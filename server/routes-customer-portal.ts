import { Router } from 'express';
import { db } from './db';
import { 
  customerPortalAccess, 
  customerServiceRequests, 
  customerMeterSubmissions,
  customerSupplyOrders,
  customerPayments,
  customerNotifications,
  customerPortalActivityLog
} from '../shared/schema';
import {
  customerSatisfactionSurveys,
  customerSatisfactionSurveyTemplates,
  customerSatisfactionSurveyQuestions,
  customerSatisfactionSurveyResponses,
  customerSatisfactionAnalytics
} from '../shared/customer-portal-schema';
import { 
  equipmentHealthRequestSchema,
  scheduleMaintenanceRequestSchema,
  usageAnalyticsRequestSchema,
  equipmentUsageDetailRequestSchema,
  maintenanceSchedulingRequestSchema,
  availabilityRequestSchema,
  rescheduleAppointmentSchema,
  insertCustomerServiceRequestSchema,
  updateServiceRequestStatusSchema,
  insertCustomerSatisfactionSurveySchema,
  insertCustomerSatisfactionSurveyResponseSchema,
  type EquipmentHealthRequest,
  type ScheduleMaintenanceRequest,
  type UsageAnalyticsRequest,
  type EquipmentUsageDetailRequest,
  type MaintenanceSchedulingRequest,
  type AvailabilityRequest,
  type RescheduleAppointmentRequest,
  type CustomerSatisfactionSurvey,
  type CustomerSatisfactionSurveyTemplate,
  type CustomerSatisfactionSurveyQuestion,
  type CustomerSatisfactionSurveyResponse,
  type CustomerSatisfactionAnalytics
} from '../shared/customer-portal-schema';
import { eq, and, desc } from 'drizzle-orm';
import { CustomerPortalService } from './services/customer-portal-service';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest
} from './middleware/rbac-route-helper';

// Enhanced auth middleware with customer portal validation
const requireAuth = (req: any, res: any, next: any) => {
  // Check for session-based auth (legacy) or user object (current)
  const isAuthenticated =
    req.session?.userId || req.user?.id || req.user?.claims?.sub;

  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Add user context for backwards compatibility
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || req.user?.tenantId,
    };
  } else if (!req.user.tenantId && !req.user.id) {
    // If we have user claims but no structured user object, build it
    req.user = {
      id: req.user.claims?.sub || req.user.id,
      tenantId: req.user.tenantId || req.session?.tenantId,
    };
  }

  next();
};

// Customer portal specific auth middleware
const requireCustomerPortalAuth = async (req: any, res: any, next: any) => {
  try {
    // First check standard auth
    const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
    
    if (!isAuthenticated) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const tenantId = req.user?.tenantId || req.session?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    // For customer portal routes, validate customer portal session
    const sessionToken = req.headers['x-portal-session'] || req.session?.portalSessionToken;
    
    if (sessionToken) {
      // Validate customer portal session
      const customerPortalUser = await customerPortalService.validateSession(sessionToken);
      if (customerPortalUser) {
        req.customerPortalUser = customerPortalUser;
        req.user.customerId = customerPortalUser.customerId;
      }
    }

    // For equipment health and customer-specific routes, ensure we have customer context
    if (req.path.includes('/equipment-') || req.path.includes('/customer-')) {
      if (!req.user.customerId && !req.customerPortalUser) {
        return res.status(403).json({ 
          message: "Customer context required. Please ensure you're accessing through the customer portal.",
          code: "CUSTOMER_CONTEXT_REQUIRED"
        });
      }
    }

    next();
  } catch (error) {
    console.error('Customer portal auth error:', error);
    return res.status(500).json({ message: "Authentication validation failed" });
  }
};

const router = Router();
const customerPortalService = new CustomerPortalService();

// Apply RBAC context to all customer portal routes
router.use(enhanceUserContext);

// Customer Portal Dashboard - Get portal statistics - requires customer view permission
router.get('/dashboard/stats',
  
  requirePermission([PERMISSIONS.SALES.CUSTOMER.VIEW_OWN, PERMISSIONS.SALES.CUSTOMER.VIEW_TEAM]),
  async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    // Get total counts for dashboard metrics
    const [
      portalUsersCount,
      serviceRequestsCount,
      meterSubmissionsCount,
      supplyOrdersCount,
      paymentsCount,
      notificationsCount
    ] = await Promise.all([
      db.select().from(customerPortalAccess).where(eq(customerPortalAccess.tenantId, tenantId)),
      db.select().from(customerServiceRequests).where(eq(customerServiceRequests.tenantId, tenantId)),
      db.select().from(customerMeterSubmissions).where(eq(customerMeterSubmissions.tenantId, tenantId)),
      db.select().from(customerSupplyOrders).where(eq(customerSupplyOrders.tenantId, tenantId)),
      db.select().from(customerPayments).where(eq(customerPayments.tenantId, tenantId)),
      db.select().from(customerNotifications).where(eq(customerNotifications.tenantId, tenantId))
    ]);

    const stats = {
      totalPortalUsers: portalUsersCount.length,
      totalServiceRequests: serviceRequestsCount.length,
      totalMeterSubmissions: meterSubmissionsCount.length,
      totalSupplyOrders: supplyOrdersCount.length,
      totalPayments: paymentsCount.length,
      totalNotifications: notificationsCount.length,
      activeUsers: portalUsersCount.filter(user => user.status === 'active').length,
      pendingRequests: serviceRequestsCount.filter(request => request.status === 'submitted').length,
      unreadNotifications: notificationsCount.filter(notification => !notification.isPortalRead).length
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching customer portal stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch customer portal statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all portal users for a tenant
router.get('/users', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    const users = await db
      .select()
      .from(customerPortalAccess)
      .where(eq(customerPortalAccess.tenantId, tenantId))
      .orderBy(desc(customerPortalAccess.createdAt));

    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching customer portal users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch portal users',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent service requests
router.get('/service-requests/recent', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    
    const requests = await db
      .select()
      .from(customerServiceRequests)
      .where(eq(customerServiceRequests.tenantId, tenantId))
      .orderBy(desc(customerServiceRequests.submittedAt))
      .limit(limit);

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error fetching recent service requests:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recent service requests',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent meter submissions
router.get('/meter-submissions/recent', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    
    const submissions = await db
      .select()
      .from(customerMeterSubmissions)
      .where(eq(customerMeterSubmissions.tenantId, tenantId))
      .orderBy(desc(customerMeterSubmissions.submissionDate))
      .limit(limit);

    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching recent meter submissions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recent meter submissions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test database connectivity
router.get('/test', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Test all customer portal tables exist
    const tableTests = await Promise.all([
      db.select().from(customerPortalAccess).limit(1),
      db.select().from(customerServiceRequests).limit(1),
      db.select().from(customerMeterSubmissions).limit(1),
      db.select().from(customerSupplyOrders).limit(1),
      db.select().from(customerPayments).limit(1),
      db.select().from(customerNotifications).limit(1),
      db.select().from(customerPortalActivityLog).limit(1)
    ]);

    res.json({ 
      success: true, 
      message: 'Customer portal database tables are properly configured',
      tablesVerified: [
        'customer_portal_access',
        'customer_service_requests', 
        'customer_meter_submissions',
        'customer_supply_orders',
        'customer_payments',
        'customer_notifications',
        'customer_portal_activity_log'
      ],
      tenantId
    });
  } catch (error) {
    console.error('Error testing customer portal database:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============= EQUIPMENT HEALTH MONITORING ROUTES =============

// Get equipment health data - SECURE VERSION with proper authorization
router.get('/equipment-health', requireCustomerPortalAuth, async (req, res) => {
  try {
    // Validate request parameters with Zod
    const validationResult = equipmentHealthRequestSchema.safeParse({
      timeRange: req.query.timeRange,
      equipmentIds: req.query.equipmentIds ? JSON.parse(req.query.equipmentIds as string) : undefined,
      includeAlerts: req.query.includeAlerts === 'true',
      includeMetrics: req.query.includeMetrics === 'true'
    });

    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid request parameters",
        errors: validationResult.error.format()
      });
    }

    const { timeRange, equipmentIds, includeAlerts, includeMetrics } = validationResult.data;
    
    // Use authenticated user's context - NO client-provided tenant/customer IDs
    const tenantId = req.user.tenantId;
    const customerId = req.user.customerId || req.customerPortalUser?.customerId;
    
    if (!tenantId || !customerId) {
      return res.status(403).json({ 
        success: false,
        message: "Access denied: missing tenant or customer context" 
      });
    }

    // Verify customer belongs to tenant (additional security check)
    await customerPortalService.verifyCustomerAccess(tenantId, customerId);

    const routeStartTime = Date.now();
    const fields = req.query.fields ? (req.query.fields as string).split(',') : undefined;

    const result = await customerPortalService.getEquipmentHealthData(
      tenantId, 
      customerId, 
      timeRange,
      { equipmentIds, includeAlerts, includeMetrics, fields }
    );

    const totalDuration = Date.now() - routeStartTime;

    res.json({
      success: true,
      data: result.data,
      total: result.total,
      meta: {
        totalCount: result.total,
        timeRange,
        lastUpdated: new Date().toISOString(),
        totalDuration,
        queryDuration: result.queryDuration
      }
    });
  } catch (error) {
    console.error('Error fetching equipment health data:', error);
    
    if (error.message === 'CUSTOMER_ACCESS_DENIED') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: customer does not belong to your tenant',
        code: 'CUSTOMER_ACCESS_DENIED'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch equipment health data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Schedule equipment maintenance - SECURE VERSION with proper authorization
router.post('/equipment-maintenance', requireCustomerPortalAuth, async (req, res) => {
  try {
    // Validate request body with Zod
    const validationResult = scheduleMaintenanceRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.format()
      });
    }

    const { equipmentId, preferredDate, maintenanceType, notes, urgency } = validationResult.data;
    
    // Use authenticated user's context - NO client-provided IDs
    const tenantId = req.user.tenantId;
    const customerId = req.user.customerId || req.customerPortalUser?.customerId;
    const customerPortalUserId = req.customerPortalUser?.id;
    
    if (!tenantId || !customerId || !customerPortalUserId) {
      return res.status(403).json({ 
        success: false,
        message: "Access denied: insufficient authentication context" 
      });
    }

    // Verify equipment belongs to customer (prevent IDOR)
    await customerPortalService.verifyEquipmentOwnership(tenantId, customerId, equipmentId);

    const maintenanceRequest = await customerPortalService.scheduleEquipmentMaintenance(
      tenantId,
      customerId,
      customerPortalUserId,
      equipmentId,
      preferredDate,
      maintenanceType,
      notes,
      urgency
    );

    res.json({ success: true, maintenanceRequest });
  } catch (error) {
    console.error('Error scheduling equipment maintenance:', error);
    
    if (error.message === 'EQUIPMENT_ACCESS_DENIED') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: equipment does not belong to your account',
        code: 'EQUIPMENT_ACCESS_DENIED'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to schedule equipment maintenance',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get equipment usage analytics - SECURE VERSION with proper authorization
router.get('/equipment-analytics/:equipmentId', requireCustomerPortalAuth, async (req, res) => {
  try {
    const equipmentId = req.params.equipmentId;
    const timeRange = req.query.timeRange as string || '30d';
    
    if (!equipmentId) {
      return res.status(400).json({ 
        success: false,
        message: "Equipment ID is required" 
      });
    }

    // Use authenticated user's context - NO client-provided IDs
    const tenantId = req.user.tenantId;
    const customerId = req.user.customerId || req.customerPortalUser?.customerId;
    
    if (!tenantId || !customerId) {
      return res.status(403).json({ 
        success: false,
        message: "Access denied: missing tenant or customer context" 
      });
    }

    // Verify equipment belongs to customer (prevent IDOR)
    await customerPortalService.verifyEquipmentOwnership(tenantId, customerId, equipmentId);

    const analytics = await customerPortalService.getEquipmentUsageAnalytics(
      tenantId,
      customerId,
      equipmentId,
      timeRange
    );

    res.json({ success: true, analytics });
  } catch (error) {
    console.error('Error fetching equipment usage analytics:', error);
    
    if (error.message === 'EQUIPMENT_ACCESS_DENIED') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: equipment does not belong to your account',
        code: 'EQUIPMENT_ACCESS_DENIED'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch equipment usage analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =====================================================================
// USAGE ANALYTICS ENDPOINTS
// =====================================================================

// Get comprehensive usage analytics - NEW ENDPOINT for analytics dashboard
router.get('/usage-analytics', requireCustomerPortalAuth, async (req, res) => {
  try {
    // Validate and parse query parameters
    const validationResult = usageAnalyticsRequestSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request parameters',
        errors: validationResult.error.errors
      });
    }

    const options: UsageAnalyticsRequest = validationResult.data;
    
    // Use authenticated user's context - NO client-provided IDs
    const tenantId = req.user.tenantId;
    const customerId = req.user.customerId || req.customerPortalUser?.customerId;
    
    if (!tenantId || !customerId) {
      return res.status(403).json({ 
        success: false,
        message: "Access denied: missing tenant or customer context" 
      });
    }

    // Verify customer access 
    await customerPortalService.verifyCustomerAccess(tenantId, customerId);

    const analytics = await customerPortalService.getUsageAnalytics(
      tenantId,
      customerId,
      options
    );

    const meta = {
      totalReadings: 0, // Will be calculated in service
      timeRange: options.timeRange,
      lastUpdated: analytics.lastUpdated,
      equipmentCount: analytics.equipmentUsage.length
    };

    res.json({ 
      success: true, 
      data: analytics,
      meta 
    });
  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    
    if (error.message === 'CUSTOMER_ACCESS_DENIED') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: customer does not belong to your account',
        code: 'CUSTOMER_ACCESS_DENIED'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch usage analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get detailed equipment usage analytics
router.get('/equipment-usage/:equipmentId', requireCustomerPortalAuth, async (req, res) => {
  try {
    const equipmentId = req.params.equipmentId;
    
    // Validate and parse query parameters
    const validationResult = equipmentUsageDetailRequestSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request parameters',
        errors: validationResult.error.errors
      });
    }

    const options: EquipmentUsageDetailRequest = validationResult.data;
    
    if (!equipmentId) {
      return res.status(400).json({ 
        success: false,
        message: "Equipment ID is required" 
      });
    }

    // Use authenticated user's context - NO client-provided IDs
    const tenantId = req.user.tenantId;
    const customerId = req.user.customerId || req.customerPortalUser?.customerId;
    
    if (!tenantId || !customerId) {
      return res.status(403).json({ 
        success: false,
        message: "Access denied: missing tenant or customer context" 
      });
    }

    // Verify equipment belongs to customer (prevent IDOR)
    await customerPortalService.verifyEquipmentOwnership(tenantId, customerId, equipmentId);

    // Get detailed analytics for specific equipment
    const analytics = await customerPortalService.getUsageAnalytics(
      tenantId,
      customerId,
      {
        timeRange: options.timeRange,
        equipmentIds: [equipmentId],
        includeComparison: options.includeCostAnalysis,
        includeCosts: options.includeCostAnalysis,
        includeRecommendations: true,
        periodType: options.includeHourlyBreakdown ? 'daily' : 'weekly'
      }
    );

    res.json({ 
      success: true, 
      data: analytics,
      equipment: analytics.equipmentUsage.find(eq => eq.equipmentId === equipmentId)
    });
  } catch (error) {
    console.error('Error fetching equipment usage details:', error);
    
    if (error.message === 'EQUIPMENT_ACCESS_DENIED') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: equipment does not belong to your account',
        code: 'EQUIPMENT_ACCESS_DENIED'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch equipment usage details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// MAINTENANCE SCHEDULING ENDPOINTS
// =============================================================================

// Get available time slots for maintenance scheduling
router.get('/maintenance-availability', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    const validation = availabilityRequestSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request parameters',
        errors: validation.error.errors 
      });
    }

    const availabilityRequest = validation.data;
    const availability = await customerPortalService.getAvailableTimeSlots(
      tenantId,
      customerId,
      availabilityRequest
    );

    res.json({ 
      success: true, 
      data: availability 
    });
  } catch (error) {
    console.error('Error fetching available time slots:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch available time slots',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Book a maintenance appointment
router.post('/maintenance-appointments', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const portalUserId = req.customerPortalUser?.id;

    if (!tenantId || !customerId || !portalUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant, customer, or portal user context' 
      });
    }

    const validation = maintenanceSchedulingRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid appointment data',
        errors: validation.error.errors 
      });
    }

    const appointmentRequest = validation.data;
    const appointment = await customerPortalService.bookMaintenanceAppointment(
      tenantId,
      customerId,
      portalUserId,
      appointmentRequest
    );

    res.status(201).json({ 
      success: true, 
      data: appointment,
      message: 'Maintenance appointment booked successfully'
    });
  } catch (error) {
    console.error('Error booking maintenance appointment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to book maintenance appointment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get customer maintenance appointments
router.get('/maintenance-appointments', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    const { status, includeCompleted, limit } = req.query;
    const options = {
      status: status as string,
      includeCompleted: includeCompleted === 'true',
      limit: limit ? parseInt(limit as string) : undefined
    };

    const appointments = await customerPortalService.getCustomerAppointments(
      tenantId,
      customerId,
      options
    );

    res.json({ 
      success: true, 
      data: appointments 
    });
  } catch (error) {
    console.error('Error fetching customer appointments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch customer appointments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific appointment details
router.get('/maintenance-appointments/:appointmentId', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const { appointmentId } = req.params;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    const appointment = await customerPortalService.getAppointmentById(
      tenantId,
      customerId,
      appointmentId
    );

    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Appointment not found' 
      });
    }

    res.json({ 
      success: true, 
      data: appointment 
    });
  } catch (error) {
    console.error('Error fetching appointment details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch appointment details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Reschedule a maintenance appointment
router.put('/maintenance-appointments/:appointmentId/reschedule', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const portalUserId = req.customerPortalUser?.id;
    const { appointmentId } = req.params;

    if (!tenantId || !customerId || !portalUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant, customer, or portal user context' 
      });
    }

    const validation = rescheduleAppointmentSchema.safeParse({
      appointmentId,
      ...req.body
    });
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid reschedule data',
        errors: validation.error.errors 
      });
    }

    const rescheduleRequest = validation.data;
    const updatedAppointment = await customerPortalService.rescheduleAppointment(
      tenantId,
      customerId,
      portalUserId,
      rescheduleRequest
    );

    res.json({ 
      success: true, 
      data: updatedAppointment,
      message: 'Appointment rescheduled successfully'
    });
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    
    if (error.message === 'Appointment not found') {
      return res.status(404).json({ 
        success: false, 
        message: 'Appointment not found' 
      });
    }
    
    if (error.message.includes('Cannot reschedule')) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reschedule appointment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel a maintenance appointment
router.delete('/maintenance-appointments/:appointmentId', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const portalUserId = req.customerPortalUser?.id;
    const { appointmentId } = req.params;
    const { reason } = req.body;

    if (!tenantId || !customerId || !portalUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant, customer, or portal user context' 
      });
    }

    const cancelledAppointment = await customerPortalService.cancelAppointment(
      tenantId,
      customerId,
      portalUserId,
      appointmentId,
      reason
    );

    res.json({ 
      success: true, 
      data: cancelledAppointment,
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    
    if (error.message === 'Appointment not found') {
      return res.status(404).json({ 
        success: false, 
        message: 'Appointment not found' 
      });
    }
    
    if (error.message.includes('Cannot cancel')) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel appointment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// SERVICE REQUESTS ENDPOINTS
// =============================================================================

// Create a new service request
router.post('/service-requests', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const portalUserId = req.customerPortalUser?.id;

    if (!tenantId || !customerId || !portalUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant, customer, or portal user context' 
      });
    }

    // Validate request body using shared schema
    const validationResult = insertCustomerServiceRequestSchema.safeParse({
      ...req.body,
      tenantId,
      customerId,
      customerPortalUserId: portalUserId
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
        errors: validationResult.error.errors
      });
    }

    const serviceRequest = await customerPortalService.submitServiceRequest(
      tenantId,
      customerId,
      portalUserId,
      validationResult.data
    );

    res.json({ 
      success: true, 
      data: serviceRequest,
      message: 'Service request created successfully'
    });
  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create service request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get customer's service requests
router.get('/service-requests', requireCustomerPortalAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    // Parse query parameters
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const fields = req.query.fields ? (req.query.fields as string).split(',') : undefined;

    const result = await customerPortalService.getCustomerServiceRequests(
      tenantId,
      customerId,
      { status, limit, offset, fields }
    );

    const totalDuration = Date.now() - startTime;

    res.json({ 
      success: true, 
      data: result.data,
      total: result.total,
      meta: {
        limit,
        offset,
        count: result.data.length,
        totalDuration,
        queryDuration: result.queryDuration
      }
    });
  } catch (error) {
    console.error('Error fetching service requests:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch service requests',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific service request by ID
router.get('/service-requests/:requestId', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const { requestId } = req.params;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    const serviceRequest = await customerPortalService.getServiceRequestById(
      tenantId,
      customerId,
      requestId
    );

    if (!serviceRequest) {
      return res.status(404).json({ 
        success: false, 
        message: 'Service request not found' 
      });
    }

    res.json({ 
      success: true, 
      data: serviceRequest
    });
  } catch (error) {
    console.error('Error fetching service request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch service request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Get service request status history timeline (customer facing)
router.get('/service-requests/:requestId/history', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const { requestId } = req.params;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    const statusHistory = await customerPortalService.getServiceRequestStatusHistory(
      tenantId,
      customerId,
      requestId
    );

    res.json({ 
      success: true, 
      data: statusHistory,
      count: statusHistory.length
    });
  } catch (error) {
    console.error('Error fetching service request status history:', error);
    
    if (error.message === 'Service request not found') {
      return res.status(404).json({ 
        success: false, 
        message: 'Service request not found' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch service request status history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// CUSTOMER SATISFACTION RATING ENDPOINTS
// =============================================================================

// Get available satisfaction surveys for the customer
router.get('/satisfaction/surveys', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const portalUserId = req.customerPortalUser?.id;

    if (!tenantId || !customerId || !portalUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant, customer, or portal user context' 
      });
    }

    // Find surveys available for this customer (invited or in progress)
    const availableSurveys = await db
      .select({
        id: customerSatisfactionSurveys.id,
        surveyType: customerSatisfactionSurveys.surveyType,
        status: customerSatisfactionSurveys.status,
        invitationSentAt: customerSatisfactionSurveys.invitationSentAt,
        firstViewedAt: customerSatisfactionSurveys.firstViewedAt,
        startedAt: customerSatisfactionSurveys.startedAt,
        completedAt: customerSatisfactionSurveys.completedAt,
        expiresAt: customerSatisfactionSurveys.expiresAt,
        overallScore: customerSatisfactionSurveys.overallScore,
        npsScore: customerSatisfactionSurveys.npsScore,
        relatedServiceRequestId: customerSatisfactionSurveys.relatedServiceRequestId,
        relatedMaintenanceAppointmentId: customerSatisfactionSurveys.relatedMaintenanceAppointmentId,
        templateName: customerSatisfactionSurveyTemplates.name,
        templateDescription: customerSatisfactionSurveyTemplates.description
      })
      .from(customerSatisfactionSurveys)
      .leftJoin(
        customerSatisfactionSurveyTemplates,
        eq(customerSatisfactionSurveys.templateId, customerSatisfactionSurveyTemplates.id)
      )
      .where(
        and(
          eq(customerSatisfactionSurveys.tenantId, tenantId),
          eq(customerSatisfactionSurveys.customerId, customerId)
        )
      )
      .orderBy(desc(customerSatisfactionSurveys.createdAt));

    res.json({ 
      success: true, 
      data: availableSurveys,
      count: availableSurveys.length
    });
  } catch (error) {
    console.error('Error fetching satisfaction surveys:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch satisfaction surveys',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific survey details with questions
router.get('/satisfaction/surveys/:surveyId', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const { surveyId } = req.params;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    // Get survey details
    const surveyDetails = await db
      .select()
      .from(customerSatisfactionSurveys)
      .where(
        and(
          eq(customerSatisfactionSurveys.id, surveyId),
          eq(customerSatisfactionSurveys.tenantId, tenantId),
          eq(customerSatisfactionSurveys.customerId, customerId)
        )
      )
      .limit(1);

    if (surveyDetails.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Survey not found' 
      });
    }

    const survey = surveyDetails[0];

    // Check if survey is expired
    if (survey.expiresAt && new Date() > new Date(survey.expiresAt)) {
      return res.status(410).json({ 
        success: false, 
        message: 'Survey has expired' 
      });
    }

    // Get survey questions
    const questions = await db
      .select()
      .from(customerSatisfactionSurveyQuestions)
      .where(eq(customerSatisfactionSurveyQuestions.templateId, survey.templateId))
      .orderBy(customerSatisfactionSurveyQuestions.orderIndex);

    // Get existing responses if any
    const existingResponses = await db
      .select()
      .from(customerSatisfactionSurveyResponses)
      .where(eq(customerSatisfactionSurveyResponses.surveyId, surveyId));

    // Update first viewed timestamp if not set
    if (!survey.firstViewedAt) {
      await db
        .update(customerSatisfactionSurveys)
        .set({ 
          firstViewedAt: new Date(),
          status: survey.status === 'invited' ? 'started' : survey.status
        })
        .where(eq(customerSatisfactionSurveys.id, surveyId));
    }

    res.json({ 
      success: true, 
      data: {
        survey,
        questions,
        existingResponses
      }
    });
  } catch (error) {
    console.error('Error fetching survey details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch survey details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start a survey (mark as started)
router.post('/satisfaction/surveys/:surveyId/start', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const { surveyId } = req.params;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    // Verify survey exists and belongs to customer
    const survey = await db
      .select()
      .from(customerSatisfactionSurveys)
      .where(
        and(
          eq(customerSatisfactionSurveys.id, surveyId),
          eq(customerSatisfactionSurveys.tenantId, tenantId),
          eq(customerSatisfactionSurveys.customerId, customerId)
        )
      )
      .limit(1);

    if (survey.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Survey not found' 
      });
    }

    const surveyRecord = survey[0];

    // Check if survey is expired
    if (surveyRecord.expiresAt && new Date() > new Date(surveyRecord.expiresAt)) {
      return res.status(410).json({ 
        success: false, 
        message: 'Survey has expired' 
      });
    }

    // Check if survey is already completed
    if (surveyRecord.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Survey is already completed' 
      });
    }

    // Update survey status to started
    const updatedSurvey = await db
      .update(customerSatisfactionSurveys)
      .set({ 
        startedAt: surveyRecord.startedAt || new Date(),
        firstViewedAt: surveyRecord.firstViewedAt || new Date(),
        status: 'started',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      })
      .where(eq(customerSatisfactionSurveys.id, surveyId))
      .returning();

    res.json({ 
      success: true, 
      data: updatedSurvey[0],
      message: 'Survey started successfully'
    });
  } catch (error) {
    console.error('Error starting survey:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start survey',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Submit survey responses
router.post('/satisfaction/surveys/:surveyId/submit', requireCustomerPortalAuth, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const { surveyId } = req.params;
    const { responses } = req.body;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Responses array is required' 
      });
    }

    // Verify survey exists and belongs to customer
    const survey = await db
      .select()
      .from(customerSatisfactionSurveys)
      .where(
        and(
          eq(customerSatisfactionSurveys.id, surveyId),
          eq(customerSatisfactionSurveys.tenantId, tenantId),
          eq(customerSatisfactionSurveys.customerId, customerId)
        )
      )
      .limit(1);

    if (survey.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Survey not found' 
      });
    }

    const surveyRecord = survey[0];

    // Check if survey is expired
    if (surveyRecord.expiresAt && new Date() > new Date(surveyRecord.expiresAt)) {
      return res.status(410).json({ 
        success: false, 
        message: 'Survey has expired' 
      });
    }

    // Check if survey is already completed
    if (surveyRecord.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Survey is already completed' 
      });
    }

    // Get survey questions for validation
    const questions = await db
      .select()
      .from(customerSatisfactionSurveyQuestions)
      .where(eq(customerSatisfactionSurveyQuestions.templateId, surveyRecord.templateId));

    const questionMap = new Map(questions.map(q => [q.id, q]));

    // Validate and prepare responses
    const validatedResponses = [];
    for (const response of responses) {
      const question = questionMap.get(response.questionId);
      if (!question) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid question ID: ${response.questionId}` 
        });
      }

      // Validate response based on question type
      const validationResult = insertCustomerSatisfactionSurveyResponseSchema.safeParse({
        surveyId,
        questionId: response.questionId,
        ratingValue: response.ratingValue,
        textValue: response.textValue,
        selectedOptions: response.selectedOptions,
        booleanValue: response.booleanValue,
        timeSpentSeconds: response.timeSpentSeconds,
        responseOrder: response.responseOrder
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid response data',
          errors: validationResult.error.errors 
        });
      }

      validatedResponses.push(validationResult.data);
    }

    // Calculate overall score and NPS score before transaction
    let overallScore = null;
    let npsScore = null;
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const response of validatedResponses) {
      const question = questionMap.get(response.questionId);
      if (question && response.ratingValue !== null) {
        if (question.questionType === 'nps_score' && response.ratingValue !== null) {
          npsScore = response.ratingValue;
        } else if (question.questionType === 'rating_scale' && response.ratingValue !== null) {
          const weight = parseFloat(question.weight || '1.00');
          totalWeightedScore += response.ratingValue * weight;
          totalWeight += weight;
        }
      }
    }

    if (totalWeight > 0) {
      overallScore = Math.round((totalWeightedScore / totalWeight) * 100) / 100;
    }

    // Atomic transaction: delete existing responses, insert new ones, and update survey
    const updatedSurvey = await db.transaction(async (tx) => {
      // Delete existing responses
      await tx
        .delete(customerSatisfactionSurveyResponses)
        .where(eq(customerSatisfactionSurveyResponses.surveyId, surveyId));

      // Insert new responses
      if (validatedResponses.length > 0) {
        await tx
          .insert(customerSatisfactionSurveyResponses)
          .values(validatedResponses);
      }

      // Update survey as completed
      const result = await tx
        .update(customerSatisfactionSurveys)
        .set({ 
          completedAt: new Date(),
          status: 'completed',
          overallScore,
          npsScore
        })
        .where(eq(customerSatisfactionSurveys.id, surveyId))
        .returning();

      return result[0];
    });

    res.json({ 
      success: true, 
      data: {
        survey: updatedSurvey,
        responsesSubmitted: validatedResponses.length,
        overallScore,
        npsScore
      },
      message: 'Survey responses submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting survey responses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit survey responses',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get customer satisfaction analytics/history
router.get('/satisfaction/analytics', requireCustomerPortalAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const tenantId = req.user?.tenantId;
    const customerId = req.user?.customerId;
    const { timeRange = '1y' } = req.query;
    const fields = req.query.fields ? (req.query.fields as string).split(',') : undefined;

    if (!tenantId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing tenant or customer context' 
      });
    }

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '6m':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1y':
      default:
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const queryStartTime = Date.now();
    
    // Build selective field query for payload optimization
    const defaultFields = {
      id: customerSatisfactionSurveys.id,
      surveyType: customerSatisfactionSurveys.surveyType,
      completedAt: customerSatisfactionSurveys.completedAt,
      overallScore: customerSatisfactionSurveys.overallScore,
      npsScore: customerSatisfactionSurveys.npsScore,
      relatedServiceRequestId: customerSatisfactionSurveys.relatedServiceRequestId,
      relatedMaintenanceAppointmentId: customerSatisfactionSurveys.relatedMaintenanceAppointmentId,
      templateName: customerSatisfactionSurveyTemplates.name
    };
    
    const selectFields = fields ? 
      Object.fromEntries(fields
        .filter(field => defaultFields.hasOwnProperty(field))
        .map(field => [field, defaultFields[field as keyof typeof defaultFields]])
      ) : 
      defaultFields;

    // Get completed surveys for this customer
    const completedSurveys = await db
      .select(selectFields)
      .from(customerSatisfactionSurveys)
      .leftJoin(
        customerSatisfactionSurveyTemplates,
        eq(customerSatisfactionSurveys.templateId, customerSatisfactionSurveyTemplates.id)
      )
      .where(
        and(
          eq(customerSatisfactionSurveys.tenantId, tenantId),
          eq(customerSatisfactionSurveys.customerId, customerId),
          eq(customerSatisfactionSurveys.status, 'completed'),
          // Add date filter - using string comparison since completedAt is timestamp
          // TODO: This might need adjustment based on your timestamp format
        )
      )
      .orderBy(desc(customerSatisfactionSurveys.completedAt));

    // Calculate summary statistics
    const totalSurveys = completedSurveys.length;
    const scoresWithValues = completedSurveys.filter(s => s.overallScore !== null);
    const npsScoresWithValues = completedSurveys.filter(s => s.npsScore !== null);
    
    const averageScore = scoresWithValues.length > 0 
      ? scoresWithValues.reduce((sum, s) => sum + s.overallScore, 0) / scoresWithValues.length 
      : null;
    
    const averageNpsScore = npsScoresWithValues.length > 0 
      ? npsScoresWithValues.reduce((sum, s) => sum + s.npsScore, 0) / npsScoresWithValues.length 
      : null;

    // Group by survey type
    const byType = completedSurveys.reduce((acc, survey) => {
      const type = survey.surveyType;
      if (!acc[type]) {
        acc[type] = { count: 0, scores: [], npsScores: [] };
      }
      acc[type].count++;
      if (survey.overallScore !== null) acc[type].scores.push(survey.overallScore);
      if (survey.npsScore !== null) acc[type].npsScores.push(survey.npsScore);
      return acc;
    }, {});

    // Calculate averages by type
    const summaryByType = Object.entries(byType).reduce((acc, [type, data]) => {
      acc[type] = {
        count: data.count,
        averageScore: data.scores.length > 0 
          ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length 
          : null,
        averageNpsScore: data.npsScores.length > 0 
          ? data.npsScores.reduce((sum, score) => sum + score, 0) / data.npsScores.length 
          : null
      };
      return acc;
    }, {});

    const queryDuration = Date.now() - queryStartTime;
    const totalDuration = Date.now() - startTime;

    res.json({ 
      success: true, 
      data: {
        summary: {
          totalSurveys,
          averageScore: averageScore ? Math.round(averageScore * 100) / 100 : null,
          averageNpsScore: averageNpsScore ? Math.round(averageNpsScore * 100) / 100 : null,
          timeRange,
          periodStart: startDate.toISOString(),
          periodEnd: now.toISOString()
        },
        byType: summaryByType,
        recentSurveys: completedSurveys.slice(0, 10) // Latest 10 surveys
      },
      meta: {
        totalSurveys,
        timeRange,
        totalDuration,
        queryDuration,
        fieldsOptimized: fields ? true : false
      }
    });
  } catch (error) {
    console.error('Error fetching satisfaction analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch satisfaction analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;