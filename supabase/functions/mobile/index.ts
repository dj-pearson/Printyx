// Mobile Field Service Edge Function
// Handles mobile sessions, photos, and offline sync for field technicians
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

    // Use service_role client for database operations (bypasses RLS)
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Path structure: /mobile/sessions, /mobile/sessions/:id, /mobile/photos, /mobile/photos/:id, /mobile/sync
    const resource = pathParts[1]; // sessions, photos, sync
    const resourceId = pathParts[2]; // :id or :ticketId for photos

    // ========================================
    // SESSIONS ENDPOINTS
    // ========================================

    // GET /mobile/sessions - List active mobile sessions for technician
    if (req.method === 'GET' && resource === 'sessions' && !resourceId) {
      const technicianId =
        url.searchParams.get('technicianId') || url.searchParams.get('technician_id') || user.id;
      const status = url.searchParams.get('status');
      const serviceTicketId =
        url.searchParams.get('serviceTicketId') || url.searchParams.get('service_ticket_id');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('mobile_service_sessions')
        .select(
          `
          *,
          service_ticket:service_tickets!mobile_service_sessions_service_ticket_id_fkey(
            id, ticket_number, title, status, priority,
            customer:business_records!service_tickets_customer_id_fkey(id, company_name, primary_contact_name, primary_contact_phone)
          ),
          technician:users!mobile_service_sessions_technician_id_fkey(id, first_name, last_name, email, phone)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .eq('technician_id', technicianId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (serviceTicketId) {
        query = query.eq('service_ticket_id', serviceTicketId);
      }

      const { data: sessions, error, count } = await query;

      if (error) {
        console.error('Error fetching mobile sessions:', error);
        return createCorsResponse({ error: 'Failed to fetch mobile sessions' }, 500, req);
      }

      return createCorsResponse(
        {
          data: sessions || [],
          total: count || 0,
          limit,
          offset,
        },
        200,
        req,
      );
    }

    // GET /mobile/sessions/:id - Get single session
    if (req.method === 'GET' && resource === 'sessions' && resourceId) {
      const { data: session, error } = await admin
        .from('mobile_service_sessions')
        .select(
          `
          *,
          service_ticket:service_tickets!mobile_service_sessions_service_ticket_id_fkey(
            id, ticket_number, title, description, status, priority, scheduled_date,
            customer:business_records!service_tickets_customer_id_fkey(
              id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone,
              address_line1, address_line2, city, state, postal_code
            ),
            equipment:equipment(id, serial_number, model, manufacturer, location)
          ),
          technician:users!mobile_service_sessions_technician_id_fkey(id, first_name, last_name, email, phone),
          time_entries:time_tracking_entries(*)
        `,
        )
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching mobile session:', error);
        return createCorsResponse({ error: 'Mobile session not found' }, 404, req);
      }

      return createCorsResponse(session, 200, req);
    }

    // POST /mobile/sessions - Start new mobile session (check-in)
    if (req.method === 'POST' && resource === 'sessions' && !resourceId) {
      const body = await req.json();

      const sessionData = {
        tenant_id: tenantId,
        service_ticket_id: body.serviceTicketId || body.service_ticket_id,
        technician_id: body.technicianId || body.technician_id || user.id,
        check_in_latitude: body.checkInLatitude || body.check_in_latitude || body.latitude,
        check_in_longitude: body.checkInLongitude || body.check_in_longitude || body.longitude,
        check_in_address: body.checkInAddress || body.check_in_address || body.address,
        check_in_timestamp:
          body.checkInTimestamp || body.check_in_timestamp || new Date().toISOString(),
        status: 'checked_in',
        service_notes: body.serviceNotes || body.service_notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!sessionData.service_ticket_id) {
        return createCorsResponse({ error: 'Service ticket ID is required' }, 400, req);
      }

      const { data: session, error } = await admin
        .from('mobile_service_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        console.error('Error creating mobile session:', error);
        return createCorsResponse(
          { error: 'Failed to create mobile session', details: error },
          500,
          req,
        );
      }

      // Create initial time tracking entry
      await admin.from('time_tracking_entries').insert({
        tenant_id: tenantId,
        session_id: session.id,
        latitude: sessionData.check_in_latitude,
        longitude: sessionData.check_in_longitude,
        address: sessionData.check_in_address,
        check_in_type: 'arrival',
        timestamp: sessionData.check_in_timestamp,
        notes: body.notes || 'Check-in at customer location',
        created_at: new Date().toISOString(),
      });

      // Update service ticket status to in_progress
      await admin
        .from('service_tickets')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionData.service_ticket_id)
        .eq('tenant_id', tenantId);

      return createCorsResponse(session, 201, req);
    }

    // PUT /mobile/sessions/:id - Update session (check-out, add notes)
    if ((req.method === 'PUT' || req.method === 'PATCH') && resource === 'sessions' && resourceId) {
      const body = await req.json();

      // Fetch current session to calculate hours
      const { data: currentSession } = await admin
        .from('mobile_service_sessions')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (!currentSession) {
        return createCorsResponse({ error: 'Mobile session not found' }, 404, req);
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map fields from camelCase to snake_case
      const fieldMap: Record<string, string> = {
        checkOutLatitude: 'check_out_latitude',
        checkOutLongitude: 'check_out_longitude',
        checkOutAddress: 'check_out_address',
        checkOutTimestamp: 'check_out_timestamp',
        totalHours: 'total_hours',
        breakHours: 'break_hours',
        workingHours: 'working_hours',
        status: 'status',
        serviceNotes: 'service_notes',
        customerSignature: 'customer_signature',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      // Handle check-out scenario
      const isCheckingOut = body.checkOut || body.check_out || updateData.status === 'completed';
      if (isCheckingOut) {
        updateData.check_out_timestamp = updateData.check_out_timestamp || new Date().toISOString();
        updateData.check_out_latitude = updateData.check_out_latitude || body.latitude;
        updateData.check_out_longitude = updateData.check_out_longitude || body.longitude;
        updateData.check_out_address = updateData.check_out_address || body.address;
        updateData.status = 'completed';

        // Calculate total hours if check-in timestamp exists
        if (currentSession.check_in_timestamp && updateData.check_out_timestamp) {
          const checkIn = new Date(currentSession.check_in_timestamp);
          const checkOut = new Date(updateData.check_out_timestamp);
          const totalMs = checkOut.getTime() - checkIn.getTime();
          const totalHours = totalMs / (1000 * 60 * 60);
          updateData.total_hours = totalHours.toFixed(2);

          const breakHours = parseFloat(currentSession.break_hours || '0');
          updateData.working_hours = (totalHours - breakHours).toFixed(2);
        }
      }

      const { data: session, error } = await admin
        .from('mobile_service_sessions')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating mobile session:', error);
        return createCorsResponse({ error: 'Failed to update mobile session' }, 500, req);
      }

      // Create time tracking entry for check-out
      if (isCheckingOut) {
        await admin.from('time_tracking_entries').insert({
          tenant_id: tenantId,
          session_id: resourceId,
          latitude: updateData.check_out_latitude,
          longitude: updateData.check_out_longitude,
          address: updateData.check_out_address,
          check_in_type: 'departure',
          timestamp: updateData.check_out_timestamp,
          notes: body.notes || 'Check-out from customer location',
          created_at: new Date().toISOString(),
        });

        // Update service ticket status if completed
        if (currentSession.service_ticket_id) {
          await admin
            .from('service_tickets')
            .update({
              status: 'completed',
              resolved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSession.service_ticket_id)
            .eq('tenant_id', tenantId);
        }
      }

      return createCorsResponse(session, 200, req);
    }

    // ========================================
    // PHOTOS ENDPOINTS
    // ========================================

    // POST /mobile/photos - Upload photo metadata (actual file handled separately)
    if (req.method === 'POST' && resource === 'photos' && !resourceId) {
      const body = await req.json();

      const photoData = {
        tenant_id: tenantId,
        service_ticket_id: body.serviceTicketId || body.service_ticket_id,
        session_id: body.sessionId || body.session_id || null,
        file_name: body.fileName || body.file_name,
        original_name: body.originalName || body.original_name || body.fileName || body.file_name,
        mime_type: body.mimeType || body.mime_type || 'image/jpeg',
        file_size: body.fileSize || body.file_size || null,
        object_path: body.objectPath || body.object_path,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        address: body.address || null,
        category: body.category || 'during', // 'before', 'during', 'after', 'damage', 'parts', 'completed'
        description: body.description || null,
        taken_at: body.takenAt || body.taken_at || new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (!photoData.service_ticket_id) {
        return createCorsResponse({ error: 'Service ticket ID is required' }, 400, req);
      }

      if (!photoData.file_name || !photoData.object_path) {
        return createCorsResponse({ error: 'File name and object path are required' }, 400, req);
      }

      const { data: photo, error } = await admin
        .from('service_photos')
        .insert(photoData)
        .select()
        .single();

      if (error) {
        console.error('Error creating photo record:', error);
        return createCorsResponse(
          { error: 'Failed to create photo record', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(photo, 201, req);
    }

    // GET /mobile/photos/:ticketId - Get photos for a service ticket
    if (req.method === 'GET' && resource === 'photos' && resourceId) {
      const category = url.searchParams.get('category');
      const sessionId = url.searchParams.get('sessionId') || url.searchParams.get('session_id');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('service_photos')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('service_ticket_id', resourceId)
        .order('taken_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (category) {
        query = query.eq('category', category);
      }

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data: photos, error, count } = await query;

      if (error) {
        console.error('Error fetching photos:', error);
        return createCorsResponse({ error: 'Failed to fetch photos' }, 500, req);
      }

      return createCorsResponse(
        {
          data: photos || [],
          total: count || 0,
          limit,
          offset,
        },
        200,
        req,
      );
    }

    // DELETE /mobile/photos/:id - Delete photo
    if (req.method === 'DELETE' && resource === 'photos' && resourceId) {
      // Fetch photo to get object path for storage deletion
      const { data: photo } = await admin
        .from('service_photos')
        .select('object_path')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (!photo) {
        return createCorsResponse({ error: 'Photo not found' }, 404, req);
      }

      // Delete from database
      const { error } = await admin
        .from('service_photos')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting photo:', error);
        return createCorsResponse({ error: 'Failed to delete photo' }, 500, req);
      }

      // Note: Actual file deletion from storage should be handled separately
      // or through a storage trigger/lifecycle policy
      return createCorsResponse(
        {
          success: true,
          message: 'Photo deleted',
          objectPath: photo.object_path,
        },
        200,
        req,
      );
    }

    // ========================================
    // SYNC ENDPOINTS
    // ========================================

    // GET /mobile/sync - Get data to sync to mobile device
    if (req.method === 'GET' && resource === 'sync') {
      const technicianId =
        url.searchParams.get('technicianId') || url.searchParams.get('technician_id') || user.id;
      const lastSyncAt = url.searchParams.get('lastSyncAt') || url.searchParams.get('last_sync_at');
      const includeCompleted = url.searchParams.get('includeCompleted') === 'true';

      // Fetch assigned service tickets
      let ticketsQuery = admin
        .from('service_tickets')
        .select(
          `
          *,
          customer:business_records!service_tickets_customer_id_fkey(
            id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone,
            address_line1, address_line2, city, state, postal_code
          ),
          equipment:equipment(id, serial_number, model, manufacturer, location)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('assigned_technician_id', technicianId)
        .order('scheduled_date', { ascending: true });

      if (!includeCompleted) {
        ticketsQuery = ticketsQuery.not('status', 'eq', 'completed');
      }

      if (lastSyncAt) {
        ticketsQuery = ticketsQuery.gte('updated_at', lastSyncAt);
      }

      const { data: tickets, error: ticketsError } = await ticketsQuery;

      if (ticketsError) {
        console.error('Error fetching tickets for sync:', ticketsError);
        return createCorsResponse({ error: 'Failed to fetch sync data' }, 500, req);
      }

      // Fetch active sessions
      const { data: sessions, error: sessionsError } = await admin
        .from('mobile_service_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('technician_id', technicianId)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (sessionsError) {
        console.error('Error fetching sessions for sync:', sessionsError);
      }

      // Fetch photos for active tickets
      const ticketIds = tickets?.map((t: any) => t.id) || [];
      let photos: any[] = [];
      if (ticketIds.length > 0) {
        const { data: photoData, error: photosError } = await admin
          .from('service_photos')
          .select('*')
          .eq('tenant_id', tenantId)
          .in('service_ticket_id', ticketIds);

        if (!photosError) {
          photos = photoData || [];
        }
      }

      return createCorsResponse(
        {
          syncedAt: new Date().toISOString(),
          technician: {
            id: user.id,
            email: user.email,
          },
          data: {
            serviceTickets: tickets || [],
            activeSessions: sessions || [],
            photos: photos,
          },
          counts: {
            serviceTickets: tickets?.length || 0,
            activeSessions: sessions?.length || 0,
            photos: photos.length,
          },
        },
        200,
        req,
      );
    }

    // POST /mobile/sync - Submit offline data from mobile
    if (req.method === 'POST' && resource === 'sync') {
      const body = await req.json();
      const results: {
        sessions: { created: number; updated: number; errors: string[] };
        photos: { created: number; errors: string[] };
        timeEntries: { created: number; errors: string[] };
        locationHistory: { created: number; errors: string[] };
      } = {
        sessions: { created: 0, updated: 0, errors: [] },
        photos: { created: 0, errors: [] },
        timeEntries: { created: 0, errors: [] },
        locationHistory: { created: 0, errors: [] },
      };

      // Process session updates
      if (body.sessions && Array.isArray(body.sessions)) {
        for (const sessionData of body.sessions) {
          try {
            const data = {
              tenant_id: tenantId,
              service_ticket_id: sessionData.serviceTicketId || sessionData.service_ticket_id,
              technician_id: sessionData.technicianId || sessionData.technician_id || user.id,
              check_in_latitude: sessionData.checkInLatitude || sessionData.check_in_latitude,
              check_in_longitude: sessionData.checkInLongitude || sessionData.check_in_longitude,
              check_in_address: sessionData.checkInAddress || sessionData.check_in_address,
              check_in_timestamp: sessionData.checkInTimestamp || sessionData.check_in_timestamp,
              check_out_latitude: sessionData.checkOutLatitude || sessionData.check_out_latitude,
              check_out_longitude: sessionData.checkOutLongitude || sessionData.check_out_longitude,
              check_out_address: sessionData.checkOutAddress || sessionData.check_out_address,
              check_out_timestamp: sessionData.checkOutTimestamp || sessionData.check_out_timestamp,
              total_hours: sessionData.totalHours || sessionData.total_hours,
              break_hours: sessionData.breakHours || sessionData.break_hours,
              working_hours: sessionData.workingHours || sessionData.working_hours,
              status: sessionData.status,
              service_notes: sessionData.serviceNotes || sessionData.service_notes,
              customer_signature: sessionData.customerSignature || sessionData.customer_signature,
              updated_at: new Date().toISOString(),
            };

            if (sessionData.id) {
              // Update existing session
              const { error } = await admin
                .from('mobile_service_sessions')
                .update(data)
                .eq('id', sessionData.id)
                .eq('tenant_id', tenantId);

              if (error) {
                results.sessions.errors.push(
                  `Failed to update session ${sessionData.id}: ${error.message}`,
                );
              } else {
                results.sessions.updated++;
              }
            } else {
              // Create new session
              data.created_at = new Date().toISOString();
              const { error } = await admin.from('mobile_service_sessions').insert(data);

              if (error) {
                results.sessions.errors.push(`Failed to create session: ${error.message}`);
              } else {
                results.sessions.created++;
              }
            }
          } catch (err) {
            results.sessions.errors.push(`Session processing error: ${err}`);
          }
        }
      }

      // Process photo metadata
      if (body.photos && Array.isArray(body.photos)) {
        for (const photoData of body.photos) {
          try {
            const data = {
              tenant_id: tenantId,
              service_ticket_id: photoData.serviceTicketId || photoData.service_ticket_id,
              session_id: photoData.sessionId || photoData.session_id,
              file_name: photoData.fileName || photoData.file_name,
              original_name: photoData.originalName || photoData.original_name,
              mime_type: photoData.mimeType || photoData.mime_type || 'image/jpeg',
              file_size: photoData.fileSize || photoData.file_size,
              object_path: photoData.objectPath || photoData.object_path,
              latitude: photoData.latitude,
              longitude: photoData.longitude,
              address: photoData.address,
              category: photoData.category || 'during',
              description: photoData.description,
              taken_at: photoData.takenAt || photoData.taken_at,
              uploaded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            };

            const { error } = await admin.from('service_photos').insert(data);

            if (error) {
              results.photos.errors.push(`Failed to create photo: ${error.message}`);
            } else {
              results.photos.created++;
            }
          } catch (err) {
            results.photos.errors.push(`Photo processing error: ${err}`);
          }
        }
      }

      // Process time tracking entries
      if (body.timeEntries && Array.isArray(body.timeEntries)) {
        for (const entryData of body.timeEntries) {
          try {
            const data = {
              tenant_id: tenantId,
              session_id: entryData.sessionId || entryData.session_id,
              latitude: entryData.latitude,
              longitude: entryData.longitude,
              address: entryData.address,
              check_in_type: entryData.checkInType || entryData.check_in_type,
              timestamp: entryData.timestamp,
              notes: entryData.notes,
              created_at: new Date().toISOString(),
            };

            const { error } = await admin.from('time_tracking_entries').insert(data);

            if (error) {
              results.timeEntries.errors.push(`Failed to create time entry: ${error.message}`);
            } else {
              results.timeEntries.created++;
            }
          } catch (err) {
            results.timeEntries.errors.push(`Time entry processing error: ${err}`);
          }
        }
      }

      // Process location history
      if (body.locationHistory && Array.isArray(body.locationHistory)) {
        for (const locationData of body.locationHistory) {
          try {
            const data = {
              tenant_id: tenantId,
              technician_id: locationData.technicianId || locationData.technician_id || user.id,
              session_id: locationData.sessionId || locationData.session_id,
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              accuracy: locationData.accuracy,
              address: locationData.address,
              timestamp: locationData.timestamp,
              speed: locationData.speed,
              heading: locationData.heading,
              created_at: new Date().toISOString(),
            };

            const { error } = await admin.from('location_history').insert(data);

            if (error) {
              results.locationHistory.errors.push(
                `Failed to create location entry: ${error.message}`,
              );
            } else {
              results.locationHistory.created++;
            }
          } catch (err) {
            results.locationHistory.errors.push(`Location history processing error: ${err}`);
          }
        }
      }

      const hasErrors =
        results.sessions.errors.length > 0 ||
        results.photos.errors.length > 0 ||
        results.timeEntries.errors.length > 0 ||
        results.locationHistory.errors.length > 0;

      return createCorsResponse(
        {
          success: !hasErrors,
          syncedAt: new Date().toISOString(),
          results,
          summary: {
            sessionsCreated: results.sessions.created,
            sessionsUpdated: results.sessions.updated,
            photosCreated: results.photos.created,
            timeEntriesCreated: results.timeEntries.created,
            locationEntriesCreated: results.locationHistory.created,
            totalErrors:
              results.sessions.errors.length +
              results.photos.errors.length +
              results.timeEntries.errors.length +
              results.locationHistory.errors.length,
          },
        },
        hasErrors ? 207 : 200, // 207 Multi-Status if partial success
        req,
      );
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in mobile function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
