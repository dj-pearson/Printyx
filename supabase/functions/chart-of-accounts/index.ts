// Chart of Accounts Edge Function
// Handles accounting chart of accounts management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const accountId = pathParts[1];
    const subResource = pathParts[2];

    // GET /chart-of-accounts - List all accounts
    if (req.method === 'GET' && !accountId) {
      const accountType = url.searchParams.get('type');
      const active = url.searchParams.get('active');

      let query = admin
        .from('chart_of_accounts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('account_number', { ascending: true });

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
        .select('account_type, balance')
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
          summary[type] += acc.balance || 0;
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
      const body = await req.json();

      const accountData = {
        tenant_id: tenantId,
        account_number: body.accountNumber || body.account_number,
        account_name: body.accountName || body.account_name,
        account_type: body.accountType || body.account_type,
        sub_type: body.subType || body.sub_type,
        description: body.description,
        parent_account_id: body.parentAccountId || body.parent_account_id,
        is_active: body.isActive !== false,
        balance: 0,
        created_by: user.id,
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

      return createCorsResponse(account, 201, req);
    }

    // PUT /chart-of-accounts/:id - Update account
    if (req.method === 'PUT' && accountId && !subResource) {
      const body = await req.json();

      const { data: account, error } = await admin
        .from('chart_of_accounts')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update account' }, 500, req);
      }

      return createCorsResponse(account, 200, req);
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
      // Check balance first
      const { data: account } = await admin
        .from('chart_of_accounts')
        .select('balance')
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
        .single();

      if (account?.balance && account.balance !== 0) {
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
