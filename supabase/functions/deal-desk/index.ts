// Deal Desk Edge Function
// Handles approval workflows, discount management, and pricing governance
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Path structure: /deal-desk/[resource]/[id]/[action]
    // pathParts[0] = 'deal-desk'
    const resource = pathParts[1]; // 'requests', 'rules', 'analytics'
    const resourceId = pathParts[2];
    const action = pathParts[3]; // 'decision', 'comments'

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

      const ruleData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description || null,
        rule_type: body.ruleType || body.rule_type || 'discount',
        priority: body.priority || 1,
        order: body.order || 0,
        conditions: body.conditions || {},
        threshold_type: body.thresholdType || body.threshold_type || null,
        threshold_value: body.thresholdValue || body.threshold_value || null,
        threshold_operator: body.thresholdOperator || body.threshold_operator || null,
        approvers: body.approvers || [],
        approver_role_ids: body.approverRoleIds || body.approver_role_ids || [],
        approval_mode: body.approvalMode || body.approval_mode || 'any',
        sla_hours: body.slaHours || body.sla_hours || 24,
        escalation_hours: body.escalationHours || body.escalation_hours || null,
        escalation_approvers: body.escalationApprovers || body.escalation_approvers || [],
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        auto_approve_below_threshold:
          body.autoApproveBelowThreshold || body.auto_approve_below_threshold || false,
        requires_justification: body.requiresJustification || body.requires_justification || false,
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

      return createCorsResponse(rule, 201, req);
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
      const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        ruleType: 'rule_type',
        priority: 'priority',
        order: 'order',
        conditions: 'conditions',
        thresholdType: 'threshold_type',
        thresholdValue: 'threshold_value',
        thresholdOperator: 'threshold_operator',
        approvers: 'approvers',
        approverRoleIds: 'approver_role_ids',
        approvalMode: 'approval_mode',
        slaHours: 'sla_hours',
        escalationHours: 'escalation_hours',
        escalationApprovers: 'escalation_approvers',
        isActive: 'is_active',
        autoApproveBelowThreshold: 'auto_approve_below_threshold',
        requiresJustification: 'requires_justification',
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
        priority: body.priority || 'normal',
        original_value: body.originalValue || body.original_value || null,
        requested_value: body.requestedValue || body.requested_value || null,
        discount_percentage: body.discountPercentage || body.discount_percentage || null,
        discount_amount: body.discountAmount || body.discount_amount || null,
        justification: body.justification || null,
        context: body.context || {},
        matched_rules: body.matchedRules || body.matched_rules || [],
        current_step: 1,
        total_steps: body.totalSteps || body.total_steps || 1,
        sla_due_at: body.slaDueAt || body.sla_due_at || null,
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
        priority: 'priority',
        originalValue: 'original_value',
        requestedValue: 'requested_value',
        discountPercentage: 'discount_percentage',
        discountAmount: 'discount_amount',
        justification: 'justification',
        context: 'context',
        currentStep: 'current_step',
        totalSteps: 'total_steps',
        slaDueAt: 'sla_due_at',
        slaBreached: 'sla_breached',
        escalatedAt: 'escalated_at',
        completedAt: 'completed_at',
        finalDecision: 'final_decision',
        finalDecisionBy: 'final_decision_by',
        finalDecisionAt: 'final_decision_at',
        finalComments: 'final_comments',
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

      if (decision === 'approve') {
        // Check if this is the final step
        if (request.current_step >= request.total_steps) {
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
          updateData.final_comments = comments;
        }
      }

      // If approved and not final step, increment current_step
      if (decision === 'approve' && request.current_step < request.total_steps) {
        updateData.current_step = request.current_step + 1;
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

    // ==================== Check Approval / SLA (stubs) ====================

    // POST /deal-desk/check-approval - evaluate whether approval is needed
    // STUB: full port requires ApprovalWorkflowService.checkApprovalRequired
    // (server/services/approval-workflow-service.ts, 1000+ lines). Tracked as a
    // follow-up — until then, this returns `required: false` so deal submits
    // proceed without gating. Tighten when approval engine lands.
    if (req.method === 'POST' && resource === 'check-approval' && !resourceId) {
      return createCorsResponse({ required: false, matchedRules: [] }, 200, req);
    }

    // POST /deal-desk/check-sla - cron-triggered SLA escalation
    // Moved to pg_cron per Phase 6 US-026 — returns 501 until that job lands.
    if (req.method === 'POST' && resource === 'check-sla' && !resourceId) {
      return createCorsResponse(
        {
          error: 'SLA escalation moved to pg_cron',
          message: 'Pending Phase 6 US-026 cron migration — schedule via pg_cron instead',
        },
        501,
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
