import express from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './db';
import {
  calculatorSessions,
  calculatorLeads,
  emailSequenceTracking,
  industryBenchmarks,
  calculatorAnalyticsEvents,
  insertCalculatorSessionSchema,
  insertCalculatorLeadSchema,
  insertEmailSequenceTrackingSchema,
} from '@shared/schema';
import {
  calculatePrintCosts,
  calculateLeadScore,
  determineLeadTemperature,
  generateRecommendations,
  type FleetInputs,
} from './services/print-cost-calculator-service';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { sendCalculatorReportEmail } from './services/calculator-email-service';

const router = express.Router();

// ==================== PUBLIC ROUTES (No Auth Required) ====================

// Create new calculator session and calculate results
router.post('/api/public/calculator/sessions', async (req, res) => {
  try {
    // Validate input
    const inputSchema = z.object({
      deviceCount: z.number().int().min(1).max(500),
      deviceTypes: z.array(z.string()),
      fleetAge: z.string(),
      monthlyPageVolume: z.number().int().min(0).max(10000000),
      colorRatio: z.number().min(0).max(100),
      employeeCount: z.number().int().min(1).max(100000),
      industry: z.string(),
      painPoints: z.array(z.string()),
      monthlySupplieCost: z.number().optional(),
      monthlyServiceCost: z.number().optional(),
      monthlyDowntimeHours: z.number().optional(),
      monthlyEnergyCost: z.number().optional(),
      visitorId: z.string().optional(),
      sourceUrl: z.string().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      referrer: z.string().optional(),
    });

    const validatedData = inputSchema.parse(req.body);

    // Calculate results
    const fleetInputs: FleetInputs = {
      deviceCount: validatedData.deviceCount,
      deviceTypes: validatedData.deviceTypes,
      fleetAge: validatedData.fleetAge,
      monthlyPageVolume: validatedData.monthlyPageVolume,
      colorRatio: validatedData.colorRatio,
      employeeCount: validatedData.employeeCount,
      industry: validatedData.industry,
      painPoints: validatedData.painPoints,
      monthlySupplieCost: validatedData.monthlySupplieCost,
      monthlyServiceCost: validatedData.monthlyServiceCost,
      monthlyDowntimeHours: validatedData.monthlyDowntimeHours,
      monthlyEnergyCost: validatedData.monthlyEnergyCost,
    };

    const results = calculatePrintCosts(fleetInputs);
    const recommendations = generateRecommendations(fleetInputs, results);

    // Generate session key
    const sessionKey = uuidv4();

    // Save session to database
    const [session] = await db.insert(calculatorSessions).values({
      sessionKey,
      visitorId: validatedData.visitorId || uuidv4(),
      deviceCount: validatedData.deviceCount,
      deviceTypes: validatedData.deviceTypes,
      fleetAge: validatedData.fleetAge,
      monthlyPageVolume: validatedData.monthlyPageVolume,
      colorRatio: validatedData.colorRatio.toString(),
      monthlySupplieCost: validatedData.monthlySupplieCost?.toString(),
      monthlyServiceCost: validatedData.monthlyServiceCost?.toString(),
      monthlyDowntimeHours: validatedData.monthlyDowntimeHours?.toString(),
      monthlyEnergyCost: validatedData.monthlyEnergyCost?.toString(),
      employeeCount: validatedData.employeeCount,
      industry: validatedData.industry,
      painPoints: validatedData.painPoints,
      calculatedResults: results,
      isCompleted: true,
      completedAt: new Date(),
      sourceUrl: validatedData.sourceUrl,
      utmSource: validatedData.utmSource,
      utmMedium: validatedData.utmMedium,
      utmCampaign: validatedData.utmCampaign,
      referrer: validatedData.referrer,
    }).returning();

    // Track analytics event
    await db.insert(calculatorAnalyticsEvents).values({
      sessionId: session.id,
      visitorId: session.visitorId,
      eventType: 'calculation_complete',
      eventCategory: 'engagement',
      eventData: {
        deviceCount: validatedData.deviceCount,
        industry: validatedData.industry,
        annualTCO: results.annualTCO,
      },
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.json({
      sessionKey,
      sessionId: session.id,
      results,
      recommendations,
    });
  } catch (error: any) {
    console.error('Error creating calculator session:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid input data',
        errors: error.errors
      });
    }

    res.status(500).json({ message: 'Failed to calculate print costs' });
  }
});

// Get calculator session by session key (public access)
router.get('/api/public/calculator/sessions/:sessionKey', async (req, res) => {
  try {
    const { sessionKey } = req.params;

    const [session] = await db
      .select()
      .from(calculatorSessions)
      .where(eq(calculatorSessions.sessionKey, sessionKey))
      .limit(1);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Regenerate recommendations
    const fleetInputs: FleetInputs = {
      deviceCount: session.deviceCount,
      deviceTypes: session.deviceTypes as string[],
      fleetAge: session.fleetAge,
      monthlyPageVolume: session.monthlyPageVolume,
      colorRatio: parseFloat(session.colorRatio),
      employeeCount: session.employeeCount,
      industry: session.industry,
      painPoints: session.painPoints as string[],
      monthlySupplieCost: session.monthlySupplieCost ? parseFloat(session.monthlySupplieCost) : undefined,
      monthlyServiceCost: session.monthlyServiceCost ? parseFloat(session.monthlyServiceCost) : undefined,
      monthlyDowntimeHours: session.monthlyDowntimeHours ? parseFloat(session.monthlyDowntimeHours) : undefined,
      monthlyEnergyCost: session.monthlyEnergyCost ? parseFloat(session.monthlyEnergyCost) : undefined,
    };

    const recommendations = generateRecommendations(fleetInputs, session.calculatedResults as any);

    res.json({
      session,
      recommendations,
    });
  } catch (error: any) {
    console.error('Error fetching calculator session:', error);
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});

// Capture email lead
router.post('/api/public/calculator/leads', async (req, res) => {
  try {
    // Validate input
    const inputSchema = z.object({
      sessionKey: z.string(),
      email: z.string().email(),
      companyName: z.string().min(1),
      fullName: z.string().optional(),
      phone: z.string().optional(),
      role: z.string(),
      wantsQuarterlyUpdates: z.boolean().default(false),
    });

    const validatedData = inputSchema.parse(req.body);

    // Get session
    const [session] = await db
      .select()
      .from(calculatorSessions)
      .where(eq(calculatorSessions.sessionKey, validatedData.sessionKey))
      .limit(1);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if email already exists
    const [existingLead] = await db
      .select()
      .from(calculatorLeads)
      .where(eq(calculatorLeads.email, validatedData.email))
      .limit(1);

    let lead;

    if (existingLead) {
      // Update existing lead
      [lead] = await db
        .update(calculatorLeads)
        .set({
          sessionCount: sql`${calculatorLeads.sessionCount} + 1`,
          companyName: validatedData.companyName,
          fullName: validatedData.fullName,
          phone: validatedData.phone,
          role: validatedData.role,
          wantsQuarterlyUpdates: validatedData.wantsQuarterlyUpdates,
        })
        .where(eq(calculatorLeads.id, existingLead.id))
        .returning();
    } else {
      // Calculate lead score
      const fleetInputs: FleetInputs = {
        deviceCount: session.deviceCount,
        deviceTypes: session.deviceTypes as string[],
        fleetAge: session.fleetAge,
        monthlyPageVolume: session.monthlyPageVolume,
        colorRatio: parseFloat(session.colorRatio),
        employeeCount: session.employeeCount,
        industry: session.industry,
        painPoints: session.painPoints as string[],
      };

      const leadScore = calculateLeadScore(fleetInputs, session.calculatedResults as any);
      const leadTemperature = determineLeadTemperature(leadScore);

      // Determine if dealer account
      const isDealerAccount = validatedData.role === 'copier_dealer';

      // Create new lead
      [lead] = await db.insert(calculatorLeads).values({
        email: validatedData.email,
        companyName: validatedData.companyName,
        fullName: validatedData.fullName,
        phone: validatedData.phone,
        role: validatedData.role,
        wantsQuarterlyUpdates: validatedData.wantsQuarterlyUpdates,
        isDealerAccount,
        firstSessionId: session.id,
        leadScore,
        leadTemperature,
        utmSource: session.utmSource || undefined,
        utmMedium: session.utmMedium || undefined,
        utmCampaign: session.utmCampaign || undefined,
      }).returning();

      // Start email sequence
      await startEmailSequence(lead.id, validatedData.email, leadScore, isDealerAccount);
    }

    // Update session with lead info
    await db
      .update(calculatorSessions)
      .set({
        leadId: lead.id,
        hasEmailCapture: true,
        emailCapturedAt: new Date(),
      })
      .where(eq(calculatorSessions.id, session.id));

    // Track analytics event
    await db.insert(calculatorAnalyticsEvents).values({
      sessionId: session.id,
      visitorId: session.visitorId,
      eventType: 'email_captured',
      eventCategory: 'conversion',
      eventData: {
        role: validatedData.role,
        isDealerAccount: lead.isDealerAccount,
        leadScore: lead.leadScore,
      },
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.json({
      leadId: lead.id,
      message: 'Email captured successfully',
    });
  } catch (error: any) {
    console.error('Error capturing lead:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Invalid input data',
        errors: error.errors
      });
    }

    res.status(500).json({ message: 'Failed to capture lead' });
  }
});

// Track PDF download
router.post('/api/public/calculator/track/pdf-download', async (req, res) => {
  try {
    const { sessionKey } = req.body;

    const [session] = await db
      .select()
      .from(calculatorSessions)
      .where(eq(calculatorSessions.sessionKey, sessionKey))
      .limit(1);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Update session
    await db
      .update(calculatorSessions)
      .set({ pdfDownloaded: true })
      .where(eq(calculatorSessions.id, session.id));

    // Track analytics event
    await db.insert(calculatorAnalyticsEvents).values({
      sessionId: session.id,
      visitorId: session.visitorId,
      eventType: 'pdf_download',
      eventCategory: 'conversion',
      eventData: {},
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.json({ message: 'PDF download tracked' });
  } catch (error: any) {
    console.error('Error tracking PDF download:', error);
    res.status(500).json({ message: 'Failed to track PDF download' });
  }
});

// Track analytics events
router.post('/api/public/calculator/track/event', async (req, res) => {
  try {
    const schema = z.object({
      sessionKey: z.string().optional(),
      visitorId: z.string(),
      eventType: z.string(),
      eventCategory: z.string(),
      eventData: z.record(z.any()).optional(),
    });

    const validatedData = schema.parse(req.body);

    // Get session if sessionKey provided
    let sessionId: string | undefined;
    if (validatedData.sessionKey) {
      const [session] = await db
        .select()
        .from(calculatorSessions)
        .where(eq(calculatorSessions.sessionKey, validatedData.sessionKey))
        .limit(1);

      sessionId = session?.id;
    }

    // Track event
    await db.insert(calculatorAnalyticsEvents).values({
      sessionId,
      visitorId: validatedData.visitorId,
      eventType: validatedData.eventType,
      eventCategory: validatedData.eventCategory,
      eventData: validatedData.eventData || {},
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.json({ message: 'Event tracked' });
  } catch (error: any) {
    console.error('Error tracking event:', error);
    res.status(500).json({ message: 'Failed to track event' });
  }
});

// Get industry benchmarks
router.get('/api/public/calculator/benchmarks/:industry', async (req, res) => {
  try {
    const { industry } = req.params;

    const benchmarks = await db
      .select()
      .from(industryBenchmarks)
      .where(eq(industryBenchmarks.industry, industry))
      .limit(5);

    res.json(benchmarks);
  } catch (error: any) {
    console.error('Error fetching benchmarks:', error);
    res.status(500).json({ message: 'Failed to fetch benchmarks' });
  }
});

// ==================== AUTHENTICATED ROUTES (Admin/Internal Use) ====================

// Auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
};

// Get all calculator leads (admin)
router.get('/api/calculator/leads', requireAuth, async (req: any, res) => {
  try {
    const {
      role,
      isDealer,
      leadTemperature,
      limit = 50,
      offset = 0
    } = req.query;

    let query = db.select().from(calculatorLeads);

    // Apply filters
    const conditions = [];
    if (role) conditions.push(eq(calculatorLeads.role, role));
    if (isDealer !== undefined) conditions.push(eq(calculatorLeads.isDealerAccount, isDealer === 'true'));
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
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Failed to fetch leads' });
  }
});

// Get lead details with sessions
router.get('/api/calculator/leads/:leadId', requireAuth, async (req: any, res) => {
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
    console.error('Error fetching lead details:', error);
    res.status(500).json({ message: 'Failed to fetch lead details' });
  }
});

// Update lead status
router.patch('/api/calculator/leads/:leadId', requireAuth, async (req: any, res) => {
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
    console.error('Error updating lead:', error);
    res.status(500).json({ message: 'Failed to update lead' });
  }
});

// Get calculator analytics/stats
router.get('/api/calculator/analytics/stats', requireAuth, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Total sessions
    const totalSessions = await db
      .select({ count: sql<number>`count(*)` })
      .from(calculatorSessions);

    // Total leads
    const totalLeads = await db
      .select({ count: sql<number>`count(*)` })
      .from(calculatorLeads);

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
    console.error('Error fetching analytics stats:', error);
    res.status(500).json({ message: 'Failed to fetch analytics stats' });
  }
});

// ==================== Helper Functions ====================

async function startEmailSequence(
  leadId: string,
  email: string,
  leadScore: number,
  isDealerAccount: boolean
): Promise<void> {
  try {
    // Update lead to mark sequence as started
    await db
      .update(calculatorLeads)
      .set({
        emailSequenceStarted: true,
        emailSequenceDay: 0,
      })
      .where(eq(calculatorLeads.id, leadId));

    // Send Day 0 (immediate) email
    const day0EmailSent = await sendCalculatorReportEmail(
      email,
      'Company', // Will be replaced with actual company name
      isDealerAccount
    );

    await db.insert(emailSequenceTracking).values({
      leadId,
      sequenceDay: 0,
      emailSubject: 'Your Print Fleet Analysis Report + First Action Step',
      emailTemplate: isDealerAccount ? 'day_0_dealer' : 'day_0_standard',
      status: day0EmailSent ? 'sent' : 'failed',
      sentAt: day0EmailSent ? new Date() : undefined,
      scheduledFor: new Date(),
    });

    // Schedule subsequent emails (Days 1-7)
    const sequenceDays = [1, 2, 3, 5, 6, 7];

    for (const day of sequenceDays) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + day);

      await db.insert(emailSequenceTracking).values({
        leadId,
        sequenceDay: day,
        emailSubject: getEmailSubjectForDay(day, isDealerAccount),
        emailTemplate: getEmailTemplateForDay(day, isDealerAccount),
        status: 'pending',
        scheduledFor: scheduledDate,
      });
    }

    console.log(`Email sequence started for lead ${leadId}`);
  } catch (error) {
    console.error('Error starting email sequence:', error);
    // Don't throw - we don't want email sequence errors to block lead capture
  }
}

function getEmailSubjectForDay(day: number, isDealer: boolean): string {
  const subjects: Record<number, { standard: string; dealer: string }> = {
    1: {
      standard: 'The hidden cost of printer downtime (it\'s worse than you think)',
      dealer: 'Sales Tool: Show This Calculator to Your Prospects',
    },
    2: {
      standard: 'Case Study: Regional law firm saves $47K with print management',
      dealer: 'Dealer Success: Close More Deals with Print Cost Analysis',
    },
    3: {
      standard: 'Your custom print policy template (based on your fleet)',
      dealer: 'White-Label Calculator: Co-Brand for Your Business',
    },
    5: {
      standard: 'Supply management is costing you more than you think',
      dealer: 'Dealer Resources: Email Templates & Sales Scripts',
    },
    6: {
      standard: 'ROI Calculator: When does new equipment pay for itself?',
      dealer: 'Partner Program: Earn Revenue Share on Referrals',
    },
    7: {
      standard: 'Special offer: 30 days free + implementation support',
      dealer: 'Exclusive Dealer Offer: Free Printyx Account + Bonuses',
    },
  };

  return subjects[day]?.[isDealer ? 'dealer' : 'standard'] || 'Printyx Print Management Update';
}

function getEmailTemplateForDay(day: number, isDealer: boolean): string {
  return isDealer ? `day_${day}_dealer` : `day_${day}_standard`;
}

export default router;
