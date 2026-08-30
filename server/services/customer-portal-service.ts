import { eq, and, desc, gte, lte, sql, isNull, or, inArray } from 'drizzle-orm';
import { db } from '../db';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('customer-portal-service');

import {
  customerPortalAccess,
  customerServiceRequests,
  customerServiceRequestStatusHistory,
  customerMeterSubmissions,
  customerSupplyOrders,
  customerSupplyOrderItems,
  customerPayments,
  customerNotifications,
  customerPortalActivityLog,
  customerMaintenanceAppointments,
  technicianAvailabilitySlots,
  type CustomerPortalAccess,
  type CustomerServiceRequest,
  type CustomerServiceRequestStatusHistory,
  type CustomerMeterSubmission,
  type CustomerSupplyOrder,
  type CustomerPayment,
  type CustomerNotification,
  type CustomerMaintenanceAppointment,
  type InsertCustomerPortalAccess,
  type InsertCustomerServiceRequest,
  type InsertCustomerServiceRequestStatusHistory,
  type InsertCustomerMeterSubmission,
  type InsertCustomerSupplyOrder,
  type InsertCustomerSupplyOrderItem,
  type InsertCustomerPayment,
  type InsertCustomerNotification,
  type InsertCustomerPortalActivityLog,
  type InsertCustomerMaintenanceAppointment,
  type MaintenanceSchedulingRequest,
  type AvailabilityRequest,
  type RescheduleAppointmentRequest,
  type UsageAnalytics,
  type UsageAnalyticsRequest,
  type EquipmentUsageSummary,
  type UsageTrend,
  type UsageAnalyticsMetrics,
  type UpdateServiceRequestStatusRequest,
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
    },
  ): Promise<CustomerPortalAccess> {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const [result] = await db
      .insert(customerPortalAccess)
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

    await this.logActivity(
      tenantId,
      customerId,
      result.id,
      'account_created',
      'Customer portal account created',
    );

    return result;
  }

  /**
   * Authenticate customer
   */
  async authenticateCustomer(
    username: string,
    password: string,
  ): Promise<{
    success: boolean;
    customer?: CustomerPortalAccess;
    error?: string;
  }> {
    try {
      const [customer] = await db
        .select()
        .from(customerPortalAccess)
        .where(
          or(eq(customerPortalAccess.username, username), eq(customerPortalAccess.email, username)),
        );

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

      await db
        .update(customerPortalAccess)
        .set({
          lastLoginAt: new Date(),
          sessionToken,
          sessionExpires,
          updatedAt: new Date(),
        })
        .where(eq(customerPortalAccess.id, customer.id));

      await this.logActivity(
        customer.tenantId,
        customer.customerId,
        customer.id,
        'login',
        'Customer logged in',
      );

      return {
        success: true,
        customer: {
          ...customer,
          sessionToken,
          sessionExpires,
          lastLoginAt: new Date(),
        },
      };
    } catch (error) {
      log.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Validate session token
   */
  async validateSession(sessionToken: string): Promise<CustomerPortalAccess | null> {
    try {
      const [customer] = await db
        .select()
        .from(customerPortalAccess)
        .where(
          and(
            eq(customerPortalAccess.sessionToken, sessionToken),
            gte(customerPortalAccess.sessionExpires, new Date()),
            eq(customerPortalAccess.status, 'active'),
          ),
        );

      return customer || null;
    } catch (error) {
      log.error('Session validation error:', error);
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
    data: Omit<
      InsertCustomerServiceRequest,
      'tenantId' | 'customerId' | 'customerPortalUserId' | 'requestNumber'
    >,
  ): Promise<CustomerServiceRequest> {
    // Generate unique request number
    const requestNumber = await this.generateRequestNumber(tenantId, 'SR');

    const [result] = await db
      .insert(customerServiceRequests)
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

    await this.logActivity(
      tenantId,
      customerId,
      customerPortalUserId,
      'submit_service_request',
      `Submitted service request #${requestNumber}`,
      'service_request',
      result.id,
    );

    return result;
  }

  /**
   * Get customer service requests with pagination
   */
  async getCustomerServiceRequests(
    tenantId: string,
    customerId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
      fields?: string[];
    } = {},
  ): Promise<{ data: CustomerServiceRequest[]; total: number; queryDuration?: number }> {
    const startTime = Date.now();

    const conditions = [
      eq(customerServiceRequests.tenantId, tenantId),
      eq(customerServiceRequests.customerId, customerId),
    ];

    if (options.status) {
      conditions.push(eq(customerServiceRequests.status, options.status as any));
    }

    const whereClause = and(...conditions);

    // Selective field query optimization
    const selectFields = options.fields
      ? Object.fromEntries(
          options.fields.map((field) => [
            field,
            customerServiceRequests[field as keyof typeof customerServiceRequests],
          ]),
        )
      : undefined;

    // Get total count and data in parallel for performance
    const [totalResult, data] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(customerServiceRequests)
        .where(whereClause),
      selectFields
        ? db
            .select(selectFields)
            .from(customerServiceRequests)
            .where(whereClause)
            .orderBy(desc(customerServiceRequests.submittedAt))
            .limit(options.limit || 50)
            .offset(options.offset || 0)
        : db
            .select()
            .from(customerServiceRequests)
            .where(whereClause)
            .orderBy(desc(customerServiceRequests.submittedAt))
            .limit(options.limit || 50)
            .offset(options.offset || 0),
    ]);

    const queryDuration = Date.now() - startTime;

    return {
      data: data as CustomerServiceRequest[],
      total: totalResult[0]?.count || 0,
      queryDuration,
    };
  }

  /**
   * Get all service requests for admin management (ADMIN/DEALER ONLY)
   */
  async getAllServiceRequests(
    tenantId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<CustomerServiceRequest[]> {
    const conditions = [eq(customerServiceRequests.tenantId, tenantId)];

    if (options.status) {
      conditions.push(eq(customerServiceRequests.status, options.status as any));
    }

    return await db
      .select()
      .from(customerServiceRequests)
      .where(and(...conditions))
      .orderBy(desc(customerServiceRequests.submittedAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);
  }

  /**
   * Get specific service request by ID
   */
  async getServiceRequestById(
    tenantId: string,
    customerId: string,
    requestId: string,
  ): Promise<CustomerServiceRequest | null> {
    const [result] = await db
      .select()
      .from(customerServiceRequests)
      .where(
        and(
          eq(customerServiceRequests.tenantId, tenantId),
          eq(customerServiceRequests.customerId, customerId),
          eq(customerServiceRequests.id, requestId),
        ),
      );

    return result || null;
  }

  /**
   * Update service request status with history tracking - SECURE VERSION with transaction integrity
   */
  async updateServiceRequestStatus(
    tenantId: string,
    requestId: string,
    statusUpdate: UpdateServiceRequestStatusRequest,
    changedByType: 'customer' | 'dealer_user' | 'system' | 'technician' = 'dealer_user',
    changedById?: string,
  ): Promise<{
    serviceRequest: CustomerServiceRequest;
    statusHistory: CustomerServiceRequestStatusHistory;
  }> {
    // Validate required fields
    if (!statusUpdate.changedByName) {
      throw new Error('changedByName is required for status updates');
    }

    // Use database transaction for integrity
    return await db.transaction(async (tx) => {
      // First get the current service request with proper tenantId constraint
      const [currentRequest] = await tx
        .select()
        .from(customerServiceRequests)
        .where(
          and(
            eq(customerServiceRequests.tenantId, tenantId),
            eq(customerServiceRequests.id, requestId),
          ),
        );

      if (!currentRequest) {
        throw new Error('Service request not found');
      }

      const previousStatus = currentRequest.status;
      const newStatus = statusUpdate.newStatus;
      const now = new Date();

      // Calculate lifecycle timestamps based on status transitions
      const lifecycleUpdates: any = {
        status: newStatus,
        updatedAt: now,
      };

      // Add lifecycle timestamps based on status
      switch (newStatus) {
        case 'acknowledged':
          if (!currentRequest.acknowledgedAt) {
            lifecycleUpdates.acknowledgedAt = now;
          }
          break;
        case 'completed':
          // Set both completion timestamps
          lifecycleUpdates.completedAt = now;
          lifecycleUpdates.actualCompletionDate = statusUpdate.actualCompletionDate
            ? new Date(statusUpdate.actualCompletionDate)
            : now;
          // Backfill acknowledged timestamp if not set
          if (!currentRequest.acknowledgedAt) {
            lifecycleUpdates.acknowledgedAt = now;
          }
          break;
        case 'cancelled':
          // Keep existing lifecycle timestamps for audit trail
          break;
      }

      // Update the service request status with SECURE tenantId constraint
      const [updatedRequest] = await tx
        .update(customerServiceRequests)
        .set(lifecycleUpdates)
        .where(
          and(
            eq(customerServiceRequests.id, requestId),
            eq(customerServiceRequests.tenantId, tenantId), // CRITICAL: tenant constraint for security
          ),
        )
        .returning();

      // Verify the update affected exactly one row
      if (!updatedRequest) {
        throw new Error('Service request update failed - request not found or tenant mismatch');
      }

      // Record status change in history
      const [statusHistory] = await tx
        .insert(customerServiceRequestStatusHistory)
        .values({
          tenantId,
          serviceRequestId: requestId,
          previousStatus,
          newStatus,
          changeReason: statusUpdate.changeReason,
          customerVisibleNotes: statusUpdate.customerVisibleNotes,
          internalNotes: statusUpdate.internalNotes,
          changedByType,
          changedById,
          changedByName: statusUpdate.changedByName,
          estimatedCompletionDate: statusUpdate.estimatedCompletionDate
            ? new Date(statusUpdate.estimatedCompletionDate)
            : null,
          actualCompletionDate: statusUpdate.actualCompletionDate
            ? new Date(statusUpdate.actualCompletionDate)
            : null,
        })
        .returning();

      // Create notification for customer if status change is customer-visible
      // This is done within transaction to ensure consistency
      if (statusUpdate.customerVisibleNotes || newStatus !== previousStatus) {
        await tx.insert(customerNotifications).values({
          tenantId,
          customerId: currentRequest.customerId,
          customerPortalUserId: currentRequest.customerPortalUserId,
          type: 'service_update',
          title: `Service Request Status Updated`,
          message:
            statusUpdate.customerVisibleNotes ||
            `Your service request #${currentRequest.requestNumber} status has been updated to ${newStatus.replace('_', ' ')}.`,
          relatedServiceRequestId: requestId,
        });
      }

      // Log the activity within transaction
      await tx.insert(customerPortalActivityLog).values({
        tenantId,
        customerId: currentRequest.customerId,
        customerPortalUserId: currentRequest.customerPortalUserId,
        activityType: 'update_service_request_status',
        description: `Status updated from ${previousStatus} to ${newStatus}`,
        relatedEntityType: 'service_request',
        relatedEntityId: requestId,
      });

      return { serviceRequest: updatedRequest, statusHistory };
    });
  }

  /**
   * Get service request status history timeline
   */
  async getServiceRequestStatusHistory(
    tenantId: string,
    customerId: string,
    requestId: string,
  ): Promise<CustomerServiceRequestStatusHistory[]> {
    // Verify the request belongs to the customer
    const [request] = await db
      .select()
      .from(customerServiceRequests)
      .where(
        and(
          eq(customerServiceRequests.tenantId, tenantId),
          eq(customerServiceRequests.customerId, customerId),
          eq(customerServiceRequests.id, requestId),
        ),
      );

    if (!request) {
      throw new Error('Service request not found');
    }

    // Get status history ordered by creation date
    return await db
      .select()
      .from(customerServiceRequestStatusHistory)
      .where(
        and(
          eq(customerServiceRequestStatusHistory.tenantId, tenantId),
          eq(customerServiceRequestStatusHistory.serviceRequestId, requestId),
        ),
      )
      .orderBy(desc(customerServiceRequestStatusHistory.createdAt));
  }

  /**
   * Submit meter reading
   */
  async submitMeterReading(
    tenantId: string,
    customerId: string,
    customerPortalUserId: string,
    data: Omit<InsertCustomerMeterSubmission, 'tenantId' | 'customerId' | 'customerPortalUserId'>,
  ): Promise<CustomerMeterSubmission> {
    const [result] = await db
      .insert(customerMeterSubmissions)
      .values({
        ...data,
        tenantId,
        customerId,
        customerPortalUserId,
      })
      .returning();

    await this.logActivity(
      tenantId,
      customerId,
      customerPortalUserId,
      'submit_meter_reading',
      `Submitted meter reading for equipment ${data.equipmentSerialNumber}`,
    );

    return result;
  }

  /**
   * Get customer meter submissions
   */
  async getCustomerMeterSubmissions(
    tenantId: string,
    customerId: string,
    equipmentId?: string,
    limit: number = 50,
  ): Promise<CustomerMeterSubmission[]> {
    const conditions = [
      eq(customerMeterSubmissions.tenantId, tenantId),
      eq(customerMeterSubmissions.customerId, customerId),
    ];

    if (equipmentId) {
      conditions.push(eq(customerMeterSubmissions.equipmentId, equipmentId));
    }

    return await db
      .select()
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
    orderData: Omit<
      InsertCustomerSupplyOrder,
      'tenantId' | 'customerId' | 'customerPortalUserId' | 'orderNumber'
    >,
    items: Omit<InsertCustomerSupplyOrderItem, 'orderId'>[],
  ): Promise<{ order: CustomerSupplyOrder; items: any[] }> {
    const orderNumber = await this.generateRequestNumber(tenantId, 'SO');

    const [order] = await db
      .insert(customerSupplyOrders)
      .values({
        ...orderData,
        tenantId,
        customerId,
        customerPortalUserId,
        orderNumber,
      })
      .returning();

    const orderItems = await db
      .insert(customerSupplyOrderItems)
      .values(items.map((item) => ({ ...item, orderId: order.id })))
      .returning();

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
    const tax = subtotal * 0.08; // 8% tax rate - should be configurable
    const total = subtotal + tax + parseFloat(orderData.shipping || '0');

    await db
      .update(customerSupplyOrders)
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

    await this.logActivity(
      tenantId,
      customerId,
      customerPortalUserId,
      'create_supply_order',
      `Created supply order #${orderNumber}`,
      'supply_order',
      order.id,
    );

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
    } = {},
  ): Promise<any[]> {
    const conditions = [
      eq(customerSupplyOrders.tenantId, tenantId),
      eq(customerSupplyOrders.customerId, customerId),
    ];

    if (options.status) {
      conditions.push(eq(customerSupplyOrders.status, options.status as any));
    }

    return await db
      .select({
        order: customerSupplyOrders,
        items: customerSupplyOrderItems,
      })
      .from(customerSupplyOrders)
      .leftJoin(
        customerSupplyOrderItems,
        eq(customerSupplyOrders.id, customerSupplyOrderItems.orderId),
      )
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
    data: Omit<
      InsertCustomerPayment,
      'tenantId' | 'customerId' | 'customerPortalUserId' | 'paymentNumber'
    >,
  ): Promise<CustomerPayment> {
    const paymentNumber = await this.generateRequestNumber(tenantId, 'PAY');

    const [result] = await db
      .insert(customerPayments)
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

    await this.logActivity(
      tenantId,
      customerId,
      customerPortalUserId,
      'submit_payment',
      `Submitted payment #${paymentNumber}`,
      'payment',
      result.id,
    );

    return result;
  }

  /**
   * Get customer payments
   */
  async getCustomerPayments(
    tenantId: string,
    customerId: string,
    limit: number = 50,
  ): Promise<CustomerPayment[]> {
    return await db
      .select()
      .from(customerPayments)
      .where(
        and(eq(customerPayments.tenantId, tenantId), eq(customerPayments.customerId, customerId)),
      )
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
    } = {},
  ): Promise<CustomerNotification[]> {
    const conditions = [
      eq(customerNotifications.tenantId, tenantId),
      eq(customerNotifications.customerId, customerId),
    ];

    if (options.unreadOnly) {
      conditions.push(eq(customerNotifications.isPortalRead, false));
    }

    return await db
      .select()
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
    await db
      .update(customerNotifications)
      .set({
        isPortalRead: true,
        portalReadAt: new Date(),
      })
      .where(
        and(
          eq(customerNotifications.id, notificationId),
          eq(customerNotifications.tenantId, tenantId),
        ),
      );
  }

  /**
   * Create notification
   */
  async createNotification(data: InsertCustomerNotification): Promise<CustomerNotification> {
    const [result] = await db.insert(customerNotifications).values(data).returning();

    return result;
  }

  /**
   * Log customer activity
   */
  async logActivity(
    tenantId: string,
    customerId: string,
    customerPortalUserId: string | null,
    action: string,
    description?: string,
    relatedRecordType?: string,
    relatedRecordId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await db.insert(customerPortalActivityLog).values({
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
      pendingSupplyOrders,
    ] = await Promise.all([
      // Active service requests
      db
        .select({ count: sql`count(*)` })
        .from(customerServiceRequests)
        .where(
          and(
            eq(customerServiceRequests.tenantId, tenantId),
            eq(customerServiceRequests.customerId, customerId),
            sql`${customerServiceRequests.status} NOT IN ('completed', 'cancelled')`,
          ),
        ),

      // Pending payments
      db
        .select({ count: sql`count(*)` })
        .from(customerPayments)
        .where(
          and(
            eq(customerPayments.tenantId, tenantId),
            eq(customerPayments.customerId, customerId),
            eq(customerPayments.status, 'pending'),
          ),
        ),

      // Recent meter readings (last 30 days)
      db
        .select({ count: sql`count(*)` })
        .from(customerMeterSubmissions)
        .where(
          and(
            eq(customerMeterSubmissions.tenantId, tenantId),
            eq(customerMeterSubmissions.customerId, customerId),
            gte(
              customerMeterSubmissions.submissionDate,
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            ),
          ),
        ),

      // Unread notifications
      db
        .select({ count: sql`count(*)` })
        .from(customerNotifications)
        .where(
          and(
            eq(customerNotifications.tenantId, tenantId),
            eq(customerNotifications.customerId, customerId),
            eq(customerNotifications.isPortalRead, false),
          ),
        ),

      // Pending supply orders
      db
        .select({ count: sql`count(*)` })
        .from(customerSupplyOrders)
        .where(
          and(
            eq(customerSupplyOrders.tenantId, tenantId),
            eq(customerSupplyOrders.customerId, customerId),
            sql`${customerSupplyOrders.status} IN ('submitted', 'confirmed', 'processing')`,
          ),
        ),
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
    const sequence = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const [customer] = await db
        .select()
        .from(customerPortalAccess)
        .where(eq(customerPortalAccess.email, email));

      if (!customer) {
        return { success: false, message: 'Email address not found' };
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db
        .update(customerPortalAccess)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
          updatedAt: new Date(),
        })
        .where(eq(customerPortalAccess.id, customer.id));

      // In a real implementation, you would send an email with the reset link
      // For now, we'll just return success
      return { success: true, message: 'Password reset email sent' };
    } catch (error) {
      log.error('Password reset error:', error);
      return { success: false, message: 'Failed to process password reset' };
    }
  }

  /**
   * Update customer preferences
   */
  async updateCustomerPreferences(customerPortalUserId: string, preferences: any): Promise<void> {
    await db
      .update(customerPortalAccess)
      .set({
        preferences,
        updatedAt: new Date(),
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
        contractId: 'CONTRACT-001',
      },
    ];
  }

  /**
   * Verify customer access - ensure customer belongs to tenant
   */
  async verifyCustomerAccess(tenantId: string, customerId: string): Promise<void> {
    try {
      const [customer] = await db
        .select()
        .from(customerPortalAccess)
        .where(
          and(
            eq(customerPortalAccess.tenantId, tenantId),
            eq(customerPortalAccess.customerId, customerId),
            eq(customerPortalAccess.status, 'active'),
          ),
        );

      if (!customer) {
        throw new Error('CUSTOMER_ACCESS_DENIED');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'CUSTOMER_ACCESS_DENIED') {
        throw error;
      }
      log.error('Error verifying customer access:', error);
      throw new Error('CUSTOMER_ACCESS_DENIED');
    }
  }

  /**
   * Verify equipment ownership - ensure equipment belongs to customer
   */
  async verifyEquipmentOwnership(
    tenantId: string,
    customerId: string,
    equipmentId: string,
  ): Promise<void> {
    try {
      // In a real implementation, this would check against your equipment/contracts tables
      // For now, we'll check if the equipment ID follows expected patterns and belongs to the customer

      // First verify customer access
      await this.verifyCustomerAccess(tenantId, customerId);

      // Mock equipment ownership verification - in reality this would query equipment tables
      // that have foreign keys to customers and tenants
      const mockEquipmentOwnership: Record<string, string[]> = {
        'eq-001': ['demo-customer-001', 'customer-001'],
        'eq-002': ['demo-customer-001', 'customer-001'],
        'eq-003': ['demo-customer-002', 'customer-002'],
      };

      const allowedCustomers = mockEquipmentOwnership[equipmentId];
      if (!allowedCustomers || !allowedCustomers.includes(customerId)) {
        throw new Error('EQUIPMENT_ACCESS_DENIED');
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'EQUIPMENT_ACCESS_DENIED' || error.message === 'CUSTOMER_ACCESS_DENIED')
      ) {
        throw error;
      }
      log.error('Error verifying equipment ownership:', error);
      throw new Error('EQUIPMENT_ACCESS_DENIED');
    }
  }

  /**
   * Get equipment health data with comprehensive monitoring
   */
  async getEquipmentHealthData(
    tenantId: string,
    customerId: string,
    timeRange: string = '30d',
    options: {
      equipmentIds?: string[];
      includeAlerts?: boolean;
      includeMetrics?: boolean;
      fields?: string[];
    } = {},
  ): Promise<{ data: any[]; total: number; queryDuration?: number }> {
    const startTime = Date.now();
    // In a real implementation, this would fetch from IoT sensors, equipment APIs,
    // service history, and usage analytics
    // For now, return comprehensive mock data

    const mockHealthData = [
      {
        id: 'eq-001',
        equipmentName: 'Canon C3530i - Reception',
        make: 'Canon',
        model: 'imageRUNNER ADVANCE C3530i',
        serialNumber: 'CAN123456789',
        location: 'Reception Desk',
        overallHealthScore: 92,
        status: 'excellent',
        lastServiceDate: '2024-11-15',
        nextServiceDue: '2025-02-15',
        totalPrintCount: 145680,
        monthlyAverage: 4500,
        predictedMaintenanceDate: '2025-01-28',
        healthMetrics: {
          tonerLevels: [
            { color: 'black', level: 78, status: 'good' },
            { color: 'cyan', level: 45, status: 'warning' },
            { color: 'magenta', level: 82, status: 'good' },
            { color: 'yellow', level: 67, status: 'good' },
          ],
          paperLevels: 85,
          drumLifeRemaining: 73,
          fuserLifeRemaining: 89,
          temperature: 72,
          humidity: 45,
          errorCount: 2,
          jamRate: 0.8,
        },
        recentActivity: [
          { date: '2024-12-01', type: 'print', count: 156 },
          { date: '2024-12-02', type: 'copy', count: 89 },
          { date: '2024-12-03', type: 'scan', count: 45 },
          { date: '2024-12-04', type: 'print', count: 178 },
          { date: '2024-12-05', type: 'copy', count: 92 },
        ],
        alerts: [
          {
            id: 'alert-001',
            type: 'warning',
            message: 'Cyan toner level is low (45%)',
            timestamp: '2024-12-05T10:30:00Z',
            resolved: false,
          },
        ],
        connectionStatus: {
          isOnline: true,
          lastSeen: '2024-12-05T11:45:00Z',
          signalStrength: 95,
          ipAddress: '192.168.1.101',
        },
      },
      {
        id: 'eq-002',
        equipmentName: 'HP LaserJet Pro - Accounting',
        make: 'HP',
        model: 'LaserJet Pro MFP M428fdw',
        serialNumber: 'HP987654321',
        location: 'Accounting Department',
        overallHealthScore: 76,
        status: 'good',
        lastServiceDate: '2024-10-20',
        nextServiceDue: '2025-01-20',
        totalPrintCount: 98456,
        monthlyAverage: 3200,
        predictedMaintenanceDate: '2025-01-15',
        healthMetrics: {
          tonerLevels: [{ color: 'black', level: 23, status: 'critical' }],
          paperLevels: 92,
          drumLifeRemaining: 45,
          fuserLifeRemaining: 67,
          temperature: 75,
          humidity: 42,
          errorCount: 5,
          jamRate: 1.2,
        },
        recentActivity: [
          { date: '2024-12-01', type: 'print', count: 98 },
          { date: '2024-12-02', type: 'scan', count: 34 },
          { date: '2024-12-03', type: 'print', count: 112 },
          { date: '2024-12-04', type: 'copy', count: 23 },
          { date: '2024-12-05', type: 'print', count: 145 },
        ],
        alerts: [
          {
            id: 'alert-002',
            type: 'critical',
            message: 'Black toner level critically low (23%) - order replacement immediately',
            timestamp: '2024-12-05T09:15:00Z',
            resolved: false,
          },
          {
            id: 'alert-003',
            type: 'warning',
            message: 'Drum life at 45% - consider scheduling replacement',
            timestamp: '2024-12-04T14:20:00Z',
            resolved: false,
          },
        ],
        connectionStatus: {
          isOnline: true,
          lastSeen: '2024-12-05T11:42:00Z',
          signalStrength: 87,
          ipAddress: '192.168.1.102',
        },
      },
      {
        id: 'eq-003',
        equipmentName: 'Xerox WorkCentre - Conference Room',
        make: 'Xerox',
        model: 'WorkCentre 6515',
        serialNumber: 'XER456789123',
        location: 'Conference Room A',
        overallHealthScore: 58,
        status: 'warning',
        lastServiceDate: '2024-09-10',
        nextServiceDue: '2024-12-10',
        totalPrintCount: 67834,
        monthlyAverage: 2100,
        predictedMaintenanceDate: '2024-12-08',
        healthMetrics: {
          tonerLevels: [
            { color: 'black', level: 67, status: 'good' },
            { color: 'cyan', level: 12, status: 'critical' },
            { color: 'magenta', level: 34, status: 'warning' },
            { color: 'yellow', level: 8, status: 'critical' },
          ],
          paperLevels: 15,
          drumLifeRemaining: 23,
          fuserLifeRemaining: 34,
          temperature: 78,
          humidity: 48,
          errorCount: 12,
          jamRate: 3.4,
        },
        recentActivity: [
          { date: '2024-12-01', type: 'print', count: 67 },
          { date: '2024-12-02', type: 'copy', count: 45 },
          { date: '2024-12-03', type: 'scan', count: 23 },
          { date: '2024-12-04', type: 'print', count: 89 },
          { date: '2024-12-05', type: 'copy', count: 56 },
        ],
        alerts: [
          {
            id: 'alert-004',
            type: 'critical',
            message: 'Multiple toner cartridges critically low - service required',
            timestamp: '2024-12-05T08:00:00Z',
            resolved: false,
          },
          {
            id: 'alert-005',
            type: 'critical',
            message: 'Paper tray nearly empty (15%)',
            timestamp: '2024-12-05T10:45:00Z',
            resolved: false,
          },
          {
            id: 'alert-006',
            type: 'warning',
            message: 'Service overdue - scheduled maintenance required',
            timestamp: '2024-12-05T07:30:00Z',
            resolved: false,
          },
        ],
        connectionStatus: {
          isOnline: true,
          lastSeen: '2024-12-05T11:30:00Z',
          signalStrength: 72,
          ipAddress: '192.168.1.103',
        },
      },
    ];

    // Apply filters based on options
    let filteredData = mockHealthData;

    if (options.equipmentIds && options.equipmentIds.length > 0) {
      filteredData = filteredData.filter((equipment) =>
        options.equipmentIds!.includes(equipment.id),
      );
    }

    if (options.includeAlerts === false) {
      filteredData = filteredData.map((equipment) => ({
        ...equipment,
        alerts: [],
      }));
    }

    if (options.includeMetrics === false) {
      filteredData = filteredData.map((equipment) => ({
        ...equipment,
        healthMetrics: null,
      }));
    }

    // Apply selective field queries for payload optimization
    if (options.fields && options.fields.length > 0) {
      filteredData = filteredData.map((equipment) => {
        const selectedFields: any = {};
        options.fields!.forEach((field) => {
          if (equipment.hasOwnProperty(field)) {
            selectedFields[field] = (equipment as Record<string, any>)[field];
          }
        });
        return selectedFields;
      });
    }

    const queryDuration = Date.now() - startTime;

    // Filter data based on time range if needed
    // In a real implementation, you would query actual data based on timeRange
    return {
      data: filteredData,
      total: filteredData.length,
      queryDuration,
    };
  }

  /**
   * Schedule equipment maintenance
   */
  async scheduleEquipmentMaintenance(
    tenantId: string,
    customerId: string,
    customerPortalUserId: string,
    equipmentId: string,
    preferredDate: string,
    maintenanceType: string,
    notes?: string,
    urgency: string = 'medium',
  ): Promise<any> {
    const maintenanceNumber = await this.generateRequestNumber(tenantId, 'MAINT');

    // In a real implementation, this would create a maintenance request
    // For now, return mock response
    const maintenanceRequest = {
      id: `maint-${Date.now()}`,
      maintenanceNumber,
      equipmentId,
      tenantId,
      customerId,
      customerPortalUserId,
      maintenanceType,
      preferredDate,
      notes,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    // Create notification
    await this.createNotification({
      tenantId,
      customerId,
      customerPortalUserId,
      type: 'service_update',
      title: 'Maintenance Scheduled',
      message: `Maintenance request #${maintenanceNumber} has been scheduled for ${new Date(preferredDate).toLocaleDateString()}.`,
    });

    await this.logActivity(
      tenantId,
      customerId,
      customerPortalUserId,
      'schedule_maintenance',
      `Scheduled maintenance #${maintenanceNumber}`,
      'maintenance',
      maintenanceRequest.id,
    );

    return maintenanceRequest;
  }

  // USAGE ANALYTICS: removed (AUDIT-021). getUsageAnalytics and its nine private
  // helpers stood here, plus the getEquipmentUsageAnalytics wrapper. Nothing
  // routed either of them - /api/customer-portal is proxied, so
  // supabase/functions/customer-portal/handlers/analytics.ts serves
  // UsageAnalyticsDashboard on both hosts - and this copy was where four of the
  // fabricated measurements in docs/random-metrics-baseline.json lived:
  //
  //   calculateUsageComparison invented the previous period outright, a random
  //     0.85-1.15 multiplier applied to the current one, and computed a
  //     percentage change from it. The customer saw a different trend on every
  //     page load.
  //   calculateEquipmentUsageSummary gave each machine a random efficiency
  //     score and a coin-flip trendDirection.
  //   calculatePeakUsageAnalysis returned a fixed block asserting 9am and
  //     Tuesday to every customer.
  //
  // The edge handler now queries the real preceding window, derives day and
  // month peaks from the readings, and reports hourly as unmeasurable rather
  // than inventing it - a meter submission carries a date, not a time of day.

  async getAvailableTimeSlots(
    tenantId: string,
    customerId: string,
    request: AvailabilityRequest,
  ): Promise<{
    date: string;
    availableSlots: Array<{
      time: string;
      duration: number;
      technicianId: string;
      technicianName: string;
      isAvailable: boolean;
    }>;
  }> {
    try {
      const requestDate = new Date(request.date);

      // Generate standard business hours time slots (8 AM - 5 PM)
      const timeSlots: Array<{
        time: string;
        duration: number;
        technicianId: string;
        technicianName: string;
        isAvailable: boolean;
      }> = [];
      for (let hour = 8; hour < 17; hour++) {
        timeSlots.push({
          time: `${hour.toString().padStart(2, '0')}:00`,
          duration: request.duration,
          technicianId: 'tech-1', // Mock technician for now
          technicianName: 'Service Technician',
          isAvailable: true,
        });
      }

      // For demo purposes, mark some random slots as unavailable
      const unavailableIndices = [2, 5, 7]; // 10 AM, 1 PM, 3 PM
      unavailableIndices.forEach((index) => {
        if (timeSlots[index]) {
          timeSlots[index].isAvailable = false;
        }
      });

      await this.logActivity(
        tenantId,
        customerId,
        null,
        'availability_check',
        `Checked availability for ${request.date}`,
      );

      return {
        date: request.date,
        availableSlots: timeSlots,
      };
    } catch (error) {
      log.error('Error getting available time slots:', error);
      throw new Error('Failed to get available time slots');
    }
  }

  /**
   * Book a maintenance appointment
   */
  async bookMaintenanceAppointment(
    tenantId: string,
    customerId: string,
    portalUserId: string,
    request: MaintenanceSchedulingRequest,
  ): Promise<CustomerMaintenanceAppointment> {
    try {
      const confirmationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const appointmentDate = new Date(request.appointmentDate);

      const [appointment] = await db
        .insert(customerMaintenanceAppointments)
        .values({
          tenantId,
          customerId,
          portalUserId,
          equipmentId: request.equipmentId,
          equipmentName: request.equipmentId ? `Equipment ${request.equipmentId}` : undefined,
          maintenanceType: request.maintenanceType,
          appointmentDate,
          appointmentTime: request.appointmentTime,
          duration: request.duration,
          description: request.description,
          specialInstructions: request.specialInstructions,
          confirmationCode,
          contactMethod: request.contactMethod,
          customerPhone: request.customerPhone,
          customerEmail: request.customerEmail,
          assignedTechnicianId: 'tech-1', // Mock assignment for now
          technicianName: 'Service Technician',
          status: 'requested',
        })
        .returning();

      await this.logActivity(
        tenantId,
        customerId,
        portalUserId,
        'appointment_booked',
        `Booked ${request.maintenanceType} appointment for ${request.appointmentDate}`,
      );

      return appointment;
    } catch (error) {
      log.error('Error booking maintenance appointment:', error);
      throw new Error('Failed to book maintenance appointment');
    }
  }

  /**
   * Get customer maintenance appointments
   */
  async getCustomerAppointments(
    tenantId: string,
    customerId: string,
    options: {
      status?: string;
      includeCompleted?: boolean;
      limit?: number;
    } = {},
  ): Promise<CustomerMaintenanceAppointment[]> {
    try {
      const conditions = [
        eq(customerMaintenanceAppointments.tenantId, tenantId),
        eq(customerMaintenanceAppointments.customerId, customerId),
      ];

      if (options.status) {
        conditions.push(eq(customerMaintenanceAppointments.status, options.status as any));
      }

      if (!options.includeCompleted) {
        conditions.push(sql`${customerMaintenanceAppointments.status} != 'completed'`);
      }

      let query = db
        .select()
        .from(customerMaintenanceAppointments)
        .where(and(...conditions))
        .orderBy(desc(customerMaintenanceAppointments.appointmentDate))
        .$dynamic();

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const appointments = await query;

      await this.logActivity(
        tenantId,
        customerId,
        null,
        'appointments_viewed',
        'Viewed maintenance appointments',
      );

      return appointments;
    } catch (error) {
      log.error('Error getting customer appointments:', error);
      throw new Error('Failed to get customer appointments');
    }
  }

  /**
   * Reschedule a maintenance appointment
   */
  async rescheduleAppointment(
    tenantId: string,
    customerId: string,
    portalUserId: string,
    request: RescheduleAppointmentRequest,
  ): Promise<CustomerMaintenanceAppointment> {
    try {
      // First check if appointment exists and belongs to customer
      const [existingAppointment] = await db
        .select()
        .from(customerMaintenanceAppointments)
        .where(
          and(
            eq(customerMaintenanceAppointments.id, request.appointmentId),
            eq(customerMaintenanceAppointments.tenantId, tenantId),
            eq(customerMaintenanceAppointments.customerId, customerId),
          ),
        );

      if (!existingAppointment) {
        throw new Error('Appointment not found');
      }

      if (
        existingAppointment.status === 'completed' ||
        existingAppointment.status === 'cancelled'
      ) {
        throw new Error('Cannot reschedule completed or cancelled appointment');
      }

      const newDate = new Date(request.newDate);
      const rescheduleCount = (existingAppointment.rescheduleCount || 0) + 1;

      const [updatedAppointment] = await db
        .update(customerMaintenanceAppointments)
        .set({
          originalDate: existingAppointment.originalDate || existingAppointment.appointmentDate,
          appointmentDate: newDate,
          appointmentTime: request.newTime,
          rescheduleCount,
          rescheduleReason: request.reason,
          status: 'rescheduled',
          updatedAt: new Date(),
        })
        .where(eq(customerMaintenanceAppointments.id, request.appointmentId))
        .returning();

      await this.logActivity(
        tenantId,
        customerId,
        portalUserId,
        'appointment_rescheduled',
        `Rescheduled appointment to ${request.newDate} at ${request.newTime}`,
      );

      return updatedAppointment;
    } catch (error) {
      log.error('Error rescheduling appointment:', error);
      throw new Error('Failed to reschedule appointment');
    }
  }

  /**
   * Cancel a maintenance appointment
   */
  async cancelAppointment(
    tenantId: string,
    customerId: string,
    portalUserId: string,
    appointmentId: string,
    reason?: string,
  ): Promise<CustomerMaintenanceAppointment> {
    try {
      // First check if appointment exists and belongs to customer
      const [existingAppointment] = await db
        .select()
        .from(customerMaintenanceAppointments)
        .where(
          and(
            eq(customerMaintenanceAppointments.id, appointmentId),
            eq(customerMaintenanceAppointments.tenantId, tenantId),
            eq(customerMaintenanceAppointments.customerId, customerId),
          ),
        );

      if (!existingAppointment) {
        throw new Error('Appointment not found');
      }

      if (existingAppointment.status === 'completed') {
        throw new Error('Cannot cancel completed appointment');
      }

      const [cancelledAppointment] = await db
        .update(customerMaintenanceAppointments)
        .set({
          status: 'cancelled',
          rescheduleReason: reason || 'Cancelled by customer',
          updatedAt: new Date(),
        })
        .where(eq(customerMaintenanceAppointments.id, appointmentId))
        .returning();

      await this.logActivity(
        tenantId,
        customerId,
        portalUserId,
        'appointment_cancelled',
        `Cancelled appointment: ${reason || 'No reason provided'}`,
      );

      return cancelledAppointment;
    } catch (error) {
      log.error('Error cancelling appointment:', error);
      throw new Error('Failed to cancel appointment');
    }
  }

  /**
   * Get appointment details by ID
   */
  async getAppointmentById(
    tenantId: string,
    customerId: string,
    appointmentId: string,
  ): Promise<CustomerMaintenanceAppointment | null> {
    try {
      const [appointment] = await db
        .select()
        .from(customerMaintenanceAppointments)
        .where(
          and(
            eq(customerMaintenanceAppointments.id, appointmentId),
            eq(customerMaintenanceAppointments.tenantId, tenantId),
            eq(customerMaintenanceAppointments.customerId, customerId),
          ),
        );

      return appointment || null;
    } catch (error) {
      log.error('Error getting appointment by ID:', error);
      throw new Error('Failed to get appointment details');
    }
  }
}
