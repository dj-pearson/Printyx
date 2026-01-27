// Email Campaigns Edge Function
// Handles email campaign management
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
    const campaignId = pathParts[1];
    const subResource = pathParts[2];

    // GET /email-campaigns - List campaigns
    if (req.method === 'GET' && !campaignId) {
      const status = url.searchParams.get('status');

      let query = admin
        .from('email_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      const { data: campaigns, error } = await query;

      if (error) {
        console.error('Error fetching email campaigns:', error);
        return createCorsResponse({ error: 'Failed to fetch campaigns' }, 500, req);
      }

      return createCorsResponse(campaigns || [], 200, req);
    }

    // GET /email-campaigns/:id - Get single campaign
    if (req.method === 'GET' && campaignId && !subResource) {
      const { data: campaign, error } = await admin
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Campaign not found' }, 404, req);
      }

      // Get stats
      const { data: stats } = await admin
        .from('email_campaign_sends')
        .select('status')
        .eq('campaign_id', campaignId);

      const statsMap = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
      };
      (stats || []).forEach((s: any) => {
        if (statsMap.hasOwnProperty(s.status)) {
          statsMap[s.status as keyof typeof statsMap]++;
        }
      });

      return createCorsResponse({ ...campaign, stats: statsMap }, 200, req);
    }

    // GET /email-campaigns/:id/stats - Get detailed stats
    if (req.method === 'GET' && campaignId && subResource === 'stats') {
      const { data: sends } = await admin
        .from('email_campaign_sends')
        .select('*')
        .eq('campaign_id', campaignId);

      const total = sends?.length || 0;
      const delivered = (sends || []).filter((s: any) => s.delivered_at).length;
      const opened = (sends || []).filter((s: any) => s.opened_at).length;
      const clicked = (sends || []).filter((s: any) => s.clicked_at).length;
      const bounced = (sends || []).filter((s: any) => s.status === 'bounced').length;
      const unsubscribed = (sends || []).filter((s: any) => s.status === 'unsubscribed').length;

      return createCorsResponse(
        {
          total,
          delivered,
          opened,
          clicked,
          bounced,
          unsubscribed,
          deliveryRate: total ? Math.round((delivered / total) * 100) : 0,
          openRate: delivered ? Math.round((opened / delivered) * 100) : 0,
          clickRate: opened ? Math.round((clicked / opened) * 100) : 0,
          bounceRate: total ? Math.round((bounced / total) * 100) : 0,
        },
        200,
        req,
      );
    }

    // POST /email-campaigns - Create campaign
    if (req.method === 'POST' && !campaignId) {
      const body = await req.json();

      const campaignData = {
        tenant_id: tenantId,
        name: body.name,
        subject: body.subject,
        from_name: body.fromName || body.from_name,
        from_email: body.fromEmail || body.from_email,
        reply_to: body.replyTo || body.reply_to,
        html_content: body.htmlContent || body.html_content,
        text_content: body.textContent || body.text_content,
        template_id: body.templateId || body.template_id,
        segment_id: body.segmentId || body.segment_id,
        status: 'draft',
        scheduled_at: body.scheduledAt || body.scheduled_at,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: campaign, error } = await admin
        .from('email_campaigns')
        .insert(campaignData)
        .select()
        .single();

      if (error) {
        console.error('Error creating campaign:', error);
        return createCorsResponse({ error: 'Failed to create campaign' }, 500, req);
      }

      return createCorsResponse(campaign, 201, req);
    }

    // PUT /email-campaigns/:id - Update campaign
    if (req.method === 'PUT' && campaignId && !subResource) {
      const body = await req.json();

      const { data: campaign, error } = await admin
        .from('email_campaigns')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', campaignId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update campaign' }, 500, req);
      }

      return createCorsResponse(campaign, 200, req);
    }

    // POST /email-campaigns/:id/send - Send campaign
    if (req.method === 'POST' && campaignId && subResource === 'send') {
      const { data: campaign } = await admin
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('tenant_id', tenantId)
        .single();

      if (!campaign) {
        return createCorsResponse({ error: 'Campaign not found' }, 404, req);
      }

      if (campaign.status === 'sent') {
        return createCorsResponse({ error: 'Campaign already sent' }, 400, req);
      }

      // Get recipients from segment
      let recipients: any[] = [];
      if (campaign.segment_id) {
        const { data: members } = await admin
          .from('customer_segment_members')
          .select(
            `
            customer:customer_id (
              id,
              email,
              company_name
            )
          `,
          )
          .eq('segment_id', campaign.segment_id);
        recipients = (members || []).map((m: any) => m.customer).filter((c: any) => c?.email);
      }

      // Create send records
      const sends = recipients.map((recipient: any) => ({
        campaign_id: campaignId,
        recipient_id: recipient.id,
        recipient_email: recipient.email,
        status: 'pending',
        created_at: new Date().toISOString(),
      }));

      if (sends.length > 0) {
        await admin.from('email_campaign_sends').insert(sends);
      }

      // Update campaign status
      await admin
        .from('email_campaigns')
        .update({
          status: 'sending',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      // In production, this would trigger actual email sending
      return createCorsResponse(
        {
          success: true,
          recipientCount: recipients.length,
          message: 'Campaign sending initiated',
        },
        200,
        req,
      );
    }

    // POST /email-campaigns/:id/schedule - Schedule campaign
    if (req.method === 'POST' && campaignId && subResource === 'schedule') {
      const body = await req.json();

      const { data: campaign, error } = await admin
        .from('email_campaigns')
        .update({
          status: 'scheduled',
          scheduled_at: body.scheduledAt || body.scheduled_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to schedule campaign' }, 500, req);
      }

      return createCorsResponse(campaign, 200, req);
    }

    // POST /email-campaigns/:id/test - Send test email
    if (req.method === 'POST' && campaignId && subResource === 'test') {
      const body = await req.json();
      const testEmail = body.email || body.testEmail;

      // In production, this would send an actual test email
      return createCorsResponse(
        {
          success: true,
          testEmail,
          message: 'Test email sent',
        },
        200,
        req,
      );
    }

    // POST /email-campaigns/:id/duplicate - Duplicate campaign
    if (req.method === 'POST' && campaignId && subResource === 'duplicate') {
      const { data: original } = await admin
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('tenant_id', tenantId)
        .single();

      if (!original) {
        return createCorsResponse({ error: 'Campaign not found' }, 404, req);
      }

      const { data: duplicate, error } = await admin
        .from('email_campaigns')
        .insert({
          tenant_id: tenantId,
          name: `${original.name} (Copy)`,
          subject: original.subject,
          from_name: original.from_name,
          from_email: original.from_email,
          reply_to: original.reply_to,
          html_content: original.html_content,
          text_content: original.text_content,
          template_id: original.template_id,
          segment_id: original.segment_id,
          status: 'draft',
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to duplicate campaign' }, 500, req);
      }

      return createCorsResponse(duplicate, 201, req);
    }

    // DELETE /email-campaigns/:id - Delete campaign
    if (req.method === 'DELETE' && campaignId) {
      // Delete send records first
      await admin.from('email_campaign_sends').delete().eq('campaign_id', campaignId);

      const { error } = await admin
        .from('email_campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete campaign' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Campaign deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in email-campaigns function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
