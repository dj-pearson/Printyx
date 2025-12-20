/**
 * REPORTS API ROUTES - Top 5 Priority Reports
 * SLA Compliance, Sales Pipeline, Revenue Recognition, Customer Health, Technician Utilization
 */

import express from "express";
import { eq, and, desc, gte, lte, sql, count } from "drizzle-orm";
import { db } from "./db";
import {
  serviceTickets,
  deals,
  dealStages,
  invoices,
  customers,
  technicians,
  contracts,
  equipment
} from "@shared/schema";

const router = express.Router();

// SERVICE SLA COMPLIANCE REPORT
router.get("/api/reports/service-sla-compliance", async (req: any, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId) return res.status(400).json({ error: "Missing x-tenant-id header" });

    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = new Date();

    const tickets = await db.query.serviceTickets.findMany({
      where: and(
        eq(serviceTickets.tenantId, tenantId),
        gte(serviceTickets.createdAt, fromDate),
        lte(serviceTickets.createdAt, toDate)
      ),
      with: { technician: true }
    });

    const totalTickets = tickets.length;
    const onTimeTickets = tickets.filter(t => {
      if (!t.completedAt) return false;
      const slaMin = t.slaResponseMinutes || 480;
      return (t.completedAt.getTime() - t.createdAt.getTime()) / (1000 * 60) <= slaMin;
    }).length;

    const byTechnician = Array.from(tickets.reduce((map, t) => {
      const key = t.technicianId || 'unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
      return map;
    }, new Map()).values()).map((group: any) => {
      const onTime = group.filter((t: any) => {
        if (!t.completedAt) return false;
        const slaMin = t.slaResponseMinutes || 480;
        return (t.completedAt.getTime() - t.createdAt.getTime()) / (1000 * 60) <= slaMin;
      }).length;
      return {
        technicianName: group[0]?.technician?.name || 'Unassigned',
        compliance: group.length > 0 ? Math.round((onTime / group.length) * 100) : 0,
        ticketCount: group.length
      };
    });

    res.json({
      totalTickets,
      onTimeTickets,
      lateTickets: totalTickets - onTimeTickets,
      slaCompliancePercent: totalTickets > 0 ? Math.round((onTimeTickets / totalTickets) * 100) : 0,
      byTechnician
    });
  } catch (error) {
    console.error("Error generating SLA report:", error);
    res.status(500).json({ error: "Failed to generate SLA report" });
  }
});

// SALES PIPELINE ANALYSIS REPORT
router.get("/api/reports/sales-pipeline", async (req: any, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId) return res.status(400).json({ error: "Missing x-tenant-id header" });

    const allDeals = await db.query.deals.findMany({
      where: eq(deals.tenantId, tenantId),
      with: { stage: true, owner: true }
    });

    const openDeals = allDeals.filter(d => d.status !== 'won' && d.status !== 'lost');
    const totalPipelineValue = openDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const dealCount = openDeals.length;
    const avgDealValue = dealCount > 0 ? Math.round(totalPipelineValue / dealCount) : 0;
    const wonDeals = allDeals.filter(d => d.status === 'won').length;
    const conversionRate = allDeals.length > 0 ? Math.round((wonDeals / allDeals.length) * 100) : 0;

    res.json({
      totalPipelineValue,
      dealCount,
      averageDealValue: avgDealValue,
      conversionRate,
      wonDeals,
      topReps: Array.from(allDeals.reduce((map, d) => {
        const name = d.owner?.name || 'Unknown';
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(d);
        return map;
      }, new Map()).entries())
        .map(([name, deals]: any) => ({
          repName: name,
          pipelineValue: deals.filter((d: any) => d.status !== 'won' && d.status !== 'lost').reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0),
          dealCount: deals.filter((d: any) => d.status !== 'won' && d.status !== 'lost').length
        }))
        .sort((a, b) => b.pipelineValue - a.pipelineValue)
        .slice(0, 5)
    });
  } catch (error) {
    console.error("Error generating pipeline report:", error);
    res.status(500).json({ error: "Failed to generate pipeline report" });
  }
});

// REVENUE RECOGNITION REPORT
router.get("/api/reports/revenue-recognition", async (req: any, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId) return res.status(400).json({ error: "Missing x-tenant-id header" });

    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = new Date();

    const invoiceList = await db.query.invoices.findMany({
      where: and(
        eq(invoices.tenantId, tenantId),
        gte(invoices.invoiceDate, fromDate),
        lte(invoices.invoiceDate, toDate)
      )
    });

    const totalRevenue = invoiceList.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const paidInvoices = invoiceList.filter(i => i.isPaid);
    const recognizedRevenue = paidInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    res.json({
      totalRevenue: Math.round(totalRevenue),
      recognizedRevenue: Math.round(recognizedRevenue),
      deferredRevenue: Math.round(totalRevenue - recognizedRevenue),
      collectionRate: totalRevenue > 0 ? Math.round((recognizedRevenue / totalRevenue) * 100) : 0,
      invoiceCount: invoiceList.length,
      paidInvoices: paidInvoices.length,
      outstandingInvoices: invoiceList.length - paidInvoices.length
    });
  } catch (error) {
    console.error("Error generating revenue report:", error);
    res.status(500).json({ error: "Failed to generate revenue report" });
  }
});

// CUSTOMER HEALTH SCORE REPORT
// Calculates health scores based on real data:
// - Service history (ticket resolution, recent issues)
// - Payment history (invoice payment rate)
// - Contract status (active contracts)
// - Engagement (recency of activity, tenure)
router.get("/api/reports/customer-health", async (req: any, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId) return res.status(400).json({ error: "Missing x-tenant-id header" });

    // Get customers with their record type = 'customer' (not leads)
    const allCustomers = await db.query.customers.findMany({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.recordType, 'customer')
      )
    });

    // Get related data for health calculation
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Fetch service tickets for all customers
    const customerTickets = await db.query.serviceTickets.findMany({
      where: and(
        eq(serviceTickets.tenantId, tenantId),
        gte(serviceTickets.createdAt, ninetyDaysAgo)
      )
    });

    // Fetch invoices for all customers
    const customerInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.tenantId, tenantId),
        gte(invoices.invoiceDate, ninetyDaysAgo)
      )
    });

    // Fetch active contracts
    const activeContracts = await db.query.contracts.findMany({
      where: and(
        eq(contracts.tenantId, tenantId),
        eq(contracts.status, 'active')
      )
    });

    // Build lookup maps for efficient access
    const ticketsByCustomer = new Map<string, typeof customerTickets>();
    customerTickets.forEach(t => {
      const custId = t.customerId;
      if (custId) {
        if (!ticketsByCustomer.has(custId)) ticketsByCustomer.set(custId, []);
        ticketsByCustomer.get(custId)!.push(t);
      }
    });

    const invoicesByCustomer = new Map<string, typeof customerInvoices>();
    customerInvoices.forEach(inv => {
      const custId = inv.customerId;
      if (custId) {
        if (!invoicesByCustomer.has(custId)) invoicesByCustomer.set(custId, []);
        invoicesByCustomer.get(custId)!.push(inv);
      }
    });

    const contractsByCustomer = new Map<string, typeof activeContracts>();
    activeContracts.forEach(c => {
      const custId = c.customerId;
      if (custId) {
        if (!contractsByCustomer.has(custId)) contractsByCustomer.set(custId, []);
        contractsByCustomer.get(custId)!.push(c);
      }
    });

    // Calculate health score for each customer
    const customerHealthScores = allCustomers.map(c => {
      const custTickets = ticketsByCustomer.get(c.id) || [];
      const custInvoices = invoicesByCustomer.get(c.id) || [];
      const custContracts = contractsByCustomer.get(c.id) || [];

      // Service Score (25 points max)
      // Based on ticket resolution and severity
      let serviceScore = 25;
      const openTickets = custTickets.filter(t => t.status !== 'completed' && t.status !== 'closed');
      const criticalTickets = openTickets.filter(t => t.priority === 'critical' || t.priority === 'high');
      serviceScore -= Math.min(15, openTickets.length * 3); // -3 per open ticket
      serviceScore -= Math.min(10, criticalTickets.length * 5); // -5 per critical/high priority
      serviceScore = Math.max(0, serviceScore);

      // Payment Score (25 points max)
      // Based on invoice payment rate
      let paymentScore = 25;
      if (custInvoices.length > 0) {
        const paidInvoices = custInvoices.filter(inv => inv.isPaid);
        const overdueInvoices = custInvoices.filter(inv =>
          !inv.isPaid && inv.dueDate && new Date(inv.dueDate) < new Date()
        );
        const paymentRate = paidInvoices.length / custInvoices.length;
        paymentScore = Math.round(paymentRate * 20);
        paymentScore -= Math.min(15, overdueInvoices.length * 5); // -5 per overdue invoice
        paymentScore = Math.max(0, Math.min(25, paymentScore));
      }

      // Engagement Score (25 points max)
      // Based on recency of activity and tenure
      let engagementScore = 25;
      const lastActivity = c.lastActivityDate || c.updatedAt || c.createdAt;
      if (lastActivity) {
        const daysSinceActivity = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceActivity > 90) engagementScore -= 15;
        else if (daysSinceActivity > 60) engagementScore -= 10;
        else if (daysSinceActivity > 30) engagementScore -= 5;
      }
      // Tenure bonus
      const customerSince = c.customerSince || c.createdAt;
      if (customerSince) {
        const monthsAsTenant = Math.floor((Date.now() - new Date(customerSince).getTime()) / (1000 * 60 * 60 * 24 * 30));
        if (monthsAsTenant >= 24) engagementScore = Math.min(25, engagementScore + 5);
        else if (monthsAsTenant >= 12) engagementScore = Math.min(25, engagementScore + 3);
      }
      engagementScore = Math.max(0, engagementScore);

      // Contract Score (25 points max)
      // Based on active contracts
      let contractScore = 0;
      if (custContracts.length > 0) {
        contractScore = 15; // Base score for having a contract
        // Check for renewals coming up
        const upcomingRenewals = custContracts.filter(con => {
          if (!con.endDate) return false;
          const daysUntilEnd = Math.floor((new Date(con.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return daysUntilEnd <= 60 && daysUntilEnd > 0;
        });
        if (upcomingRenewals.length === 0) contractScore += 10; // No imminent renewals
      }
      contractScore = Math.min(25, contractScore);

      // Calculate total health score (0-100)
      const healthScore = serviceScore + paymentScore + engagementScore + contractScore;

      // Determine risk level and reason
      let riskLevel: 'critical' | 'high' | 'medium' | 'low';
      let reasons: string[] = [];

      if (healthScore < 25) {
        riskLevel = 'critical';
      } else if (healthScore < 50) {
        riskLevel = 'high';
      } else if (healthScore < 75) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'low';
      }

      // Identify specific risk reasons
      if (serviceScore < 10) reasons.push('Multiple open service issues');
      if (paymentScore < 10) reasons.push('Payment concerns');
      if (engagementScore < 10) reasons.push('Low engagement');
      if (contractScore === 0) reasons.push('No active contract');

      return {
        customerId: c.id,
        customerName: c.companyName || 'Unknown',
        healthScore,
        riskLevel,
        reason: reasons.length > 0 ? reasons.join(', ') : 'Healthy customer',
        breakdown: {
          serviceScore,
          paymentScore,
          engagementScore,
          contractScore
        },
        openTickets: openTickets.length,
        activeContracts: custContracts.length
      };
    });

    // Sort by health score (lowest first) and filter for at-risk
    const atRiskCustomers = customerHealthScores
      .filter(c => c.riskLevel !== 'low')
      .sort((a, b) => a.healthScore - b.healthScore);

    // Calculate average health score
    const avgHealthScore = customerHealthScores.length > 0
      ? Math.round(customerHealthScores.reduce((sum, c) => sum + c.healthScore, 0) / customerHealthScores.length)
      : 0;

    res.json({
      totalCustomers: allCustomers.length,
      averageHealthScore: avgHealthScore,
      atRiskCount: atRiskCustomers.length,
      criticalCount: atRiskCustomers.filter(c => c.riskLevel === 'critical').length,
      highRiskCount: atRiskCustomers.filter(c => c.riskLevel === 'high').length,
      mediumRiskCount: atRiskCustomers.filter(c => c.riskLevel === 'medium').length,
      healthyCount: customerHealthScores.filter(c => c.riskLevel === 'low').length,
      atRiskCustomers: atRiskCustomers.slice(0, 10),
      scoreDistribution: {
        critical: customerHealthScores.filter(c => c.healthScore < 25).length,
        high: customerHealthScores.filter(c => c.healthScore >= 25 && c.healthScore < 50).length,
        medium: customerHealthScores.filter(c => c.healthScore >= 50 && c.healthScore < 75).length,
        low: customerHealthScores.filter(c => c.healthScore >= 75).length
      }
    });
  } catch (error) {
    console.error("Error generating health report:", error);
    res.status(500).json({ error: "Failed to generate health report" });
  }
});

// TECHNICIAN UTILIZATION REPORT
// Calculates utilization based on real data:
// - Tickets completed per period
// - Time spent on tickets vs available working hours
// - SLA compliance rate
router.get("/api/reports/technician-utilization", async (req: any, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId) return res.status(400).json({ error: "Missing x-tenant-id header" });

    // Define the reporting period (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Get all technicians
    const techList = await db.query.technicians.findMany({
      where: eq(technicians.tenantId, tenantId)
    });

    // Get all service tickets from the last 30 days
    const periodTickets = await db.query.serviceTickets.findMany({
      where: and(
        eq(serviceTickets.tenantId, tenantId),
        gte(serviceTickets.createdAt, thirtyDaysAgo)
      )
    });

    // Group tickets by technician
    const ticketsByTech = new Map<string, typeof periodTickets>();
    periodTickets.forEach(t => {
      const techId = t.technicianId;
      if (techId) {
        if (!ticketsByTech.has(techId)) ticketsByTech.set(techId, []);
        ticketsByTech.get(techId)!.push(t);
      }
    });

    // Calculate utilization for each technician
    // Assumptions:
    // - Working hours per day: 8 hours
    // - Working days in 30 days: ~22 days
    // - Available work hours: 176 hours per month
    const WORKING_HOURS_PER_MONTH = 176;
    const AVERAGE_TICKET_TIME_MINUTES = 60; // Default estimate if no data

    const byTechnician = techList.map(t => {
      const techTickets = ticketsByTech.get(t.id) || [];
      const completedTickets = techTickets.filter(tk => tk.status === 'completed' || tk.status === 'closed');
      const openTickets = techTickets.filter(tk => tk.status !== 'completed' && tk.status !== 'closed');

      // Calculate actual time spent (if time tracking is available)
      let totalMinutesWorked = 0;
      let ticketsWithTime = 0;

      completedTickets.forEach(ticket => {
        if (ticket.startedAt && ticket.completedAt) {
          const duration = (new Date(ticket.completedAt).getTime() - new Date(ticket.startedAt).getTime()) / (1000 * 60);
          // Only count reasonable durations (exclude overnight or multi-day tickets)
          if (duration > 0 && duration < 480) { // Max 8 hours per ticket
            totalMinutesWorked += duration;
            ticketsWithTime++;
          }
        }
      });

      // Calculate average ticket time from real data or use estimate
      let avgTicketTimeMinutes: number;
      if (ticketsWithTime > 0) {
        avgTicketTimeMinutes = Math.round(totalMinutesWorked / ticketsWithTime);
      } else {
        // Estimate based on ticket count and assumed time
        avgTicketTimeMinutes = AVERAGE_TICKET_TIME_MINUTES;
        totalMinutesWorked = completedTickets.length * AVERAGE_TICKET_TIME_MINUTES;
      }

      // Calculate utilization percentage
      // (Hours worked / Available hours) * 100
      const hoursWorked = totalMinutesWorked / 60;
      const utilizationPercent = Math.min(100, Math.round((hoursWorked / WORKING_HOURS_PER_MONTH) * 100));

      // Calculate SLA compliance
      const ticketsWithSLA = completedTickets.filter(tk => tk.slaResponseMinutes);
      let slaCompliance = 100;
      if (ticketsWithSLA.length > 0) {
        const onTimeTickets = ticketsWithSLA.filter(tk => {
          if (!tk.completedAt) return false;
          const responseTime = (new Date(tk.completedAt).getTime() - new Date(tk.createdAt).getTime()) / (1000 * 60);
          return responseTime <= (tk.slaResponseMinutes || 480);
        });
        slaCompliance = Math.round((onTimeTickets.length / ticketsWithSLA.length) * 100);
      }

      // Calculate first-time fix rate
      const firstTimeFix = completedTickets.filter(tk =>
        !techTickets.some(other =>
          other.id !== tk.id &&
          other.customerId === tk.customerId &&
          other.equipmentId === tk.equipmentId &&
          other.createdAt > tk.createdAt &&
          new Date(other.createdAt).getTime() - new Date(tk.completedAt || tk.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
        )
      );
      const firstTimeFixRate = completedTickets.length > 0
        ? Math.round((firstTimeFix.length / completedTickets.length) * 100)
        : 100;

      return {
        technicianId: t.id,
        name: t.name || 'Unknown',
        utilizationPercent,
        ticketsCompleted: completedTickets.length,
        ticketsOpen: openTickets.length,
        totalTickets: techTickets.length,
        averageTicketTime: avgTicketTimeMinutes,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        slaCompliance,
        firstTimeFixRate
      };
    });

    // Sort by utilization (highest first)
    byTechnician.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

    // Calculate averages
    const avgUtilization = byTechnician.length > 0
      ? Math.round(byTechnician.reduce((sum, t) => sum + t.utilizationPercent, 0) / byTechnician.length)
      : 0;

    const avgSLA = byTechnician.length > 0
      ? Math.round(byTechnician.reduce((sum, t) => sum + t.slaCompliance, 0) / byTechnician.length)
      : 0;

    const avgFirstTimeFix = byTechnician.length > 0
      ? Math.round(byTechnician.reduce((sum, t) => sum + t.firstTimeFixRate, 0) / byTechnician.length)
      : 0;

    res.json({
      totalTechnicians: techList.length,
      reportingPeriod: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
        days: 30
      },
      averageUtilizationPercent: avgUtilization,
      averageSLACompliance: avgSLA,
      averageFirstTimeFixRate: avgFirstTimeFix,
      totalTicketsCompleted: byTechnician.reduce((sum, t) => sum + t.ticketsCompleted, 0),
      totalHoursWorked: Math.round(byTechnician.reduce((sum, t) => sum + t.hoursWorked, 0)),
      excellentCount: byTechnician.filter(t => t.utilizationPercent >= 90).length,
      goodCount: byTechnician.filter(t => t.utilizationPercent >= 75 && t.utilizationPercent < 90).length,
      needsImprovementCount: byTechnician.filter(t => t.utilizationPercent < 75).length,
      byTechnician: byTechnician.slice(0, 10)
    });
  } catch (error) {
    console.error("Error generating utilization report:", error);
    res.status(500).json({ error: "Failed to generate utilization report" });
  }
});

export default router;
