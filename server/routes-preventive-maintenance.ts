import express from 'express';
import { desc, eq, and, sql, asc, gte, lte } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth-setup';
import { equipment, businessRecords } from '../shared/schema';

const router = express.Router();

// Preventive Maintenance Automation API Routes

// Get all maintenance schedules
router.get('/api/maintenance/schedules', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample maintenance schedules until schema is updated
    const maintenanceSchedules = [
      {
        id: 'schedule-1',
        equipmentId: 'eq-001',
        equipmentModel: 'Canon imageRUNNER ADVANCE DX C5750i',
        customerName: 'ABC Corporation',
        customerLocation: '123 Business Way, Downtown',
        maintenanceType: 'quarterly_service',
        serviceName: 'Quarterly Preventive Maintenance',
        
        // Scheduling Information
        frequency: 'quarterly', // daily, weekly, monthly, quarterly, yearly
        frequencyValue: 3, // every 3 months
        nextDueDate: new Date('2025-02-15'),
        lastServiceDate: new Date('2024-11-15'),
        
        // Meter-based scheduling
        meterBasedScheduling: true,
        currentMeterReading: 45230,
        meterAtLastService: 42500,
        nextServiceMeter: 47500,
        meterThreshold: 2500, // service every 2500 copies
        
        // Service Details
        estimatedDuration: 120, // minutes
        requiredSkills: ['preventive_maintenance', 'copier_service'],
        requiredParts: ['toner_cartridge', 'transfer_belt', 'fuser_kit'],
        
        // Status and Priority
        status: 'scheduled',
        priority: 'medium',
        urgencyScore: 75, // 0-100 based on overdue days, meter readings, etc.
        
        // Assignment
        assignedTechnicianId: 'tech-2',
        assignedTechnicianName: 'Sarah Wilson',
        scheduledDate: new Date('2025-02-15'),
        scheduledTimeSlot: '10:00 AM - 12:00 PM',
        
        // Automation Settings
        autoScheduleEnabled: true,
        reminderDaysBefore: 7,
        escalationDays: 3,
        
        // Performance Tracking
        serviceHistory: [
          {
            date: new Date('2024-11-15'),
            technician: 'Mike Johnson',
            duration: 105,
            partsUsed: ['toner_cartridge'],
            issues: ['paper jam sensor cleaned'],
            meterReading: 42500
          },
          {
            date: new Date('2024-08-15'),
            technician: 'Sarah Wilson',
            duration: 95,
            partsUsed: ['transfer_belt'],
            issues: ['routine maintenance'],
            meterReading: 39800
          }
        ],
        
        // Predictive Analytics
        predictiveInsights: {
          riskLevel: 'low',
          failurePrediction: 12, // percentage chance of failure in next 30 days
          recommendedActions: [
            'Monitor toner levels - replacement due soon',
            'Check paper feed mechanism during next service'
          ],
          costSavings: 450 // estimated savings from preventive vs reactive maintenance
        },
        
        createdAt: new Date('2024-08-01'),
        updatedAt: new Date('2025-01-20')
      },
      {
        id: 'schedule-2',
        equipmentId: 'eq-002',
        equipmentModel: 'Xerox VersaLink C405',
        customerName: 'XYZ Industries',
        customerLocation: '456 Industrial Dr, Manufacturing District',
        maintenanceType: 'monthly_service',
        serviceName: 'Monthly Maintenance Check',
        
        frequency: 'monthly',
        frequencyValue: 1,
        nextDueDate: new Date('2025-02-01'),
        lastServiceDate: new Date('2025-01-01'),
        
        meterBasedScheduling: true,
        currentMeterReading: 28650,
        meterAtLastService: 27200,
        nextServiceMeter: 29000,
        meterThreshold: 1500,
        
        estimatedDuration: 90,
        requiredSkills: ['printer_maintenance', 'network_troubleshoot'],
        requiredParts: ['drum_unit', 'waste_toner_box'],
        
        status: 'overdue',
        priority: 'high',
        urgencyScore: 90,
        
        assignedTechnicianId: 'tech-1',
        assignedTechnicianName: 'Mike Johnson',
        scheduledDate: new Date('2025-02-01'),
        scheduledTimeSlot: '2:00 PM - 3:30 PM',
        
        autoScheduleEnabled: true,
        reminderDaysBefore: 5,
        escalationDays: 2,
        
        serviceHistory: [
          {
            date: new Date('2025-01-01'),
            technician: 'David Chen',
            duration: 85,
            partsUsed: ['waste_toner_box'],
            issues: ['routine maintenance'],
            meterReading: 27200
          }
        ],
        
        predictiveInsights: {
          riskLevel: 'medium',
          failurePrediction: 25,
          recommendedActions: [
            'Drum unit showing wear - schedule replacement within 2 weeks',
            'Network connectivity intermittent - check during service'
          ],
          costSavings: 320
        },
        
        createdAt: new Date('2024-09-01'),
        updatedAt: new Date('2025-01-25')
      },
      {
        id: 'schedule-3',
        equipmentId: 'eq-003',
        equipmentModel: 'HP LaserJet Enterprise M507dn',
        customerName: 'Tech Solutions Inc',
        customerLocation: '789 Office Park, Business Center',
        maintenanceType: 'bi_annual_service',
        serviceName: 'Bi-Annual Deep Maintenance',
        
        frequency: 'bi_annual',
        frequencyValue: 6,
        nextDueDate: new Date('2025-03-01'),
        lastServiceDate: new Date('2024-09-01'),
        
        meterBasedScheduling: false,
        currentMeterReading: 15420,
        meterAtLastService: 12800,
        nextServiceMeter: null,
        meterThreshold: null,
        
        estimatedDuration: 180,
        requiredSkills: ['laser_printer_service', 'hardware_diagnostic'],
        requiredParts: ['fuser_assembly', 'pickup_roller'],
        
        status: 'pending',
        priority: 'low',
        urgencyScore: 45,
        
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        scheduledDate: null,
        scheduledTimeSlot: null,
        
        autoScheduleEnabled: false,
        reminderDaysBefore: 14,
        escalationDays: 7,
        
        serviceHistory: [
          {
            date: new Date('2024-09-01'),
            technician: 'Sarah Wilson',
            duration: 165,
            partsUsed: ['pickup_roller'],
            issues: ['deep cleaning', 'calibration'],
            meterReading: 12800
          }
        ],
        
        predictiveInsights: {
          riskLevel: 'low',
          failurePrediction: 8,
          recommendedActions: [
            'Fuser assembly within normal wear range',
            'Consider upgrading to newer model for better efficiency'
          ],
          costSavings: 180
        },
        
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date('2025-01-15')
      }
    ];

    res.json(maintenanceSchedules);
    
  } catch (error) {
    console.error('Error fetching maintenance schedules:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance schedules' });
  }
});

// Get maintenance analytics and insights
router.get('/api/maintenance/analytics', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample maintenance analytics
    const analytics = {
      summary: {
        totalEquipment: 156,
        scheduledMaintenance: 89,
        overdueMaintenance: 12,
        completedThisMonth: 45,
        preventiveVsReactive: 78.5, // percentage preventive
        averageServiceTime: 105, // minutes
        customerSatisfaction: 4.7,
        costSavings: 12450 // monthly savings from preventive maintenance
      },
      
      efficiency: {
        maintenanceCompliance: 92.3, // percentage on-time completion
        firstTimeFixRate: 87.6,
        averageResponseTime: 2.4, // hours
        technicianUtilization: 74.2,
        partsAvailability: 94.8,
        schedulingAccuracy: 89.1 // how often scheduled times are met
      },
      
      equipment_health: [
        {
          category: 'Copiers/MFPs',
          totalUnits: 78,
          healthyUnits: 65,
          warningUnits: 10,
          criticalUnits: 3,
          averageAge: 3.2, // years
          predictedFailures: 2 // next 30 days
        },
        {
          category: 'Printers',
          totalUnits: 45,
          healthyUnits: 38,
          warningUnits: 5,
          criticalUnits: 2,
          averageAge: 2.8,
          predictedFailures: 1
        },
        {
          category: 'Scanners',
          totalUnits: 33,
          healthyUnits: 30,
          warningUnits: 2,
          criticalUnits: 1,
          averageAge: 4.1,
          predictedFailures: 1
        }
      ],
      
      cost_analysis: {
        monthlyMaintenanceCost: 8750,
        preventiveCost: 6850,
        reactiveCost: 1900,
        averageCostPerUnit: 56.09,
        costTrends: [
          { month: 'Sep 2024', preventive: 6200, reactive: 2100, total: 8300 },
          { month: 'Oct 2024', preventive: 6500, reactive: 1850, total: 8350 },
          { month: 'Nov 2024', preventive: 6750, reactive: 1950, total: 8700 },
          { month: 'Dec 2024', preventive: 6650, reactive: 2200, total: 8850 },
          { month: 'Jan 2025', preventive: 6850, reactive: 1900, total: 8750 }
        ]
      },
      
      performance_trends: [
        { month: 'Sep', compliance: 89.5, satisfaction: 4.6, savings: 11200 },
        { month: 'Oct', compliance: 91.2, satisfaction: 4.7, savings: 11800 },
        { month: 'Nov', compliance: 90.8, satisfaction: 4.6, savings: 12100 },
        { month: 'Dec', compliance: 93.1, satisfaction: 4.8, savings: 12300 },
        { month: 'Jan', compliance: 92.3, satisfaction: 4.7, savings: 12450 }
      ],
      
      predictive_insights: {
        highRiskEquipment: [
          {
            equipmentId: 'eq-004',
            model: 'Canon imageRUNNER C3025i',
            customer: 'Delta Corp',
            riskScore: 85,
            predictedIssue: 'Fuser unit failure',
            recommendedAction: 'Schedule immediate inspection',
            estimatedCost: 450
          },
          {
            equipmentId: 'eq-007',
            model: 'Xerox WorkCentre 6515',
            customer: 'Epsilon Ltd',
            riskScore: 78,
            predictedIssue: 'Drum unit degradation',
            recommendedAction: 'Order replacement parts',
            estimatedCost: 320
          }
        ],
        
        optimizationOpportunities: [
          {
            type: 'schedule_consolidation',
            description: 'Consolidate 3 nearby customers into single route',
            potentialSavings: 180,
            implementationEffort: 'low'
          },
          {
            type: 'parts_inventory',
            description: 'Optimize parts inventory based on usage patterns',
            potentialSavings: 650,
            implementationEffort: 'medium'
          }
        ]
      }
    };

    res.json(analytics);
    
  } catch (error) {
    console.error('Error fetching maintenance analytics:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance analytics' });
  }
});

// Get maintenance templates
router.get('/api/maintenance/templates', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample maintenance templates
    const templates = [
      {
        id: 'template-1',
        templateName: 'Standard Copier Quarterly Service',
        description: 'Comprehensive quarterly maintenance for copiers and MFPs',
        equipmentTypes: ['copier', 'mfp'],
        estimatedDuration: 120,
        frequency: 'quarterly',
        
        checklist: [
          { item: 'Clean paper path and feed rollers', required: true, estimatedTime: 15 },
          { item: 'Replace toner cartridges if below 20%', required: true, estimatedTime: 10 },
          { item: 'Clean scanner glass and ADF', required: true, estimatedTime: 10 },
          { item: 'Check and clean transfer belt', required: true, estimatedTime: 20 },
          { item: 'Inspect fuser unit condition', required: true, estimatedTime: 15 },
          { item: 'Test all paper trays and sensors', required: true, estimatedTime: 20 },
          { item: 'Perform print quality calibration', required: true, estimatedTime: 15 },
          { item: 'Update firmware if available', required: false, estimatedTime: 15 }
        ],
        
        requiredParts: [
          { partName: 'Toner Cartridge Set', quantity: 1, optional: true },
          { partName: 'Transfer Belt', quantity: 1, optional: true },
          { partName: 'Cleaning Kit', quantity: 1, optional: false }
        ],
        
        requiredSkills: ['copier_maintenance', 'preventive_service'],
        safetyRequirements: ['power_off_before_service', 'use_cleaning_gloves'],
        
        isActive: true,
        usageCount: 34,
        lastUsed: new Date('2025-01-20'),
        createdAt: new Date('2024-06-15')
      },
      {
        id: 'template-2',
        templateName: 'Printer Monthly Maintenance',
        description: 'Basic monthly maintenance for laser and inkjet printers',
        equipmentTypes: ['printer'],
        estimatedDuration: 60,
        frequency: 'monthly',
        
        checklist: [
          { item: 'Check and clean paper feed mechanism', required: true, estimatedTime: 10 },
          { item: 'Inspect cartridge levels and condition', required: true, estimatedTime: 5 },
          { item: 'Clean print heads (inkjet only)', required: false, estimatedTime: 10 },
          { item: 'Test print quality and alignment', required: true, estimatedTime: 10 },
          { item: 'Check connectivity and network settings', required: true, estimatedTime: 15 },
          { item: 'Clear any error codes or warnings', required: true, estimatedTime: 10 }
        ],
        
        requiredParts: [
          { partName: 'Cleaning Cartridge', quantity: 1, optional: true },
          { partName: 'Paper Feed Rollers', quantity: 1, optional: true }
        ],
        
        requiredSkills: ['printer_maintenance', 'network_troubleshoot'],
        safetyRequirements: ['handle_cartridges_carefully'],
        
        isActive: true,
        usageCount: 28,
        lastUsed: new Date('2025-01-18'),
        createdAt: new Date('2024-07-01')
      },
      {
        id: 'template-3',
        templateName: 'High-Volume Copier Deep Service',
        description: 'Comprehensive deep maintenance for high-volume production copiers',
        equipmentTypes: ['production_copier'],
        estimatedDuration: 240,
        frequency: 'bi_annual',
        
        checklist: [
          { item: 'Complete paper path disassembly and cleaning', required: true, estimatedTime: 45 },
          { item: 'Replace all consumable parts', required: true, estimatedTime: 60 },
          { item: 'Calibrate color registration and density', required: true, estimatedTime: 30 },
          { item: 'Lubricate all moving parts', required: true, estimatedTime: 30 },
          { item: 'Test all sensors and switches', required: true, estimatedTime: 25 },
          { item: 'Update software and firmware', required: true, estimatedTime: 20 },
          { item: 'Perform full diagnostic test cycle', required: true, estimatedTime: 30 }
        ],
        
        requiredParts: [
          { partName: 'Complete Consumables Kit', quantity: 1, optional: false },
          { partName: 'Lubrication Kit', quantity: 1, optional: false },
          { partName: 'Sensor Cleaning Kit', quantity: 1, optional: false }
        ],
        
        requiredSkills: ['advanced_copier_service', 'production_equipment'],
        safetyRequirements: ['lockout_tagout', 'specialized_tools_required'],
        
        isActive: true,
        usageCount: 12,
        lastUsed: new Date('2025-01-10'),
        createdAt: new Date('2024-05-20')
      }
    ];

    res.json(templates);
    
  } catch (error) {
    console.error('Error fetching maintenance templates:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance templates' });
  }
});

// Auto-generate maintenance schedules
router.post('/api/maintenance/auto-generate', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { equipmentIds, templateId, startDate, frequency } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample auto-generation result
    const generatedSchedules = equipmentIds.map((equipmentId: string, index: number) => ({
      id: `auto-schedule-${Date.now()}-${index}`,
      equipmentId,
      templateId,
      frequency,
      nextDueDate: new Date(Date.now() + (30 + index * 7) * 24 * 60 * 60 * 1000), // Stagger by week
      autoScheduleEnabled: true,
      status: 'pending',
      createdAt: new Date(),
      estimatedCostSavings: Math.floor(Math.random() * 300) + 200
    }));

    res.json({
      message: `Successfully generated ${generatedSchedules.length} maintenance schedules`,
      schedules: generatedSchedules,
      totalEquipment: equipmentIds.length,
      estimatedAnnualSavings: generatedSchedules.reduce((sum, s) => sum + s.estimatedCostSavings, 0) * 12
    });
    
  } catch (error) {
    console.error('Error auto-generating maintenance schedules:', error);
    res.status(500).json({ message: 'Failed to auto-generate maintenance schedules' });
  }
});

// Update maintenance schedule
router.put('/api/maintenance/schedules/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // For now, return success response until schema is updated
    res.json({
      message: 'Maintenance schedule updated successfully',
      id,
      ...updateData,
      updatedAt: new Date()
    });
    
  } catch (error) {
    console.error('Error updating maintenance schedule:', error);
    res.status(500).json({ message: 'Failed to update maintenance schedule' });
  }
});

// Get predictive maintenance recommendations
router.get('/api/maintenance/predictions', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample predictive maintenance data
    const predictions = [
      {
        equipmentId: 'eq-005',
        model: 'Canon imageRUNNER ADVANCE DX C7765i',
        customer: 'Gamma Solutions',
        location: 'Building A, Floor 3',
        
        prediction: {
          riskLevel: 'high',
          failureProbability: 78,
          predictedComponent: 'Fuser Unit',
          timeToFailure: 14, // days
          confidence: 87 // percentage
        },
        
        recommendation: {
          action: 'immediate_service',
          priority: 'urgent',
          estimatedCost: 485,
          preventiveCost: 320,
          reactiveCost: 750,
          potentialSavings: 430
        },
        
        dataPoints: {
          currentMeterReading: 87540,
          averageMonthlyVolume: 12500,
          lastServiceDate: new Date('2024-10-15'),
          errorFrequency: 'increasing',
          performanceMetrics: {
            printQuality: 'declining',
            speedReduction: '15%',
            jamFrequency: 'high'
          }
        },
        
        historicalPattern: [
          { date: '2024-12', issues: 2, performance: 95 },
          { date: '2025-01', issues: 5, performance: 87 },
          { date: '2025-02', issues: 3, performance: 92 }
        ]
      },
      {
        equipmentId: 'eq-008',
        model: 'Xerox VersaLink B400',
        customer: 'Theta Corp',
        location: 'Main Office',
        
        prediction: {
          riskLevel: 'medium',
          failureProbability: 45,
          predictedComponent: 'Drum Unit',
          timeToFailure: 30,
          confidence: 72
        },
        
        recommendation: {
          action: 'schedule_service',
          priority: 'medium',
          estimatedCost: 280,
          preventiveCost: 180,
          reactiveCost: 420,
          potentialSavings: 240
        },
        
        dataPoints: {
          currentMeterReading: 34200,
          averageMonthlyVolume: 8500,
          lastServiceDate: new Date('2024-11-20'),
          errorFrequency: 'stable',
          performanceMetrics: {
            printQuality: 'good',
            speedReduction: '5%',
            jamFrequency: 'low'
          }
        },
        
        historicalPattern: [
          { date: '2024-12', issues: 1, performance: 98 },
          { date: '2025-01', issues: 2, performance: 94 },
          { date: '2025-02', issues: 1, performance: 96 }
        ]
      }
    ];

    res.json(predictions);
    
  } catch (error) {
    console.error('Error fetching predictive maintenance:', error);
    res.status(500).json({ message: 'Failed to fetch predictive maintenance' });
  }
});

export default router;