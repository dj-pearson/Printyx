// Chart of Accounts Edge Function
// Handles accounting chart of accounts management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  toAccountColumns,
  validateNewAccount,
  isDeletable,
  SERVER_OWNED_COLUMNS,
} from '../_shared/chart-of-accounts-contract.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /chart-of-accounts, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'chart-of-accounts');
    const accountId = parts[0];
    const subResource = parts[1];

    // GET /chart-of-accounts - List all accounts
    if (req.method === 'GET' && !accountId) {
      const accountType = url.searchParams.get('type');
      const active = url.searchParams.get('active');

      let query = admin
        .from('chart_of_accounts')
        .select('*')
        .eq('tenant_id', tenantId)
        // The column is account_code; account_number does not exist, so this
        // ordering 42703'd and the whole account list failed.
        .order('account_code', { ascending: true });

      if (accountType) query = query.eq('account_type', accountType);
      if (active === 'true') query = query.eq('is_active', true);
      if (active === 'false') query = query.eq('is_active', false);

      const { data: accounts, error } = await query;

      if (error) {
        console.error('Error fetching chart of accounts:', error);
        return createCorsResponse({ error: 'Failed to fetch accounts' }, 500, req);
      }

      return createCorsResponse(accounts || [], 200, req);
    }

    // GET /chart-of-accounts/types - Get account types
    if (req.method === 'GET' && accountId === 'types') {
      return createCorsResponse(
        [
          { type: 'asset', label: 'Assets', normalBalance: 'debit' },
          { type: 'liability', label: 'Liabilities', normalBalance: 'credit' },
          { type: 'equity', label: 'Equity', normalBalance: 'credit' },
          { type: 'revenue', label: 'Revenue', normalBalance: 'credit' },
          { type: 'expense', label: 'Expenses', normalBalance: 'debit' },
        ],
        200,
        req,
      );
    }

    // GET /chart-of-accounts/summary - Get account summary with balances
    if (req.method === 'GET' && accountId === 'summary') {
      const { data: accounts } = await admin
        .from('chart_of_accounts')
        .select('account_type, current_balance')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      const summary = {
        assets: 0,
        liabilities: 0,
        equity: 0,
        revenue: 0,
        expenses: 0,
      };

      (accounts || []).forEach((acc: any) => {
        const type = acc.account_type as keyof typeof summary;
        if (summary[type] !== undefined) {
          summary[type] += Number(acc.current_balance) || 0;
        }
      });

      return createCorsResponse(
        {
          ...summary,
          netIncome: summary.revenue - summary.expenses,
          totalAssets: summary.assets,
          totalLiabilities: summary.liabilities,
          totalEquity: summary.equity,
        },
        200,
        req,
      );
    }

    // GET /chart-of-accounts/:id - Get single account
    if (req.method === 'GET' && accountId && !subResource) {
      const { data: account, error } = await admin
        .from('chart_of_accounts')
        .select('*')
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Account not found' }, 404, req);
      }

      return createCorsResponse(account, 200, req);
    }

    // POST /chart-of-accounts - Create account
    if (req.method === 'POST' && !accountId) {
      const body = await req.json().catch(() => null);

      // Four of this payload's names used to be phantom - account_number,
      // sub_type, balance and created_by - so every account create was a 42703.
      // Only account_number and balance were visible to check:phantom-cols, the
      // payload being a named variable. chart_of_accounts has no created_by.
      // The camel-to-column mapping now lives in the shared contract module.
      const { columns, ignored } = toAccountColumns(body);
      for (const owned of SERVER_OWNED_COLUMNS) delete columns[owned];

      const validation = validateNewAccount(columns);
      if (!validation.ok) {
        return createCorsResponse(
          { error: 'Invalid account', errors: validation.errors },
          400,
          req,
        );
      }

      const accountData = {
        ...columns,
        tenant_id: tenantId,
        // Balances are derived from posted journal activity, never supplied by
        // the client.
        current_balance: 0,
        debit_balance: 0,
        credit_balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: account, error } = await admin
        .from('chart_of_accounts')
        .insert(accountData)
        .select()
        .single();

      if (error) {
        console.error('Error creating account:', error);
        return createCorsResponse({ error: 'Failed to create account', details: error }, 500, req);
      }

      return createCorsResponse(ignored.length > 0 ? { ...account, ignored } : account, 201, req);
    }

    // PATCH|PUT /chart-of-accounts/:id - Update account.
    //
    // PATCH is the verb ChartOfAccounts.tsx sends; only PUT was implemented, so
    // every edit 404'd in production (and 404'd in dev too, where Express had no
    // /:id handler at all). PUT is kept as an alias.
    if ((req.method === 'PATCH' || req.method === 'PUT') && accountId && !subResource) {
      const body = await req.json().catch(() => null);

      // This used to spread the request body straight into the update. The page
      // sends camelCase, none of which are columns, so the statement failed even
      // once it was reachable.
      const { columns, ignored } = toAccountColumns(body);
      for (const owned of SERVER_OWNED_COLUMNS) delete columns[owned];

      if (Object.keys(columns).length === 0) {
        return createCorsResponse({ error: 'No updatable fields supplied', ignored }, 400, req);
      }

      const { data: account, error } = await admin
        .from('chart_of_accounts')
        .update({ ...columns, updated_at: new Date().toISOString() })
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating account:', error);
        return createCorsResponse({ error: 'Failed to update account' }, 500, req);
      }
      if (!account) {
        return createCorsResponse({ error: 'Account not found' }, 404, req);
      }

      return createCorsResponse(ignored.length > 0 ? { ...account, ignored } : account, 200, req);
    }

    // POST /chart-of-accounts/:id/deactivate - Deactivate account
    if (req.method === 'POST' && accountId && subResource === 'deactivate') {
      const { data: account, error } = await admin
        .from('chart_of_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to deactivate account' }, 500, req);
      }

      return createCorsResponse(account, 200, req);
    }

    // DELETE /chart-of-accounts/:id - Delete account (only if balance is 0)
    if (req.method === 'DELETE' && accountId) {
      // Check balance first.
      //
      // This read `balance`, which is not a column, so account.balance was
      // always undefined and the guard NEVER fired: an account holding a
      // non-zero balance could be deleted outright. That is a data-integrity
      // bug, not just a failed request. The real column is current_balance.
      const { data: account } = await admin
        .from('chart_of_accounts')
        .select('current_balance')
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
        .single();

      // A missing account is a 404. The old guard read Number(undefined) = NaN
      // for it and answered "cannot delete account with non-zero balance",
      // which is both the wrong status and a misleading reason.
      if (!account) {
        return createCorsResponse({ error: 'Account not found' }, 404, req);
      }

      if (!isDeletable(account.current_balance)) {
        return createCorsResponse(
          { error: 'Cannot delete account with non-zero balance' },
          400,
          req,
        );
      }

      const { error } = await admin
        .from('chart_of_accounts')
        .delete()
        .eq('id', accountId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete account' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Account deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in chart-of-accounts function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
