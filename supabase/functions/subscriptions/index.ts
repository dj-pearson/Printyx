// Subscriptions Edge Function
// Handles subscription management for tenants
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

export default async function handler(req: Request) {
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    // Extract tenant ID from user metadata
    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Route parsing:
    // /subscriptions -> pathParts = ['subscriptions']
    // /subscriptions/:id -> pathParts = ['subscriptions', ':id']
    // /subscriptions/:id/cancel -> pathParts = ['subscriptions', ':id', 'cancel']
    // /subscriptions/plans -> pathParts = ['subscriptions', 'plans']
    // /subscriptions/usage -> pathParts = ['subscriptions', 'usage']
    // /subscriptions/invoices -> pathParts = ['subscriptions', 'invoices']
    // /subscriptions/change-plan -> pathParts = ['subscriptions', 'change-plan']
    // /subscriptions/features -> pathParts = ['subscriptions', 'features']

    const secondSegment = pathParts[1];
    const thirdSegment = pathParts[2];

    // ========================================================================
    // GET /subscriptions/plans - List available subscription plans
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'plans') {
      const { data: plans, error } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('is_visible', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching subscription plans:', error);
        return createCorsResponse({ error: 'Failed to fetch subscription plans' }, 500, req);
      }

      return createCorsResponse({ data: plans || [] }, 200, req);
    }

    // ========================================================================
    // GET /subscriptions/usage - Get usage metrics against limits
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'usage') {
      // Get the current subscription for the tenant
      const { data: subscription, error: subError } = await admin
        .from('tenant_subscriptions')
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error fetching subscription for usage:', subError);
        return createCorsResponse({ error: 'Failed to fetch subscription' }, 500, req);
      }

      if (!subscription) {
        return createCorsResponse({ error: 'No active subscription found' }, 404, req);
      }

      // Get current usage metrics
      const now = new Date();
      const periodStart = subscription.current_period_start || now.toISOString();
      const periodEnd = subscription.current_period_end || now.toISOString();

      const { data: usageMetrics, error: usageError } = await admin
        .from('usage_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Calculate usage against limits
      const plan = subscription.plan;
      const customLimits = subscription.custom_limits || {};

      const limits = {
        maxUsers: customLimits.maxUsers ?? plan?.max_users ?? -1,
        maxStorage: customLimits.maxStorage ?? plan?.max_storage ?? -1,
        maxApiCalls: customLimits.maxApiCalls ?? plan?.max_api_calls ?? -1,
        maxLocations: customLimits.maxLocations ?? plan?.max_locations ?? -1,
        maxBusinessRecords: customLimits.maxBusinessRecords ?? plan?.max_business_records ?? -1,
      };

      const currentUsage = {
        activeUsers: usageMetrics?.active_users ?? 0,
        totalUsers: usageMetrics?.total_users ?? 0,
        storageUsedMb: usageMetrics?.storage_used_mb ?? 0,
        apiCalls: usageMetrics?.api_calls ?? 0,
        activeLocations: usageMetrics?.active_locations ?? 0,
        businessRecords: usageMetrics?.business_records ?? 0,
      };

      // Calculate percentage used for each metric
      const calculatePercentage = (used: number, limit: number): number => {
        if (limit === -1) return 0; // Unlimited
        if (limit === 0) return 100; // No allowance
        return Math.min(100, Math.round((used / limit) * 100));
      };

      const usageSummary = {
        users: {
          used: currentUsage.totalUsers,
          limit: limits.maxUsers,
          percentage: calculatePercentage(currentUsage.totalUsers, limits.maxUsers),
          isUnlimited: limits.maxUsers === -1,
        },
        storage: {
          usedMb: currentUsage.storageUsedMb,
          usedGb: Math.round((currentUsage.storageUsedMb / 1024) * 100) / 100,
          limitGb: limits.maxStorage,
          percentage: calculatePercentage(currentUsage.storageUsedMb / 1024, limits.maxStorage),
          isUnlimited: limits.maxStorage === -1,
        },
        apiCalls: {
          used: currentUsage.apiCalls,
          limit: limits.maxApiCalls,
          percentage: calculatePercentage(currentUsage.apiCalls, limits.maxApiCalls),
          isUnlimited: limits.maxApiCalls === -1,
        },
        locations: {
          used: currentUsage.activeLocations,
          limit: limits.maxLocations,
          percentage: calculatePercentage(currentUsage.activeLocations, limits.maxLocations),
          isUnlimited: limits.maxLocations === -1,
        },
        businessRecords: {
          used: currentUsage.businessRecords,
          limit: limits.maxBusinessRecords,
          percentage: calculatePercentage(currentUsage.businessRecords, limits.maxBusinessRecords),
          isUnlimited: limits.maxBusinessRecords === -1,
        },
      };

      return createCorsResponse(
        {
          subscription: {
            id: subscription.id,
            planName: plan?.name,
            status: subscription.status,
            billingCycle: subscription.billing_cycle,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
          },
          usage: usageSummary,
          raw: usageMetrics,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // GET /subscriptions/invoices - Get subscription invoices
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'invoices') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;
      const status = url.searchParams.get('status');

      let query = admin
        .from('billing_history')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('invoice_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: invoices, error, count } = await query;

      if (error) {
        console.error('Error fetching subscription invoices:', error);
        return createCorsResponse({ error: 'Failed to fetch invoices' }, 500, req);
      }

      return createCorsResponse(
        {
          data: invoices || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // GET /subscriptions/features - Get features for current plan
    // ========================================================================
    if (req.method === 'GET' && secondSegment === 'features') {
      // Get the current subscription
      const { data: subscription, error: subError } = await admin
        .from('tenant_subscriptions')
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error fetching subscription for features:', subError);
        return createCorsResponse({ error: 'Failed to fetch subscription' }, 500, req);
      }

      if (!subscription) {
        return createCorsResponse({ error: 'No active subscription found' }, 404, req);
      }

      // Get all features
      const { data: allFeatures, error: featuresError } = await admin
        .from('subscription_features')
        .select('*')
        .order('display_order', { ascending: true });

      if (featuresError) {
        console.error('Error fetching features:', featuresError);
        return createCorsResponse({ error: 'Failed to fetch features' }, 500, req);
      }

      // Get the feature slugs included in the plan
      const planFeatures = subscription.plan?.features || [];

      // Mark which features are enabled for this plan
      const featuresWithStatus = (allFeatures || []).map((feature) => ({
        ...feature,
        isEnabled: planFeatures.includes(feature.slug) || feature.is_core,
      }));

      return createCorsResponse(
        {
          planName: subscription.plan?.name,
          planSlug: subscription.plan?.slug,
          features: featuresWithStatus,
          enabledFeatureSlugs: planFeatures,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // POST /subscriptions/change-plan - Change to a different plan
    // ========================================================================
    if (req.method === 'POST' && secondSegment === 'change-plan') {
      const body = await req.json();
      const newPlanId = body.planId || body.plan_id;
      const billingCycle = body.billingCycle || body.billing_cycle;

      if (!newPlanId) {
        return createCorsResponse({ error: 'Plan ID is required' }, 400, req);
      }

      // Get the current subscription
      const { data: currentSubscription, error: currentSubError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (currentSubError && currentSubError.code !== 'PGRST116') {
        console.error('Error fetching current subscription:', currentSubError);
        return createCorsResponse({ error: 'Failed to fetch current subscription' }, 500, req);
      }

      // Get the new plan
      const { data: newPlan, error: planError } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('id', newPlanId)
        .eq('is_active', true)
        .single();

      if (planError || !newPlan) {
        return createCorsResponse({ error: 'Invalid plan ID' }, 400, req);
      }

      const selectedBillingCycle = billingCycle || currentSubscription?.billing_cycle || 'monthly';
      const newAmount =
        selectedBillingCycle === 'annual' ? newPlan.annual_price : newPlan.monthly_price;

      // Calculate new period end
      const now = new Date();
      const periodEnd = new Date(now);
      if (selectedBillingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      if (currentSubscription) {
        // Update existing subscription
        const fromPlanId = currentSubscription.plan_id;

        const { data: updatedSubscription, error: updateError } = await admin
          .from('tenant_subscriptions')
          .update({
            plan_id: newPlanId,
            billing_cycle: selectedBillingCycle,
            amount: newAmount,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', currentSubscription.id)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          return createCorsResponse({ error: 'Failed to change plan' }, 500, req);
        }

        // Log the plan change event
        await admin.from('subscription_events').insert({
          tenant_id: tenantId,
          subscription_id: currentSubscription.id,
          event_type: 'plan_changed',
          user_id: user.id,
          from_plan: fromPlanId,
          to_plan: newPlanId,
          data: {
            fromBillingCycle: currentSubscription.billing_cycle,
            toBillingCycle: selectedBillingCycle,
            fromAmount: currentSubscription.amount,
            toAmount: newAmount,
          },
          created_at: now.toISOString(),
        });

        return createCorsResponse(
          {
            message: 'Plan changed successfully',
            subscription: updatedSubscription,
          },
          200,
          req,
        );
      } else {
        // Create new subscription
        const { data: newSubscription, error: createError } = await admin
          .from('tenant_subscriptions')
          .insert({
            tenant_id: tenantId,
            plan_id: newPlanId,
            status: 'active',
            billing_cycle: selectedBillingCycle,
            start_date: now.toISOString(),
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            amount: newAmount,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating subscription:', createError);
          return createCorsResponse({ error: 'Failed to create subscription' }, 500, req);
        }

        // Log the subscription creation event
        await admin.from('subscription_events').insert({
          tenant_id: tenantId,
          subscription_id: newSubscription.id,
          event_type: 'created',
          user_id: user.id,
          to_plan: newPlanId,
          data: {
            billingCycle: selectedBillingCycle,
            amount: newAmount,
          },
          created_at: now.toISOString(),
        });

        return createCorsResponse(
          {
            message: 'Subscription created successfully',
            subscription: newSubscription,
          },
          201,
          req,
        );
      }
    }

    // ========================================================================
    // GET /subscriptions - Get current subscription for tenant
    // ========================================================================
    if (req.method === 'GET' && !secondSegment) {
      const { data: subscription, error } = await admin
        .from('tenant_subscriptions')
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing', 'past_due', 'paused'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return createCorsResponse({ error: 'Failed to fetch subscription' }, 500, req);
      }

      if (!subscription) {
        return createCorsResponse(
          {
            message: 'No active subscription found',
            subscription: null,
          },
          200,
          req,
        );
      }

      return createCorsResponse({ subscription }, 200, req);
    }

    // ========================================================================
    // POST /subscriptions - Create/start a new subscription
    // ========================================================================
    if (req.method === 'POST' && !secondSegment) {
      const body = await req.json();
      const planId = body.planId || body.plan_id;
      const billingCycle = body.billingCycle || body.billing_cycle || 'monthly';
      const startTrial = body.startTrial || body.start_trial || false;

      if (!planId) {
        return createCorsResponse({ error: 'Plan ID is required' }, 400, req);
      }

      // Check if tenant already has an active subscription
      const { data: existingSubscription } = await admin
        .from('tenant_subscriptions')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .single();

      if (existingSubscription) {
        return createCorsResponse(
          {
            error:
              'Tenant already has an active subscription. Use change-plan endpoint to switch plans.',
            existingSubscriptionId: existingSubscription.id,
          },
          409,
          req,
        );
      }

      // Get the plan
      const { data: plan, error: planError } = await admin
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .eq('is_active', true)
        .single();

      if (planError || !plan) {
        return createCorsResponse({ error: 'Invalid plan ID' }, 400, req);
      }

      const now = new Date();
      const periodEnd = new Date(now);

      // Calculate trial end or period end
      let isTrialing = false;
      let trialStartDate: string | null = null;
      let trialEndDate: string | null = null;

      if (startTrial && plan.trial_enabled) {
        isTrialing = true;
        trialStartDate = now.toISOString();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + (plan.trial_days || 14));
        trialEndDate = trialEnd.toISOString();
        periodEnd.setDate(periodEnd.getDate() + (plan.trial_days || 14));
      } else if (billingCycle === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const amount = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;

      const subscriptionData = {
        tenant_id: tenantId,
        plan_id: planId,
        status: isTrialing ? 'trialing' : 'active',
        billing_cycle: billingCycle,
        start_date: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        is_trialing: isTrialing,
        trial_start_date: trialStartDate,
        trial_end_date: trialEndDate,
        amount: amount,
        currency: 'USD',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const { data: subscription, error: createError } = await admin
        .from('tenant_subscriptions')
        .insert(subscriptionData)
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .single();

      if (createError) {
        console.error('Error creating subscription:', createError);
        return createCorsResponse(
          { error: 'Failed to create subscription', details: createError },
          500,
          req,
        );
      }

      // Log subscription event
      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: subscription.id,
        event_type: isTrialing ? 'trial_started' : 'created',
        user_id: user.id,
        to_plan: planId,
        data: {
          billingCycle,
          amount,
          isTrialing,
          trialDays: isTrialing ? plan.trial_days : null,
        },
        created_at: now.toISOString(),
      });

      return createCorsResponse({ subscription }, 201, req);
    }

    // ========================================================================
    // PUT /subscriptions/:id - Update subscription
    // ========================================================================
    if ((req.method === 'PUT' || req.method === 'PATCH') && secondSegment && !thirdSegment) {
      const subscriptionId = secondSegment;
      const body = await req.json();

      // Verify the subscription belongs to this tenant
      const { data: existingSubscription, error: fetchError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !existingSubscription) {
        return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Allow updating specific fields
      if (body.billingCycle !== undefined || body.billing_cycle !== undefined) {
        updateData.billing_cycle = body.billingCycle || body.billing_cycle;
      }
      if (body.notes !== undefined) {
        updateData.notes = body.notes;
      }
      if (body.metadata !== undefined) {
        updateData.metadata = body.metadata;
      }

      const { data: updatedSubscription, error: updateError } = await admin
        .from('tenant_subscriptions')
        .update(updateData)
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .single();

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return createCorsResponse({ error: 'Failed to update subscription' }, 500, req);
      }

      return createCorsResponse({ subscription: updatedSubscription }, 200, req);
    }

    // ========================================================================
    // POST /subscriptions/:id/cancel - Cancel subscription
    // ========================================================================
    if (req.method === 'POST' && thirdSegment === 'cancel') {
      const subscriptionId = secondSegment;
      const body = await req.json().catch(() => ({}));
      const cancelImmediately = body.cancelImmediately || body.cancel_immediately || false;
      const reason = body.reason || null;

      // Verify the subscription belongs to this tenant
      const { data: subscription, error: fetchError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !subscription) {
        return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      }

      if (subscription.status === 'canceled') {
        return createCorsResponse({ error: 'Subscription is already canceled' }, 400, req);
      }

      const now = new Date();
      const updateData: Record<string, unknown> = {
        canceled_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      if (cancelImmediately) {
        updateData.status = 'canceled';
        updateData.ended_at = now.toISOString();
      } else {
        // Cancel at end of current period
        updateData.cancel_at = subscription.current_period_end;
      }

      const { data: updatedSubscription, error: updateError } = await admin
        .from('tenant_subscriptions')
        .update(updateData)
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .single();

      if (updateError) {
        console.error('Error canceling subscription:', updateError);
        return createCorsResponse({ error: 'Failed to cancel subscription' }, 500, req);
      }

      // Log cancellation event
      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        event_type: 'canceled',
        user_id: user.id,
        data: {
          cancelImmediately,
          reason,
          cancelAt: cancelImmediately ? now.toISOString() : subscription.current_period_end,
        },
        created_at: now.toISOString(),
      });

      return createCorsResponse(
        {
          message: cancelImmediately
            ? 'Subscription canceled immediately'
            : 'Subscription will be canceled at the end of the current billing period',
          subscription: updatedSubscription,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // POST /subscriptions/:id/resume - Resume a canceled subscription
    // ========================================================================
    if (req.method === 'POST' && thirdSegment === 'resume') {
      const subscriptionId = secondSegment;

      // Verify the subscription belongs to this tenant
      const { data: subscription, error: fetchError } = await admin
        .from('tenant_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !subscription) {
        return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      }

      // Can only resume if scheduled for cancellation (has cancel_at but not ended)
      if (!subscription.cancel_at && subscription.status !== 'canceled') {
        return createCorsResponse(
          { error: 'Subscription is not scheduled for cancellation' },
          400,
          req,
        );
      }

      // If already fully canceled, check if within grace period (30 days)
      if (subscription.status === 'canceled' && subscription.ended_at) {
        const endedAt = new Date(subscription.ended_at);
        const gracePeriodEnd = new Date(endedAt);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

        if (new Date() > gracePeriodEnd) {
          return createCorsResponse(
            {
              error: 'Subscription grace period has expired. Please create a new subscription.',
            },
            400,
            req,
          );
        }
      }

      const now = new Date();

      // Calculate new period if subscription was fully canceled
      let newPeriodEnd = subscription.current_period_end;
      if (subscription.status === 'canceled') {
        newPeriodEnd = new Date(now);
        if (subscription.billing_cycle === 'annual') {
          newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
        } else {
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        }
        newPeriodEnd = newPeriodEnd.toISOString();
      }

      const updateData: Record<string, unknown> = {
        status: subscription.is_trialing ? 'trialing' : 'active',
        cancel_at: null,
        canceled_at: null,
        ended_at: null,
        current_period_end: newPeriodEnd,
        updated_at: now.toISOString(),
      };

      const { data: updatedSubscription, error: updateError } = await admin
        .from('tenant_subscriptions')
        .update(updateData)
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .single();

      if (updateError) {
        console.error('Error resuming subscription:', updateError);
        return createCorsResponse({ error: 'Failed to resume subscription' }, 500, req);
      }

      // Log resume event
      await admin.from('subscription_events').insert({
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        event_type: 'reactivated',
        user_id: user.id,
        data: {
          previousStatus: subscription.status,
          newStatus: updatedSubscription.status,
        },
        created_at: now.toISOString(),
      });

      return createCorsResponse(
        {
          message: 'Subscription resumed successfully',
          subscription: updatedSubscription,
        },
        200,
        req,
      );
    }

    // ========================================================================
    // GET /subscriptions/:id - Get a specific subscription
    // ========================================================================
    if (req.method === 'GET' && secondSegment && !thirdSegment) {
      const subscriptionId = secondSegment;

      const { data: subscription, error } = await admin
        .from('tenant_subscriptions')
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .eq('id', subscriptionId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !subscription) {
        return createCorsResponse({ error: 'Subscription not found' }, 404, req);
      }

      return createCorsResponse({ subscription }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in subscriptions function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
