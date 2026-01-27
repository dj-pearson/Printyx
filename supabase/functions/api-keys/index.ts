// API Keys Edge Function
// Handles API key management
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
    const keyId = pathParts[1];

    // GET /api-keys - List API keys
    if (req.method === 'GET' && !keyId) {
      const { data: keys, error } = await admin
        .from('api_keys')
        .select('id, name, prefix, scopes, is_active, last_used_at, expires_at, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching API keys:', error);
        return createCorsResponse({ error: 'Failed to fetch API keys' }, 500, req);
      }

      return createCorsResponse(keys || [], 200, req);
    }

    // GET /api-keys/:id - Get single API key (without revealing the key)
    if (req.method === 'GET' && keyId) {
      const { data: key, error } = await admin
        .from('api_keys')
        .select(
          'id, name, prefix, scopes, is_active, last_used_at, expires_at, created_at, created_by',
        )
        .eq('id', keyId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'API key not found' }, 404, req);
      }

      return createCorsResponse(key, 200, req);
    }

    // POST /api-keys - Create API key
    if (req.method === 'POST' && !keyId) {
      const body = await req.json();

      // Generate a secure API key
      const keyValue = `pk_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
      const prefix = keyValue.substring(0, 12);

      // Hash the key for storage
      const encoder = new TextEncoder();
      const data = encoder.encode(keyValue);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedKey = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const keyData = {
        tenant_id: tenantId,
        name: body.name,
        prefix,
        hashed_key: hashedKey,
        scopes: body.scopes || ['read'],
        is_active: true,
        expires_at: body.expiresAt || body.expires_at,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: key, error } = await admin
        .from('api_keys')
        .insert(keyData)
        .select('id, name, prefix, scopes, is_active, expires_at, created_at')
        .single();

      if (error) {
        console.error('Error creating API key:', error);
        return createCorsResponse({ error: 'Failed to create API key' }, 500, req);
      }

      // Return the full key only once at creation
      return createCorsResponse(
        {
          ...key,
          key: keyValue,
          message: 'Save this key now - it will not be shown again',
        },
        201,
        req,
      );
    }

    // PUT /api-keys/:id - Update API key
    if (req.method === 'PUT' && keyId) {
      const body = await req.json();

      const { data: key, error } = await admin
        .from('api_keys')
        .update({
          name: body.name,
          scopes: body.scopes,
          is_active: body.isActive ?? body.is_active,
          expires_at: body.expiresAt || body.expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', keyId)
        .eq('tenant_id', tenantId)
        .select('id, name, prefix, scopes, is_active, expires_at, updated_at')
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update API key' }, 500, req);
      }

      return createCorsResponse(key, 200, req);
    }

    // POST /api-keys/:id/regenerate - Regenerate API key
    if (req.method === 'POST' && keyId === 'regenerate') {
      const body = await req.json();
      const targetKeyId = body.keyId || body.key_id;

      // Generate new key
      const keyValue = `pk_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
      const prefix = keyValue.substring(0, 12);

      // Hash the new key
      const encoder = new TextEncoder();
      const data = encoder.encode(keyValue);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedKey = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const { data: key, error } = await admin
        .from('api_keys')
        .update({
          prefix,
          hashed_key: hashedKey,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetKeyId)
        .eq('tenant_id', tenantId)
        .select('id, name, prefix, scopes, is_active')
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to regenerate API key' }, 500, req);
      }

      return createCorsResponse(
        {
          ...key,
          key: keyValue,
          message: 'Save this new key now - it will not be shown again',
        },
        200,
        req,
      );
    }

    // POST /api-keys/verify - Verify an API key (for internal use)
    if (req.method === 'POST' && keyId === 'verify') {
      const body = await req.json();
      const apiKey = body.apiKey || body.api_key;

      if (!apiKey) {
        return createCorsResponse({ valid: false, error: 'No API key provided' }, 400, req);
      }

      const prefix = apiKey.substring(0, 12);

      // Hash the provided key
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedKey = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      // Look up the key
      const { data: key } = await admin
        .from('api_keys')
        .select('id, tenant_id, scopes, is_active, expires_at')
        .eq('prefix', prefix)
        .eq('hashed_key', hashedKey)
        .single();

      if (!key) {
        return createCorsResponse({ valid: false, error: 'Invalid API key' }, 200, req);
      }

      if (!key.is_active) {
        return createCorsResponse({ valid: false, error: 'API key is inactive' }, 200, req);
      }

      if (key.expires_at && new Date(key.expires_at) < new Date()) {
        return createCorsResponse({ valid: false, error: 'API key has expired' }, 200, req);
      }

      // Update last used
      await admin
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', key.id);

      return createCorsResponse(
        {
          valid: true,
          tenantId: key.tenant_id,
          scopes: key.scopes,
        },
        200,
        req,
      );
    }

    // DELETE /api-keys/:id - Delete API key
    if (req.method === 'DELETE' && keyId) {
      const { error } = await admin
        .from('api_keys')
        .delete()
        .eq('id', keyId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete API key' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'API key deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in api-keys function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
