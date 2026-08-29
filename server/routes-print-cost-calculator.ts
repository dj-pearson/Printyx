import express from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-print-cost-calculator');

import { calculatorSessions, calculatorLeads, emailSequenceTracking } from '@shared/schema';
import { z } from 'zod';

const router = express.Router();

// ==================== PUBLIC ROUTES — RETIRED (PROD-008b) ====================
//
// The six /api/public/calculator/* handlers that lived here are gone. The
// prefix is proxied to supabase/functions/public-calculator/, which EDGE-005f
// built as a full port, so none of them could run on either host.
//
// One behaviour did NOT survive that port, and it was already lost before this
// deletion: the Day-0 report email. Express called sendCalculatorReportEmail on
// lead capture; the edge function records the sequence row with status
// 'pending' instead. Days 1-7 were never delivered by anything —
// processEmailSequences in services/calculator-email-service.ts is exported and
// has NO caller anywhere in the tree. So every calculator lead since the proxy
// went in front of this prefix has had a full 8-row nurture sequence recorded
// and zero emails sent. Restoring delivery is EDGE-005f follow-up work: it needs
// the templates ported to Deno (the _sendgrid.ts cross-function import idiom
// exists) plus a worker for the scheduled days.
//
// The authenticated /api/calculator/* handlers below are NOT proxied and are
// live. They stay.

// ==================== AUTHENTICATED ROUTES (Admin/Internal Use) ====================

// Get all calculator leads (admin)
router.get('/api/calculator/leads', async (req: any, res) => {
  try {
    const { role, isDealer, leadTemperature, limit = 50, offset = 0 } = req.query;

    let query = db.select().from(calculatorLeads);

    // Apply filters
    const conditions = [];
    if (role) conditions.push(eq(calculatorLeads.role, role));
    if (isDealer !== undefined)
      conditions.push(eq(calculatorLeads.isDealerAccount, isDealer === 'true'));
    if (leadTemperature) conditions.push(eq(calculatorLeads.leadTemperature, leadTemperature));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const leads = await query
      .orderBy(desc(calculatorLeads.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json(leads);
  } catch (error: any) {
    log.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Failed to fetch leads' });
  }
});

// Get lead details with sessions
router.get('/api/calculator/leads/:leadId', async (req: any, res) => {
  try {
    const { leadId } = req.params;

    const [lead] = await db
      .select()
      .from(calculatorLeads)
      .where(eq(calculatorLeads.id, leadId))
      .limit(1);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Get associated sessions
    const sessions = await db
      .select()
      .from(calculatorSessions)
      .where(eq(calculatorSessions.leadId, leadId))
      .orderBy(desc(calculatorSessions.createdAt));

    // Get email sequence progress
    const emailSequence = await db
      .select()
      .from(emailSequenceTracking)
      .where(eq(emailSequenceTracking.leadId, leadId))
      .orderBy(emailSequenceTracking.sequenceDay);

    res.json({
      lead,
      sessions,
      emailSequence,
    });
  } catch (error: any) {
    log.error('Error fetching lead details:', error);
    res.status(500).json({ message: 'Failed to fetch lead details' });
  }
});

// Update lead status
router.patch('/api/calculator/leads/:leadId', async (req: any, res) => {
  try {
    const { leadId } = req.params;

    const schema = z.object({
      isQualified: z.boolean().optional(),
      hasBookedDemo: z.boolean().optional(),
      hasStartedTrial: z.boolean().optional(),
      hasConvertedToPaid: z.boolean().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    });

    const validatedData = schema.parse(req.body);

    const updateData: any = { ...validatedData };

    if (validatedData.hasBookedDemo && !req.body.demoBookedAt) {
      updateData.demoBookedAt = new Date();
    }
    if (validatedData.hasStartedTrial && !req.body.trialStartedAt) {
      updateData.trialStartedAt = new Date();
    }
    if (validatedData.hasConvertedToPaid && !req.body.convertedAt) {
      updateData.convertedAt = new Date();
    }

    const [lead] = await db
      .update(calculatorLeads)
      .set(updateData)
      .where(eq(calculatorLeads.id, leadId))
      .returning();

    res.json(lead);
  } catch (error: any) {
    log.error('Error updating lead:', error);
    res.status(500).json({ message: 'Failed to update lead' });
  }
});

// Get calculator analytics/stats
router.get('/api/calculator/analytics/stats', async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Total sessions
    const totalSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(calculatorSessions);

    // Total leads
    const totalLeads = await db.select({ count: sql<number>`count(*)` }).from(calculatorLeads);

    // Completion rate
    const completedSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(calculatorSessions)
      .where(eq(calculatorSessions.isCompleted, true));

    // Email capture rate
    const emailCaptures = await db
      .select({ count: sql<number>`count(*)` })
      .from(calculatorSessions)
      .where(eq(calculatorSessions.hasEmailCapture, true));

    // PDF downloads
    const pdfDownloads = await db
      .select({ count: sql<number>`count(*)` })
      .from(calculatorSessions)
      .where(eq(calculatorSessions.pdfDownloaded, true));

    // Industry breakdown
    const industryBreakdown = await db
      .select({
        industry: calculatorSessions.industry,
        count: sql<number>`count(*)`,
      })
      .from(calculatorSessions)
      .groupBy(calculatorSessions.industry);

    // Role breakdown
    const roleBreakdown = await db
      .select({
        role: calculatorLeads.role,
        count: sql<number>`count(*)`,
      })
      .from(calculatorLeads)
      .groupBy(calculatorLeads.role);

    res.json({
      totalSessions: totalSessions[0]?.count || 0,
      totalLeads: totalLeads[0]?.count || 0,
      completionRate: ((completedSessions[0]?.count || 0) / (totalSessions[0]?.count || 1)) * 100,
      emailCaptureRate: ((emailCaptures[0]?.count || 0) / (completedSessions[0]?.count || 1)) * 100,
      pdfDownloadRate: ((pdfDownloads[0]?.count || 0) / (emailCaptures[0]?.count || 1)) * 100,
      industryBreakdown,
      roleBreakdown,
    });
  } catch (error: any) {
    log.error('Error fetching analytics stats:', error);
    res.status(500).json({ message: 'Failed to fetch analytics stats' });
  }
});

// ==================== Helper Functions ====================

export default router;
