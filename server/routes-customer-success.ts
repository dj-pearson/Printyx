import express from 'express';
import { desc, eq, and, sql, asc, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth-setup';
import { businessRecords, users, contracts, serviceTickets } from '../shared/schema';

const router = express.Router();

// Customer Success & Retention API Routes

// Get customer health scores
router.get('/api/customer-success/health-scores', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample customer health scores with predictive analytics
    const healthScores = [
      {
        customerId: 'cust-001',
        customerName: 'Metro Office Solutions',
        accountManager: 'John Smith',
        
        // Overall health metrics
        overallHealthScore: 85,
        healthStatus: 'healthy',
        riskLevel: 'low',
        churnProbability: 12,
        
        // Component scores
        scoreBreakdown: {
          usageHealth: 92,
          paymentHealth: 95,
          serviceHealth: 78,
          contractHealth: 88,
          engagementHealth: 82
        },
        
        // Key metrics
        metrics: {
          contractValue: 15600,
          monthsRemaining: 18,
          lastPaymentDate: new Date('2025-01-28'),
          daysSinceLastService: 45,
          averageResponseTime: 2.3,
          satisfactionScore: 4.2,
          usageUtilization: 87,
          renewalProbability: 89
        },
        
        // Trend indicators
        trends: {
          usageTrend: 'stable',
          paymentTrend: 'improving',
          serviceTrend: 'declining',
          engagementTrend: 'stable'
        },
        
        // Risk factors and opportunities
        riskFactors: [
          {
            factor: 'Service Response Time',
            severity: 'medium',
            description: 'Average response time has increased by 20% over past 3 months',
            impact: 15,
            recommendation: 'Schedule proactive service check and review technician assignments'
          }
        ],
        
        opportunities: [
          {
            type: 'contract_renewal',
            description: 'Contract renewal due in 18 months - early engagement opportunity',
            value: 15600,
            probability: 89,
            action: 'Schedule renewal discussion meeting'
          },
          {
            type: 'equipment_upgrade',
            description: 'Customer usage patterns suggest need for higher capacity equipment',
            value: 8500,
            probability: 65,
            action: 'Present equipment upgrade options'
          }
        ],
        
        // Alerts and notifications
        alerts: [
          {
            type: 'service_alert',
            priority: 'medium',
            message: 'Service response time degrading - schedule proactive maintenance',
            dueDate: new Date('2025-02-15')
          }
        ],
        
        lastUpdated: new Date('2025-02-03'),
        nextReviewDate: new Date('2025-02-17')
      },
      {
        customerId: 'cust-002',
        customerName: 'TechStart Innovations',
        accountManager: 'Sarah Wilson',
        
        overallHealthScore: 65,
        healthStatus: 'at_risk',
        riskLevel: 'medium',
        churnProbability: 35,
        
        scoreBreakdown: {
          usageHealth: 45,
          paymentHealth: 72,
          serviceHealth: 88,
          contractHealth: 70,
          engagementHealth: 58
        },
        
        metrics: {
          contractValue: 8200,
          monthsRemaining: 8,
          lastPaymentDate: new Date('2025-01-15'),
          daysSinceLastService: 12,
          averageResponseTime: 1.8,
          satisfactionScore: 3.8,
          usageUtilization: 52,
          renewalProbability: 45
        },
        
        trends: {
          usageTrend: 'declining',
          paymentTrend: 'stable',
          serviceTrend: 'improving',
          engagementTrend: 'declining'
        },
        
        riskFactors: [
          {
            factor: 'Low Usage Utilization',
            severity: 'high',
            description: 'Equipment usage has dropped 40% in past 6 months',
            impact: 35,
            recommendation: 'Investigate usage patterns and identify customer needs changes'
          },
          {
            factor: 'Declining Engagement',
            severity: 'medium',
            description: 'Reduced response to communications and support interactions',
            impact: 20,
            recommendation: 'Schedule executive check-in call to understand business changes'
          }
        ],
        
        opportunities: [
          {
            type: 'needs_assessment',
            description: 'Usage patterns suggest business model change - reassess equipment needs',
            value: 5000,
            probability: 70,
            action: 'Conduct comprehensive needs assessment'
          }
        ],
        
        alerts: [
          {
            type: 'churn_risk',
            priority: 'high',
            message: 'High churn risk detected - immediate intervention required',
            dueDate: new Date('2025-02-10')
          },
          {
            type: 'renewal_risk',
            priority: 'high',
            message: 'Contract renewal at risk - only 8 months remaining with declining usage',
            dueDate: new Date('2025-02-08')
          }
        ],
        
        lastUpdated: new Date('2025-02-03'),
        nextReviewDate: new Date('2025-02-08')
      },
      {
        customerId: 'cust-003',
        customerName: 'Regional Medical Center',
        accountManager: 'Mike Johnson',
        
        overallHealthScore: 96,
        healthStatus: 'excellent',
        riskLevel: 'very_low',
        churnProbability: 5,
        
        scoreBreakdown: {
          usageHealth: 98,
          paymentHealth: 100,
          serviceHealth: 95,
          contractHealth: 94,
          engagementHealth: 92
        },
        
        metrics: {
          contractValue: 32400,
          monthsRemaining: 24,
          lastPaymentDate: new Date('2025-02-01'),
          daysSinceLastService: 22,
          averageResponseTime: 1.2,
          satisfactionScore: 4.8,
          usageUtilization: 95,
          renewalProbability: 98
        },
        
        trends: {
          usageTrend: 'growing',
          paymentTrend: 'excellent',
          serviceTrend: 'excellent',
          engagementTrend: 'improving'
        },
        
        riskFactors: [],
        
        opportunities: [
          {
            type: 'account_expansion',
            description: 'High satisfaction and usage - opportunity for additional locations',
            value: 45000,
            probability: 75,
            action: 'Present multi-location expansion proposal'
          },
          {
            type: 'service_upgrade',
            description: 'Premium service tier opportunity based on usage patterns',
            value: 6000,
            probability: 85,
            action: 'Propose premium service package'
          }
        ],
        
        alerts: [
          {
            type: 'opportunity',
            priority: 'low',
            message: 'Excellent customer - explore expansion opportunities',
            dueDate: new Date('2025-02-20')
          }
        ],
        
        lastUpdated: new Date('2025-02-03'),
        nextReviewDate: new Date('2025-03-03')
      }
    ];

    res.json(healthScores);
    
  } catch (error) {
    console.error('Error fetching customer health scores:', error);
    res.status(500).json({ message: 'Failed to fetch customer health scores' });
  }
});

// Get usage analytics for customers
router.get('/api/customer-success/usage-analytics', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { customerId, period = 'month' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample usage analytics data
    const usageAnalytics = {
      summary: {
        totalCustomers: 45,
        averageUtilization: 76.5,
        totalMonthlyVolume: 2847500,
        utilizationTrend: 2.3,
        topPerformingAccounts: 12,
        underutilizedAccounts: 8
      },
      
      // Customer-specific analytics
      customerBreakdown: [
        {
          customerId: 'cust-001',
          customerName: 'Metro Office Solutions',
          equipment: [
            {
              serialNumber: 'MX-2020-001',
              model: 'Canon ImageRunner 2525i',
              monthlyVolume: 12500,
              capacity: 15000,
              utilization: 83.3,
              averageDailyUsage: 417,
              peakUsageDay: 'Tuesday',
              maintenanceScore: 92
            },
            {
              serialNumber: 'MX-2020-002',
              model: 'Canon ImageRunner 3235i',
              monthlyVolume: 8750,
              capacity: 12000,
              utilization: 72.9,
              averageDailyUsage: 292,
              peakUsageDay: 'Wednesday',
              maintenanceScore: 88
            }
          ],
          
          usageTrends: {
            currentMonth: 21250,
            lastMonth: 20800,
            growth: 2.2,
            yearOverYear: 15.7,
            seasonalPattern: 'stable'
          },
          
          recommendations: [
            {
              type: 'optimization',
              priority: 'medium',
              description: 'Equipment MX-2020-001 nearing capacity - consider upgrade or load balancing',
              potentialSavings: 2400,
              implementationCost: 850
            }
          ],
          
          alerts: [
            {
              type: 'capacity_warning',
              equipment: 'MX-2020-001',
              message: 'Operating at 83% capacity - approaching optimal threshold',
              severity: 'medium'
            }
          ]
        },
        {
          customerId: 'cust-002',
          customerName: 'TechStart Innovations',
          equipment: [
            {
              serialNumber: 'TX-2021-003',
              model: 'Xerox WorkCentre 5855',
              monthlyVolume: 4200,
              capacity: 8000,
              utilization: 52.5,
              averageDailyUsage: 140,
              peakUsageDay: 'Monday',
              maintenanceScore: 95
            }
          ],
          
          usageTrends: {
            currentMonth: 4200,
            lastMonth: 6800,
            growth: -38.2,
            yearOverYear: -42.5,
            seasonalPattern: 'declining'
          },
          
          recommendations: [
            {
              type: 'rightsizing',
              priority: 'high',
              description: 'Significant underutilization - consider downsizing to lower-cost equipment',
              potentialSavings: 3600,
              implementationCost: 1200
            },
            {
              type: 'needs_assessment',
              priority: 'high',
              description: 'Usage decline suggests business changes - schedule needs review',
              potentialSavings: 0,
              implementationCost: 0
            }
          ],
          
          alerts: [
            {
              type: 'underutilization',
              equipment: 'TX-2021-003',
              message: 'Severe underutilization detected - only 52% capacity usage',
              severity: 'high'
            },
            {
              type: 'declining_usage',
              equipment: 'TX-2021-003',
              message: 'Usage down 38% from last month - investigate cause',
              severity: 'high'
            }
          ]
        }
      ],
      
      // Usage patterns analysis
      usagePatterns: {
        peakHours: ['9:00-11:00', '13:00-15:00'],
        peakDays: ['Tuesday', 'Wednesday', 'Thursday'],
        seasonalTrends: {
          Q1: 'High usage - year-end processing',
          Q2: 'Moderate usage - steady business',
          Q3: 'Lower usage - summer slowdown',
          Q4: 'Peak usage - holiday preparations'
        },
        industryBenchmarks: {
          healthcare: { averageUtilization: 82, monthlyVolume: 18500 },
          legal: { averageUtilization: 89, monthlyVolume: 22000 },
          education: { averageUtilization: 65, monthlyVolume: 12000 },
          corporate: { averageUtilization: 76, monthlyVolume: 15500 }
        }
      },
      
      // Optimization opportunities
      optimizationOpportunities: [
        {
          type: 'equipment_consolidation',
          affectedCustomers: ['cust-004', 'cust-007'],
          description: 'Multiple underutilized devices can be consolidated',
          potentialSavings: 12600,
          implementationCost: 4200,
          roi: 300
        },
        {
          type: 'capacity_upgrades',
          affectedCustomers: ['cust-001', 'cust-003'],
          description: 'High-utilization customers need capacity increases',
          potentialRevenue: 28500,
          implementationCost: 8500,
          roi: 335
        },
        {
          type: 'service_optimization',
          affectedCustomers: ['cust-002', 'cust-005'],
          description: 'Underutilized equipment suggests service plan adjustments',
          potentialSavings: 6800,
          implementationCost: 1200,
          roi: 567
        }
      ],
      
      // Predictive insights
      predictions: {
        nextMonthVolume: 2965000,
        utilizationForecast: 78.2,
        atRiskAccounts: [
          {
            customerId: 'cust-002',
            riskType: 'underutilization',
            probability: 85,
            recommendedAction: 'Equipment rightsizing discussion'
          }
        ],
        growthOpportunities: [
          {
            customerId: 'cust-001',
            opportunityType: 'capacity_expansion',
            probability: 75,
            estimatedValue: 8500
          }
        ]
      }
    };

    // Filter by customer if specified
    if (customerId) {
      const customerData = usageAnalytics.customerBreakdown.find(c => c.customerId === customerId);
      if (customerData) {
        res.json({
          summary: usageAnalytics.summary,
          customer: customerData,
          usagePatterns: usageAnalytics.usagePatterns,
          predictions: usageAnalytics.predictions
        });
      } else {
        res.status(404).json({ message: 'Customer not found' });
      }
    } else {
      res.json(usageAnalytics);
    }
    
  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    res.status(500).json({ message: 'Failed to fetch usage analytics' });
  }
});

// Get satisfaction surveys and feedback
router.get('/api/customer-success/satisfaction', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const satisfactionData = {
      summary: {
        overallSatisfaction: 4.2,
        responseRate: 68.5,
        totalSurveys: 156,
        completedSurveys: 107,
        npsScore: 42,
        promoters: 65,
        detractors: 23,
        trend: 'improving'
      },
      
      // Recent survey responses
      recentSurveys: [
        {
          surveyId: 'surv-001',
          customerId: 'cust-001',
          customerName: 'Metro Office Solutions',
          submittedDate: new Date('2025-01-30'),
          scores: {
            overall: 4.5,
            serviceQuality: 4.7,
            responseTime: 4.2,
            technicalExpertise: 4.8,
            communication: 4.3,
            valueForMoney: 4.1
          },
          npsScore: 9,
          category: 'promoter',
          feedback: 'Excellent service team - always responsive and knowledgeable. Equipment runs smoothly.',
          actionItems: []
        },
        {
          surveyId: 'surv-002',
          customerId: 'cust-002',
          customerName: 'TechStart Innovations',
          submittedDate: new Date('2025-01-28'),
          scores: {
            overall: 3.2,
            serviceQuality: 3.8,
            responseTime: 2.9,
            technicalExpertise: 4.1,
            communication: 2.8,
            valueForMoney: 2.5
          },
          npsScore: 5,
          category: 'passive',
          feedback: 'Service is adequate but response times could be better. Pricing seems high for our usage.',
          actionItems: [
            {
              action: 'Review response time procedures',
              assignedTo: 'Service Manager',
              dueDate: new Date('2025-02-15'),
              status: 'in_progress'
            },
            {
              action: 'Conduct pricing review meeting',
              assignedTo: 'Account Manager',
              dueDate: new Date('2025-02-10'),
              status: 'pending'
            }
          ]
        }
      ],
      
      // Satisfaction trends by category
      categoryTrends: {
        serviceQuality: {
          current: 4.3,
          previous: 4.1,
          trend: 'improving',
          target: 4.5
        },
        responseTime: {
          current: 3.8,
          previous: 3.6,
          trend: 'improving',
          target: 4.2
        },
        technicalExpertise: {
          current: 4.5,
          previous: 4.4,
          trend: 'stable',
          target: 4.6
        },
        communication: {
          current: 3.9,
          previous: 3.7,
          trend: 'improving',
          target: 4.3
        },
        valueForMoney: {
          current: 3.6,
          previous: 3.5,
          trend: 'stable',
          target: 4.0
        }
      },
      
      // Action plans for improvement
      improvementPlans: [
        {
          area: 'Response Time',
          currentScore: 3.8,
          targetScore: 4.2,
          initiatives: [
            {
              initiative: 'Implement automated dispatch system',
              timeline: '30 days',
              expectedImpact: 0.3,
              status: 'in_progress'
            },
            {
              initiative: 'Add weekend service coverage',
              timeline: '60 days',
              expectedImpact: 0.2,
              status: 'planned'
            }
          ]
        },
        {
          area: 'Communication',
          currentScore: 3.9,
          targetScore: 4.3,
          initiatives: [
            {
              initiative: 'Customer portal for service updates',
              timeline: '45 days',
              expectedImpact: 0.3,
              status: 'in_progress'
            },
            {
              initiative: 'Proactive maintenance notifications',
              timeline: '30 days',
              expectedImpact: 0.2,
              status: 'planned'
            }
          ]
        }
      ]
    };

    res.json(satisfactionData);
    
  } catch (error) {
    console.error('Error fetching satisfaction data:', error);
    res.status(500).json({ message: 'Failed to fetch satisfaction data' });
  }
});

// Create or trigger customer health score calculation
router.post('/api/customer-success/calculate-health', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { customerIds, recalculateAll = false } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Simulate health score calculation process
    const calculationResults = {
      calculationId: `health-calc-${Date.now()}`,
      status: 'completed',
      processedCustomers: customerIds?.length || 45,
      calculationTime: '12.8 seconds',
      updates: [
        { customerId: 'cust-001', oldScore: 82, newScore: 85, change: 3 },
        { customerId: 'cust-002', oldScore: 72, newScore: 65, change: -7 },
        { customerId: 'cust-003', oldScore: 94, newScore: 96, change: 2 }
      ],
      alerts: [
        {
          type: 'score_decline',
          customerId: 'cust-002',
          message: 'Health score declined by 7 points - requires attention'
        }
      ]
    };

    res.json(calculationResults);
    
  } catch (error) {
    console.error('Error calculating health scores:', error);
    res.status(500).json({ message: 'Failed to calculate health scores' });
  }
});

export default router;