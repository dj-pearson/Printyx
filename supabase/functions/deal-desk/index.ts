// Deal Desk Edge Function
// Handles approval workflows, discount management, and pricing governance
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    // ': undefined' not ': null' — auth.getUser takes string | undefined (CLAUDE.md).
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID from JWT metadata
    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);

    // EVERY route in this function 404'd in production before this — identical bug to
    // the one fixed in supabase/functions/seo/index.ts (EDGE-002e).
    //
    // It read the resource from pathParts[1] on the assumption that pathParts[0] was
    // 'deal-desk', i.e. that the /deal-desk prefix survived. It does not: the Coolify
    // dispatcher (server.ts) strips the function-name segment before invoking the
    // handler (stripSegments = 1), so /deal-desk/requests arrived here as /requests,
    // pathParts[1] was undefined, and every `resource === '...'` guard was false.
    //
    // Invisible locally because '/api/deal-desk' is not in crmProxies: dev serves it
    // from Express and never reaches this function. The frontend calls five of these
    // paths (/dashboard, /my-approvals, /pending, /requests, /requests/:id).
    //
    // normalizePath strips an OPTIONAL leading /deal-desk, so it resolves identically
    // whether the prefix is present or already stripped.
    const { parts } = normalizePath(url.pathname, 'deal-desk');
    const resource = parts[0]; // 'requests', 'rules', 'analytics'
    const resourceId = parts[1];
    const action = parts[2]; // 'decision', 'comments'

    // ==================== Approval Rules ====================

    // GET /deal-desk/rules - List approval rules
    if (req.method === 'GET' && resource === 'rules' && !resourceId) {
      const { data: rules, error } = await admin
        .from('approval_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false })
        .order('order', { ascending: false });

      if (error) {
        console.error('Error fetching approval rules:', error);
        return createCorsResponse({ error: 'Failed to fetch approval rules' }, 500, req);
      }

      return createCorsResponse(rules || [], 200, req);
    }

    // POST /deal-desk/rules - Create approval rule
    if (req.method === 'POST' && resource === 'rules' && !resourceId) {
      const body = await req.json();

      // AUDIT-037: eight of these were not columns, so creating an approval
      // rule 42703'd every time - the deal desk has never had a rule to match
      // against. shared/deal-desk-schema.ts is the shape: rule_name,
      // comparison_operator, approval_chain_type, escalate_to_role_id.
      //
      // Two fields are dropped rather than given columns.
      // auto_approve_below_threshold has no home, and it is a POLICY that would
      // silently approve discounts if it were ever honoured - inventing a column
      // for it here would be inventing the behaviour. requires_justification is
      // the same: approval_requests.business_justification is nullable, so
      // nothing enforces it, and a flag that no code reads is worse than an
      // absent one. Both are named in the response so a caller that sent them
      // learns they were ignored.
      const ignoredRuleFields = ['autoApproveBelowThreshold', 'requiresJustification'].filter(
        (f) => body[f] !== undefined || body[f.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())],
      );

      const ruleData = {
        tenant_id: tenantId,
        rule_name: body.name || body.ruleName || body.rule_name,
        description: body.description || null,
        rule_type: body.ruleType || body.rule_type || 'discount',
        priority: body.priority || 1,
        order: body.order || 0,
        conditions: body.conditions || {},
        threshold_type: body.thresholdType || body.threshold_type || null,
        threshold_value: body.thresholdValue || body.threshold_value || null,
        comparison_operator: body.thresholdOperator || body.threshold_operator || null,
        // approvers is the jsonb list; the camelCase alias below was a second
        // name for the same thing and folds into it.
        approvers: body.approvers || body.approverRoleIds || [],
        approval_chain_type: body.approvalMode || body.approval_mode || 'any',
        sla_hours: body.slaHours || body.sla_hours || body.escalationHours || 24,
        escalate_to_role_id: body.escalateToRoleId || body.escalate_to_role_id || null,
        escalation_enabled:
          body.escalationEnabled ??
          body.escalation_enabled ??
          Boolean(body.escalationHours || body.escalation_hours),
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: rule, error } = await admin
        .from('approval_rules')
        .insert(ruleData)
        .select()
        .single();

      if (error) {
        console.error('Error creating approval rule:', error);
        return createCorsResponse(
          { error: 'Failed to create approval rule', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(
        ignoredRuleFields.length > 0 ? { ...rule, ignored: ignoredRuleFields } : rule,
        201,
        req,
      );
    }

    // DELETE /deal-desk/rules/:id - Delete approval rule
    if (req.method === 'DELETE' && resource === 'rules' && resourceId && !action) {
      const { error } = await admin
        .from('approval_rules')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting approval rule:', error);
        return createCorsResponse({ error: 'Failed to delete approval rule' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Approval rule deleted' }, 200, req);
    }

    // PUT /deal-desk/rules/:id - Update approval rule
    if (req.method === 'PUT' && resource === 'rules' && resourceId && !action) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map updatable fields
      // Same correction as the create above: these are the columns
      // shared/deal-desk-schema.ts declares. autoApproveBelowThreshold and
      // requiresJustification are gone because nothing stores or reads them.
      const fieldMap: Record<string, string> = {
        name: 'rule_name',
        ruleName: 'rule_name',
        description: 'description',
        ruleType: 'rule_type',
        priority: 'priority',
        order: 'order',
        conditions: 'conditions',
        thresholdType: 'threshold_type',
        thresholdValue: 'threshold_value',
        thresholdOperator: 'comparison_operator',
        approvers: 'approvers',
        approverRoleIds: 'approvers',
        approvalMode: 'approval_chain_type',
        slaHours: 'sla_hours',
        escalationEnabled: 'escalation_enabled',
        escalateToRoleId: 'escalate_to_role_id',
        isActive: 'is_active',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined) {
          updateData[snakeKey] = body[camelKey];
        } else if (body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[snakeKey];
        }
      }

      const { data: rule, error } = await admin
        .from('approval_rules')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating approval rule:', error);
        return createCorsResponse({ error: 'Failed to update approval rule' }, 500, req);
      }

      if (!rule) {
        return createCorsResponse({ error: 'Rule not found' }, 404, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // ==================== Approval Requests ====================

    // GET /deal-desk/requests - List approval requests with filters
    if (req.method === 'GET' && resource === 'requests' && !resourceId) {
      const status = url.searchParams.get('status');
      const requestedBy =
        url.searchParams.get('requestedBy') || url.searchParams.get('requested_by');
      const dealId = url.searchParams.get('dealId') || url.searchParams.get('deal_id');
      const quoteId = url.searchParams.get('quoteId') || url.searchParams.get('quote_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('approval_requests')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('submitted_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (requestedBy) {
        query = query.eq('requested_by', requestedBy);
      }

      if (dealId) {
        query = query.eq('deal_id', dealId);
      }

      if (quoteId) {
        query = query.eq('quote_id', quoteId);
      }

      const { data: requests, error, count } = await query;

      if (error) {
        console.error('Error fetching approval requests:', error);
        return createCorsResponse({ error: 'Failed to fetch approval requests' }, 500, req);
      }

      return createCorsResponse(
        {
          data: requests || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /deal-desk/requests/:id - Get single request with related data
    if (req.method === 'GET' && resource === 'requests' && resourceId && !action) {
      const { data: request, error } = await admin
        .from('approval_requests')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !request) {
        console.error('Error fetching approval request:', error);
        return createCorsResponse({ error: 'Approval request not found' }, 404, req);
      }

      // Fetch related deal if exists
      let dealData = null;
      if (request.deal_id) {
        const { data: deal } = await admin
          .from('deals')
          .select('*')
          .eq('id', request.deal_id)
          .single();
        dealData = deal;
      }

      // Fetch related quote if exists
      let quoteData = null;
      if (request.quote_id) {
        const { data: quote } = await admin
          .from('quotes')
          .select('*')
          .eq('id', request.quote_id)
          .single();
        quoteData = quote;
      }

      // Fetch comments
      const { data: comments } = await admin
        .from('approval_comments')
        .select('*')
        .eq('approval_request_id', resourceId)
        .order('created_at', { ascending: true });

      return createCorsResponse(
        {
          ...request,
          deal: dealData,
          quote: quoteData,
          comments: comments || [],
        },
        200,
        req,
      );
    }

    // POST /deal-desk/requests - Create approval request
    if (req.method === 'POST' && resource === 'requests' && !resourceId) {
      const body = await req.json();

      // WF-C-03: build the chain HERE rather than taking one from the caller.
      // check-approval already matches rules and its own comment says chain
      // building "belongs in the actual request-creation flow"; this is that
      // flow. It matters beyond tidiness: a client-supplied approval_chain is a
      // client-supplied answer to "who may approve this", and an empty one makes
      // the first decision final (see the decision handler's totalSteps).
      let approvalChain = body.approvalChain ?? body.approval_chain;
      let slaDeadline = body.slaDueAt ?? body.sla_due_at ?? null;
      if (!Array.isArray(approvalChain) || approvalChain.length === 0) {
        const { data: activeRules } = await admin
          .from('approval_rules')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .order('order', { ascending: false });

        const ctx: ApprovalCheckContext = {
          discountPercentage: numberOrUndefined(
            body.discountPercentage ?? body.discount_percentage,
          ),
          discountAmount: numberOrUndefined(body.discountAmount ?? body.discount_amount),
          margin: numberOrUndefined(body.margin ?? body.proposedMargin ?? body.proposed_margin),
          dealValue: numberOrUndefined(body.dealValue ?? body.deal_value),
          totalContractValue: numberOrUndefined(
            body.totalContractValue ?? body.total_contract_value,
          ),
          paymentTermsDays: numberOrUndefined(body.paymentTermsDays ?? body.payment_terms_days),
        };

        const matched = (activeRules ?? []).filter((rule) => evaluateApprovalRule(rule, ctx));
        approvalChain = buildApprovalChain(matched);

        // The SLA is the tightest matched rule's, because a request that has to
        // clear two rules is due when the SOONER of them says it is.
        const slaHours = matched
          .map((r) => Number(r.sla_hours))
          .filter((h) => Number.isFinite(h) && h > 0);
        if (!slaDeadline && slaHours.length > 0) {
          slaDeadline = new Date(Date.now() + Math.min(...slaHours) * 3600_000).toISOString();
        }
      }

      // Fetch user details for the request
      const { data: userData } = await admin
        .from('users')
        .select('first_name, last_name, role_id')
        .eq('id', user.id)
        .single();

      const userName = userData
        ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
        : '';

      // Fetch user role name if available
      let roleName = 'User';
      if (userData?.role_id) {
        const { data: roleData } = await admin
          .from('roles')
          .select('name')
          .eq('id', userData.role_id)
          .single();
        if (roleData) {
          roleName = roleData.name;
        }
      }

      const requestData = {
        tenant_id: tenantId,
        request_type: body.requestType || body.request_type || 'discount',
        deal_id: body.dealId || body.deal_id || null,
        quote_id: body.quoteId || body.quote_id || null,
        requested_by: user.id,
        requested_by_name: userName,
        requested_by_role: roleName,
        status: 'pending',
        // AUDIT-037: ten of these were not columns, so submitting a request
        // for approval 42703'd - the deal desk could neither hold a rule nor
        // take a request. The real names are original_price, proposed_price,
        // business_justification, current_approval_level and sla_deadline.
        //
        // priority, a matched-rule list and a step total are dropped. There is no
        // priority on a request (it is a property of the RULE that matched);
        // the chain lives in approval_chain, whose length is the step count, so
        // storing a second copy invites the two to disagree; and nothing reads
        // a matched-rules list.
        original_price: body.originalValue || body.original_value || null,
        proposed_price: body.requestedValue || body.requested_value || null,
        discount_percentage: body.discountPercentage || body.discount_percentage || null,
        discount_amount: body.discountAmount || body.discount_amount || null,
        business_justification: body.justification || null,
        approval_chain: approvalChain ?? [],
        current_approval_level: 1,
        sla_deadline: slaDeadline,
        // WF-C-03: the margins the guardrail actually blocked on. Both are real
        // columns and neither was written, so a reviewer saw a discount request
        // with no margin on it - the number the policy is about.
        original_margin: body.originalMargin ?? body.original_margin ?? null,
        proposed_margin: body.proposedMargin ?? body.proposed_margin ?? null,
        request_title: body.requestTitle ?? body.request_title ?? null,
        request_description: body.requestDescription ?? body.request_description ?? null,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: request, error } = await admin
        .from('approval_requests')
        .insert(requestData)
        .select()
        .single();

      if (error) {
        console.error('Error creating approval request:', error);
        return createCorsResponse(
          { error: 'Failed to create approval request', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(request, 201, req);
    }

    // PUT /deal-desk/requests/:id - Update approval request
    if (req.method === 'PUT' && resource === 'requests' && resourceId && !action) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        status: 'status',
        originalValue: 'original_price',
        requestedValue: 'proposed_price',
        discountPercentage: 'discount_percentage',
        discountAmount: 'discount_amount',
        justification: 'business_justification',
        currentStep: 'current_approval_level',
        slaDueAt: 'sla_deadline',
        slaBreached: 'sla_breached',
        escalatedAt: 'escalated_at',
        completedAt: 'completed_at',
        finalDecision: 'final_decision',
        finalDecisionBy: 'final_decision_by',
        finalDecisionAt: 'final_decision_at',
        finalComments: 'final_decision_comments',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined) {
          updateData[snakeKey] = body[camelKey];
        } else if (body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[snakeKey];
        }
      }

      const { data: request, error } = await admin
        .from('approval_requests')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating approval request:', error);
        return createCorsResponse({ error: 'Failed to update approval request' }, 500, req);
      }

      if (!request) {
        return createCorsResponse({ error: 'Request not found' }, 404, req);
      }

      return createCorsResponse(request, 200, req);
    }

    // POST /deal-desk/requests/:id/decision - Make approval decision
    if (req.method === 'POST' && resource === 'requests' && resourceId && action === 'decision') {
      const body = await req.json();
      const { decision, comments } = body;

      if (!['approve', 'reject', 'request_changes'].includes(decision)) {
        return createCorsResponse(
          { error: 'Invalid decision. Must be approve, reject, or request_changes' },
          400,
          req,
        );
      }

      // Fetch the current request
      const { data: request, error: fetchError } = await admin
        .from('approval_requests')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !request) {
        return createCorsResponse({ error: 'Approval request not found' }, 404, req);
      }

      // Determine new status based on decision
      let newStatus = request.status;
      let completedAt = null;

      // AUDIT-037: the step counter is current_approval_level, and the number
      // of steps is the length of approval_chain - there is no total_steps
      // column, and keeping a second copy of a length is how the two come to
      // disagree. An empty chain means a single step.
      const totalSteps = Array.isArray(request.approval_chain)
        ? Math.max(request.approval_chain.length, 1)
        : 1;
      const currentStep = Number(request.current_approval_level ?? 1);

      if (decision === 'approve') {
        // Check if this is the final step
        if (currentStep >= totalSteps) {
          newStatus = 'approved';
          completedAt = new Date().toISOString();
        } else {
          newStatus = 'in_review';
        }
      } else if (decision === 'reject') {
        newStatus = 'rejected';
        completedAt = new Date().toISOString();
      } else if (decision === 'request_changes') {
        newStatus = 'changes_requested';
      }

      // Update the request
      const updateData: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (completedAt) {
        updateData.completed_at = completedAt;
        updateData.final_decision = decision;
        updateData.final_decision_by = user.id;
        updateData.final_decision_at = completedAt;
        if (comments) {
          updateData.final_decision_comments = comments;
        }
      }

      // If approved and not the final step, advance the level
      if (decision === 'approve' && currentStep < totalSteps) {
        updateData.current_approval_level = currentStep + 1;
      }

      const { data: updatedRequest, error } = await admin
        .from('approval_requests')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error processing decision:', error);
        return createCorsResponse({ error: 'Failed to process decision' }, 500, req);
      }

      // WF-C-04: stamp the PROPOSAL on a final approve, so the send guardrail has
      // something server-side to read.
      //
      // Before this, approving only moved approval_requests.status, and the
      // guardrail in supabase/functions/proposals trusted `body.approved` - which
      // QuoteBuilder set from the SENDER'S OWN isManager flag. So a rep whose
      // exception had genuinely been approved still could not send, while anyone
      // who could post JSON could send anything.
      //
      // Only on a FINAL approve: an in_review request has cleared one step of its
      // chain and is not approved yet. And never on reject or request_changes -
      // the stamp is cleared there, because a request that swung back is an
      // exception that no longer holds.
      if (request.quote_id) {
        const stamp =
          newStatus === 'approved'
            ? { pricing_approval_id: resourceId, pricing_approved_at: completedAt }
            : decision === 'approve'
              ? null
              : { pricing_approval_id: null, pricing_approved_at: null };
        if (stamp) {
          const { error: stampError } = await admin
            .from('proposals')
            .update(stamp)
            .eq('id', request.quote_id)
            .eq('tenant_id', tenantId);
          if (stampError) {
            // The decision itself is recorded; losing the stamp means the rep is
            // still blocked, which is the safe direction and is worth a log.
            console.error('Error stamping proposal pricing approval:', stampError.message);
          }
        }
      }

      // Add a comment for the decision
      if (comments) {
        const { data: userData } = await admin
          .from('users')
          .select('first_name, last_name, role_id')
          .eq('id', user.id)
          .single();

        const authorName = userData
          ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
          : '';

        let authorRole = 'User';
        if (userData?.role_id) {
          const { data: roleData } = await admin
            .from('roles')
            .select('name')
            .eq('id', userData.role_id)
            .single();
          if (roleData) {
            authorRole = roleData.name;
          }
        }

        await admin.from('approval_comments').insert({
          tenant_id: tenantId,
          approval_request_id: resourceId,
          comment_text: `[${decision.toUpperCase()}] ${comments}`,
          author_id: user.id,
          author_name: authorName,
          author_role: authorRole,
          is_internal: false,
          created_at: new Date().toISOString(),
        });
      }

      return createCorsResponse(updatedRequest, 200, req);
    }

    // GET /deal-desk/requests/:id/comments - Get comments for a request
    if (req.method === 'GET' && resource === 'requests' && resourceId && action === 'comments') {
      const { data: comments, error } = await admin
        .from('approval_comments')
        .select('*')
        .eq('approval_request_id', resourceId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        return createCorsResponse({ error: 'Failed to fetch comments' }, 500, req);
      }

      return createCorsResponse(comments || [], 200, req);
    }

    // POST /deal-desk/requests/:id/comments - Add comment to request
    if (req.method === 'POST' && resource === 'requests' && resourceId && action === 'comments') {
      const body = await req.json();
      const { commentText, isInternal } = body;

      if (!commentText) {
        return createCorsResponse({ error: 'Comment text is required' }, 400, req);
      }

      // Fetch user details
      const { data: userData } = await admin
        .from('users')
        .select('first_name, last_name, role_id')
        .eq('id', user.id)
        .single();

      const authorName = userData
        ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
        : '';

      let authorRole = 'User';
      if (userData?.role_id) {
        const { data: roleData } = await admin
          .from('roles')
          .select('name')
          .eq('id', userData.role_id)
          .single();
        if (roleData) {
          authorRole = roleData.name;
        }
      }

      const commentData = {
        tenant_id: tenantId,
        approval_request_id: resourceId,
        comment_text: commentText,
        author_id: user.id,
        author_name: authorName,
        author_role: authorRole,
        is_internal: isInternal || false,
        created_at: new Date().toISOString(),
      };

      const { data: comment, error } = await admin
        .from('approval_comments')
        .insert(commentData)
        .select()
        .single();

      if (error) {
        console.error('Error adding comment:', error);
        return createCorsResponse({ error: 'Failed to add comment', details: error }, 500, req);
      }

      return createCorsResponse(comment, 201, req);
    }

    // ==================== Analytics ====================

    // GET /deal-desk/analytics - Get deal desk analytics
    if (req.method === 'GET' && resource === 'analytics') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get pending requests count
      const { count: pendingCount } = await admin
        .from('approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'in_review']);

      // Get SLA breached count
      const { count: slaBreachedCount } = await admin
        .from('approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('sla_breached', true)
        .in('status', ['pending', 'in_review']);

      // Get approved count (last 30 days)
      const { count: approvedCount } = await admin
        .from('approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .gte('submitted_at', thirtyDaysAgo.toISOString());

      // Get rejected count (last 30 days)
      const { count: rejectedCount } = await admin
        .from('approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'rejected')
        .gte('submitted_at', thirtyDaysAgo.toISOString());

      // Calculate approval rate
      const totalDecisions = (approvedCount || 0) + (rejectedCount || 0);
      const approvalRate = totalDecisions > 0 ? ((approvedCount || 0) / totalDecisions) * 100 : 0;

      // Get recent completed requests for average time calculation
      const { data: recentCompleted } = await admin
        .from('approval_requests')
        .select('submitted_at, completed_at')
        .eq('tenant_id', tenantId)
        .in('status', ['approved', 'rejected'])
        .gte('submitted_at', thirtyDaysAgo.toISOString())
        .not('completed_at', 'is', null);

      let avgApprovalTimeHours = 0;
      if (recentCompleted && recentCompleted.length > 0) {
        const totalHours = recentCompleted.reduce((sum, req) => {
          if (!req.completed_at || !req.submitted_at) return sum;
          const hours =
            (new Date(req.completed_at).getTime() - new Date(req.submitted_at).getTime()) /
            (1000 * 60 * 60);
          return sum + hours;
        }, 0);
        avgApprovalTimeHours = totalHours / recentCompleted.length;
      }

      // Get requests by type
      const { data: requestsByType } = await admin
        .from('approval_requests')
        .select('request_type')
        .eq('tenant_id', tenantId)
        .gte('submitted_at', thirtyDaysAgo.toISOString());

      const typeCounts: Record<string, number> = {};
      if (requestsByType) {
        requestsByType.forEach((req) => {
          const type = req.request_type || 'other';
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
      }

      return createCorsResponse(
        {
          totalPending: pendingCount || 0,
          slaBreached: slaBreachedCount || 0,
          approvalRate: Math.round(approvalRate * 100) / 100,
          avgApprovalTimeHours: Math.round(avgApprovalTimeHours * 10) / 10,
          recentApproved: approvedCount || 0,
          recentRejected: rejectedCount || 0,
          requestsByType: typeCounts,
          periodDays: 30,
        },
        200,
        req,
      );
    }

    // ==================== My Approvals ====================

    // GET /deal-desk/my-approvals - Requests pending my approval
    // Ports the JS-filtered version from ApprovalWorkflowService.getPendingApprovalsForUser —
    // query pending/in_review requests for the tenant, then filter where the
    // approval_chain JSON contains this user as a pending approver.
    if (req.method === 'GET' && resource === 'my-approvals' && !resourceId) {
      const { data: requests, error } = await admin
        .from('approval_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'in_review']);

      if (error) {
        console.error('Error fetching my-approvals:', error);
        return createCorsResponse({ error: 'Failed to fetch pending approvals' }, 500, req);
      }

      const mine = (requests || []).filter((r: Record<string, unknown>) => {
        const chain = r.approval_chain;
        if (!Array.isArray(chain)) return false;
        return chain.some(
          (m: { approverId?: string; approver_id?: string; status?: string }) =>
            (m.approverId === user.id || m.approver_id === user.id) && m.status === 'pending',
        );
      });

      return createCorsResponse(mine, 200, req);
    }

    // ==================== Check Approval / SLA ====================

    // POST /deal-desk/check-approval - evaluate whether approval is needed
    //
    // Ported from the deleted ApprovalWorkflowService.checkApprovalRequired.
    // Chain building (buildApprovalChain) is still deferred — that step belongs
    // in the actual request-creation flow, not in a read-only pre-check.
    if (req.method === 'POST' && resource === 'check-approval' && !resourceId) {
      const ctx = (await req.json().catch(() => ({}))) as ApprovalCheckContext;

      const { data: rules, error: rulesError } = await admin
        .from('approval_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('order', { ascending: false });

      if (rulesError) {
        console.error('Error fetching approval rules:', rulesError);
        return createCorsResponse({ error: 'Failed to evaluate approval' }, 500, req);
      }

      const matchedRules = (rules || []).filter((rule) => evaluateApprovalRule(rule, ctx));

      return createCorsResponse(
        {
          required: matchedRules.length > 0,
          matchedRules,
        },
        200,
        req,
      );
    }

    // POST /deal-desk/check-sla - mark any approval_requests whose sla_deadline
    // has passed as breached. Returns the count of newly-breached rows.
    //
    // This is the single-tenant edge-function version of the job; Phase 6
    // US-026 will add a pg_cron entry that calls this per-tenant on a
    // schedule. The dispatch wrapper there will pass INTERNAL_CRON_TOKEN for
    // auth. For now: safe to call ad-hoc from the UI or a manual curl.
    if (req.method === 'POST' && resource === 'check-sla' && !resourceId) {
      const nowIso = new Date().toISOString();

      const { data: overdue, error: fetchErr } = await admin
        .from('approval_requests')
        .select('id, deal_id, quote_id, current_approval_level, approval_chain')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'in_review'])
        .lte('sla_deadline', nowIso)
        .eq('sla_breached', false)
        .limit(500);

      if (fetchErr) {
        console.error('check-sla fetch failed:', fetchErr);
        return createCorsResponse(
          { error: 'Failed to scan overdue approvals', details: fetchErr },
          500,
          req,
        );
      }

      const overdueRows = overdue ?? [];
      if (overdueRows.length === 0) {
        return createCorsResponse(
          { breached: 0, checkedAt: nowIso, message: 'No SLA breaches' },
          200,
          req,
        );
      }

      // Mark all in one UPDATE — cleaner than per-row loop and atomic.
      const ids = overdueRows.map((r) => r.id as string);
      const { error: updErr } = await admin
        .from('approval_requests')
        .update({ sla_breached: true, escalated_at: nowIso, updated_at: nowIso })
        .in('id', ids)
        .eq('tenant_id', tenantId);

      if (updErr) {
        console.error('check-sla update failed:', updErr);
        return createCorsResponse({ error: 'Failed to mark breaches', details: updErr }, 500, req);
      }

      // Notification dispatch (email, push) is Phase 3+ territory. For now
      // we return the breach summary so the caller (cron wrapper or UI)
      // can surface it. When email lands, call the notification service
      // here with `overdueRows` as input.
      return createCorsResponse(
        {
          breached: ids.length,
          checkedAt: nowIso,
          breachedIds: ids,
          followUp: 'Notification dispatch — Phase 3+ email-marketing / notifications service',
        },
        200,
        req,
      );
    }

    // ==================== Analytics: Discounts ====================

    // GET /deal-desk/analytics/discounts
    if (req.method === 'GET' && resource === 'analytics' && resourceId === 'discounts') {
      const period = url.searchParams.get('period');
      const startDate = url.searchParams.get('startDate') || url.searchParams.get('start_date');
      const endDate = url.searchParams.get('endDate') || url.searchParams.get('end_date');

      let query = admin
        .from('discount_analytics')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('period_start', { ascending: false });

      if (period) query = query.eq('period_type', period);
      if (startDate) query = query.gte('period_start', startDate);
      if (endDate) query = query.lte('period_end', endDate);

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching discount analytics:', error);
        return createCorsResponse({ error: 'Failed to fetch discount analytics' }, 500, req);
      }
      return createCorsResponse(data || [], 200, req);
    }

    // ==================== Delegations ====================

    // GET /deal-desk/delegations - requests where current user is delegator OR delegate
    if (req.method === 'GET' && resource === 'delegations' && !resourceId) {
      const { data, error } = await admin
        .from('approval_delegations')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`delegator_id.eq.${user.id},delegate_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching delegations:', error);
        return createCorsResponse({ error: 'Failed to fetch delegations' }, 500, req);
      }
      return createCorsResponse(data || [], 200, req);
    }

    // POST /deal-desk/delegations - create delegation
    if (req.method === 'POST' && resource === 'delegations' && !resourceId) {
      const body = await req.json();

      const insertRow = {
        tenant_id: tenantId,
        delegator_id: user.id,
        delegate_id: body.delegateId || body.delegate_id,
        delegation_type: body.delegationType || body.delegation_type || 'full',
        approval_rule_ids: body.approvalRuleIds || body.approval_rule_ids || null,
        max_discount_percentage: body.maxDiscountPercentage ?? body.max_discount_percentage ?? null,
        max_deal_value: body.maxDealValue ?? body.max_deal_value ?? null,
        start_date: body.startDate || body.start_date,
        end_date: body.endDate || body.end_date,
        reason: body.reason ?? null,
        is_active: true,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await admin
        .from('approval_delegations')
        .insert(insertRow)
        .select()
        .single();

      if (error) {
        console.error('Error creating delegation:', error);
        return createCorsResponse(
          { error: 'Failed to create delegation', details: error },
          500,
          req,
        );
      }
      return createCorsResponse(data, 201, req);
    }

    // PATCH /deal-desk/delegations/:id/deactivate
    if (
      req.method === 'PATCH' &&
      resource === 'delegations' &&
      resourceId &&
      action === 'deactivate'
    ) {
      const { data, error } = await admin
        .from('approval_delegations')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .eq('delegator_id', user.id) // only the delegator can deactivate
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error deactivating delegation:', error);
        return createCorsResponse({ error: 'Failed to deactivate delegation' }, 500, req);
      }
      if (!data) {
        return createCorsResponse({ error: 'Delegation not found' }, 404, req);
      }
      return createCorsResponse(data, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in deal-desk function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ==================== Approval Evaluation Helpers ====================
// Ported from server/services/approval-workflow-service.ts (deleted).

interface ApprovalCheckContext {
  dealId?: string;
  quoteId?: string;
  discountPercentage?: number;
  discountAmount?: number;
  margin?: number;
  dealValue?: number;
  totalContractValue?: number;
  paymentTermsDays?: number;
  customFields?: Record<string, any>;
}

interface ApprovalCondition {
  field: string;
  operator: string;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

// Maps approval_rules.threshold_type → which context field to compare.
const THRESHOLD_FIELD_MAP: Record<string, keyof ApprovalCheckContext> = {
  discount_percentage: 'discountPercentage',
  discount_amount: 'discountAmount',
  margin_below: 'margin',
  deal_value: 'dealValue',
  total_contract_value: 'totalContractValue',
  payment_terms_days: 'paymentTermsDays',
};

function evaluateApprovalRule(rule: any, ctx: ApprovalCheckContext): boolean {
  const contextField = THRESHOLD_FIELD_MAP[rule.threshold_type];
  if (!contextField) return false;

  const contextValue = ctx[contextField] as number | undefined;
  if (contextValue === undefined || contextValue === null) return false;

  const threshold = Number(rule.threshold_value);
  if (!Number.isFinite(threshold)) return false;

  if (!compareValues(contextValue, threshold, rule.comparison_operator)) {
    return false;
  }

  const conditions = rule.conditions as ApprovalCondition[] | null | undefined;
  if (Array.isArray(conditions) && conditions.length > 0) {
    return evaluateConditionList(conditions, ctx);
  }

  return true;
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * One approval step per matched rule, in the order the rules were matched -
 * which is priority then `order`, the same sequence the rules list uses.
 *
 * A rule with no approvers still produces a step: the rule matched, so somebody
 * has to look at it, and dropping the step would silently shorten the chain and
 * make an earlier decision final.
 */
function buildApprovalChain(matchedRules: any[]): Array<Record<string, unknown>> {
  return matchedRules.map((rule, index) => ({
    level: index + 1,
    ruleId: rule.id,
    ruleName: rule.rule_name,
    approvers: Array.isArray(rule.approvers) ? rule.approvers : [],
    slaHours: Number.isFinite(Number(rule.sla_hours)) ? Number(rule.sla_hours) : null,
    status: 'pending',
  }));
}

function compareValues(value: number, threshold: number, operator: string): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    case '==':
    case '=':
      return value === threshold;
    case '!=':
      return value !== threshold;
    default:
      return false;
  }
}

function evaluateConditionList(
  conditions: ApprovalCondition[],
  ctx: ApprovalCheckContext,
): boolean {
  // Mirrors the deleted Express service: fold left with AND/OR as declared on
  // the *previous* condition. First fold starts in AND mode (identity=true).
  let result = true;
  let op: 'AND' | 'OR' = 'AND';

  for (const cond of conditions) {
    const met = evaluateSingleCondition(cond, ctx);
    result = op === 'AND' ? result && met : result || met;
    op = cond.logicalOperator || 'AND';
  }

  return result;
}

function evaluateSingleCondition(cond: ApprovalCondition, ctx: ApprovalCheckContext): boolean {
  const fromCtx = (ctx as any)[cond.field];
  const fromCustom = ctx.customFields?.[cond.field];
  const value = fromCtx !== undefined ? fromCtx : fromCustom;
  if (value === undefined || value === null) return false;

  switch (cond.operator) {
    case 'equals':
      return value === cond.value;
    case 'not_equals':
      return value !== cond.value;
    case 'contains':
      return String(value).includes(String(cond.value));
    case 'in_list':
      return Array.isArray(cond.value) && cond.value.includes(value);
    case 'greater_than':
      return Number(value) > Number(cond.value);
    case 'less_than':
      return Number(value) < Number(cond.value);
    default:
      return false;
  }
}
