import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('seed-lease-data');

import {
  leases,
  leasePayments,
  leaseRenewals,
  leaseDispositions,
  businessRecords,
  equipment,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function seedLeaseData() {
  log.info('Starting lease data seeding...');

  try {
    // Get a tenant ID from existing data
    const existingCustomers = await db
      .select()
      .from(businessRecords)
      .where(eq(businessRecords.recordType, 'customer'))
      .limit(5);

    if (existingCustomers.length === 0) {
      log.info('No customers found. Please seed customer data first.');
      return;
    }

    const tenantId = existingCustomers[0].tenantId;
    log.info(`Using tenant ID: ${tenantId}`);

    // Create sample leases in various states
    const sampleLeases = [
      {
        tenantId,
        customerId: existingCustomers[0].id,
        equipmentId: null,
        leaseNumber: 'LS-2024-001',
        leaseName: 'Canon MFP Lease 2024',
        term: 36,
        monthlyPayment: '450.00',
        totalAmount: '16200.00',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2027-01-14'),
        firstPaymentDate: new Date('2024-02-01'),
        lastPaymentDate: new Date('2027-01-01'),
        status: 'active',
        leaseType: 'fmv',
        paymentFrequency: 'monthly',
        fairMarketValue: '500.00',
        purchaseOption: '50.00',
        residualValue: '550.00',
        earlyTerminationFee: '2000.00',
        lateFeePercentage: '5.00',
        gracePeriodDays: 5,
        autoRenewal: true,
        paymentsCompleted: 11,
        totalPaid: '4950.00',
        createdBy: 'system',
      },
      {
        tenantId,
        customerId: existingCustomers[1]?.id || existingCustomers[0].id,
        equipmentId: null,
        leaseNumber: 'LS-2024-002',
        leaseName: 'Office Equipment Lease',
        term: 60,
        monthlyPayment: '289.00',
        totalAmount: '17340.00',
        startDate: new Date('2023-06-01'),
        endDate: new Date('2028-05-31'),
        firstPaymentDate: new Date('2023-07-01'),
        lastPaymentDate: new Date('2028-06-01'),
        status: 'pending_renewal',
        leaseType: 'dollar_buyout',
        paymentFrequency: 'monthly',
        fairMarketValue: '1.00',
        purchaseOption: '1.00',
        residualValue: '1.00',
        earlyTerminationFee: '1500.00',
        lateFeePercentage: '5.00',
        gracePeriodDays: 5,
        autoRenewal: false,
        paymentsCompleted: 53,
        totalPaid: '15317.00',
        createdBy: 'system',
      },
      {
        tenantId,
        customerId: existingCustomers[2]?.id || existingCustomers[0].id,
        equipmentId: null,
        leaseNumber: 'LS-2023-045',
        leaseName: 'Xerox Printer Lease',
        term: 48,
        monthlyPayment: '625.00',
        totalAmount: '30000.00',
        startDate: new Date('2020-03-01'),
        endDate: new Date('2024-02-28'),
        firstPaymentDate: new Date('2020-04-01'),
        lastPaymentDate: new Date('2024-03-01'),
        status: 'expired',
        leaseType: 'fmv',
        paymentFrequency: 'monthly',
        fairMarketValue: '800.00',
        purchaseOption: '100.00',
        residualValue: '900.00',
        earlyTerminationFee: '3000.00',
        lateFeePercentage: '5.00',
        gracePeriodDays: 5,
        autoRenewal: false,
        paymentsCompleted: 48,
        totalPaid: '30000.00',
        createdBy: 'system',
      },
      {
        tenantId,
        customerId: existingCustomers[3]?.id || existingCustomers[0].id,
        equipmentId: null,
        leaseNumber: 'LS-2024-003',
        leaseName: 'Production Copier Lease',
        term: 36,
        monthlyPayment: '375.00',
        totalAmount: '13500.00',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2027-08-31'),
        firstPaymentDate: new Date('2024-10-01'),
        lastPaymentDate: new Date('2027-09-01'),
        status: 'active',
        leaseType: 'ten_percent',
        paymentFrequency: 'monthly',
        fairMarketValue: '1350.00',
        purchaseOption: '1350.00',
        residualValue: '1350.00',
        earlyTerminationFee: '1800.00',
        lateFeePercentage: '5.00',
        gracePeriodDays: 5,
        autoRenewal: true,
        paymentsCompleted: 3,
        totalPaid: '1125.00',
        createdBy: 'system',
      },
      {
        tenantId,
        customerId: existingCustomers[4]?.id || existingCustomers[0].id,
        equipmentId: null,
        leaseNumber: 'LS-2022-078',
        leaseName: 'High-Volume Copier Lease',
        term: 60,
        monthlyPayment: '520.00',
        totalAmount: '31200.00',
        startDate: new Date('2019-01-01'),
        endDate: new Date('2024-12-31'),
        firstPaymentDate: new Date('2019-02-01'),
        lastPaymentDate: new Date('2024-01-01'),
        status: 'expired',
        leaseType: 'dollar_buyout',
        paymentFrequency: 'monthly',
        fairMarketValue: '1.00',
        purchaseOption: '1.00',
        residualValue: '1.00',
        earlyTerminationFee: '2500.00',
        lateFeePercentage: '5.00',
        gracePeriodDays: 5,
        autoRenewal: false,
        paymentsCompleted: 60,
        totalPaid: '31200.00',
        createdBy: 'system',
      },
    ];

    log.info('Inserting leases...');
    const insertedLeases = await db.insert(leases).values(sampleLeases).returning();
    log.info(`✓ Inserted ${insertedLeases.length} leases`);

    // Create payment schedules for active leases
    log.info('Creating payment schedules...');
    const paymentRecords = [];

    for (const lease of insertedLeases) {
      if (lease.status === 'active' || lease.status === 'pending_renewal') {
        const startDate = new Date(lease.firstPaymentDate);
        const paymentsCompleted = lease.paymentsCompleted || 0;

        // Create past payments (completed)
        for (let i = 0; i < paymentsCompleted; i++) {
          const scheduledDate = new Date(startDate);
          scheduledDate.setMonth(startDate.getMonth() + i);

          const paidDate = new Date(scheduledDate);
          paidDate.setDate(paidDate.getDate() + Math.floor(Math.random() * 5)); // Paid within 5 days

          paymentRecords.push({
            tenantId,
            leaseId: lease.id,
            paymentNumber: i + 1,
            scheduledDate,
            scheduledAmount: lease.monthlyPayment,
            status: 'completed',
            paidDate,
            paidAmount: lease.monthlyPayment,
            transactionId: `TXN-${Date.now()}-${i}`,
          });
        }

        // Create upcoming payments (scheduled)
        const remainingPayments = lease.term - paymentsCompleted;
        for (let i = 0; i < Math.min(remainingPayments, 12); i++) {
          const scheduledDate = new Date(startDate);
          scheduledDate.setMonth(startDate.getMonth() + paymentsCompleted + i);

          paymentRecords.push({
            tenantId,
            leaseId: lease.id,
            paymentNumber: paymentsCompleted + i + 1,
            scheduledDate,
            scheduledAmount: lease.monthlyPayment,
            status: 'scheduled',
          });
        }
      }
    }

    if (paymentRecords.length > 0) {
      await db.insert(leasePayments).values(paymentRecords);
      log.info(`✓ Inserted ${paymentRecords.length} payment records`);
    }

    // Create renewal records for pending renewal leases
    log.info('Creating renewal records...');
    const renewalRecords = [];

    for (const lease of insertedLeases) {
      if (lease.status === 'pending_renewal') {
        const renewalDeadline = new Date(lease.endDate);
        renewalDeadline.setDate(renewalDeadline.getDate() - 30);

        renewalRecords.push({
          tenantId,
          leaseId: lease.id,
          renewalOffered: true,
          renewalOfferDate: new Date(lease.endDate.getTime() - 180 * 24 * 60 * 60 * 1000), // 180 days before
          renewalDeadline,
          renewalTerm: 36,
          renewalMonthlyPayment: lease.monthlyPayment,
          customerResponse: 'pending',
          createdBy: 'system',
        });
      }
    }

    if (renewalRecords.length > 0) {
      await db.insert(leaseRenewals).values(renewalRecords);
      log.info(`✓ Inserted ${renewalRecords.length} renewal records`);
    }

    // Create disposition records for completed/expired leases
    log.info('Creating disposition records...');
    const dispositionRecords = [];

    for (const lease of insertedLeases) {
      if (lease.status === 'completed') {
        dispositionRecords.push({
          tenantId,
          leaseId: lease.id,
          action: 'purchase',
          actionDate: new Date(lease.endDate),
          finalStatus: 'completed',
          completionDate: new Date(lease.endDate),
          purchasePrice: lease.purchaseOption,
          invoiceGenerated: true,
          equipmentPickedUp: false,
          createdBy: 'system',
        });
      } else if (lease.status === 'expired') {
        dispositionRecords.push({
          tenantId,
          leaseId: lease.id,
          action: 'return',
          actionDate: new Date(lease.endDate),
          finalStatus: 'completed',
          completionDate: new Date(lease.endDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days after
          equipmentPickedUp: true,
          pickupDate: new Date(lease.endDate.getTime() + 5 * 24 * 60 * 60 * 1000),
          createdBy: 'system',
        });
      }
    }

    if (dispositionRecords.length > 0) {
      await db.insert(leaseDispositions).values(dispositionRecords);
      log.info(`✓ Inserted ${dispositionRecords.length} disposition records`);
    }

    log.info('\n✅ Lease data seeding completed successfully!');
    log.info('\nSummary:');
    log.info(`- ${insertedLeases.length} leases created`);
    log.info(`- ${paymentRecords.length} payment records`);
    log.info(`- ${renewalRecords.length} renewal records`);
    log.info(`- ${dispositionRecords.length} disposition records`);
  } catch (error) {
    log.error('Error seeding lease data:', error);
    throw error;
  }
}

export { seedLeaseData };

// Auto-run when executed directly
seedLeaseData()
  .then(() => {
    log.info('Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    log.error('Seeding failed:', error);
    process.exit(1);
  });
