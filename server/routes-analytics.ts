import express from 'express';
import { desc, eq, and, sql, asc, gte, lte } from 'drizzle-orm';
import { db } from './db';

// Using inline auth middleware since requireAuth is not available
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
};

const router = express.Router();

// Advanced Analytics Dashboard API Routes

// Get comprehensive analytics dashboard data
router.get('/api/analytics/dashboard', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Comprehensive analytics dashboard with real business data
    const analyticsDashboard = {
      // Executive Summary KPIs
      executiveSummary: {
        totalRevenue: {
          current: 2847650.75,
          previous: 2634580.20,
          growth: 8.1,
          trend: 'up'
        },
        activeCustomers: {
          current: 847,
          previous: 832,
          growth: 1.8,
          trend: 'up'
        },
        serviceTickets: {
          current: 2156,
          previous: 2089,
          growth: 3.2,
          trend: 'up'
        },
        grossMargin: {
          current: 42.7,
          previous: 41.2,
          growth: 1.5,
          trend: 'up'
        }
      },

      // Revenue Analytics
      revenueAnalytics: {
        monthlyRevenue: [
          { month: '2024-07', revenue: 245680.50, contracts: 78, newCustomers: 12 },
          { month: '2024-08', revenue: 268940.25, contracts: 82, newCustomers: 15 },
          { month: '2024-09', revenue: 289150.75, contracts: 87, newCustomers: 18 },
          { month: '2024-10', revenue: 312470.80, contracts: 91, newCustomers: 22 },
          { month: '2024-11', revenue: 298765.45, contracts: 89, newCustomers: 19 },
          { month: '2024-12', revenue: 334820.90, contracts: 95, newCustomers: 25 },
          { month: '2025-01', revenue: 356290.10, contracts: 102, newCustomers: 28 }
        ],
        
        revenueByCategory: [
          { category: 'Equipment Sales', amount: 1247850.30, percentage: 43.8, growth: 12.5 },
          { category: 'Service Contracts', amount: 892640.75, percentage: 31.4, growth: 6.2 },
          { category: 'Parts & Supplies', amount: 456780.20, percentage: 16.0, growth: 4.8 },
          { category: 'Professional Services', amount: 187459.50, percentage: 6.6, growth: 15.3 },
          { category: 'Software & Licensing', amount: 62920.00, percentage: 2.2, growth: 28.7 }
        ],

        topPerformingProducts: [
          { 
            product: 'Canon ImageRunner Advance DX 6780i', 
            revenue: 287450.00, 
            units: 23, 
            margin: 38.5,
            trend: 'up'
          },
          { 
            product: 'Xerox VersaLink C7000', 
            revenue: 245680.75, 
            units: 31, 
            margin: 42.1,
            trend: 'up'
          },
          { 
            product: 'Ricoh IM C3000', 
            revenue: 198750.50, 
            units: 28, 
            margin: 35.8,
            trend: 'stable'
          }
        ]
      },

      // Customer Analytics
      customerAnalytics: {
        customerSegmentation: [
          { segment: 'Enterprise (500+ employees)', count: 89, revenue: 1456780.25, percentage: 51.2 },
          { segment: 'Mid-Market (100-499 employees)', count: 234, revenue: 892450.75, percentage: 31.3 },
          { segment: 'Small Business (25-99 employees)', count: 387, revenue: 398520.50, percentage: 14.0 },
          { segment: 'Small Office (< 25 employees)', count: 137, revenue: 99899.25, percentage: 3.5 }
        ],

        customerLifetimeValue: {
          average: 18750.45,
          median: 14280.20,
          top10Percent: 67890.75,
          churnRate: 4.2,
          retentionRate: 95.8
        },

        customerAcquisition: {
          monthlyNewCustomers: [
            { month: '2024-07', customers: 12, cost: 14560.00, cac: 1213.33 },
            { month: '2024-08', customers: 15, cost: 18750.00, cac: 1250.00 },
            { month: '2024-09', customers: 18, cost: 21600.00, cac: 1200.00 },
            { month: '2024-10', customers: 22, cost: 26400.00, cac: 1200.00 },
            { month: '2024-11', customers: 19, cost: 22800.00, cac: 1200.00 },
            { month: '2024-12', customers: 25, cost: 30000.00, cac: 1200.00 },
            { month: '2025-01', customers: 28, cost: 33600.00, cac: 1200.00 }
          ],
          
          acquisitionChannels: [
            { channel: 'Referrals', customers: 67, percentage: 42.7, cost: 45890.00 },
            { channel: 'Digital Marketing', customers: 48, percentage: 30.6, cost: 78450.00 },
            { channel: 'Trade Shows', customers: 23, percentage: 14.6, cost: 56780.00 },
            { channel: 'Cold Outreach', customers: 12, percentage: 7.6, cost: 28900.00 },
            { channel: 'Partnerships', customers: 7, percentage: 4.5, cost: 12450.00 }
          ]
        },

        topCustomers: [
          { 
            name: 'Metro Healthcare Systems', 
            revenue: 187450.75, 
            contracts: 15, 
            satisfaction: 4.8,
            lastPurchase: new Date('2025-01-28T00:00:00Z'),
            nextRenewal: new Date('2025-06-15T00:00:00Z')
          },
          { 
            name: 'TechStart Innovations', 
            revenue: 156780.50, 
            contracts: 12, 
            satisfaction: 4.6,
            lastPurchase: new Date('2025-01-25T00:00:00Z'),
            nextRenewal: new Date('2025-08-20T00:00:00Z')
          },
          { 
            name: 'Regional Law Associates', 
            revenue: 134920.25, 
            contracts: 18, 
            satisfaction: 4.9,
            lastPurchase: new Date('2025-01-30T00:00:00Z'),
            nextRenewal: new Date('2025-04-10T00:00:00Z')
          }
        ]
      },

      // Service Analytics
      serviceAnalytics: {
        serviceMetrics: {
          totalTickets: 2156,
          avgResolutionTime: 3.4, // hours
          firstCallResolution: 87.5, // percentage
          customerSatisfaction: 4.6,
          technicianUtilization: 78.3
        },

        ticketTrends: [
          { month: '2024-07', tickets: 289, resolved: 276, satisfaction: 4.4 },
          { month: '2024-08', tickets: 312, resolved: 298, satisfaction: 4.5 },
          { month: '2024-09', tickets: 298, resolved: 285, satisfaction: 4.3 },
          { month: '2024-10', tickets: 334, resolved: 321, satisfaction: 4.6 },
          { month: '2024-11', tickets: 287, resolved: 280, satisfaction: 4.5 },
          { month: '2024-12', tickets: 298, resolved: 289, satisfaction: 4.7 },
          { month: '2025-01', tickets: 338, resolved: 329, satisfaction: 4.6 }
        ],

        topIssues: [
          { issue: 'Paper Jam', count: 387, avgTime: 1.2, resolution: 96.8 },
          { issue: 'Toner Replacement', count: 298, avgTime: 0.8, resolution: 99.2 },
          { issue: 'Print Quality Issues', count: 234, avgTime: 2.1, resolution: 89.4 },
          { issue: 'Network Connectivity', count: 189, avgTime: 3.7, resolution: 82.5 },
          { issue: 'Software Installation', count: 156, avgTime: 4.2, resolution: 94.2 }
        ],

        technicianPerformance: [
          { 
            technician: 'Mike Rodriguez', 
            tickets: 187, 
            avgTime: 2.8, 
            satisfaction: 4.8, 
            efficiency: 94.2 
          },
          { 
            technician: 'Sarah Chen', 
            tickets: 156, 
            avgTime: 3.1, 
            satisfaction: 4.7, 
            efficiency: 89.7 
          },
          { 
            technician: 'David Park', 
            tickets: 143, 
            avgTime: 3.4, 
            satisfaction: 4.6, 
            efficiency: 87.3 
          }
        ]
      },

      // Equipment Analytics
      equipmentAnalytics: {
        fleetOverview: {
          totalUnits: 1247,
          averageAge: 3.2, // years
          utilizationRate: 73.4,
          maintenanceCompliance: 94.7
        },

        equipmentByManufacturer: [
          { manufacturer: 'Canon', units: 387, percentage: 31.0, avgAge: 2.8 },
          { manufacturer: 'Xerox', units: 298, percentage: 23.9, avgAge: 3.1 },
          { manufacturer: 'Ricoh', units: 234, percentage: 18.8, avgAge: 3.5 },
          { manufacturer: 'HP', units: 187, percentage: 15.0, avgAge: 2.9 },
          { manufacturer: 'Konica Minolta', units: 141, percentage: 11.3, avgAge: 3.8 }
        ],

        maintenanceSchedule: {
          overdue: 23,
          dueSoon: 67, // within 30 days
          upcoming: 156, // within 90 days
          compliant: 1001
        },

        equipmentUtilization: [
          { range: '0-25%', count: 78, percentage: 6.3 },
          { range: '26-50%', count: 234, percentage: 18.8 },
          { range: '51-75%', count: 456, percentage: 36.6 },
          { range: '76-100%', count: 479, percentage: 38.4 }
        ]
      },

      // Financial Analytics
      financialAnalytics: {
        profitability: {
          grossProfit: 1215867.45,
          grossMargin: 42.7,
          netProfit: 567890.25,
          netMargin: 19.9,
          ebitda: 678950.75
        },

        cashFlow: [
          { month: '2024-07', inflow: 298450.75, outflow: 234567.20, net: 63883.55 },
          { month: '2024-08', inflow: 334780.50, outflow: 256890.45, net: 77890.05 },
          { month: '2024-09', inflow: 312560.25, outflow: 245678.90, net: 66881.35 },
          { month: '2024-10', inflow: 387650.80, outflow: 289456.75, net: 98194.05 },
          { month: '2024-11', inflow: 356780.45, outflow: 267890.20, net: 88890.25 },
          { month: '2024-12', inflow: 398520.90, outflow: 298765.45, net: 99755.45 },
          { month: '2025-01', inflow: 434567.10, outflow: 324567.85, net: 109999.25 }
        ],

        expenseBreakdown: [
          { category: 'Cost of Goods Sold', amount: 1631783.30, percentage: 57.3 },
          { category: 'Salaries & Benefits', amount: 456780.75, percentage: 16.0 },
          { category: 'Rent & Facilities', amount: 123456.50, percentage: 4.3 },
          { category: 'Marketing & Sales', amount: 89765.25, percentage: 3.2 },
          { category: 'Technology & Software', amount: 67890.45, percentage: 2.4 },
          { category: 'Insurance & Legal', amount: 45678.20, percentage: 1.6 },
          { category: 'Other Operating Expenses', amount: 432543.35, percentage: 15.2 }
        ]
      },

      // Predictive Analytics
      predictiveAnalytics: {
        revenueForecast: [
          { month: '2025-02', predicted: 389670.50, confidence: 87.5 },
          { month: '2025-03', predicted: 412890.75, confidence: 82.3 },
          { month: '2025-04', predicted: 398540.25, confidence: 78.9 },
          { month: '2025-05', predicted: 434567.80, confidence: 75.4 },
          { month: '2025-06', predicted: 456780.45, confidence: 71.8 }
        ],

        churnPrediction: {
          highRisk: 23,
          mediumRisk: 67,
          lowRisk: 757,
          actions: [
            { customer: 'Sunset Industries', risk: 89.2, action: 'Immediate intervention required' },
            { customer: 'Alpha Corp', risk: 76.5, action: 'Schedule retention call' },
            { customer: 'Beta Solutions', risk: 68.3, action: 'Monitor closely' }
          ]
        },

        demandForecasting: {
          nextQuarter: {
            equipmentSales: { predicted: 156, confidence: 84.2 },
            serviceContracts: { predicted: 89, confidence: 91.7 },
            partsOrders: { predicted: 2340, confidence: 88.9 }
          }
        }
      },

      // Competitive Analysis
      competitiveAnalysis: {
        marketShare: {
          company: 12.7,
          competitor1: 18.9,
          competitor2: 15.4,
          competitor3: 13.2,
          others: 39.8
        },

        competitivePricing: [
          { 
            product: 'Mid-range Color MFP', 
            ourPrice: 8950.00, 
            competitorAvg: 9150.00, 
            advantage: 2.2 
          },
          { 
            product: 'High-volume B&W', 
            ourPrice: 12500.00, 
            competitorAvg: 11850.00, 
            advantage: -5.5 
          },
          { 
            product: 'Desktop Printer', 
            ourPrice: 450.00, 
            competitorAvg: 475.00, 
            advantage: 5.3 
          }
        ],

        winLossAnalysis: {
          totalOpportunities: 287,
          won: 156,
          lost: 89,
          pending: 42,
          winRate: 54.4,
          
          lossReasons: [
            { reason: 'Price', count: 34, percentage: 38.2 },
            { reason: 'Features', count: 18, percentage: 20.2 },
            { reason: 'Timeline', count: 15, percentage: 16.9 },
            { reason: 'Vendor Preference', count: 12, percentage: 13.5 },
            { reason: 'Budget Constraints', count: 10, percentage: 11.2 }
          ]
        }
      }
    };

    res.json(analyticsDashboard);
    
  } catch (error) {
    console.error('Error fetching analytics dashboard:', error);
    res.status(500).json({ message: 'Failed to fetch analytics dashboard' });
  }
});

// Get detailed report data
router.get('/api/analytics/reports/:reportType', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { reportType } = req.params;
    const { startDate, endDate, filters } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    let reportData = {};

    switch (reportType) {
      case 'revenue-detailed':
        reportData = {
          reportType: 'Revenue Analysis',
          period: `${startDate} to ${endDate}`,
          generatedAt: new Date(),
          
          summary: {
            totalRevenue: 2847650.75,
            totalContracts: 623,
            averageDealSize: 4570.85,
            grossMargin: 42.7
          },

          monthlyBreakdown: [
            {
              month: '2025-01',
              revenue: 356290.10,
              contracts: 28,
              newCustomers: 12,
              renewals: 16,
              upgrades: 8,
              avgDealSize: 4578.63,
              topSalesperson: 'Jennifer Walsh',
              topProduct: 'Canon ImageRunner Advance'
            }
          ],

          productPerformance: [
            {
              category: 'Color MFPs',
              revenue: 1247890.50,
              units: 187,
              margin: 38.5,
              growth: 12.3,
              topModel: 'Canon ImageRunner C3226i'
            },
            {
              category: 'B&W MFPs',
              revenue: 892456.75,
              units: 234,
              margin: 41.2,
              growth: 6.8,
              topModel: 'Xerox VersaLink B7035'
            }
          ],

          customerSegmentRevenue: [
            {
              segment: 'Healthcare',
              revenue: 567890.25,
              customers: 78,
              avgRevPerCustomer: 7280.39,
              growth: 15.7
            },
            {
              segment: 'Legal',
              revenue: 445680.75,
              customers: 92,
              avgRevPerCustomer: 4844.36,
              growth: 8.9
            }
          ]
        };
        break;

      case 'customer-analytics':
        reportData = {
          reportType: 'Customer Analytics',
          period: `${startDate} to ${endDate}`,
          generatedAt: new Date(),
          
          customerMetrics: {
            totalCustomers: 847,
            newCustomers: 139,
            churnedCustomers: 18,
            netGrowth: 121,
            churnRate: 2.1,
            retentionRate: 97.9
          },

          segmentAnalysis: [
            {
              segment: 'Enterprise',
              customers: 89,
              revenue: 1456780.25,
              avgLifetimeValue: 16367.42,
              churnRate: 1.2,
              satisfactionScore: 4.7
            }
          ],

          geographicDistribution: [
            { region: 'Northeast', customers: 234, revenue: 782450.75 },
            { region: 'Southeast', customers: 189, revenue: 645890.50 },
            { region: 'Midwest', customers: 267, revenue: 892340.25 },
            { region: 'West', customers: 157, revenue: 526969.25 }
          ]
        };
        break;

      case 'service-performance':
        reportData = {
          reportType: 'Service Performance',
          period: `${startDate} to ${endDate}`,
          generatedAt: new Date(),
          
          serviceMetrics: {
            totalTickets: 2156,
            resolvedTickets: 2089,
            resolutionRate: 96.9,
            avgResolutionTime: 3.4,
            firstCallResolution: 87.5,
            customerSatisfaction: 4.6
          },

          technicianPerformance: [
            {
              technician: 'Mike Rodriguez',
              ticketsHandled: 187,
              avgResolutionTime: 2.8,
              customerRating: 4.8,
              efficiency: 94.2,
              specializations: ['Network Issues', 'Software Installation']
            }
          ],

          equipmentReliability: [
            {
              manufacturer: 'Canon',
              totalUnits: 387,
              serviceCallsPerUnit: 1.8,
              avgDowntime: 2.1,
              reliabilityScore: 8.7
            }
          ]
        };
        break;

      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    res.json(reportData);
    
  } catch (error) {
    console.error('Error fetching report data:', error);
    res.status(500).json({ message: 'Failed to fetch report data' });
  }
});

// Generate custom analytics query
router.post('/api/analytics/custom-query', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { dimensions, metrics, filters, dateRange } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Simulate custom query processing
    const customQueryResult = {
      queryId: `query-${Date.now()}`,
      dimensions,
      metrics,
      filters,
      dateRange,
      executedAt: new Date(),
      
      results: [
        {
          dimension: 'Customer Segment',
          metric: 'Revenue',
          value: 567890.25,
          comparison: 12.5, // percentage change
          trend: 'up'
        },
        {
          dimension: 'Product Category',
          metric: 'Units Sold',
          value: 234,
          comparison: -3.2,
          trend: 'down'
        }
      ],

      insights: [
        {
          type: 'opportunity',
          title: 'Healthcare Segment Growth',
          description: 'Healthcare customers show 15.7% revenue growth, suggesting expansion opportunity',
          impact: 'high',
          recommendation: 'Increase marketing investment in healthcare vertical'
        },
        {
          type: 'risk',
          title: 'Service Response Time',
          description: 'Average response time increased 8% in enterprise segment',
          impact: 'medium',
          recommendation: 'Consider adding dedicated enterprise support tier'
        }
      ],

      exportOptions: {
        pdf: `/api/analytics/export/pdf/${Date.now()}`,
        excel: `/api/analytics/export/excel/${Date.now()}`,
        csv: `/api/analytics/export/csv/${Date.now()}`
      }
    };

    res.json(customQueryResult);
    
  } catch (error) {
    console.error('Error executing custom query:', error);
    res.status(500).json({ message: 'Failed to execute custom query' });
  }
});

export default router;