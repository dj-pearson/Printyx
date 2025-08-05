import { Router } from 'express';
import { z } from 'zod';
import { CustomerPortalService } from './services/customer-portal-service';
import {
  insertCustomerServiceRequestSchema,
  insertCustomerMeterSubmissionSchema,
  insertCustomerSupplyOrderSchema,
  insertCustomerSupplyOrderItemSchema,
  insertCustomerPaymentSchema,
  serviceRequestTypeEnum,
  serviceRequestPriorityEnum,
  paymentMethodEnum,
  meterSubmissionMethodEnum
} from '../shared/customer-portal-schema';

const router = Router();
const customerPortalService = new CustomerPortalService();

// Validation schemas
const customerLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const createServiceRequestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  type: z.enum(serviceRequestTypeEnum.enumValues),
  priority: z.enum(serviceRequestPriorityEnum.enumValues).default('normal'),
  equipmentSerialNumber: z.string().optional(),
  equipmentModel: z.string().optional(),
  equipmentLocation: z.string().optional(),
  contactName: z.string().min(1).max(100),
  contactPhone: z.string().max(20).optional(),
  contactEmail: z.string().email().optional(),
  preferredDate: z.string().datetime().optional(),
  preferredTime: z.string().max(50).optional(),
  urgencyNotes: z.string().optional(),
  customerNotes: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    url: z.string(),
    size: z.number(),
    type: z.string()
  })).default([])
});

const meterReadingSubmissionSchema = z.object({
  equipmentId: z.string().uuid(),
  equipmentSerialNumber: z.string().min(1),
  totalImpressions: z.number().int().min(0).optional(),
  blackWhiteImpressions: z.number().int().min(0).optional(),
  colorImpressions: z.number().int().min(0).optional(),
  largeFormatImpressions: z.number().int().min(0).optional(),
  scanImpressions: z.number().int().min(0).optional(),
  faxImpressions: z.number().int().min(0).optional(),
  submissionMethod: z.enum(meterSubmissionMethodEnum.enumValues),
  readingDate: z.string().datetime(),
  photoUrls: z.array(z.string().url()).default([]),
  customerNotes: z.string().optional()
});

const supplyOrderSchema = z.object({
  deliveryAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string().default('US')
  }),
  deliveryInstructions: z.string().optional(),
  requestedDeliveryDate: z.string().datetime().optional(),
  purchaseOrderNumber: z.string().optional(),
  customerNotes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productSku: z.string(),
    productName: z.string(),
    productDescription: z.string().optional(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
    customerNotes: z.string().optional()
  })).min(1)
});

const paymentSubmissionSchema = z.object({
  amount: z.number().min(0.01),
  paymentMethod: z.enum(paymentMethodEnum.enumValues),
  invoiceId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  paymentMethodDetails: z.object({
    cardNumber: z.string().optional(),
    expiryMonth: z.number().int().min(1).max(12).optional(),
    expiryYear: z.number().int().optional(),
    cvv: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional()
  }).optional(),
  customerNotes: z.string().optional()
});

// Middleware to validate customer session
const requireCustomerAuth = async (req: any, res: any, next: any) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    const customer = await customerPortalService.validateSession(sessionToken);
    if (!customer) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    console.error('Customer auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Customer Authentication Routes
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = customerLoginSchema.parse(req.body);
    
    const result = await customerPortalService.authenticateCustomer(username, password);
    
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({
      success: true,
      customer: {
        id: result.customer!.id,
        username: result.customer!.username,
        email: result.customer!.email,
        permissions: result.customer!.permissions,
        preferences: result.customer!.preferences,
      },
      sessionToken: result.customer!.sessionToken,
      expiresAt: result.customer!.sessionExpires
    });
  } catch (error) {
    console.error('Customer login error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/auth/logout', requireCustomerAuth, async (req: any, res) => {
  try {
    // Invalidate session by clearing session token
    await customerPortalService.logActivity(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      'logout',
      'Customer logged out',
      undefined,
      undefined,
      req.ip,
      req.get('User-Agent')
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Customer logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await customerPortalService.resetPassword(email);
    res.json(result);
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Dashboard
router.get('/dashboard', requireCustomerAuth, async (req: any, res) => {
  try {
    const summary = await customerPortalService.getCustomerDashboardSummary(
      req.customer.tenantId,
      req.customer.customerId
    );

    await customerPortalService.logActivity(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      'view_dashboard',
      'Viewed dashboard',
      undefined,
      undefined,
      req.ip,
      req.get('User-Agent')
    );

    res.json({ summary });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Service Requests
router.post('/service-requests', requireCustomerAuth, async (req: any, res) => {
  try {
    const validatedData = createServiceRequestSchema.parse(req.body);
    
    const serviceRequest = await customerPortalService.submitServiceRequest(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      validatedData
    );

    res.status(201).json({ serviceRequest });
  } catch (error) {
    console.error('Service request submission error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to submit service request' });
  }
});

router.get('/service-requests', requireCustomerAuth, async (req: any, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const serviceRequests = await customerPortalService.getCustomerServiceRequests(
      req.customer.tenantId,
      req.customer.customerId,
      {
        status: status as string,
        limit: parseInt(limit as string),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string)
      }
    );

    await customerPortalService.logActivity(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      'view_service_requests',
      'Viewed service requests'
    );

    res.json({ serviceRequests });
  } catch (error) {
    console.error('Service requests fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch service requests' });
  }
});

router.get('/service-requests/:id', requireCustomerAuth, async (req: any, res) => {
  try {
    const serviceRequests = await customerPortalService.getCustomerServiceRequests(
      req.customer.tenantId,
      req.customer.customerId
    );
    
    const serviceRequest = serviceRequests.find(sr => sr.id === req.params.id);
    
    if (!serviceRequest) {
      return res.status(404).json({ error: 'Service request not found' });
    }

    await customerPortalService.logActivity(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      'view_service_request',
      `Viewed service request ${serviceRequest.requestNumber}`,
      'service_request',
      serviceRequest.id
    );

    res.json({ serviceRequest });
  } catch (error) {
    console.error('Service request fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch service request' });
  }
});

// Meter Readings
router.post('/meter-readings', requireCustomerAuth, async (req: any, res) => {
  try {
    const validatedData = meterReadingSubmissionSchema.parse(req.body);
    
    const meterSubmission = await customerPortalService.submitMeterReading(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      validatedData
    );

    res.status(201).json({ meterSubmission });
  } catch (error) {
    console.error('Meter reading submission error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to submit meter reading' });
  }
});

router.get('/meter-readings', requireCustomerAuth, async (req: any, res) => {
  try {
    const { equipmentId, limit = 50 } = req.query;
    
    const meterSubmissions = await customerPortalService.getCustomerMeterSubmissions(
      req.customer.tenantId,
      req.customer.customerId,
      equipmentId as string,
      parseInt(limit as string)
    );

    await customerPortalService.logActivity(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      'view_meter_readings',
      'Viewed meter readings'
    );

    res.json({ meterSubmissions });
  } catch (error) {
    console.error('Meter readings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch meter readings' });
  }
});

// Equipment
router.get('/equipment', requireCustomerAuth, async (req: any, res) => {
  try {
    const equipment = await customerPortalService.getCustomerEquipment(
      req.customer.tenantId,
      req.customer.customerId
    );

    res.json({ equipment });
  } catch (error) {
    console.error('Equipment fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Supply Orders
router.post('/supply-orders', requireCustomerAuth, async (req: any, res) => {
  try {
    const validatedData = supplyOrderSchema.parse(req.body);
    
    const { items, ...orderData } = validatedData;
    
    // Calculate item totals
    const processedItems = items.map(item => ({
      ...item,
      totalPrice: (item.quantity * item.unitPrice).toFixed(2)
    }));

    const shipping = '15.00'; // Default shipping - should be calculated based on items/location
    
    const result = await customerPortalService.createSupplyOrder(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      { ...orderData, shipping },
      processedItems
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Supply order creation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create supply order' });
  }
});

router.get('/supply-orders', requireCustomerAuth, async (req: any, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const supplyOrders = await customerPortalService.getCustomerSupplyOrders(
      req.customer.tenantId,
      req.customer.customerId,
      {
        status: status as string,
        limit: parseInt(limit as string),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string)
      }
    );

    await customerPortalService.logActivity(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      'view_supply_orders',
      'Viewed supply orders'
    );

    res.json({ supplyOrders });
  } catch (error) {
    console.error('Supply orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch supply orders' });
  }
});

// Payments
router.post('/payments', requireCustomerAuth, async (req: any, res) => {
  try {
    const validatedData = paymentSubmissionSchema.parse(req.body);
    
    // In production, you would integrate with a payment processor here
    // For now, we'll just create the payment record
    
    const payment = await customerPortalService.createPayment(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      {
        ...validatedData,
        status: 'processing', // Would be set based on payment processor response
        transactionId: `txn_${Math.random().toString(36).substr(2, 9)}`, // Mock transaction ID
        processorName: 'stripe' // Mock processor
      }
    );

    res.status(201).json({ payment });
  } catch (error) {
    console.error('Payment submission error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

router.get('/payments', requireCustomerAuth, async (req: any, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const payments = await customerPortalService.getCustomerPayments(
      req.customer.tenantId,
      req.customer.customerId,
      parseInt(limit as string)
    );

    await customerPortalService.logActivity(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      'view_payments',
      'Viewed payment history'
    );

    res.json({ payments });
  } catch (error) {
    console.error('Payments fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Notifications
router.get('/notifications', requireCustomerAuth, async (req: any, res) => {
  try {
    const { unreadOnly, page = 1, limit = 20 } = req.query;
    
    const notifications = await customerPortalService.getCustomerNotifications(
      req.customer.tenantId,
      req.customer.customerId,
      {
        unreadOnly: unreadOnly === 'true',
        limit: parseInt(limit as string),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string)
      }
    );

    res.json({ notifications });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/notifications/:id/read', requireCustomerAuth, async (req: any, res) => {
  try {
    await customerPortalService.markNotificationAsRead(req.params.id, req.customer.tenantId);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// User Preferences
router.get('/preferences', requireCustomerAuth, async (req: any, res) => {
  try {
    res.json({ 
      preferences: req.customer.preferences,
      permissions: req.customer.permissions
    });
  } catch (error) {
    console.error('Preferences fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

router.put('/preferences', requireCustomerAuth, async (req: any, res) => {
  try {
    const { preferences } = req.body;
    
    await customerPortalService.updateCustomerPreferences(req.customer.id, preferences);
    
    await customerPortalService.logActivity(
      req.customer.tenantId,
      req.customer.customerId,
      req.customer.id,
      'update_preferences',
      'Updated account preferences'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Preferences update error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;