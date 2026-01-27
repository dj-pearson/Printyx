// Fleet Management Edge Function
// Handles vehicle fleet tracking and management
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
    const endpoint = pathParts[1];
    const vehicleId = pathParts[2];

    // GET /fleet/vehicles - List vehicles
    if (req.method === 'GET' && endpoint === 'vehicles' && !vehicleId) {
      const status = url.searchParams.get('status');
      const assignedTo = url.searchParams.get('assignedTo');

      let query = admin
        .from('fleet_vehicles')
        .select(
          `
          *,
          assigned_technician:assigned_to (
            id,
            full_name
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('vehicle_number', { ascending: true });

      if (status) query = query.eq('status', status);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);

      const { data: vehicles, error } = await query;

      if (error) {
        console.error('Error fetching fleet vehicles:', error);
        return createCorsResponse({ error: 'Failed to fetch vehicles' }, 500, req);
      }

      return createCorsResponse(vehicles || [], 200, req);
    }

    // GET /fleet/vehicles/:id - Get single vehicle
    if (req.method === 'GET' && endpoint === 'vehicles' && vehicleId) {
      const { data: vehicle, error } = await admin
        .from('fleet_vehicles')
        .select('*')
        .eq('id', vehicleId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Vehicle not found' }, 404, req);
      }

      // Get maintenance history
      const { data: maintenance } = await admin
        .from('fleet_maintenance')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('service_date', { ascending: false })
        .limit(20);

      // Get fuel logs
      const { data: fuelLogs } = await admin
        .from('fleet_fuel_logs')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('fill_date', { ascending: false })
        .limit(20);

      return createCorsResponse(
        {
          ...vehicle,
          maintenanceHistory: maintenance || [],
          fuelLogs: fuelLogs || [],
        },
        200,
        req,
      );
    }

    // POST /fleet/vehicles - Add vehicle
    if (req.method === 'POST' && endpoint === 'vehicles') {
      const body = await req.json();

      const vehicleData = {
        tenant_id: tenantId,
        vehicle_number: body.vehicleNumber || body.vehicle_number,
        vin: body.vin,
        make: body.make,
        model: body.model,
        year: body.year,
        license_plate: body.licensePlate || body.license_plate,
        color: body.color,
        status: body.status || 'available',
        assigned_to: body.assignedTo || body.assigned_to,
        current_mileage: body.currentMileage || body.current_mileage || 0,
        fuel_type: body.fuelType || body.fuel_type || 'gasoline',
        fuel_capacity: body.fuelCapacity || body.fuel_capacity,
        purchase_date: body.purchaseDate || body.purchase_date,
        purchase_price: body.purchasePrice || body.purchase_price,
        insurance_expiry: body.insuranceExpiry || body.insurance_expiry,
        registration_expiry: body.registrationExpiry || body.registration_expiry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: vehicle, error } = await admin
        .from('fleet_vehicles')
        .insert(vehicleData)
        .select()
        .single();

      if (error) {
        console.error('Error adding vehicle:', error);
        return createCorsResponse({ error: 'Failed to add vehicle' }, 500, req);
      }

      return createCorsResponse(vehicle, 201, req);
    }

    // PUT /fleet/vehicles/:id - Update vehicle
    if (req.method === 'PUT' && endpoint === 'vehicles' && vehicleId) {
      const body = await req.json();

      const { data: vehicle, error } = await admin
        .from('fleet_vehicles')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', vehicleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update vehicle' }, 500, req);
      }

      return createCorsResponse(vehicle, 200, req);
    }

    // POST /fleet/maintenance - Log maintenance
    if (req.method === 'POST' && endpoint === 'maintenance') {
      const body = await req.json();

      const { data: maintenance, error } = await admin
        .from('fleet_maintenance')
        .insert({
          tenant_id: tenantId,
          vehicle_id: body.vehicleId || body.vehicle_id,
          service_type: body.serviceType || body.service_type,
          description: body.description,
          service_date: body.serviceDate || body.service_date || new Date().toISOString(),
          mileage_at_service: body.mileageAtService || body.mileage_at_service,
          cost: body.cost,
          vendor: body.vendor,
          invoice_number: body.invoiceNumber || body.invoice_number,
          next_service_date: body.nextServiceDate || body.next_service_date,
          next_service_mileage: body.nextServiceMileage || body.next_service_mileage,
          performed_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to log maintenance' }, 500, req);
      }

      // Update vehicle mileage
      if (body.mileageAtService || body.mileage_at_service) {
        await admin
          .from('fleet_vehicles')
          .update({
            current_mileage: body.mileageAtService || body.mileage_at_service,
            last_service_date: body.serviceDate || body.service_date || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.vehicleId || body.vehicle_id);
      }

      return createCorsResponse(maintenance, 201, req);
    }

    // POST /fleet/fuel-log - Log fuel fill-up
    if (req.method === 'POST' && endpoint === 'fuel-log') {
      const body = await req.json();

      const { data: fuelLog, error } = await admin
        .from('fleet_fuel_logs')
        .insert({
          tenant_id: tenantId,
          vehicle_id: body.vehicleId || body.vehicle_id,
          fill_date: body.fillDate || body.fill_date || new Date().toISOString(),
          gallons: body.gallons,
          price_per_gallon: body.pricePerGallon || body.price_per_gallon,
          total_cost:
            body.totalCost ||
            body.total_cost ||
            body.gallons * (body.pricePerGallon || body.price_per_gallon),
          odometer_reading: body.odometerReading || body.odometer_reading,
          fuel_type: body.fuelType || body.fuel_type,
          station: body.station,
          logged_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to log fuel' }, 500, req);
      }

      // Update vehicle mileage
      if (body.odometerReading || body.odometer_reading) {
        await admin
          .from('fleet_vehicles')
          .update({
            current_mileage: body.odometerReading || body.odometer_reading,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.vehicleId || body.vehicle_id);
      }

      return createCorsResponse(fuelLog, 201, req);
    }

    // GET /fleet/dashboard - Fleet dashboard stats
    if (req.method === 'GET' && endpoint === 'dashboard') {
      const { count: totalVehicles } = await admin
        .from('fleet_vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      const { count: availableVehicles } = await admin
        .from('fleet_vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'available');

      const { count: inServiceVehicles } = await admin
        .from('fleet_vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'in_service');

      const { data: upcomingMaintenance } = await admin
        .from('fleet_vehicles')
        .select('id, vehicle_number, next_service_date')
        .eq('tenant_id', tenantId)
        .not('next_service_date', 'is', null)
        .lte('next_service_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('next_service_date', { ascending: true })
        .limit(5);

      return createCorsResponse(
        {
          totalVehicles: totalVehicles || 0,
          availableVehicles: availableVehicles || 0,
          inServiceVehicles: inServiceVehicles || 0,
          inMaintenanceVehicles:
            (totalVehicles || 0) - (availableVehicles || 0) - (inServiceVehicles || 0),
          upcomingMaintenance: upcomingMaintenance || [],
        },
        200,
        req,
      );
    }

    // GET /fleet/location - Get vehicle locations (GPS tracking)
    if (req.method === 'GET' && endpoint === 'location') {
      const { data: locations } = await admin
        .from('fleet_vehicle_locations')
        .select(
          `
          *,
          vehicle:vehicle_id (
            id,
            vehicle_number,
            make,
            model
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('timestamp', { ascending: false });

      // Get only latest location per vehicle
      const latestByVehicle = new Map();
      (locations || []).forEach((loc: any) => {
        if (!latestByVehicle.has(loc.vehicle_id)) {
          latestByVehicle.set(loc.vehicle_id, loc);
        }
      });

      return createCorsResponse(Array.from(latestByVehicle.values()), 200, req);
    }

    // DELETE /fleet/vehicles/:id - Delete vehicle
    if (req.method === 'DELETE' && endpoint === 'vehicles' && vehicleId) {
      const { error } = await admin
        .from('fleet_vehicles')
        .delete()
        .eq('id', vehicleId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete vehicle' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Vehicle deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in fleet function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
