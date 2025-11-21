import express from "express";
import { eq, and, desc, sql, gte, lte, count, avg } from "drizzle-orm";
import { db } from "./db";
import { 
  serviceTickets, 
  purchaseOrders, 
  meterReadings,
  businessRecords,
  quotes,
  proposals
} from "@shared/schema";
import {
  phoneInTickets,
  technicianTicketSessions
} from "@shared/schema";

const router = express.Router();

// GET /api/reports - Lightweight metrics layer v0
router.get("/reports", async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId) {
      return res.status(400).json({ error: "Missing x-tenant-id header" });
    }

    const { type, from, to, groupBy, interval } = req.query;

    // Default date range - last 30 days if not specified
    const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();

    switch (type) {
      case 'service_sla':
        return await getServiceSLAReport(req, res, tenantId, fromDate, toDate, groupBy as string, interval as string);
      
      case 'po_variance':
        return await getPOVarianceReport(req, res, tenantId, fromDate, toDate, groupBy as string, interval as string);
      
      case 'meter_missed':
        return await getMeterMissedReport(req, res, tenantId, fromDate, toDate, groupBy as string, interval as string);
      
      case 'lead_conversion':
        return await getLeadConversionReport(req, res, tenantId, fromDate, toDate, groupBy as string, interval as string);
      
      case 'proposal_aging':
        return await getProposalAgingReport(req, res, tenantId, fromDate, toDate, groupBy as string, interval as string);
      
      case 'phone_in_tickets':
        return await getPhoneInTicketReport(req, res, tenantId, fromDate, toDate, groupBy as string, interval as string);
      
      default:
        return res.status(400).json({ error: "Invalid report type" });
    }
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// Service SLA Report
async function getServiceSLAReport(req: any, res: any, tenantId: string, fromDate: Date, toDate: Date, groupBy?: string, interval?: string) {
  const tickets = await db
    .select({
      id: serviceTickets.id,
      priority: serviceTickets.priority,
      status: serviceTickets.status,
      createdAt: serviceTickets.createdAt,
      completedDate: serviceTickets.completedDate,
      technicianId: serviceTickets.technicianId,
    })
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.tenantId, tenantId),
        gte(serviceTickets.createdAt, fromDate),
        lte(serviceTickets.createdAt, toDate)
      )
    );

  // Calculate SLA metrics
  const slaTargets = { urgent: 4, high: 8, medium: 24, low: 48 }; // hours
  const metrics = tickets.map(ticket => {
    const slaTarget = slaTargets[ticket.priority as keyof typeof slaTargets] || 24;
    const resolvedAt = ticket.completedDate || new Date();
    const hours = (resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
    const slaBreached = hours > slaTarget;
    
    return {
      ticketId: ticket.id,
      priority: ticket.priority,
      status: ticket.status,
      slaTarget,
      actualHours: Math.round(hours * 100) / 100,
      slaBreached,
      onTime: !slaBreached && ticket.status === 'completed'
    };
  });

  const summary = {
    totalTickets: metrics.length,
    onTimePercentage: Math.round((metrics.filter(m => m.onTime).length / metrics.length) * 100) || 0,
    breachedTickets: metrics.filter(m => m.slaBreached).length,
    averageResolutionTime: Math.round((metrics.reduce((sum, m) => sum + m.actualHours, 0) / metrics.length) * 100) / 100 || 0,
  };

  res.json({
    type: 'service_sla',
    period: { from: fromDate, to: toDate },
    summary,
    details: metrics,
    breakdown: {
      byPriority: Object.entries(
        metrics.reduce((acc, m) => {
          const priority = m.priority || 'medium';
          if (!acc[priority]) acc[priority] = { total: 0, onTime: 0 };
          acc[priority].total++;
          if (m.onTime) acc[priority].onTime++;
          return acc;
        }, {} as Record<string, { total: number; onTime: number }>)
      ).map(([priority, stats]) => ({
        priority,
        total: stats.total,
        onTimePercentage: Math.round((stats.onTime / stats.total) * 100)
      }))
    }
  });
}

// Purchase Order Variance Report
async function getPOVarianceReport(req: any, res: any, tenantId: string, fromDate: Date, toDate: Date, groupBy?: string, interval?: string) {
  const pos = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      vendorId: purchaseOrders.vendorId,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      receivedDate: purchaseOrders.receivedDate,
      status: purchaseOrders.status,
    })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.tenantId, tenantId),
        gte(purchaseOrders.orderDate, fromDate),
        lte(purchaseOrders.orderDate, toDate)
      )
    );

  const metrics = pos.map(po => {
    const expectedDays = po.expectedDate ? 
      Math.ceil((po.expectedDate.getTime() - po.orderDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const actualDays = po.receivedDate ? 
      Math.ceil((po.receivedDate.getTime() - po.orderDate.getTime()) / (1000 * 60 * 60 * 24)) : 
      Math.ceil((new Date().getTime() - po.orderDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const varianceDays = actualDays - expectedDays;
    const varianceMultiplier = expectedDays > 0 ? actualDays / expectedDays : 1;
    
    return {
      poId: po.id,
      poNumber: po.poNumber,
      vendorId: po.vendorId,
      status: po.status,
      expectedDays,
      actualDays,
      varianceDays,
      varianceMultiplier: Math.round(varianceMultiplier * 100) / 100,
      varianceGt2x: varianceMultiplier > 2
    };
  });

  const summary = {
    totalPOs: metrics.length,
    avgVarianceDays: Math.round((metrics.reduce((sum, m) => sum + m.varianceDays, 0) / metrics.length) * 100) / 100 || 0,
    posWithVarianceGt2x: metrics.filter(m => m.varianceGt2x).length,
    onTimeDeliveryRate: Math.round((metrics.filter(m => m.varianceDays <= 0).length / metrics.length) * 100) || 0,
  };

  res.json({
    type: 'po_variance',
    period: { from: fromDate, to: toDate },
    summary,
    details: metrics,
    highVariancePOs: metrics.filter(m => m.varianceGt2x)
  });
}

// Meter Missed Report
async function getMeterMissedReport(req: any, res: any, tenantId: string, fromDate: Date, toDate: Date, groupBy?: string, interval?: string) {
  // This would need the meter readings table to be properly implemented
  // For now, return a placeholder structure
  res.json({
    type: 'meter_missed',
    period: { from: fromDate, to: toDate },
    summary: {
      totalEquipment: 0,
      missedReadings: 0,
      missedPercentage: 0,
      equipmentWithMissedReads: 0
    },
    details: [],
    note: "Meter readings tracking requires equipment and meter reading tables to be properly configured"
  });
}

// Lead Conversion Report
async function getLeadConversionReport(req: any, res: any, tenantId: string, fromDate: Date, toDate: Date, groupBy?: string, interval?: string) {
  const leads = await db
    .select({
      id: businessRecords.id,
      recordType: businessRecords.recordType,
      createdAt: businessRecords.createdAt,
      updatedAt: businessRecords.updatedAt,
    })
    .from(businessRecords)
    .where(
      and(
        eq(businessRecords.tenantId, tenantId),
        gte(businessRecords.createdAt, fromDate),
        lte(businessRecords.createdAt, toDate)
      )
    );

  const leadCounts = leads.reduce((acc, lead) => {
    const type = lead.recordType || 'new';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalLeads = leadCounts.new || 0;
  const convertedLeads = (leadCounts.contacted || 0) + (leadCounts.qualified || 0) + (leadCounts.active || 0);
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  res.json({
    type: 'lead_conversion',
    period: { from: fromDate, to: toDate },
    summary: {
      totalLeads,
      convertedLeads,
      conversionRate,
      activeCustomers: leadCounts.active || 0
    },
    breakdown: leadCounts,
    details: leads
  });
}

// Proposal Aging Report
async function getProposalAgingReport(req: any, res: any, tenantId: string, fromDate: Date, toDate: Date, groupBy?: string, interval?: string) {
  try {
    const proposalList = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        status: proposals.status,
        createdAt: proposals.createdAt,
        updatedAt: proposals.updatedAt,
      })
      .from(proposals)
      .where(
        and(
          eq(proposals.tenantId, tenantId),
          gte(proposals.createdAt, fromDate),
          lte(proposals.createdAt, toDate)
        )
      );

    const agingMetrics = proposalList.map(proposal => {
      const daysSinceCreated = Math.ceil((new Date().getTime() - proposal.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceUpdated = Math.ceil((new Date().getTime() - proposal.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        proposalId: proposal.id,
        title: proposal.title,
        status: proposal.status,
        daysSinceCreated,
        daysSinceUpdated,
        isAging: daysSinceUpdated > 7, // Consider aging after 7 days of no activity
        isStale: daysSinceUpdated > 30 // Consider stale after 30 days
      };
    });

    const summary = {
      totalProposals: agingMetrics.length,
      agingProposals: agingMetrics.filter(p => p.isAging).length,
      staleProposals: agingMetrics.filter(p => p.isStale).length,
      avgDaysOld: Math.round((agingMetrics.reduce((sum, p) => sum + p.daysSinceCreated, 0) / agingMetrics.length) * 100) / 100 || 0
    };

    res.json({
      type: 'proposal_aging',
      period: { from: fromDate, to: toDate },
      summary,
      details: agingMetrics,
      agingProposals: agingMetrics.filter(p => p.isAging && !p.isStale),
      staleProposals: agingMetrics.filter(p => p.isStale)
    });
  } catch (error) {
    console.error("Error in proposal aging report:", error);
    res.json({
      type: 'proposal_aging',
      period: { from: fromDate, to: toDate },
      summary: { totalProposals: 0, agingProposals: 0, staleProposals: 0, avgDaysOld: 0 },
      details: [],
      note: "Proposals table may not be available"
    });
  }
}

// Phone-in Ticket Report
async function getPhoneInTicketReport(req: any, res: any, tenantId: string, fromDate: Date, toDate: Date, groupBy?: string, interval?: string) {
  try {
    const phoneTickets = await db
      .select({
        id: phoneInTickets.id,
        issueCategory: phoneInTickets.issueCategory,
        urgencyLevel: phoneInTickets.urgencyLevel,
        convertedToTicketId: phoneInTickets.convertedToTicketId,
        convertedAt: phoneInTickets.convertedAt,
        createdAt: phoneInTickets.createdAt,
        callDuration: phoneInTickets.callDuration,
      })
      .from(phoneInTickets)
      .where(
        and(
          eq(phoneInTickets.tenantId, tenantId),
          gte(phoneInTickets.createdAt, fromDate),
          lte(phoneInTickets.createdAt, toDate)
        )
      );

    const convertedCount = phoneTickets.filter(t => t.convertedToTicketId).length;
    const conversionRate = phoneTickets.length > 0 ? Math.round((convertedCount / phoneTickets.length) * 100) : 0;
    const avgCallDuration = Math.round((phoneTickets.reduce((sum, t) => sum + (t.callDuration || 0), 0) / phoneTickets.length) * 100) / 100 || 0;

    const categoryBreakdown = phoneTickets.reduce((acc, ticket) => {
      const category = ticket.issueCategory || 'other';
      if (!acc[category]) acc[category] = { total: 0, converted: 0 };
      acc[category].total++;
      if (ticket.convertedToTicketId) acc[category].converted++;
      return acc;
    }, {} as Record<string, { total: number; converted: number }>);

    res.json({
      type: 'phone_in_tickets',
      period: { from: fromDate, to: toDate },
      summary: {
        totalPhoneInTickets: phoneTickets.length,
        convertedToServiceTickets: convertedCount,
        conversionRate,
        avgCallDurationMinutes: avgCallDuration
      },
      breakdown: {
        byCategory: Object.entries(categoryBreakdown).map(([category, stats]) => ({
          category,
          total: stats.total,
          converted: stats.converted,
          conversionRate: Math.round((stats.converted / stats.total) * 100)
        }))
      },
      details: phoneTickets
    });
  } catch (error) {
    console.error("Error in phone-in ticket report:", error);
    res.json({
      type: 'phone_in_tickets',
      period: { from: fromDate, to: toDate },
      summary: { totalPhoneInTickets: 0, convertedToServiceTickets: 0, conversionRate: 0, avgCallDurationMinutes: 0 },
      details: [],
      note: "Phone-in tickets table may not be available"
    });
  }
}

export default router;