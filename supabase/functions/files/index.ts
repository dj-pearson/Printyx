// Files Edge Function
// Handles file uploads and document management
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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const fileId = pathParts[1];

    // GET /files - List files
    if (req.method === 'GET' && !fileId) {
      const relatedType =
        url.searchParams.get('relatedType') || url.searchParams.get('related_type');
      const relatedId = url.searchParams.get('relatedId') || url.searchParams.get('related_id');
      const fileType = url.searchParams.get('fileType') || url.searchParams.get('file_type');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = admin
        .from('file_uploads')
        .select(
          `
          *,
          uploaded_by_user:users!file_uploads_uploaded_by_fkey(id, first_name, last_name)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (relatedType) {
        query = query.eq('related_type', relatedType);
      }

      if (relatedId) {
        query = query.eq('related_id', relatedId);
      }

      if (fileType) {
        query = query.eq('file_type', fileType);
      }

      if (search) {
        query = query.or(`file_name.ilike.%${search}%,original_name.ilike.%${search}%`);
      }

      const { data: files, error, count } = await query;

      if (error) {
        console.error('Error fetching files:', error);
        return createCorsResponse({ error: 'Failed to fetch files' }, 500, req);
      }

      return createCorsResponse(
        {
          data: files || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /files/:id - Get single file metadata
    if (req.method === 'GET' && fileId) {
      const { data: file, error } = await admin
        .from('file_uploads')
        .select(
          `
          *,
          uploaded_by_user:users!file_uploads_uploaded_by_fkey(id, first_name, last_name, email)
        `,
        )
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching file:', error);
        return createCorsResponse({ error: 'File not found' }, 404, req);
      }

      return createCorsResponse(file, 200, req);
    }

    // POST /files - Create file record (metadata only, actual upload handled separately)
    if (req.method === 'POST') {
      const body = await req.json();

      const fileData = {
        tenant_id: tenantId,
        file_name: body.fileName || body.file_name,
        original_name: body.originalName || body.original_name || body.fileName || body.file_name,
        file_path: body.filePath || body.file_path,
        file_size: body.fileSize || body.file_size || 0,
        file_type: body.fileType || body.file_type || 'document',
        mime_type: body.mimeType || body.mime_type || 'application/octet-stream',
        related_type: body.relatedType || body.related_type || null,
        related_id: body.relatedId || body.related_id || null,
        is_public:
          body.isPublic !== undefined
            ? body.isPublic
            : body.is_public !== undefined
              ? body.is_public
              : false,
        description: body.description || null,
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: file, error } = await admin
        .from('file_uploads')
        .insert(fileData)
        .select()
        .single();

      if (error) {
        console.error('Error creating file record:', error);
        return createCorsResponse(
          { error: 'Failed to create file record', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(file, 201, req);
    }

    // PATCH /files/:id - Update file metadata
    if ((req.method === 'PATCH' || req.method === 'PUT') && fileId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        fileName: 'file_name',
        originalName: 'original_name',
        description: 'description',
        relatedType: 'related_type',
        relatedId: 'related_id',
        isPublic: 'is_public',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: file, error } = await admin
        .from('file_uploads')
        .update(updateData)
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating file:', error);
        return createCorsResponse({ error: 'Failed to update file' }, 500, req);
      }

      return createCorsResponse(file, 200, req);
    }

    // DELETE /files/:id - Delete file
    if (req.method === 'DELETE' && fileId) {
      // Get file info first
      const { data: file } = await admin
        .from('file_uploads')
        .select('file_path')
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .single();

      if (file?.file_path) {
        // Delete from storage
        const storagePath = file.file_path.replace(/^\//, '');
        await admin.storage.from('files').remove([storagePath]);
      }

      // Delete database record
      const { error } = await admin
        .from('file_uploads')
        .delete()
        .eq('id', fileId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting file:', error);
        return createCorsResponse({ error: 'Failed to delete file' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'File deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in files function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
