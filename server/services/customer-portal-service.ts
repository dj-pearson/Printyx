import { eq, and, desc, gte, lte, sql, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import {
  customerPortalAccess,
  customerServiceRequests,
  customerMeterSubmissions,
  customerSupplyOrders,
  customerSupplyOrderItems,
  customerPayments,
  customerNotifications,
  customerPortalActivityLog,
  type CustomerPortalAccess,
  type CustomerServiceRequest,
  type CustomerMeterSubmission,
  type CustomerSupplyOrder,
  type CustomerPayment,
  type CustomerNotification,
  type InsertCustomerPortalAccess,
  type InsertCustomerServiceRequest,
  type InsertCustomerMeterSubmission,
  type InsertCustomerSupplyOrder,
  type InsertCustomerSupplyOrderItem,
  type InsertCustomerPayment,
  type InsertCustomerNotification,
  type InsertCustomerPortalActivityLog,
} from '../../shared/customer-portal-schema';

/**
 * Customer Portal Service
 * Handles all customer self-service portal functionality
 */
export class CustomerPortalService {

  /**
   * Create customer portal access
   */
  async createCustomerAccess(
    tenantId: string,
    customerId: string,
    data: {
      username: string;
      email: string;
      password: string;
      permissions?: any;
      createdBy?: string;
    }
  ): Promise<CustomerPortalAccess> {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const [result] = await db.insert(customerPortalAccess)
      .values({
        tenantId,
        customerId,
        username: data.username,
        email: data.email,
        passwordHash,
        emailVerificationToken,
        permissions: data.permissions || {},
        createdBy: data.createdBy,
      })
      .returning();

    await this.logActivity(tenantId, customerId, result.id, 'account_created', 'Customer portal account created');

    return result;
  }

  /**
   * Authenticate customer
   */
  async authenticateCustomer(username: string, password: string): Promise<{
    success: boolean;
    customer?: CustomerPortalAccess;
    error?: string;
  }> {
    try {
      const [customer] = await db.select()
        .from(customerPortalAccess)
        .where(or(
          eq(customerPortalAccess.username, username),
          eq(customerPortalAccess.email, username)
        ));

      if (!customer) {
        return { success: false, error: 'Invalid credentials' };
      }

      if (customer.status !== 'active') {
        return { success: false, error: 'Account is not active' };
      }

      const passwordValid = await bcrypt.compare(password, customer.passwordHash);
      if (!passwordValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Update last login
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.update(customerPortalAccess)
        .set({
          lastLoginAt: new Date(),
          sessionToken,
          sessionExpires,
          updatedAt: new Date()
        })
        .where(eq(customerPortalAccess.id, customer.id));

      await this.logActivity(customer.tenantId, customer.customerId, customer.id, 'login', 'Customer logged in');

      return { 
        success: true, 
        customer: { 
          ...customer, 
          sessionToken, 
          sessionExpires,
          lastLoginAt: new Date()
        } 
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Validate session token
   */
  async validateSession(sessionToken: string): Promise<CustomerPortalAccess | null> {
    try {
      const [customer] = await db.select()
        .from(customerPortalAccess)
        .where(and(
          eq(customerPortalAccess.sessionToken, sessionToken),
          gte(customerPortalAccess.sessionExpires, new Date()),
          eq(customerPortalAccess.status, 'active')
        ));

      return customer || null;
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  /**
   * Submit service request
   */
  async submitServiceRequest(
    tenantId: string,
    customerId: string,
    customerPortalUserId: string,
    data: Omit<InsertCustomerServiceRequest, 'tenantId' | 'customerId' | 'customerPortalUserId' | 'requestNumber'>
  ): Promise<CustomerServiceRequest> {
    // Generate unique request number
    const requestNumber = await this.generateRequestNumber(tenantId, 'SR');

    const [result] = await db.insert(customerServiceRequests)
      .values({
        ...data,
        tenantId,
        customerId,
        customerPortalUserId,
        requestNumber,
      })
      .returning();

    // Create notification for internal team
    await this.createNotification({
      tenantId,
      customerId,
      customerPortalUserId,
      type: 'service_update',
      title: 'Service Request Submitted',
      message: `Your service request #${requestNumber} has been submitted and will be reviewed shortly.`,
      relatedServiceRequestId: result.id,
    });

    await this.logActivity(tenantId, customerId, customerPortalUserId, 'submit_service_request', 
      `Submitted service request #${requestNumber}`, 'service_request', result.id);

    return result;
  }

  /**
   * Get customer service requests
   */
  async getCustomerServiceRequests(
    tenantId: string,
    customerId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CustomerServiceRequest[]> {
    const conditions = [
      eq(customerServiceRequests.tenantId, tenantId),
      eq(customerServiceRequests.customerId, customerId)
    ];

    if (options.status) {
      conditions.push(eq(customerServiceRequests.status, options.status as any));
    }

    return await db.select()
      .from(customerServiceRequests)
      .where(and(...conditions))
      .orderBy(desc(customerServiceRequests.submittedAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);
  }

  /**
   * Submit meter reading
   */
  async submitMeterReading(
    tenantId: string,
    customerId: string,
    customerPortalUserId: string,
    data: Omit<InsertCustomerMeterSubmission, 'tenantId' | 'customerId' | 'customerPortalUserId'>
  ): Promise<CustomerMeterSubmission> {
    const [result] = await db.insert(customerMeterSubmissions)
      .values({
        ...data,
        tenantId,
        customerId,
        customerPortalUserId,
      })
      .returning();

    await this.logActivity(tenantId, customerId, customerPortalUserId, 'submit_meter_reading', 
      `Submitted meter reading for equipment ${data.equipmentSerialNumber}`);

    return result;
  }

  /**
   * Get customer meter submissions
   */
  async getCustomerMeterSubmissions(
    tenantId: string,
    customerId: string,
    equipmentId?: string,
    limit: number = 50
  ): Promise<CustomerMeterSubmission[]> {
    const conditions = [
      eq(customerMeterSubmissions.tenantId, tenantId),
      eq(customerMeterSubmissions.customerId, customerId)
    ];

    if (equipmentId) {
      conditions.push(eq(customerMeterSubmissions.equipmentId, equipmentId));
    }

    return await db.select()
      .from(customerMeterSubmissions)
      .where(and(...conditions))
      .orderBy(desc(customerMeterSubmissions.submissionDate))
      .limit(limit);
  }

  /**
   * Create supply order
   */
  async createSupplyOrder(
    tenantId: string,
    customerId: string,
    customerPortalUserId: string,
    orderData: Omit<InsertCustomerSupplyOrder, 'tenantId' | 'customerId' | 'customerPortalUserId' | 'orderNumber'>,
    items: Omit<InsertCustomerSupplyOrderItem, 'orderId'>[]
  ): Promise<{ order: CustomerSupplyOrder; items: any[] }> {
    const orderNumber = await this.generateRequestNumber(tenantId, 'SO');

    const [order] = await db.insert(customerSupplyOrders)
      .values({
        ...orderData,
        tenantId,
        customerId,
        customerPortalUserId,
        orderNumber,
      })
      .returning();

    const orderItems = await db.insert(customerSupplyOrderItems)
      .values(items.map(item => ({ ...item, orderId: order.id })))
      .returning();

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
    const tax = subtotal * 0.08; // 8% tax rate - should be configurable
    const total = subtotal + tax + parseFloat(orderData.shipping || '0');

    await db.update(customerSupplyOrders)
      .set({
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
      })
      .where(eq(customerSupplyOrders.id, order.id));

    await this.createNotification({
      tenantId,
      customerId,
      customerPortalUserId,
      type: 'service_update',
      title: 'Supply Order Created',
      message: `Your supply order #${orderNumber} has been created and is being processed.`,
      relatedSupplyOrderId: order.id,
    });

    await this.logActivity(tenantId, customerId, customerPortalUserId, 'create_supply_order', 
      `Created supply order #${orderNumber}`, 'supply_order', order.id);

    return { order, items: orderItems };
  }

  /**
   * Get customer supply orders
   */
  async getCustomerSupplyOrders(
    tenantId: string,
    customerId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    const conditions = [
      eq(customerSupplyOrders.tenantId, tenantId),
      eq(customerSupplyOrders.customerId, customerId)
    ];

    if (options.status) {
      conditions.push(eq(customerSupplyOrders.status, options.status as any));
    }

    return await db.select({
      order: customerSupplyOrders,
      items: customerSupplyOrderItems
    })
      .from(customerSupplyOrders)
      .leftJoin(customerSupplyOrderItems, eq(customerSupplyOrders.id, customerSupplyOrderItems.orderId))
      .where(and(...conditions))
      .orderBy(desc(customerSupplyOrders.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);
  }

  /**
   * Create payment
   */
  async createPayment(
    tenantId: string,
    customerId: string,
    customerPortalUserId: string,
    data: Omit<InsertCustomerPayment, 'tenantId' | 'customerId' | 'customerPortalUserId' | 'paymentNumber'>
  ): Promise<CustomerPayment> {
    const paymentNumber = await this.generateRequestNumber(tenantId, 'PAY');

    const [result] = await db.insert(customerPayments)
      .values({
        ...data,
        tenantId,
        customerId,
        customerPortalUserId,
        paymentNumber,
      })
      .returning();

    await this.createNotification({
      tenantId,
      customerId,
      customerPortalUserId,
      type: 'service_update',
      title: 'Payment Submitted',
      message: `Your payment #${paymentNumber} has been submitted and is being processed.`,
      relatedPaymentId: result.id,
    });

    await this.logActivity(tenantId, customerId, customerPortalUserId, 'submit_payment', 
      `Submitted payment #${paymentNumber}`, 'payment', result.id);

    return result;
  }

  /**
   * Get customer payments
   */
  async getCustomerPayments(
    tenantId: string,
    customerId: string,
    limit: number = 50
  ): Promise<CustomerPayment[]> {
    return await db.select()
      .from(customerPayments)
      .where(and(
        eq(customerPayments.tenantId, tenantId),
        eq(customerPayments.customerId, customerId)
      ))
      .orderBy(desc(customerPayments.paymentDate))
      .limit(limit);
  }

  /**
   * Get customer notifications
   */
  async getCustomerNotifications(
    tenantId: string,
    customerId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CustomerNotification[]> {
    const conditions = [
      eq(customerNotifications.tenantId, tenantId),
      eq(customerNotifications.customerId, customerId)
    ];

    if (options.unreadOnly) {
      conditions.push(eq(customerNotifications.isPortalRead, false));
    }

    return await db.select()
      .from(customerNotifications)
      .where(and(...conditions))
      .orderBy(desc(customerNotifications.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, tenantId: string): Promise<void> {
    await db.update(customerNotifications)
      .set({
        isPortalRead: true,
        portalReadAt: new Date()
      })
      .where(and(
        eq(customerNotifications.id, notificationId),
        eq(customerNotifications.tenantId, tenantId)
      ));
  }

  /**
   * Create notification
   */
  async createNotification(data: InsertCustomerNotification): Promise<CustomerNotification> {
    const [result] = await db.insert(customerNotifications)
      .values(data)
      .returning();

    return result;
  }

  /**
   * Log customer activity
   */
  async logActivity(
    tenantId: string,
    customerId: string,
    customerPortalUserId: string,
    action: string,
    description?: string,
    relatedRecordType?: string,
    relatedRecordId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await db.insert(customerPortalActivityLog)
      .values({
        tenantId,
        customerId,
        customerPortalUserId,
        action,
        description,
        relatedRecordType,
        relatedRecordId,
        ipAddress,
        userAgent,
      });
  }

  /**
   * Get customer dashboard summary
   */
  async getCustomerDashboardSummary(tenantId: string, customerId: string): Promise<any> {
    const [
      activeServiceRequests,
      pendingPayments,
      recentMeterReadings,
      unreadNotifications,
      pendingSupplyOrders
    ] = await Promise.all([
      // Active service requests
      db.select({ count: sql`count(*)` })
        .from(customerServiceRequests)
        .where(and(
          eq(customerServiceRequests.tenantId, tenantId),
          eq(customerServiceRequests.customerId, customerId),
          sql`${customerServiceRequests.status} NOT IN ('completed', 'cancelled')`
        )),

      // Pending payments
      db.select({ count: sql`count(*)` })
        .from(customerPayments)
        .where(and(
          eq(customerPayments.tenantId, tenantId),
          eq(customerPayments.customerId, customerId),
          eq(customerPayments.status, 'pending')
        )),

      // Recent meter readings (last 30 days)
      db.select({ count: sql`count(*)` })
        .from(customerMeterSubmissions)
        .where(and(
          eq(customerMeterSubmissions.tenantId, tenantId),
          eq(customerMeterSubmissions.customerId, customerId),
          gte(customerMeterSubmissions.submissionDate, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        )),

      // Unread notifications
      db.select({ count: sql`count(*)` })
        .from(customerNotifications)
        .where(and(
          eq(customerNotifications.tenantId, tenantId),
          eq(customerNotifications.customerId, customerId),
          eq(customerNotifications.isPortalRead, false)
        )),

      // Pending supply orders
      db.select({ count: sql`count(*)` })
        .from(customerSupplyOrders)
        .where(and(
          eq(customerSupplyOrders.tenantId, tenantId),
          eq(customerSupplyOrders.customerId, customerId),
          sql`${customerSupplyOrders.status} IN ('submitted', 'confirmed', 'processing')`
        ))
    ]);

    return {
      activeServiceRequests: Number(activeServiceRequests[0]?.count || 0),
      pendingPayments: Number(pendingPayments[0]?.count || 0),
      recentMeterReadings: Number(recentMeterReadings[0]?.count || 0),
      unreadNotifications: Number(unreadNotifications[0]?.count || 0),
      pendingSupplyOrders: Number(pendingSupplyOrders[0]?.count || 0),
    };
  }

  /**
   * Generate unique request number
   */
  private async generateRequestNumber(tenantId: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const [customer] = await db.select()
        .from(customerPortalAccess)
        .where(eq(customerPortalAccess.email, email));

      if (!customer) {
        return { success: false, message: 'Email address not found' };
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.update(customerPortalAccess)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
          updatedAt: new Date()
        })
        .where(eq(customerPortalAccess.id, customer.id));

      // In a real implementation, you would send an email with the reset link
      // For now, we'll just return success
      return { success: true, message: 'Password reset email sent' };
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, message: 'Failed to process password reset' };
    }
  }

  /**
   * Update customer preferences
   */
  async updateCustomerPreferences(
    customerPortalUserId: string,
    preferences: any
  ): Promise<void> {
    await db.update(customerPortalAccess)
      .set({
        preferences,
        updatedAt: new Date()
      })
      .where(eq(customerPortalAccess.id, customerPortalUserId));
  }

  /**
   * Get customer equipment for meter readings
   */
  async getCustomerEquipment(tenantId: string, customerId: string): Promise<any[]> {
    // This would integrate with your existing equipment/contracts system
    // For now, return placeholder data
    return [
      {
        id: '1',
        serialNumber: 'ABC123456',
        model: 'Canon imageRUNNER ADVANCE C3530i',
        location: 'Main Office',
        contractId: 'CONTRACT-001'
      }
    ];
  }
}