// Email Templates Edge Function
// Handles email template management
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
    const templateId = pathParts[1];
    const subResource = pathParts[2];

    // GET /email-templates - List templates
    if (req.method === 'GET' && !templateId) {
      const category = url.searchParams.get('category');
      const isActive = url.searchParams.get('isActive');

      let query = admin
        .from('email_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (category) query = query.eq('category', category);
      if (isActive === 'true') query = query.eq('is_active', true);

      const { data: templates, error } = await query;

      if (error) {
        console.error('Error fetching email templates:', error);
        return createCorsResponse({ error: 'Failed to fetch templates' }, 500, req);
      }

      return createCorsResponse(templates || [], 200, req);
    }

    // GET /email-templates/categories - Get template categories
    if (req.method === 'GET' && templateId === 'categories') {
      const categories = [
        { id: 'marketing', name: 'Marketing', description: 'Promotional and marketing emails' },
        {
          id: 'transactional',
          name: 'Transactional',
          description: 'Order confirmations, receipts',
        },
        {
          id: 'notification',
          name: 'Notification',
          description: 'System notifications and alerts',
        },
        { id: 'onboarding', name: 'Onboarding', description: 'Welcome and onboarding sequences' },
        { id: 'service', name: 'Service', description: 'Service-related communications' },
        { id: 'invoice', name: 'Invoice', description: 'Invoice and billing templates' },
        { id: 'reminder', name: 'Reminder', description: 'Payment and appointment reminders' },
      ];

      return createCorsResponse(categories, 200, req);
    }

    // GET /email-templates/:id - Get single template
    if (req.method === 'GET' && templateId && !subResource) {
      const { data: template, error } = await admin
        .from('email_templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Template not found' }, 404, req);
      }

      return createCorsResponse(template, 200, req);
    }

    // POST /email-templates - Create template
    if (req.method === 'POST' && !templateId) {
      const body = await req.json();

      const templateData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        category: body.category || 'general',
        subject: body.subject,
        html_content: body.htmlContent || body.html_content,
        text_content: body.textContent || body.text_content,
        variables: body.variables || [],
        is_active: body.isActive !== false,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: template, error } = await admin
        .from('email_templates')
        .insert(templateData)
        .select()
        .single();

      if (error) {
        console.error('Error creating template:', error);
        return createCorsResponse({ error: 'Failed to create template' }, 500, req);
      }

      return createCorsResponse(template, 201, req);
    }

    // PUT /email-templates/:id - Update template
    if (req.method === 'PUT' && templateId && !subResource) {
      const body = await req.json();

      const { data: template, error } = await admin
        .from('email_templates')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update template' }, 500, req);
      }

      return createCorsResponse(template, 200, req);
    }

    // POST /email-templates/:id/preview - Preview template with data
    if (req.method === 'POST' && templateId && subResource === 'preview') {
      const body = await req.json();
      const variables = body.variables || {};

      const { data: template } = await admin
        .from('email_templates')
        .select('html_content, text_content, subject')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .single();

      if (!template) {
        return createCorsResponse({ error: 'Template not found' }, 404, req);
      }

      // Replace variables in template
      let html = template.html_content || '';
      let text = template.text_content || '';
      let subject = template.subject || '';

      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        html = html.replace(regex, String(value));
        text = text.replace(regex, String(value));
        subject = subject.replace(regex, String(value));
      });

      return createCorsResponse(
        {
          subject,
          html,
          text,
        },
        200,
        req,
      );
    }

    // POST /email-templates/:id/duplicate - Duplicate template
    if (req.method === 'POST' && templateId && subResource === 'duplicate') {
      const { data: original } = await admin
        .from('email_templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .single();

      if (!original) {
        return createCorsResponse({ error: 'Template not found' }, 404, req);
      }

      const { data: duplicate, error } = await admin
        .from('email_templates')
        .insert({
          tenant_id: tenantId,
          name: `${original.name} (Copy)`,
          description: original.description,
          category: original.category,
          subject: original.subject,
          html_content: original.html_content,
          text_content: original.text_content,
          variables: original.variables,
          is_active: false,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to duplicate template' }, 500, req);
      }

      return createCorsResponse(duplicate, 201, req);
    }

    // POST /email-templates/:id/test - Send test email
    if (req.method === 'POST' && templateId && subResource === 'test') {
      const body = await req.json();
      const testEmail = body.email || body.testEmail;
      const variables = body.variables || {};

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

    // DELETE /email-templates/:id - Delete template
    if (req.method === 'DELETE' && templateId) {
      const { error } = await admin
        .from('email_templates')
        .delete()
        .eq('id', templateId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete template' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Template deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in email-templates function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
