import express from 'express';
import { desc, eq, and, sql, asc, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth-setup';

const router = express.Router();

// Remote Monitoring & IoT Integration API Routes

// Get real-time equipment status
router.get('/api/remote-monitoring/equipment-status', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Real-time equipment monitoring data
    const equipmentStatus = [
      {
        equipmentId: 'eq-001',
        serialNumber: 'MX-2025-001',
        model: 'Canon ImageRunner 2535i',
        location: {
          customerName: 'Metro Office Solutions',
          address: '123 Business Center Dr, Suite 200',
          floor: '2nd Floor - Copy Center',
          coordinates: { lat: 40.7128, lng: -74.0060 }
        },
        
        // Current operational status
        status: 'operational',
        connectionStatus: 'connected',
        lastPing: new Date('2025-02-03T23:45:32Z'),
        uptime: 98.7,
        
        // Real-time metrics
        currentMetrics: {
          pagesPerMinute: 35,
          tonerLevels: {
            black: 78,
            cyan: 82,
            magenta: 75,
            yellow: 91
          },
          paperLevels: {
            tray1: 85,
            tray2: 92,
            tray3: 67
          },
          temperature: 42.3,
          humidity: 45,
          errorCount: 0,
          jamCount: 2,
          lastJobCompleted: new Date('2025-02-03T23:44:15Z')
        },
        
        // Performance metrics
        performance: {
          dailyPageCount: 1247,
          weeklyPageCount: 8650,
          monthlyPageCount: 32450,
          utilizationRate: 87,
          efficiency: 94.2,
          averageJobSize: 12.5,
          peakUsageHour: 14
        },
        
        // Maintenance status
        maintenance: {
          nextScheduled: new Date('2025-02-15T09:00:00Z'),
          lastCompleted: new Date('2025-01-20T14:30:00Z'),
          maintenanceScore: 92,
          predictiveAlerts: [
            {
              component: 'Fuser Unit',
              condition: 'good',
              estimatedLife: 85,
              nextReplacement: new Date('2025-04-15T00:00:00Z')
            },
            {
              component: 'Drum Unit',
              condition: 'fair',
              estimatedLife: 65,
              nextReplacement: new Date('2025-03-10T00:00:00Z')
            }
          ]
        },
        
        // Current alerts and notifications
        alerts: [
          {
            id: 'alert-001',
            type: 'supply_low',
            severity: 'medium',
            message: 'Magenta toner at 75% - consider ordering replacement',
            timestamp: new Date('2025-02-03T22:30:00Z'),
            acknowledged: false
          }
        ],
        
        // Energy and environmental data
        environmental: {
          powerConsumption: 450, // watts
          energyEfficiency: 'A+',
          carbonFootprint: 2.3, // kg CO2/day
          sleepModeActive: false,
          autoSleepEnabled: true
        }
      },
      {
        equipmentId: 'eq-002',
        serialNumber: 'TX-2024-007',
        model: 'Xerox WorkCentre 5855',
        location: {
          customerName: 'TechStart Innovations',
          address: '456 Innovation Blvd',
          floor: 'Main Floor - Reception',
          coordinates: { lat: 40.7589, lng: -73.9851 }
        },
        
        status: 'warning',
        connectionStatus: 'connected',
        lastPing: new Date('2025-02-03T23:45:28Z'),
        uptime: 92.3,
        
        currentMetrics: {
          pagesPerMinute: 22,
          tonerLevels: {
            black: 15,
            cyan: 45,
            magenta: 38,
            yellow: 52
          },
          paperLevels: {
            tray1: 25,
            tray2: 0,
            tray3: 78
          },
          temperature: 48.7,
          humidity: 52,
          errorCount: 3,
          jamCount: 8,
          lastJobCompleted: new Date('2025-02-03T22:15:42Z')
        },
        
        performance: {
          dailyPageCount: 456,
          weeklyPageCount: 2890,
          monthlyPageCount: 12340,
          utilizationRate: 52,
          efficiency: 78.5,
          averageJobSize: 8.2,
          peakUsageHour: 11
        },
        
        maintenance: {
          nextScheduled: new Date('2025-02-08T10:00:00Z'),
          lastCompleted: new Date('2025-01-12T16:45:00Z'),
          maintenanceScore: 68,
          predictiveAlerts: [
            {
              component: 'Paper Feed Mechanism',
              condition: 'poor',
              estimatedLife: 25,
              nextReplacement: new Date('2025-02-20T00:00:00Z')
            }
          ]
        },
        
        alerts: [
          {
            id: 'alert-002',
            type: 'supply_critical',
            severity: 'high',
            message: 'Black toner critically low (15%) - immediate replacement needed',
            timestamp: new Date('2025-02-03T20:45:00Z'),
            acknowledged: false
          },
          {
            id: 'alert-003',
            type: 'paper_empty',
            severity: 'medium',
            message: 'Tray 2 is empty - refill required',
            timestamp: new Date('2025-02-03T19:22:00Z'),
            acknowledged: true
          },
          {
            id: 'alert-004',
            type: 'maintenance_due',
            severity: 'medium',
            message: 'Frequent paper jams detected - maintenance recommended',
            timestamp: new Date('2025-02-03T18:00:00Z'),
            acknowledged: false
          }
        ],
        
        environmental: {
          powerConsumption: 520,
          energyEfficiency: 'B',
          carbonFootprint: 3.1,
          sleepModeActive: false,
          autoSleepEnabled: true
        }
      },
      {
        equipmentId: 'eq-003',
        serialNumber: 'RM-2025-012',
        model: 'Ricoh MP C3004',
        location: {
          customerName: 'Regional Medical Center',
          address: '789 Healthcare Plaza',
          floor: 'Level 3 - Administrative Wing',
          coordinates: { lat: 40.7831, lng: -73.9712 }
        },
        
        status: 'offline',
        connectionStatus: 'disconnected',
        lastPing: new Date('2025-02-03T15:32:18Z'),
        uptime: 99.2,
        
        currentMetrics: {
          pagesPerMinute: 0,
          tonerLevels: {
            black: 92,
            cyan: 88,
            magenta: 94,
            yellow: 85
          },
          paperLevels: {
            tray1: 95,
            tray2: 88,
            tray3: 92
          },
          temperature: null,
          humidity: null,
          errorCount: 0,
          jamCount: 0,
          lastJobCompleted: new Date('2025-02-03T15:28:45Z')
        },
        
        performance: {
          dailyPageCount: 2840,
          weeklyPageCount: 18960,
          monthlyPageCount: 75840,
          utilizationRate: 95,
          efficiency: 98.7,
          averageJobSize: 18.5,
          peakUsageHour: 10
        },
        
        maintenance: {
          nextScheduled: new Date('2025-02-10T08:00:00Z'),
          lastCompleted: new Date('2025-01-25T11:15:00Z'),
          maintenanceScore: 96,
          predictiveAlerts: []
        },
        
        alerts: [
          {
            id: 'alert-005',
            type: 'connection_lost',
            severity: 'critical',
            message: 'Equipment offline for 8+ hours - network connectivity issue',
            timestamp: new Date('2025-02-03T15:32:18Z'),
            acknowledged: false
          }
        ],
        
        environmental: {
          powerConsumption: 0,
          energyEfficiency: 'A++',
          carbonFootprint: 0,
          sleepModeActive: false,
          autoSleepEnabled: true
        }
      }
    ];

    res.json(equipmentStatus);
    
  } catch (error) {
    console.error('Error fetching equipment status:', error);
    res.status(500).json({ message: 'Failed to fetch equipment status' });
  }
});

// Get IoT sensor data and environmental metrics
router.get('/api/remote-monitoring/sensor-data', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { equipmentId, timeRange = '24h' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // IoT sensor data with historical trends
    const sensorData = {
      equipmentId: equipmentId || 'eq-001',
      collectionPeriod: timeRange,
      
      // Real-time sensor readings
      currentReadings: {
        temperature: 42.3,
        humidity: 45,
        vibration: 0.8,
        acousticLevel: 52,
        powerDraw: 450,
        networkSignal: -45,
        ambientLight: 350
      },
      
      // Historical data points (last 24 hours)
      historicalData: {
        temperature: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
          value: 40 + Math.random() * 8,
          status: 'normal'
        })),
        
        powerConsumption: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
          value: 300 + Math.random() * 400,
          status: 'normal'
        })),
        
        utilizationRate: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
          value: Math.random() * 100,
          status: 'normal'
        })),
        
        errorEvents: [
          {
            timestamp: new Date('2025-02-03T14:30:00Z'),
            type: 'paper_jam',
            severity: 'low',
            resolved: true,
            resolutionTime: 180 // seconds
          },
          {
            timestamp: new Date('2025-02-03T09:15:00Z'),
            type: 'toner_low_warning',
            severity: 'medium',
            resolved: false,
            resolutionTime: null
          }
        ]
      },
      
      // Predictive analytics
      predictions: {
        nextMaintenanceRequired: new Date('2025-02-15T09:00:00Z'),
        estimatedTonerReplacementDates: {
          black: new Date('2025-02-20T00:00:00Z'),
          cyan: new Date('2025-03-05T00:00:00Z'),
          magenta: new Date('2025-02-25T00:00:00Z'),
          yellow: new Date('2025-03-15T00:00:00Z')
        },
        probabilityOfFailure: {
          next7Days: 5,
          next30Days: 18,
          next90Days: 45
        },
        recommendedActions: [
          {
            action: 'Schedule proactive maintenance',
            priority: 'medium',
            estimatedCost: 150,
            preventsPotentialIssue: 'Fuser unit degradation'
          },
          {
            action: 'Order replacement toner cartridges',
            priority: 'high',
            estimatedCost: 320,
            preventsPotentialIssue: 'Print quality issues'
          }
        ]
      },
      
      // Performance benchmarks
      benchmarks: {
        industryAverage: {
          uptime: 94.5,
          efficiency: 87.2,
          energyEfficiency: 'B+',
          maintenanceCost: 1200 // annual
        },
        fleetAverage: {
          uptime: 96.8,
          efficiency: 91.5,
          energyEfficiency: 'A-',
          maintenanceCost: 980
        },
        thisEquipment: {
          uptime: 98.7,
          efficiency: 94.2,
          energyEfficiency: 'A+',
          maintenanceCost: 750
        }
      }
    };

    res.json(sensorData);
    
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ message: 'Failed to fetch sensor data' });
  }
});

// Get fleet overview and analytics
router.get('/api/remote-monitoring/fleet-overview', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const fleetOverview = {
      summary: {
        totalEquipment: 47,
        onlineEquipment: 44,
        offlineEquipment: 3,
        equipmentWithAlerts: 8,
        criticalAlerts: 2,
        averageUptime: 96.8,
        fleetUtilization: 78.5,
        energyEfficiency: 'A-'
      },
      
      // Status distribution
      statusDistribution: {
        operational: 38,
        warning: 6,
        critical: 2,
        offline: 3,
        maintenance: 1
      },
      
      // Geographic distribution
      locationAnalytics: [
        {
          region: 'Downtown Business District',
          equipmentCount: 18,
          averageUptime: 98.2,
          criticalAlerts: 0,
          utilizationRate: 85.7
        },
        {
          region: 'Industrial Park',
          equipmentCount: 15,
          averageUptime: 95.8,
          criticalAlerts: 1,
          utilizationRate: 72.3
        },
        {
          region: 'Medical Center Complex',
          equipmentCount: 14,
          averageUptime: 97.1,
          criticalAlerts: 1,
          utilizationRate: 82.1
        }
      ],
      
      // Performance trends
      performanceTrends: {
        weeklyUptime: [96.2, 97.1, 96.8, 97.5, 96.9, 97.2, 96.8],
        weeklyUtilization: [75.2, 78.1, 76.8, 79.5, 77.9, 80.2, 78.5],
        weeklyEfficiency: [89.2, 91.1, 90.8, 92.5, 91.9, 93.2, 91.5]
      },
      
      // Top performing equipment
      topPerformers: [
        {
          equipmentId: 'eq-003',
          customerName: 'Regional Medical Center',
          model: 'Ricoh MP C3004',
          uptime: 99.2,
          efficiency: 98.7,
          utilizationRate: 95
        },
        {
          equipmentId: 'eq-001',
          customerName: 'Metro Office Solutions',
          model: 'Canon ImageRunner 2535i',
          uptime: 98.7,
          efficiency: 94.2,
          utilizationRate: 87
        }
      ],
      
      // Equipment requiring attention
      attentionRequired: [
        {
          equipmentId: 'eq-002',
          customerName: 'TechStart Innovations',
          model: 'Xerox WorkCentre 5855',
          issues: ['Critical toner low', 'Frequent jams', 'Maintenance overdue'],
          priority: 'high',
          estimatedRevenueLoss: 1200
        },
        {
          equipmentId: 'eq-003',
          customerName: 'Regional Medical Center',
          model: 'Ricoh MP C3004',
          issues: ['Connection lost'],
          priority: 'critical',
          estimatedRevenueLoss: 2400
        }
      ],
      
      // Predictive maintenance schedule
      maintenanceSchedule: [
        {
          equipmentId: 'eq-002',
          customerName: 'TechStart Innovations',
          scheduledDate: new Date('2025-02-08T10:00:00Z'),
          type: 'emergency',
          estimatedDuration: 180,
          technicianAssigned: 'Mike Rodriguez'
        },
        {
          equipmentId: 'eq-001',
          customerName: 'Metro Office Solutions',
          scheduledDate: new Date('2025-02-15T09:00:00Z'),
          type: 'preventive',
          estimatedDuration: 120,
          technicianAssigned: 'Sarah Chen'
        }
      ],
      
      // Cost and efficiency metrics
      costMetrics: {
        totalMaintenanceCost: 12800,
        energyCost: 8960,
        supplyCost: 15600,
        potentialSavings: {
          predictiveMaintenance: 3200,
          energyOptimization: 1800,
          supplyOptimization: 2400
        }
      }
    };

    res.json(fleetOverview);
    
  } catch (error) {
    console.error('Error fetching fleet overview:', error);
    res.status(500).json({ message: 'Failed to fetch fleet overview' });
  }
});

// Create or update monitoring alerts
router.post('/api/remote-monitoring/alerts', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { equipmentId, alertType, threshold, enabled } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Simulate alert configuration
    const alertConfig = {
      id: `alert-config-${Date.now()}`,
      equipmentId,
      alertType,
      threshold,
      enabled,
      createdAt: new Date(),
      lastTriggered: null,
      triggeredCount: 0
    };

    res.json({ 
      success: true, 
      alertConfig,
      message: 'Alert configuration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating alert configuration:', error);
    res.status(500).json({ message: 'Failed to update alert configuration' });
  }
});

// Acknowledge alerts
router.post('/api/remote-monitoring/acknowledge-alert', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { alertId, acknowledgmentNote } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Simulate alert acknowledgment
    const acknowledgment = {
      alertId,
      acknowledgedBy: req.user.name,
      acknowledgedAt: new Date(),
      note: acknowledgmentNote,
      status: 'acknowledged'
    };

    res.json({ 
      success: true, 
      acknowledgment,
      message: 'Alert acknowledged successfully'
    });
    
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ message: 'Failed to acknowledge alert' });
  }
});

export default router;