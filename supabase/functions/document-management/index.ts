// Document Management Edge Function
// Handles document storage, retrieval, and organization
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
    const documentId = pathParts[1];
    const subResource = pathParts[2];

    // GET /document-management - List documents
    if (req.method === 'GET' && !documentId) {
      const folder = url.searchParams.get('folder');
      const entityType = url.searchParams.get('entityType');
      const entityId = url.searchParams.get('entityId');
      const search = url.searchParams.get('search');

      let query = admin
        .from('documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (folder) query = query.eq('folder', folder);
      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) query = query.eq('entity_id', entityId);
      if (search) query = query.ilike('name', `%${search}%`);

      const { data: documents, error } = await query;

      if (error) {
        console.error('Error fetching documents:', error);
        return createCorsResponse({ error: 'Failed to fetch documents' }, 500, req);
      }

      return createCorsResponse(documents || [], 200, req);
    }

    // GET /document-management/folders - List folders
    if (req.method === 'GET' && documentId === 'folders') {
      const { data: folders } = await admin
        .from('document_folders')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      return createCorsResponse(folders || [], 200, req);
    }

    // GET /document-management/:id - Get single document
    if (req.method === 'GET' && documentId && !subResource) {
      const { data: document, error } = await admin
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Document not found' }, 404, req);
      }

      return createCorsResponse(document, 200, req);
    }

    // POST /document-management - Create document record
    if (req.method === 'POST' && !documentId) {
      const body = await req.json();

      const documentData = {
        tenant_id: tenantId,
        name: body.name,
        file_path: body.filePath || body.file_path,
        file_type: body.fileType || body.file_type,
        file_size: body.fileSize || body.file_size,
        mime_type: body.mimeType || body.mime_type,
        folder: body.folder,
        entity_type: body.entityType || body.entity_type,
        entity_id: body.entityId || body.entity_id,
        description: body.description,
        tags: body.tags || [],
        version: 1,
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: document, error } = await admin
        .from('documents')
        .insert(documentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating document:', error);
        return createCorsResponse({ error: 'Failed to create document' }, 500, req);
      }

      return createCorsResponse(document, 201, req);
    }

    // POST /document-management/folders - Create folder
    if (req.method === 'POST' && documentId === 'folders') {
      const body = await req.json();

      const { data: folder, error } = await admin
        .from('document_folders')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          parent_id: body.parentId || body.parent_id,
          description: body.description,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create folder' }, 500, req);
      }

      return createCorsResponse(folder, 201, req);
    }

    // PUT /document-management/:id - Update document
    if (req.method === 'PUT' && documentId && !subResource) {
      const body = await req.json();

      const { data: document, error } = await admin
        .from('documents')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', documentId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update document' }, 500, req);
      }

      return createCorsResponse(document, 200, req);
    }

    // POST /document-management/:id/move - Move document to folder
    if (req.method === 'POST' && documentId && subResource === 'move') {
      const body = await req.json();

      const { data: document, error } = await admin
        .from('documents')
        .update({
          folder: body.folder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to move document' }, 500, req);
      }

      return createCorsResponse(document, 200, req);
    }

    // DELETE /document-management/:id - Delete document
    if (req.method === 'DELETE' && documentId) {
      const { error } = await admin
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete document' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Document deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in document-management function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
