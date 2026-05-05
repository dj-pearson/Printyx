// File Storage Edge Function
// Handles file upload and management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    const { parts } = normalizePath(url.pathname, 'file-storage');
    const fileId = parts[0];
    const subResource = parts[1];

    // GET /file-storage - List files
    if (req.method === 'GET' && !fileId) {
      const folder = url.searchParams.get('folder');
      const entityType = url.searchParams.get('entityType');
      const entityId = url.searchParams.get('entityId');
      const fileType = url.searchParams.get('fileType');

      let query = admin
        .from('files')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (folder) query = query.eq('folder', folder);
      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) query = query.eq('entity_id', entityId);
      if (fileType) query = query.eq('file_type', fileType);

      const { data: files, error } = await query;

      if (error) {
        console.error('Error fetching files:', error);
        return createCorsResponse({ error: 'Failed to fetch files' }, 500, req);
      }

      return createCorsResponse(files || [], 200, req);
    }

    // GET /file-storage/folders - Get folder structure
    if (req.method === 'GET' && fileId === 'folders') {
      const { data: files } = await admin.from('files').select('folder').eq('tenant_id', tenantId);

      const folders = [...new Set((files || []).map((f: any) => f.folder).filter(Boolean))].sort();

      return createCorsResponse(folders, 200, req);
    }

    // GET /file-storage/usage - Get storage usage
    if (req.method === 'GET' && fileId === 'usage') {
      const { data: files } = await admin
        .from('files')
        .select('file_size, file_type')
        .eq('tenant_id', tenantId);

      const totalSize = (files || []).reduce((sum: number, f: any) => sum + (f.file_size || 0), 0);
      const fileCount = files?.length || 0;

      // Group by type
      const byType = new Map<string, { count: number; size: number }>();
      (files || []).forEach((f: any) => {
        const type = f.file_type || 'unknown';
        const current = byType.get(type) || { count: 0, size: 0 };
        byType.set(type, {
          count: current.count + 1,
          size: current.size + (f.file_size || 0),
        });
      });

      return createCorsResponse(
        {
          totalSize,
          fileCount,
          byType: Array.from(byType.entries()).map(([type, stats]) => ({ type, ...stats })),
        },
        200,
        req,
      );
    }

    // GET /file-storage/:id - Get file details
    if (req.method === 'GET' && fileId && !subResource) {
      const { data: file, error } = await admin
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'File not found' }, 404, req);
      }

      return createCorsResponse(file, 200, req);
    }

    // POST /file-storage - Create file record (after upload to storage)
    if (req.method === 'POST' && !fileId) {
      const body = await req.json();

      const fileData = {
        tenant_id: tenantId,
        file_name: body.fileName || body.file_name,
        original_name: body.originalName || body.original_name,
        file_type: body.fileType || body.file_type,
        mime_type: body.mimeType || body.mime_type,
        file_size: body.fileSize || body.file_size,
        storage_path: body.storagePath || body.storage_path,
        folder: body.folder || 'general',
        entity_type: body.entityType || body.entity_type,
        entity_id: body.entityId || body.entity_id,
        description: body.description,
        is_public: body.isPublic || false,
        uploaded_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: file, error } = await admin.from('files').insert(fileData).select().single();

      if (error) {
        console.error('Error creating file record:', error);
        return createCorsResponse({ error: 'Failed to create file record' }, 500, req);
      }

      return createCorsResponse(file, 201, req);
    }

    // PUT /file-storage/:id - Update file metadata
    if (req.method === 'PUT' && fileId && !subResource) {
      const body = await req.json();

      const { data: file, error } = await admin
        .from('files')
        .update({
          file_name: body.fileName || body.file_name,
          folder: body.folder,
          description: body.description,
          is_public: body.isPublic || body.is_public,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update file' }, 500, req);
      }

      return createCorsResponse(file, 200, req);
    }

    // POST /file-storage/:id/move - Move file to different folder
    if (req.method === 'POST' && fileId && subResource === 'move') {
      const body = await req.json();

      const { data: file, error } = await admin
        .from('files')
        .update({
          folder: body.folder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to move file' }, 500, req);
      }

      return createCorsResponse(file, 200, req);
    }

    // POST /file-storage/:id/copy - Copy file
    if (req.method === 'POST' && fileId && subResource === 'copy') {
      const body = await req.json();

      const { data: original } = await admin
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .single();

      if (!original) {
        return createCorsResponse({ error: 'File not found' }, 404, req);
      }

      const { data: copy, error } = await admin
        .from('files')
        .insert({
          tenant_id: tenantId,
          file_name: body.newName || `${original.file_name} (Copy)`,
          original_name: original.original_name,
          file_type: original.file_type,
          mime_type: original.mime_type,
          file_size: original.file_size,
          storage_path: original.storage_path, // Note: In production, you'd also copy the actual file
          folder: body.folder || original.folder,
          entity_type: original.entity_type,
          entity_id: original.entity_id,
          description: original.description,
          is_public: original.is_public,
          uploaded_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to copy file' }, 500, req);
      }

      return createCorsResponse(copy, 201, req);
    }

    // GET /file-storage/:id/download-url - Get signed download URL
    if (req.method === 'GET' && fileId && subResource === 'download-url') {
      const { data: file } = await admin
        .from('files')
        .select('storage_path, file_name')
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .single();

      if (!file) {
        return createCorsResponse({ error: 'File not found' }, 404, req);
      }

      // In production, generate a signed URL from Supabase Storage
      // For now, return the storage path
      return createCorsResponse(
        {
          downloadUrl: file.storage_path,
          fileName: file.file_name,
          expiresIn: 3600,
        },
        200,
        req,
      );
    }

    // DELETE /file-storage/:id - Delete file
    if (req.method === 'DELETE' && fileId) {
      // Get file to delete from storage
      const { data: file } = await admin
        .from('files')
        .select('storage_path')
        .eq('id', fileId)
        .eq('tenant_id', tenantId)
        .single();

      if (file?.storage_path) {
        // In production, also delete from Supabase Storage
        // await admin.storage.from('files').remove([file.storage_path]);
      }

      const { error } = await admin
        .from('files')
        .delete()
        .eq('id', fileId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete file' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'File deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in file-storage function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
