import express from 'express';
import { desc, eq, and, sql, asc, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth-setup';
import { businessRecords, users, contracts } from '../shared/schema';

const router = express.Router();

// Commission Management API Routes

// Get commission plans
router.get('/api/commission/plans', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample commission plans until schema is updated
    const commissionPlans = [
      {
        id: 'plan-1',
        planName: 'Sales Rep Standard',
        planType: 'sales_rep',
        description: 'Standard commission plan for sales representatives',
        isActive: true,
        effectiveDate: new Date('2024-01-01'),
        
        // Tier structure
        tiers: [
          {
            tierLevel: 1,
            tierName: 'Starter',
            minimumSales: 0,
            maximumSales: 50000,
            commissionRate: 5.0,
            bonusThreshold: null,
            bonusAmount: null
          },
          {
            tierLevel: 2,
            tierName: 'Achiever',
            minimumSales: 50001,
            maximumSales: 100000,
            commissionRate: 6.5,
            bonusThreshold: 75000,
            bonusAmount: 2500
          },
          {
            tierLevel: 3,
            tierName: 'Elite',
            minimumSales: 100001,
            maximumSales: null,
            commissionRate: 8.0,
            bonusThreshold: 125000,
            bonusAmount: 5000
          }
        ],
        
        // Rules and settings
        rules: {
          paymentFrequency: 'monthly',
          paymentDelay: 30, // days after invoice payment
          splitCommissionAllowed: true,
          chargebackEnabled: true,
          chargebackPeriod: 90, // days
          minimumCommissionPayment: 100
        },
        
        // Product categories with different rates
        productRates: [
          { category: 'new_equipment', rate: 8.0, description: 'New copier/printer sales' },
          { category: 'used_equipment', rate: 6.0, description: 'Used equipment sales' },
          { category: 'service_contracts', rate: 4.0, description: 'Service and maintenance contracts' },
          { category: 'supplies', rate: 3.0, description: 'Toner and supplies' },
          { category: 'software', rate: 10.0, description: 'Software licenses and solutions' }
        ],
        
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2025-01-15')
      },
      {
        id: 'plan-2',
        planName: 'Sales Manager',
        planType: 'sales_manager',
        description: 'Commission plan for sales managers with override structure',
        isActive: true,
        effectiveDate: new Date('2024-01-01'),
        
        tiers: [
          {
            tierLevel: 1,
            tierName: 'Manager Base',
            minimumSales: 0,
            maximumSales: 200000,
            commissionRate: 3.0,
            bonusThreshold: null,
            bonusAmount: null
          },
          {
            tierLevel: 2,
            tierName: 'Manager Premium',
            minimumSales: 200001,
            maximumSales: null,
            commissionRate: 4.0,
            bonusThreshold: 300000,
            bonusAmount: 10000
          }
        ],
        
        rules: {
          paymentFrequency: 'monthly',
          paymentDelay: 30,
          splitCommissionAllowed: false,
          chargebackEnabled: true,
          chargebackPeriod: 120,
          minimumCommissionPayment: 250
        },
        
        productRates: [
          { category: 'new_equipment', rate: 4.0, description: 'Manager override on new equipment' },
          { category: 'used_equipment', rate: 3.0, description: 'Manager override on used equipment' },
          { category: 'service_contracts', rate: 2.0, description: 'Manager override on service contracts' },
          { category: 'supplies', rate: 1.5, description: 'Manager override on supplies' },
          { category: 'software', rate: 5.0, description: 'Manager override on software' }
        ],
        
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2025-01-10')
      },
      {
        id: 'plan-3',
        planName: 'Service Technician',
        planType: 'service_tech',
        description: 'Commission plan for service technicians based on billable hours',
        isActive: true,
        effectiveDate: new Date('2024-06-01'),
        
        tiers: [
          {
            tierLevel: 1,
            tierName: 'Tech Standard',
            minimumSales: 0,
            maximumSales: 15000,
            commissionRate: 12.0,
            bonusThreshold: null,
            bonusAmount: null
          },
          {
            tierLevel: 2,
            tierName: 'Tech Advanced',
            minimumSales: 15001,
            maximumSales: null,
            commissionRate: 15.0,
            bonusThreshold: 20000,
            bonusAmount: 1500
          }
        ],
        
        rules: {
          paymentFrequency: 'monthly',
          paymentDelay: 15,
          splitCommissionAllowed: false,
          chargebackEnabled: false,
          chargebackPeriod: 0,
          minimumCommissionPayment: 50
        },
        
        productRates: [
          { category: 'billable_hours', rate: 15.0, description: 'Commission on billable service hours' },
          { category: 'parts_markup', rate: 8.0, description: 'Commission on parts markup' },
          { category: 'addon_sales', rate: 20.0, description: 'Commission on additional equipment sales' }
        ],
        
        createdAt: new Date('2024-06-01'),
        updatedAt: new Date('2025-01-12')
      }
    ];

    res.json(commissionPlans);
    
  } catch (error) {
    console.error('Error fetching commission plans:', error);
    res.status(500).json({ message: 'Failed to fetch commission plans' });
  }
});

// Get commission calculations for a specific period
router.get('/api/commission/calculations', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { startDate, endDate, employeeId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample commission calculations
    const commissionCalculations = [
      {
        id: 'calc-1',
        employeeId: 'emp-001',
        employeeName: 'John Smith',
        employeeRole: 'Sales Representative',
        planId: 'plan-1',
        planName: 'Sales Rep Standard',
        calculationPeriod: {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31'),
          periodName: 'January 2025'
        },
        
        // Sales performance
        salesMetrics: {
          totalSales: 87500,
          newEquipmentSales: 65000,
          usedEquipmentSales: 12500,
          serviceContractSales: 7500,
          suppliesSales: 2500,
          quotaTarget: 75000,
          quotaAchievement: 116.7
        },
        
        // Commission breakdown
        commissionDetails: [
          {
            category: 'new_equipment',
            salesAmount: 65000,
            commissionRate: 6.5,
            commissionAmount: 4225,
            description: 'Tier 2 rate (6.5%) applied for sales over $50k'
          },
          {
            category: 'used_equipment',
            salesAmount: 12500,
            commissionRate: 6.0,
            commissionAmount: 750,
            description: 'Used equipment commission rate'
          },
          {
            category: 'service_contracts',
            salesAmount: 7500,
            commissionRate: 4.0,
            commissionAmount: 300,
            description: 'Service contract commission rate'
          },
          {
            category: 'supplies',
            salesAmount: 2500,
            commissionRate: 3.0,
            commissionAmount: 75,
            description: 'Supplies commission rate'
          }
        ],
        
        // Bonuses and adjustments
        bonuses: [
          {
            type: 'tier_bonus',
            description: 'Achiever tier bonus for exceeding $75k',
            amount: 2500,
            eligibilityMet: true
          },
          {
            type: 'quota_bonus',
            description: 'Monthly quota achievement bonus',
            amount: 1000,
            eligibilityMet: true
          }
        ],
        
        adjustments: [
          {
            type: 'chargeback',
            description: 'Customer cancellation - ABC Corp',
            amount: -450,
            reason: 'Customer cancelled contract within 90 days'
          }
        ],
        
        // Totals
        summary: {
          grossCommission: 5350,
          totalBonuses: 3500,
          totalAdjustments: -450,
          netCommission: 8400,
          payoutDate: new Date('2025-03-01'),
          status: 'calculated'
        },
        
        calculatedAt: new Date('2025-02-01'),
        calculatedBy: 'system'
      },
      {
        id: 'calc-2',
        employeeId: 'emp-002',
        employeeName: 'Sarah Wilson',
        employeeRole: 'Service Technician',
        planId: 'plan-3',
        planName: 'Service Technician',
        calculationPeriod: {
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-31'),
          periodName: 'January 2025'
        },
        
        salesMetrics: {
          totalSales: 18500,
          billableHours: 142,
          hourlyRate: 85,
          partsMarkup: 3200,
          addonSales: 3400,
          quotaTarget: 15000,
          quotaAchievement: 123.3
        },
        
        commissionDetails: [
          {
            category: 'billable_hours',
            salesAmount: 12070,
            commissionRate: 15.0,
            commissionAmount: 1810.50,
            description: 'Commission on 142 billable hours at $85/hr'
          },
          {
            category: 'parts_markup',
            salesAmount: 3200,
            commissionRate: 8.0,
            commissionAmount: 256,
            description: 'Commission on parts markup'
          },
          {
            category: 'addon_sales',
            salesAmount: 3400,
            commissionRate: 20.0,
            commissionAmount: 680,
            description: 'Commission on additional equipment sales'
          }
        ],
        
        bonuses: [
          {
            type: 'tier_bonus',
            description: 'Tech Advanced tier bonus for exceeding $15k',
            amount: 1500,
            eligibilityMet: true
          }
        ],
        
        adjustments: [],
        
        summary: {
          grossCommission: 2746.50,
          totalBonuses: 1500,
          totalAdjustments: 0,
          netCommission: 4246.50,
          payoutDate: new Date('2025-02-15'),
          status: 'calculated'
        },
        
        calculatedAt: new Date('2025-02-01'),
        calculatedBy: 'system'
      }
    ];

    // Filter by employee if specified
    const filteredCalculations = employeeId 
      ? commissionCalculations.filter(calc => calc.employeeId === employeeId)
      : commissionCalculations;

    res.json(filteredCalculations);
    
  } catch (error) {
    console.error('Error fetching commission calculations:', error);
    res.status(500).json({ message: 'Failed to fetch commission calculations' });
  }
});

// Get commission analytics and reporting
router.get('/api/commission/analytics', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { period = 'quarter' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample commission analytics
    const analytics = {
      summary: {
        totalCommissionPaid: 245780,
        averageCommissionRate: 6.8,
        totalBonusesPaid: 45200,
        totalAdjustments: -8950,
        participatingEmployees: 28,
        topPerformerPayout: 18750,
        averagePayout: 8777.86
      },
      
      performance_metrics: {
        quotaAchievementRate: 87.5,
        tierDistribution: {
          starter: 12,
          achiever: 11,
          elite: 5
        },
        avgSalesPerRep: 89450,
        commissionToSalesRatio: 2.75
      },
      
      monthly_trends: [
        { month: 'Oct 2024', totalCommissions: 78420, avgPayout: 8602, quotaAchievement: 82.3 },
        { month: 'Nov 2024', totalCommissions: 82150, avgPayout: 9016, quotaAchievement: 85.7 },
        { month: 'Dec 2024', totalCommissions: 85210, avgPayout: 9356, quotaAchievement: 89.2 },
        { month: 'Jan 2025', totalCommissions: 87500, avgPayout: 9611, quotaAchievement: 91.5 }
      ],
      
      top_performers: [
        {
          employeeId: 'emp-001',
          name: 'John Smith',
          role: 'Sales Representative',
          totalCommission: 18750,
          totalSales: 287500,
          quotaAchievement: 191.7,
          rank: 1
        },
        {
          employeeId: 'emp-003',
          name: 'Mike Johnson',
          role: 'Senior Sales Rep',
          totalCommission: 16840,
          totalSales: 242300,
          quotaAchievement: 161.5,
          rank: 2
        },
        {
          employeeId: 'emp-005',
          name: 'Emily Davis',
          role: 'Sales Representative',
          totalCommission: 15650,
          totalSales: 228750,
          quotaAchievement: 152.5,
          rank: 3
        }
      ],
      
      plan_performance: [
        {
          planId: 'plan-1',
          planName: 'Sales Rep Standard',
          participants: 18,
          avgPayout: 9235,
          totalPayout: 166230,
          avgQuotaAchievement: 89.2
        },
        {
          planId: 'plan-2',
          planName: 'Sales Manager',
          participants: 6,
          avgPayout: 12850,
          totalPayout: 77100,
          avgQuotaAchievement: 94.7
        },
        {
          planId: 'plan-3',
          planName: 'Service Technician',
          participants: 4,
          avgPayout: 4246,
          totalPayout: 16984,
          avgQuotaAchievement: 112.3
        }
      ],
      
      dispute_analysis: {
        totalDisputes: 3,
        resolvedDisputes: 2,
        pendingDisputes: 1,
        averageResolutionTime: 5.5, // days
        disputeReasons: [
          { reason: 'Calculation Error', count: 1, resolved: 1 },
          { reason: 'Split Commission', count: 1, resolved: 1 },
          { reason: 'Chargeback Dispute', count: 1, resolved: 0 }
        ]
      },
      
      forecast: {
        nextMonthProjection: 92500,
        quarterProjection: 267500,
        yearProjection: 1050000,
        confidenceLevel: 87.5
      }
    };

    res.json(analytics);
    
  } catch (error) {
    console.error('Error fetching commission analytics:', error);
    res.status(500).json({ message: 'Failed to fetch commission analytics' });
  }
});

// Process commission calculations for a period
router.post('/api/commission/calculate', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { startDate, endDate, employeeIds, planId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Simulate commission calculation process
    const calculationResults = {
      calculationId: `calc-${Date.now()}`,
      status: 'completed',
      processedEmployees: employeeIds?.length || 28,
      totalCommissions: 89750,
      totalBonuses: 15250,
      totalAdjustments: -2100,
      netTotal: 102900,
      calculationTime: '3.2 seconds',
      errors: [],
      warnings: [
        'Employee EMP-007 has incomplete sales data for calculation period',
        'Plan rates changed mid-period for 2 employees - pro-rated calculations applied'
      ]
    };

    res.json(calculationResults);
    
  } catch (error) {
    console.error('Error calculating commissions:', error);
    res.status(500).json({ message: 'Failed to calculate commissions' });
  }
});

// Get commission disputes
router.get('/api/commission/disputes', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const disputes = [
      {
        id: 'dispute-1',
        disputeNumber: 'DISP-2025-001',
        employeeId: 'emp-001',
        employeeName: 'John Smith',
        calculationId: 'calc-123',
        calculationPeriod: 'January 2025',
        
        disputeDetails: {
          type: 'calculation_error',
          description: 'Incorrect commission rate applied for large deal',
          disputedAmount: 2850,
          expectedAmount: 5200,
          difference: 2350
        },
        
        status: 'under_review',
        priority: 'high',
        submittedDate: new Date('2025-02-03'),
        lastUpdated: new Date('2025-02-05'),
        
        resolution: {
          assignedTo: 'manager-001',
          assignedToName: 'Mary Johnson',
          estimatedResolution: new Date('2025-02-10'),
          notes: 'Reviewing contract terms and commission plan details'
        },
        
        history: [
          {
            date: new Date('2025-02-03'),
            action: 'dispute_submitted',
            user: 'John Smith',
            description: 'Employee submitted dispute regarding commission calculation'
          },
          {
            date: new Date('2025-02-04'),
            action: 'assigned_to_manager',
            user: 'System',
            description: 'Dispute assigned to Mary Johnson for review'
          },
          {
            date: new Date('2025-02-05'),
            action: 'under_review',
            user: 'Mary Johnson',
            description: 'Started review of commission calculation and deal details'
          }
        ]
      },
      {
        id: 'dispute-2',
        disputeNumber: 'DISP-2025-002',
        employeeId: 'emp-003',
        employeeName: 'Mike Johnson',
        calculationId: 'calc-124',
        calculationPeriod: 'January 2025',
        
        disputeDetails: {
          type: 'split_commission',
          description: 'Split commission not properly allocated between team members',
          disputedAmount: 1200,
          expectedAmount: 1800,
          difference: 600
        },
        
        status: 'resolved',
        priority: 'medium',
        submittedDate: new Date('2025-01-28'),
        lastUpdated: new Date('2025-02-01'),
        
        resolution: {
          assignedTo: 'manager-001',
          assignedToName: 'Mary Johnson',
          actualResolution: new Date('2025-02-01'),
          resolutionType: 'adjustment_approved',
          adjustmentAmount: 600,
          notes: 'Split commission formula was incorrectly applied. Adjustment approved and processed.'
        },
        
        history: [
          {
            date: new Date('2025-01-28'),
            action: 'dispute_submitted',
            user: 'Mike Johnson',
            description: 'Employee submitted split commission dispute'
          },
          {
            date: new Date('2025-01-29'),
            action: 'assigned_to_manager',
            user: 'System',
            description: 'Dispute assigned to Mary Johnson for review'
          },
          {
            date: new Date('2025-02-01'),
            action: 'resolved',
            user: 'Mary Johnson',
            description: 'Dispute resolved with $600 adjustment approved'
          }
        ]
      }
    ];

    res.json(disputes);
    
  } catch (error) {
    console.error('Error fetching commission disputes:', error);
    res.status(500).json({ message: 'Failed to fetch commission disputes' });
  }
});

// Update commission dispute
router.put('/api/commission/disputes/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // For now, return success response until schema is updated
    res.json({
      message: 'Commission dispute updated successfully',
      id,
      ...updateData,
      updatedAt: new Date()
    });
    
  } catch (error) {
    console.error('Error updating commission dispute:', error);
    res.status(500).json({ message: 'Failed to update commission dispute' });
  }
});

export default router;