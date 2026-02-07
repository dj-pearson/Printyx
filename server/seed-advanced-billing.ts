import { storage } from './storage';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('seed-advanced-billing');

async function seedAdvancedBilling() {
  try {
    log.info('Seeding advanced billing system...');

    const tenantId = 'demo-tenant';
    const now = new Date();

    // 1. Create Billing Rules
    log.info('Creating billing rules...');

    // Tiered rate rule for high-volume customers
    const tieredRule = await storage.createBillingRule({
      tenantId,
      ruleName: 'High-Volume Tiered Pricing',
      ruleDescription: 'Tiered pricing for customers with high monthly volume (>5000 pages)',
      ruleType: 'tiered',
      ruleStatus: 'active',
      priority: 1,
      customerId: 'customer-201',
      applicableToAllCustomers: false,
      applicableToAllEquipment: false,
      effectiveStartDate: new Date(now.getFullYear(), now.getMonth() - 3, 1),
      billingCycle: 'monthly',
      tieredRates: [
        { minVolume: 0, maxVolume: 1000, bwRate: 0.01, colorRate: 0.05 },
        { minVolume: 1001, maxVolume: 5000, bwRate: 0.008, colorRate: 0.04 },
        { minVolume: 5001, maxVolume: 10000, bwRate: 0.006, colorRate: 0.03 },
        { minVolume: 10001, maxVolume: null, bwRate: 0.005, colorRate: 0.025 },
      ],
      baseCharge: '100.00',
      minimumCharge: '150.00',
      baseVolumeBw: 500,
      baseVolumeColor: 100,
      metadata: {
        customerName: 'TechCorp',
        negotiatedDate: '2024-08-01',
        accountManager: 'John Smith',
      },
      createdBy: 'admin-001',
    });

    // Volume discount rule
    const volumeDiscountRule = await storage.createBillingRule({
      tenantId,
      ruleName: 'Enterprise Volume Discount',
      ruleDescription: 'Volume-based discounts for enterprise customers',
      ruleType: 'volume_discount',
      ruleStatus: 'active',
      priority: 2,
      customerId: 'customer-202',
      applicableToAllCustomers: false,
      applicableToAllEquipment: true,
      effectiveStartDate: new Date(now.getFullYear(), now.getMonth() - 6, 1),
      billingCycle: 'monthly',
      volumeDiscounts: [
        { threshold: 10000, discountPercent: 5 },
        { threshold: 25000, discountPercent: 10 },
        { threshold: 50000, discountPercent: 15 },
      ],
      bwRate: '0.009',
      colorRate: '0.045',
      baseCharge: '200.00',
      minimumCharge: '300.00',
      baseVolumeBw: 1000,
      baseVolumeColor: 200,
      metadata: {
        customerName: 'Enterprise Solutions Inc',
        contractTerm: '36 months',
        autoRenewal: true,
      },
      createdBy: 'admin-001',
    });

    // Overage pricing rule
    const overageRule = await storage.createBillingRule({
      tenantId,
      ruleName: 'Standard Overage Pricing',
      ruleDescription: 'Standard overage rates for base contract volumes',
      ruleType: 'overage',
      ruleStatus: 'active',
      priority: 3,
      contractId: 'contract-101',
      applicableToAllCustomers: false,
      applicableToAllEquipment: false,
      effectiveStartDate: new Date(now.getFullYear(), now.getMonth() - 12, 1),
      billingCycle: 'monthly',
      bwRate: '0.012',
      colorRate: '0.06',
      baseVolumeBw: 2000,
      baseVolumeColor: 500,
      overageMultiplier: '1.5', // 50% premium on overages
      metadata: {
        contractType: 'Full Service',
        includesSupplies: true,
      },
      createdBy: 'admin-001',
    });

    // Flat rate rule
    const flatRateRule = await storage.createBillingRule({
      tenantId,
      ruleName: 'Small Business Flat Rate',
      ruleDescription: 'Simple flat monthly rate for small businesses',
      ruleType: 'flat_rate',
      ruleStatus: 'active',
      priority: 4,
      productCategory: 'color_mfp',
      applicableToAllCustomers: false,
      applicableToAllEquipment: false,
      effectiveStartDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      billingCycle: 'monthly',
      baseCharge: '199.00',
      minimumCharge: '199.00',
      maximumCharge: '199.00',
      metadata: {
        planName: 'Small Business Essentials',
        includedPages: 1500,
        marketingCampaign: 'Q4-2024',
      },
      createdBy: 'admin-001',
    });

    // Inactive rule (for testing)
    const inactiveRule = await storage.createBillingRule({
      tenantId,
      ruleName: 'Legacy Pricing (Deprecated)',
      ruleDescription: 'Old pricing model - replaced by tiered rates',
      ruleType: 'custom',
      ruleStatus: 'inactive',
      priority: 99,
      applicableToAllCustomers: false,
      applicableToAllEquipment: false,
      effectiveStartDate: new Date(now.getFullYear() - 2, 0, 1),
      effectiveEndDate: new Date(now.getFullYear(), 0, 1),
      billingCycle: 'monthly',
      bwRate: '0.015',
      colorRate: '0.075',
      metadata: {
        deprecatedDate: '2024-01-01',
        replacedBy: tieredRule.id,
      },
      createdBy: 'admin-001',
    });

    log.info(`Created ${5} billing rules`);

    // 2. Create Meter Anomalies
    log.info('Creating meter anomalies...');

    // Sudden spike anomaly
    const spikeAnomaly = await storage.createMeterAnomaly({
      tenantId,
      meterReadingId: 'meter-reading-001',
      equipmentId: 'equipment-101',
      contractId: 'contract-101',
      customerId: 'customer-201',
      anomalyType: 'spike',
      severity: 'high',
      detectedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      detectionMethod: 'automated',
      currentBwReading: 125000,
      currentColorReading: 35000,
      previousBwReading: 85000,
      previousColorReading: 25000,
      expectedBwReading: 87500,
      expectedColorReading: 25500,
      bwDeviation: 37500,
      colorDeviation: 9500,
      bwDeviationPercent: '42.86',
      colorDeviationPercent: '37.25',
      anomalyDescription:
        'Sudden spike in B&W printing detected (42.86% increase). Current reading: 125,000, Expected: 87,500',
      suggestedAction:
        'Contact customer to verify meter reading accuracy. Possible causes: large print job, meter error, or new equipment usage patterns.',
      requiresReview: true,
      reviewed: true,
      reviewedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      reviewedBy: 'manager-001',
      reviewNotes: 'Confirmed with customer - large marketing campaign print job. Valid reading.',
      resolved: true,
      resolvedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      resolutionMethod: 'accepted',
      resolutionNotes:
        'Reading accepted. Customer confirmed bulk marketing materials printed for trade show.',
      autoNotificationSent: true,
      notifiedUsers: ['manager-001', 'billing-admin-001'],
      impactOnBilling: true,
      affectedInvoiceIds: ['invoice-2024-11-001'],
    });

    // Negative reading anomaly (meter reset)
    const negativeAnomaly = await storage.createMeterAnomaly({
      tenantId,
      meterReadingId: 'meter-reading-002',
      equipmentId: 'equipment-102',
      contractId: 'contract-102',
      customerId: 'customer-202',
      anomalyType: 'negative_reading',
      severity: 'critical',
      detectedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
      detectionMethod: 'automated',
      currentBwReading: 2500,
      currentColorReading: 500,
      previousBwReading: 95000,
      previousColorReading: 28000,
      expectedBwReading: 97000,
      expectedColorReading: 28500,
      bwDeviation: -94500,
      colorDeviation: -28000,
      bwDeviationPercent: '-97.42',
      colorDeviationPercent: '-98.25',
      anomalyDescription:
        'CRITICAL: Meter reading decreased from previous reading. Current: 2,500 (was 95,000). Possible meter replacement or equipment swap.',
      suggestedAction:
        'URGENT: Contact customer immediately. Verify equipment serial number. Check if meter was replaced or equipment swapped.',
      requiresReview: true,
      reviewed: false,
      resolved: false,
      autoNotificationSent: true,
      notifiedUsers: ['manager-001', 'admin-001', 'technician-001'],
      impactOnBilling: true,
    });

    // Stagnant meter anomaly
    const stagnantAnomaly = await storage.createMeterAnomaly({
      tenantId,
      meterReadingId: 'meter-reading-003',
      equipmentId: 'equipment-103',
      contractId: 'contract-103',
      customerId: 'customer-203',
      anomalyType: 'stagnant',
      severity: 'medium',
      detectedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      detectionMethod: 'automated',
      currentBwReading: 52000,
      currentColorReading: 15000,
      previousBwReading: 52000,
      previousColorReading: 15000,
      expectedBwReading: 54500,
      expectedColorReading: 15750,
      bwDeviation: -2500,
      colorDeviation: -750,
      bwDeviationPercent: '-4.59',
      colorDeviationPercent: '-4.76',
      anomalyDescription:
        'No usage detected for 30+ days. Meter reading unchanged: B&W: 52,000, Color: 15,000',
      suggestedAction:
        'Contact customer to verify equipment status. Equipment may be offline, unplugged, or no longer in use.',
      requiresReview: true,
      reviewed: true,
      reviewedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      reviewedBy: 'technician-001',
      reviewNotes:
        'Customer confirmed equipment moved to storage during office renovation. Not in use temporarily.',
      resolved: false, // Still monitoring
      autoNotificationSent: true,
      notifiedUsers: ['manager-001'],
      impactOnBilling: false,
    });

    // Out of range anomaly
    const outOfRangeAnomaly = await storage.createMeterAnomaly({
      tenantId,
      meterReadingId: 'meter-reading-004',
      equipmentId: 'equipment-104',
      customerId: 'customer-204',
      anomalyType: 'out_of_range',
      severity: 'low',
      detectedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
      detectionMethod: 'automated',
      currentBwReading: 145000,
      currentColorReading: 42000,
      previousBwReading: 140000,
      previousColorReading: 40500,
      expectedBwReading: 142000,
      expectedColorReading: 41000,
      bwDeviation: 3000,
      colorDeviation: 1000,
      bwDeviationPercent: '2.11',
      colorDeviationPercent: '2.44',
      anomalyDescription:
        'Slight deviation from expected usage pattern. May indicate seasonal variation.',
      suggestedAction:
        'Monitor for next reading. If pattern continues, may need to adjust usage baseline.',
      requiresReview: false,
      reviewed: false,
      resolved: false,
      autoNotificationSent: false,
      impactOnBilling: false,
    });

    log.info(`Created ${4} meter anomalies`);

    // 3. Create Billing Disputes
    log.info('Creating billing disputes...');

    // Open dispute - meter reading challenge
    const meterDisputeOpen = await storage.createBillingDispute({
      tenantId,
      disputeNumber: `DISPUTE-${now.getFullYear()}-001`,
      invoiceId: 'invoice-2024-10-001',
      customerId: 'customer-201',
      equipmentId: 'equipment-101',
      meterReadingId: 'meter-reading-001',
      disputeType: 'meter_reading',
      disputeStatus: 'open',
      severity: 'high',
      disputedAmount: '1250.50',
      customerComplaint:
        "The meter reading for October shows 42,000 pages, but our internal records show only 28,000 pages printed. We believe there's an error in the meter reading.",
      customerContactName: 'Jane Smith',
      customerContactEmail: 'jsmith@techcorp.com',
      customerContactPhone: '512-555-1234',
      filedDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      assignedTo: 'billing-admin-001',
      assignedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      priorityLevel: 2,
      internalNotes:
        'Customer has requested technician visit to verify meter reading. Scheduling for this week.',
      requiresManagerApproval: true,
      createdBy: 'customer-service-001',
    });

    // Under review dispute - pricing error
    const pricingDisputeReview = await storage.createBillingDispute({
      tenantId,
      disputeNumber: `DISPUTE-${now.getFullYear()}-002`,
      invoiceId: 'invoice-2024-10-002',
      customerId: 'customer-202',
      equipmentId: 'equipment-102',
      disputeType: 'pricing',
      disputeStatus: 'under_review',
      severity: 'medium',
      disputedAmount: '325.00',
      approvedCreditAmount: '0.00',
      customerComplaint:
        'We were quoted a rate of $0.008 per B&W page but invoice shows $0.01 per page. Contract shows the lower rate.',
      customerContactName: 'Bob Johnson',
      customerContactEmail: 'bjohnson@enterprise-solutions.com',
      customerContactPhone: '512-555-5678',
      filedDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      assignedTo: 'billing-admin-002',
      assignedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      priorityLevel: 2,
      internalNotes:
        'Confirmed contract shows $0.008 rate. Billing system was using old rate. Need to correct and issue credit memo.',
      researchNotes:
        'Reviewed contract file. Customer is correct. System has wrong rate configured.',
      communicationLog: [
        {
          date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
          user: 'billing-admin-002',
          type: 'email',
          message: 'Acknowledged dispute. Reviewing contract terms.',
        },
        {
          date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
          user: 'billing-admin-002',
          type: 'phone',
          message: 'Called customer to confirm contract details. Promised resolution by Friday.',
        },
      ],
      requiresManagerApproval: true,
      createdBy: 'customer-service-002',
    });

    // Resolved dispute - service quality
    const serviceDisputeResolved = await storage.createBillingDispute({
      tenantId,
      disputeNumber: `DISPUTE-${now.getFullYear()}-003`,
      invoiceId: 'invoice-2024-09-003',
      customerId: 'customer-203',
      disputeType: 'service_quality',
      disputeStatus: 'resolved',
      severity: 'high',
      disputedAmount: '450.00',
      approvedCreditAmount: '225.00',
      customerComplaint:
        'Equipment was down for 3 days due to delayed technician visit. We should not be charged for those days.',
      customerContactName: 'Alice Williams',
      customerContactEmail: 'awilliams@acme-corp.com',
      customerContactPhone: '512-555-9012',
      filedDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      dueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      assignedTo: 'manager-001',
      assignedAt: new Date(now.getTime() - 19 * 24 * 60 * 60 * 1000),
      priorityLevel: 1,
      internalNotes:
        'Customer is a long-standing account. Service logs confirm 3-day delay due to parts availability. Goodwill gesture warranted.',
      researchNotes:
        'Service ticket #ST-1234 confirms equipment down Sep 12-15. Technician dispatch delayed due to part backorder.',
      resolutionType: 'partial_credit',
      resolutionDescription:
        'Issued 50% credit ($225) for service interruption. Expedited parts ordering process implemented.',
      resolutionDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      resolvedBy: 'manager-001',
      creditMemoNumber: 'CM-2024-001',
      creditMemoAmount: '225.00',
      creditMemoIssued: true,
      creditMemoIssuedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      communicationLog: [
        {
          date: new Date(now.getTime() - 19 * 24 * 60 * 60 * 1000),
          user: 'manager-001',
          type: 'email',
          message: 'Dispute assigned to me. Reviewing service logs.',
        },
        {
          date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
          user: 'manager-001',
          type: 'phone',
          message: 'Called customer. Apologized for delay. Proposed 50% credit.',
        },
        {
          date: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
          user: 'customer',
          type: 'email',
          message: 'Customer accepted resolution. Satisfied with outcome.',
        },
      ],
      requiresManagerApproval: true,
      managerApproved: true,
      approvedBy: 'manager-001',
      approvedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      approvalNotes: 'Approved 50% credit. Reasonable resolution given service delay.',
      customerSatisfactionRating: 4,
      customerFeedback:
        'Thank you for working with us on this. We appreciate the quick resolution.',
      preventativeAction:
        'Implemented priority parts ordering for critical accounts. Updated SLA to guarantee 24-hour response.',
      createdBy: 'customer-service-001',
    });

    // Escalated dispute
    const unauthorizedDisputeEscalated = await storage.createBillingDispute({
      tenantId,
      disputeNumber: `DISPUTE-${now.getFullYear()}-004`,
      invoiceId: 'invoice-2024-10-004',
      customerId: 'customer-204',
      disputeType: 'unauthorized_charge',
      disputeStatus: 'escalated',
      severity: 'critical',
      disputedAmount: '2150.00',
      customerComplaint:
        'Invoice includes charges for equipment we returned 2 months ago. We specifically requested termination of this contract.',
      customerContactName: 'David Brown',
      customerContactEmail: 'dbrown@legal-eagles.com',
      customerContactPhone: '512-555-3456',
      filedDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      assignedTo: 'manager-001',
      assignedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      priorityLevel: 1,
      internalNotes:
        'Customer is threatening legal action. Need to verify equipment return receipt and contract termination documentation.',
      researchNotes:
        'Equipment return logged on Aug 15. Contract termination request submitted Sep 1. System continued billing. This is our error.',
      escalated: true,
      escalatedTo: 'vp-operations-001',
      escalatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      escalationReason:
        'Customer threatened legal action. Full invoice reversal required. Senior management approval needed.',
      communicationLog: [
        {
          date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
          user: 'billing-admin-001',
          type: 'email',
          message: 'Acknowledged dispute. Investigating equipment return and contract status.',
        },
        {
          date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          user: 'manager-001',
          type: 'phone',
          message:
            'Called customer. Confirmed equipment returned Aug 15. Customer is very upset. Escalating to VP.',
        },
        {
          date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          user: 'vp-operations-001',
          type: 'phone',
          message:
            'Called customer personally. Apologized. Committed to full credit and review of termination process.',
        },
      ],
      requiresManagerApproval: true,
      createdBy: 'billing-admin-001',
    });

    log.info(`Created ${4} billing disputes`);

    // 4. Create Invoice Generation Logs
    log.info('Creating invoice generation logs...');

    // Successful generation
    const successLog1 = await storage.createInvoiceGenerationLog({
      tenantId,
      batchId: `BATCH-${now.toISOString().slice(0, 10)}`,
      generationType: 'automated',
      invoiceId: 'invoice-2024-11-001',
      customerId: 'customer-201',
      contractId: 'contract-101',
      equipmentId: 'equipment-101',
      billingPeriodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      billingPeriodEnd: new Date(now.getFullYear(), now.getMonth(), 0),
      status: 'success',
      meterReadingsUsed: [{ meterReadingId: 'meter-reading-001', bw: 42000, color: 12500 }],
      billingRulesApplied: [
        { ruleId: tieredRule.id, ruleName: 'High-Volume Tiered Pricing', amount: '1250.50' },
      ],
      calculatedSubtotal: '1250.50',
      calculatedTax: '106.29',
      calculatedTotal: '1356.79',
      lineItemsGenerated: 3,
      processingTimeMs: 245,
      sentToCustomer: true,
      sentAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
      triggeredBy: 'system',
      triggeredByEvent: 'scheduled_billing',
    });

    // Failed generation
    const failedLog = await storage.createInvoiceGenerationLog({
      tenantId,
      batchId: `BATCH-${now.toISOString().slice(0, 10)}`,
      generationType: 'automated',
      customerId: 'customer-202',
      contractId: 'contract-102',
      equipmentId: 'equipment-102',
      billingPeriodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      billingPeriodEnd: new Date(now.getFullYear(), now.getMonth(), 0),
      status: 'failed',
      processingTimeMs: 1523,
      errorOccurred: true,
      errorType: 'missing_meter_reading',
      errorMessage:
        'No meter reading found for billing period. Customer must submit meter reading before invoice can be generated.',
      warningsGenerated: [
        { type: 'missing_data', message: 'No meter reading submitted for October 2024' },
        {
          type: 'billing_delayed',
          message: 'Invoice generation delayed until meter reading received',
        },
      ],
      triggeredBy: 'system',
      triggeredByEvent: 'scheduled_billing',
    });

    // Partial success (with warnings)
    const partialLog = await storage.createInvoiceGenerationLog({
      tenantId,
      batchId: `BATCH-${now.toISOString().slice(0, 10)}`,
      generationType: 'automated',
      invoiceId: 'invoice-2024-11-003',
      customerId: 'customer-203',
      contractId: 'contract-103',
      billingPeriodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      billingPeriodEnd: new Date(now.getFullYear(), now.getMonth(), 0),
      status: 'partial',
      meterReadingsUsed: [{ meterReadingId: 'meter-reading-003', bw: 52000, color: 15000 }],
      billingRulesApplied: [
        { ruleId: overageRule.id, ruleName: 'Standard Overage Pricing', amount: '485.00' },
      ],
      calculatedSubtotal: '485.00',
      calculatedTax: '41.23',
      calculatedTotal: '526.23',
      lineItemsGenerated: 2,
      processingTimeMs: 312,
      errorOccurred: false,
      warningsGenerated: [
        { type: 'anomaly_detected', message: 'Stagnant meter detected - no usage for 30+ days' },
        {
          type: 'customer_notification',
          message: 'Customer should be contacted to verify equipment status',
        },
      ],
      sentToCustomer: true,
      sentAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago
      triggeredBy: 'system',
      triggeredByEvent: 'scheduled_billing',
    });

    // Manual generation
    const manualLog = await storage.createInvoiceGenerationLog({
      tenantId,
      generationType: 'manual',
      invoiceId: 'invoice-2024-11-999',
      customerId: 'customer-205',
      billingPeriodStart: new Date(now.getFullYear(), now.getMonth() - 1, 15),
      billingPeriodEnd: new Date(now.getFullYear(), now.getMonth(), 14),
      status: 'success',
      calculatedSubtotal: '750.00',
      calculatedTax: '63.75',
      calculatedTotal: '813.75',
      lineItemsGenerated: 5,
      processingTimeMs: 189,
      sentToCustomer: false,
      triggeredBy: 'admin-001',
      triggeredByEvent: 'manual_request',
      metadata: {
        reason: 'Pro-rated billing for mid-month equipment installation',
        requestedBy: 'Sales Rep - John Doe',
        approvedBy: 'Manager - Jane Smith',
      },
    });

    log.info(`Created ${4} invoice generation logs`);

    // 5. Create Billing Schedules
    log.info('Creating billing schedules...');

    // Monthly recurring schedule
    const monthlySchedule = await storage.createBillingSchedule({
      tenantId,
      scheduleName: 'Monthly Billing - All Customers',
      scheduleDescription: 'Standard monthly billing cycle for all active contracts',
      scheduleType: 'recurring',
      frequency: 'monthly',
      dayOfMonth: 1, // Bill on 1st of month
      billingCutoffDay: 28, // Cutoff on 28th of previous month
      nextRunDate: new Date(now.getFullYear(), now.getMonth() + 1, 1), // Next month
      lastRunDate: new Date(now.getFullYear(), now.getMonth(), 1), // This month
      isActive: true,
      autoSendInvoice: true,
      autoApplyLateFees: false,
      notifyBeforeDays: 3,
      metadata: {
        billingTeam: 'Accounts Receivable',
        emailTemplate: 'monthly-invoice-standard',
      },
      createdBy: 'admin-001',
    });

    // Quarterly schedule
    const quarterlySchedule = await storage.createBillingSchedule({
      tenantId,
      scheduleName: 'Quarterly Billing - Enterprise Accounts',
      scheduleDescription: 'Quarterly billing for enterprise customers with negotiated terms',
      scheduleType: 'recurring',
      frequency: 'quarterly',
      customerId: 'customer-202',
      dayOfMonth: 15, // Bill on 15th of quarter-end month
      billingCutoffDay: 10,
      nextRunDate: new Date(now.getFullYear(), 11, 15), // Dec 15
      lastRunDate: new Date(now.getFullYear(), 8, 15), // Sep 15
      isActive: true,
      autoSendInvoice: true,
      autoApplyLateFees: true,
      notifyBeforeDays: 7,
      metadata: {
        paymentTerms: 'Net 60',
        accountManager: 'Enterprise Sales Team',
      },
      createdBy: 'admin-001',
    });

    // Weekly schedule (for testing/special cases)
    const weeklySchedule = await storage.createBillingSchedule({
      tenantId,
      scheduleName: 'Weekly Billing - Trial Account',
      scheduleDescription: 'Weekly billing for trial period customer',
      scheduleType: 'recurring',
      frequency: 'weekly',
      customerId: 'customer-999',
      contractId: 'contract-trial-001',
      dayOfWeek: 5, // Friday
      nextRunDate: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + ((5 - now.getDay() + 7) % 7),
      ),
      lastRunDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
      isActive: true,
      autoSendInvoice: false, // Manual review required
      autoApplyLateFees: false,
      notifyBeforeDays: 1,
      metadata: {
        trialPeriod: true,
        reviewRequired: true,
      },
      createdBy: 'sales-001',
    });

    // Inactive schedule
    const inactiveSchedule = await storage.createBillingSchedule({
      tenantId,
      scheduleName: 'Legacy Annual Billing (Deprecated)',
      scheduleDescription: 'Old annual billing - migrated to monthly',
      scheduleType: 'recurring',
      frequency: 'annual',
      dayOfMonth: 1,
      nextRunDate: new Date(now.getFullYear() + 1, 0, 1),
      lastRunDate: new Date(now.getFullYear(), 0, 1),
      isActive: false,
      autoSendInvoice: false,
      autoApplyLateFees: false,
      metadata: {
        deprecated: true,
        migratedToMonthly: true,
        migrationDate: '2024-01-01',
      },
      createdBy: 'admin-001',
    });

    log.info(`Created ${4} billing schedules`);

    // 6. Create Credit Memos
    log.info('Creating credit memos...');

    // Issued credit memo (from resolved dispute)
    const issuedCredit = await storage.createCreditMemo({
      tenantId,
      creditMemoNumber: 'CM-2024-001',
      customerId: 'customer-203',
      invoiceId: 'invoice-2024-09-003',
      disputeId: serviceDisputeResolved.id,
      creditAmount: '225.00',
      creditReason: 'dispute_resolution',
      creditDescription:
        'Partial credit for 3-day service interruption due to delayed technician visit and parts backorder.',
      creditStatus: 'issued',
      appliedToInvoice: true,
      appliedToInvoiceId: 'invoice-2024-09-003',
      appliedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      issuedDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      approvedBy: 'manager-001',
      approvedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      metadata: {
        disputeNumber: serviceDisputeResolved.disputeNumber,
        originalInvoiceAmount: '450.00',
        creditPercentage: 50,
        customerSatisfaction: 'Satisfied',
      },
      createdBy: 'manager-001',
    });

    // Approved credit memo (ready to be issued)
    const approvedCredit = await storage.createCreditMemo({
      tenantId,
      creditMemoNumber: 'CM-2024-002',
      customerId: 'customer-202',
      invoiceId: 'invoice-2024-10-002',
      disputeId: pricingDisputeReview.id,
      creditAmount: '325.00',
      creditReason: 'billing_error',
      creditDescription:
        'Billing rate correction - customer charged $0.01/page instead of contracted rate of $0.008/page for 32,500 B&W pages.',
      creditStatus: 'approved',
      appliedToInvoice: false,
      issuedDate: now,
      approvedBy: 'manager-001',
      approvedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      metadata: {
        calculationDetails:
          '32,500 pages x ($0.01 - $0.008) = $65.00 overcharge x 5 months = $325.00',
        billingRuleCorrected: true,
        futureInvoicesUpdated: true,
      },
      createdBy: 'billing-admin-002',
    });

    // Pending credit memo (awaiting approval)
    const pendingCredit = await storage.createCreditMemo({
      tenantId,
      creditMemoNumber: 'CM-2024-003',
      customerId: 'customer-201',
      invoiceId: 'invoice-2024-10-001',
      creditAmount: '150.00',
      creditReason: 'goodwill',
      creditDescription:
        'Goodwill credit for customer inconvenience during meter reading verification process.',
      creditStatus: 'pending',
      appliedToInvoice: false,
      issuedDate: now,
      metadata: {
        requestedBy: 'customer-service-001',
        requestDate: now,
        justification: 'Long-time customer, minor billing issue, maintain good relationship',
      },
      createdBy: 'customer-service-001',
    });

    // Voided credit memo
    const voidedCredit = await storage.createCreditMemo({
      tenantId,
      creditMemoNumber: 'CM-2024-099',
      customerId: 'customer-999',
      invoiceId: 'invoice-2024-08-999',
      creditAmount: '500.00',
      creditReason: 'billing_error',
      creditDescription:
        'Credit for duplicate invoice (later determined to be valid separate invoice)',
      creditStatus: 'voided',
      appliedToInvoice: false,
      issuedDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      approvedBy: 'manager-002',
      approvedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      voidedBy: 'admin-001',
      voidedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      voidReason:
        'Customer error - invoices were for different billing periods. Both invoices valid. Credit memo voided per customer request.',
      metadata: {
        customerAcknowledged: true,
        duplicateCreditPrevented: true,
      },
      createdBy: 'billing-admin-003',
    });

    log.info(`Created ${4} credit memos`);

    log.info('✅ Advanced billing system seeded successfully');
    log.info(`Summary:
  - 5 billing rules (tiered, volume discount, overage, flat rate, inactive)
  - 4 meter anomalies (spike, negative reading, stagnant, out of range)
  - 4 billing disputes (open, under review, resolved, escalated)
  - 4 invoice generation logs (success, failed, partial, manual)
  - 4 billing schedules (monthly, quarterly, weekly, inactive)
  - 4 credit memos (issued, approved, pending, voided)
    `);
  } catch (error) {
    log.error('❌ Error seeding advanced billing:', error);
    throw error;
  }
}

// Run the seed function if called directly
if (require.main === module) {
  seedAdvancedBilling()
    .then(() => {
      log.info('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedAdvancedBilling };
