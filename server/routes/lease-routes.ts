import { Router } from 'express';
import { storage } from '../storage';
import {
  insertLeaseSchema,
  insertLeasePaymentSchema,
  insertLeaseRenewalSchema,
  insertLeaseDispositionSchema,
} from '@shared/schema';

const router = Router();

// ============= LEASE CRUD OPERATIONS =============

// Get all leases for tenant
router.get('/leases', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leases = await storage.getLeases(tenantId);
    res.json(leases);
  } catch (error) {
    next(error);
  }
});

// Get lease by ID
router.get('/leases/:id', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const lease = await storage.getLease(req.params.id, tenantId);
    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    res.json(lease);
  } catch (error) {
    next(error);
  }
});

// Get leases by customer
router.get('/customers/:customerId/leases', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leases = await storage.getLeasesByCustomer(req.params.customerId, tenantId);
    res.json(leases);
  } catch (error) {
    next(error);
  }
});

// Get leases by status
router.get('/leases/status/:status', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leases = await storage.getLeasesByStatus(req.params.status, tenantId);
    res.json(leases);
  } catch (error) {
    next(error);
  }
});

// Create new lease
router.post('/leases', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    const userId = req.session.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = insertLeaseSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId,
    });

    const lease = await storage.createLease(validatedData);
    res.status(201).json(lease);
  } catch (error) {
    next(error);
  }
});

// Update lease
router.patch('/leases/:id', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    const userId = req.session.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updatedLease = await storage.updateLease(req.params.id, tenantId, {
      ...req.body,
      updatedBy: userId,
    });

    if (!updatedLease) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    res.json(updatedLease);
  } catch (error) {
    next(error);
  }
});

// Delete lease
router.delete('/leases/:id', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await storage.deleteLease(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============= LEASE PAYMENT OPERATIONS =============

// Get payments for a lease
router.get('/leases/:leaseId/payments', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payments = await storage.getLeasePayments(req.params.leaseId, tenantId);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

// Get upcoming payments
router.get('/lease-payments/upcoming', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const daysAhead = parseInt(req.query.days as string) || 30;
    const payments = await storage.getUpcomingPayments(tenantId, daysAhead);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

// Get past due payments
router.get('/lease-payments/past-due', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payments = await storage.getPastDuePayments(tenantId);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

// Create lease payment
router.post('/lease-payments', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = insertLeasePaymentSchema.parse({
      ...req.body,
      tenantId,
    });

    const payment = await storage.createLeasePayment(validatedData);
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

// Update lease payment (e.g., mark as paid)
router.patch('/lease-payments/:id', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updatedPayment = await storage.updateLeasePayment(req.params.id, tenantId, req.body);
    if (!updatedPayment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(updatedPayment);
  } catch (error) {
    next(error);
  }
});

// Delete lease payment
router.delete('/lease-payments/:id', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await storage.deleteLeasePayment(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============= LEASE RENEWAL OPERATIONS =============

// Get all lease renewals
router.get('/lease-renewals', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const renewals = await storage.getLeaseRenewals(tenantId);
    res.json(renewals);
  } catch (error) {
    next(error);
  }
});

// Get lease renewal by lease ID
router.get('/leases/:leaseId/renewal', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const renewal = await storage.getLeaseRenewalByLease(req.params.leaseId, tenantId);
    res.json(renewal);
  } catch (error) {
    next(error);
  }
});

// Get leases needing renewal action
router.get('/lease-renewals/action-needed', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const daysAhead = parseInt(req.query.days as string) || 180;
    const renewals = await storage.getLeasesNeedingRenewalAction(tenantId, daysAhead);
    res.json(renewals);
  } catch (error) {
    next(error);
  }
});

// Create lease renewal
router.post('/lease-renewals', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    const userId = req.session.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = insertLeaseRenewalSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId,
    });

    const renewal = await storage.createLeaseRenewal(validatedData);
    res.status(201).json(renewal);
  } catch (error) {
    next(error);
  }
});

// Update lease renewal
router.patch('/lease-renewals/:id', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updatedRenewal = await storage.updateLeaseRenewal(req.params.id, tenantId, req.body);
    if (!updatedRenewal) {
      return res.status(404).json({ error: 'Renewal not found' });
    }

    res.json(updatedRenewal);
  } catch (error) {
    next(error);
  }
});

// Delete lease renewal
router.delete('/lease-renewals/:id', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await storage.deleteLeaseRenewal(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============= LEASE DISPOSITION OPERATIONS =============

// Get all lease dispositions
router.get('/lease-dispositions', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dispositions = await storage.getLeaseDispositions(tenantId);
    res.json(dispositions);
  } catch (error) {
    next(error);
  }
});

// Get disposition by lease ID
router.get('/leases/:leaseId/disposition', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const disposition = await storage.getLeaseDispositionByLease(req.params.leaseId, tenantId);
    res.json(disposition);
  } catch (error) {
    next(error);
  }
});

// Create lease disposition
router.post('/lease-dispositions', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    const userId = req.session.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = insertLeaseDispositionSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId,
    });

    const disposition = await storage.createLeaseDisposition(validatedData);
    res.status(201).json(disposition);
  } catch (error) {
    next(error);
  }
});

// Update lease disposition
router.patch('/lease-dispositions/:id', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updatedDisposition = await storage.updateLeaseDisposition(
      req.params.id,
      tenantId,
      req.body,
    );
    if (!updatedDisposition) {
      return res.status(404).json({ error: 'Disposition not found' });
    }

    res.json(updatedDisposition);
  } catch (error) {
    next(error);
  }
});

// Delete lease disposition
router.delete('/lease-dispositions/:id', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await storage.deleteLeaseDisposition(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============= LEASE LIFECYCLE OPERATIONS =============

// Generate lease payment schedule
router.post('/leases/:id/generate-payment-schedule', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const lease = await storage.getLease(req.params.id, tenantId);
    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    // Generate payment schedule based on lease terms
    const paymentSchedule = [];
    const startDate = new Date(lease.firstPaymentDate);

    for (let i = 0; i < lease.term; i++) {
      const scheduledDate = new Date(startDate);
      scheduledDate.setMonth(startDate.getMonth() + i);

      const payment = await storage.createLeasePayment({
        tenantId,
        leaseId: lease.id,
        paymentNumber: i + 1,
        scheduledDate,
        scheduledAmount: lease.monthlyPayment,
        status: 'scheduled',
      });

      paymentSchedule.push(payment);
    }

    res.json({ message: 'Payment schedule generated', payments: paymentSchedule });
  } catch (error) {
    next(error);
  }
});

// Process lease payment
router.post('/lease-payments/:id/process', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payment = await storage.getLeasePayment(req.params.id, tenantId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update payment status to completed
    const updatedPayment = await storage.updateLeasePayment(req.params.id, tenantId, {
      status: 'completed',
      paidDate: new Date(),
      paidAmount: payment.scheduledAmount,
      ...req.body, // Allow passing transaction details
    });

    // Update lease totals
    const lease = await storage.getLease(payment.leaseId, tenantId);
    if (lease) {
      await storage.updateLease(payment.leaseId, tenantId, {
        paymentsCompleted: (lease.paymentsCompleted || 0) + 1,
        totalPaid: parseFloat(lease.totalPaid || '0') + parseFloat(payment.scheduledAmount),
      });
    }

    res.json(updatedPayment);
  } catch (error) {
    next(error);
  }
});

// Initiate lease renewal
router.post('/leases/:id/initiate-renewal', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    const userId = req.session.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const lease = await storage.getLease(req.params.id, tenantId);
    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    // Create renewal record
    const renewalDeadline = new Date(lease.endDate);
    renewalDeadline.setDate(renewalDeadline.getDate() - 30); // 30 days before end

    const renewal = await storage.createLeaseRenewal({
      tenantId,
      leaseId: lease.id,
      renewalOffered: true,
      renewalOfferDate: new Date(),
      renewalDeadline,
      renewalTerm: req.body.renewalTerm || lease.term,
      renewalMonthlyPayment: req.body.renewalMonthlyPayment || lease.monthlyPayment,
      createdBy: userId,
    });

    // Update lease status
    await storage.updateLease(lease.id, tenantId, {
      status: 'pending_renewal',
      updatedBy: userId,
    });

    res.json({ message: 'Renewal initiated', renewal });
  } catch (error) {
    next(error);
  }
});

// Complete lease disposition
router.post('/leases/:id/complete-disposition', async (req, res, next) => {
  try {
    const tenantId = req.session.user?.tenantId;
    const userId = req.session.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const lease = await storage.getLease(req.params.id, tenantId);
    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    // Create or update disposition
    const disposition = await storage.createLeaseDisposition({
      tenantId,
      leaseId: lease.id,
      action: req.body.action,
      actionDate: new Date(),
      finalStatus: 'completed',
      completionDate: new Date(),
      createdBy: userId,
      ...req.body,
    });

    // Update lease status based on disposition action
    let leaseStatus = 'expired';
    if (req.body.action === 'renew') {
      leaseStatus = 'renewed';
    } else if (req.body.action === 'purchase') {
      leaseStatus = 'completed';
    }

    await storage.updateLease(lease.id, tenantId, {
      status: leaseStatus,
      updatedBy: userId,
    });

    res.json({ message: 'Disposition completed', disposition });
  } catch (error) {
    next(error);
  }
});

export default router;
