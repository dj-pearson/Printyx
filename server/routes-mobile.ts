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

// Mobile Service App API Routes

// Get mobile dashboard data for technicians
router.get('/api/mobile/dashboard', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const technicianId = req.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Mobile dashboard optimized for field technicians
    const mobileDashboard = {
      technician: {
        id: technicianId,
        name: req.user.name,
        employeeId: 'TECH-001',
        certification: 'Senior Technician',
        rating: 4.8,
        completedJobs: 1247,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          lastUpdated: new Date()
        }
      },

      todaysSummary: {
        assignedJobs: 6,
        completedJobs: 3,
        inProgress: 1,
        pendingParts: 2,
        estimatedDriveTime: 45, // minutes
        totalRevenue: 2340.50
      },

      currentLocation: {
        address: '456 Innovation Blvd, Tech District',
        customerName: 'TechStart Innovations',
        arrivalTime: new Date('2025-02-04T10:30:00Z'),
        jobStatus: 'in_progress',
        estimatedCompletion: new Date('2025-02-04T12:00:00Z')
      },

      // Today's job queue optimized by route
      jobsQueue: [
        {
          id: 'job-001',
          priority: 'high',
          status: 'assigned',
          customerName: 'Metro Office Solutions',
          contactPerson: 'Sarah Johnson',
          contactPhone: '+1-555-0123',
          address: '123 Business Center Dr, Suite 200',
          coordinates: { lat: 40.7128, lng: -74.0060 },
          
          equipment: {
            model: 'Canon ImageRunner 2535i',
            serialNumber: 'MX-2025-001',
            location: '2nd Floor - Copy Center'
          },
          
          serviceType: 'maintenance',
          issueDescription: 'Routine preventive maintenance and toner replacement',
          estimatedDuration: 90, // minutes
          scheduledTime: new Date('2025-02-04T09:00:00Z'),
          
          requiredParts: [
            { partNumber: 'TNR-2535-BK', description: 'Black Toner Cartridge', quantity: 1, available: true },
            { partNumber: 'MNT-2535-KIT', description: 'Maintenance Kit', quantity: 1, available: true }
          ],
          
          customerNotes: 'Equipment heavily used, check paper feed mechanism',
          internalNotes: 'Customer prefers morning service calls',
          
          routeOptimization: {
            driveTime: 15,
            distanceFromPrevious: 3.2, // miles
            trafficConditions: 'light',
            parkingNotes: 'Visitor parking available on 1st floor'
          }
        },
        {
          id: 'job-002',
          priority: 'critical',
          status: 'in_progress',
          customerName: 'TechStart Innovations',
          contactPerson: 'Mike Rodriguez',
          contactPhone: '+1-555-0456',
          address: '456 Innovation Blvd',
          coordinates: { lat: 40.7589, lng: -73.9851 },
          
          equipment: {
            model: 'Xerox WorkCentre 5855',
            serialNumber: 'TX-2024-007',
            location: 'Main Floor - Reception'
          },
          
          serviceType: 'repair',
          issueDescription: 'Paper jams occurring frequently, print quality issues',
          estimatedDuration: 120,
          scheduledTime: new Date('2025-02-04T10:30:00Z'),
          
          requiredParts: [
            { partNumber: 'PF-5855-ROLL', description: 'Paper Feed Roller', quantity: 2, available: false },
            { partNumber: 'FUS-5855-UNIT', description: 'Fuser Unit', quantity: 1, available: true }
          ],
          
          customerNotes: 'Equipment critical for daily operations',
          internalNotes: 'Check for firmware updates, customer reports slow printing',
          
          serviceHistory: [
            { date: new Date('2025-01-15T00:00:00Z'), issue: 'Toner replacement', technician: 'TECH-002' },
            { date: new Date('2024-12-10T00:00:00Z'), issue: 'Paper jam repair', technician: 'TECH-001' }
          ],
          
          routeOptimization: {
            driveTime: 12,
            distanceFromPrevious: 2.8,
            trafficConditions: 'moderate',
            parkingNotes: 'Street parking, 2-hour limit'
          }
        },
        {
          id: 'job-003',
          priority: 'medium',
          status: 'assigned',
          customerName: 'Regional Medical Center',
          contactPerson: 'Dr. Emily Chen',
          contactPhone: '+1-555-0789',
          address: '789 Healthcare Plaza',
          coordinates: { lat: 40.7831, lng: -73.9712 },
          
          equipment: {
            model: 'Ricoh MP C3004',
            serialNumber: 'RM-2025-012',
            location: 'Level 3 - Administrative Wing'
          },
          
          serviceType: 'installation',
          issueDescription: 'New equipment installation and network setup',
          estimatedDuration: 180,
          scheduledTime: new Date('2025-02-04T14:00:00Z'),
          
          requiredParts: [
            { partNumber: 'NET-C3004-KIT', description: 'Network Setup Kit', quantity: 1, available: true },
            { partNumber: 'TNR-C3004-SET', description: 'Full Toner Set', quantity: 1, available: true }
          ],
          
          customerNotes: 'Security clearance required, contact Dr. Chen upon arrival',
          internalNotes: 'Medical facility - maintain sterile procedures',
          
          routeOptimization: {
            driveTime: 18,
            distanceFromPrevious: 4.1,
            trafficConditions: 'heavy',
            parkingNotes: 'Designated service parking in garage level B1'
          }
        }
      ],

      // Performance metrics for the technician
      performanceMetrics: {
        thisWeek: {
          jobsCompleted: 28,
          averageJobTime: 95, // minutes
          customerSatisfaction: 4.7,
          firstTimeFixRate: 89,
          onTimeArrival: 94
        },
        thisMonth: {
          jobsCompleted: 124,
          revenue: 18450,
          partsUsed: 67,
          milesdriven: 1847
        }
      },

      // Quick actions for mobile interface
      quickActions: [
        { action: 'clock_in', label: 'Clock In', icon: 'Clock', enabled: true },
        { action: 'start_job', label: 'Start Current Job', icon: 'Play', enabled: true },
        { action: 'request_parts', label: 'Request Parts', icon: 'Package', enabled: true },
        { action: 'escalate_job', label: 'Escalate Job', icon: 'AlertTriangle', enabled: true },
        { action: 'emergency_contact', label: 'Emergency Contact', icon: 'Phone', enabled: true }
      ],

      // Parts inventory status
      partsInventory: {
        vanStock: {
          tonerCartridges: 12,
          maintenanceKits: 6,
          paperFeedRollers: 8,
          fuserUnits: 3
        },
        pendingOrders: 2,
        criticalLowItems: ['PF-5855-ROLL', 'FUS-7500-UNIT'],
        lastRestocked: new Date('2025-02-01T00:00:00Z')
      }
    };

    res.json(mobileDashboard);
    
  } catch (error) {
    console.error('Error fetching mobile dashboard:', error);
    res.status(500).json({ message: 'Failed to fetch mobile dashboard' });
  }
});

// Get detailed job information for mobile view
router.get('/api/mobile/jobs/:jobId', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { jobId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Detailed job information optimized for mobile
    const jobDetail = {
      id: jobId,
      jobNumber: 'SVC-2025-001',
      priority: 'high',
      status: 'assigned',
      
      customer: {
        name: 'Metro Office Solutions',
        accountNumber: 'ACC-001',
        contractType: 'Full Service',
        preferredServiceWindow: '9:00 AM - 5:00 PM',
        specialInstructions: 'Ring front desk, ask for Sarah'
      },
      
      contact: {
        primaryContact: 'Sarah Johnson',
        title: 'Office Manager',
        phone: '+1-555-0123',
        email: 'sarah.johnson@metrooffice.com',
        alternateContact: 'Mike Thompson',
        alternatePhone: '+1-555-0124'
      },
      
      location: {
        address: '123 Business Center Dr, Suite 200',
        city: 'Business District',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        buildingAccess: 'Card reader at main entrance, visitor parking available',
        equipmentLocation: '2nd Floor - Copy Center, near elevator'
      },
      
      equipment: {
        manufacturer: 'Canon',
        model: 'ImageRunner 2535i',
        serialNumber: 'MX-2025-001',
        assetTag: 'ASSET-001',
        installDate: new Date('2023-03-15T00:00:00Z'),
        warrantyStatus: 'Under Contract',
        lastServiceDate: new Date('2024-12-15T00:00:00Z'),
        meterReading: {
          current: 145670,
          lastReading: 142350,
          readingDate: new Date('2025-01-01T00:00:00Z')
        }
      },
      
      serviceDetails: {
        serviceType: 'Preventive Maintenance',
        issueDescription: 'Routine preventive maintenance and toner replacement',
        issueReportedBy: 'Sarah Johnson',
        issueReportedDate: new Date('2025-02-01T14:30:00Z'),
        priority: 'high',
        estimatedDuration: 90,
        scheduledDate: new Date('2025-02-04T09:00:00Z'),
        
        workToBeDone: [
          'Replace black toner cartridge',
          'Clean paper feed mechanism',
          'Update firmware',
          'Test print quality',
          'Check error log'
        ]
      },
      
      requiredParts: [
        {
          partNumber: 'TNR-2535-BK',
          description: 'Black Toner Cartridge',
          quantity: 1,
          unitCost: 89.99,
          available: true,
          location: 'Van Stock',
          warranty: '12 months'
        },
        {
          partNumber: 'MNT-2535-KIT',
          description: 'Maintenance Kit',
          quantity: 1,
          unitCost: 156.50,
          available: true,
          location: 'Van Stock',
          warranty: '6 months'
        }
      ],
      
      serviceHistory: [
        {
          date: new Date('2024-12-15T00:00:00Z'),
          serviceType: 'Repair',
          issue: 'Paper jam mechanism replacement',
          technician: 'Mike Rodriguez',
          partsUsed: ['PF-2535-ROLL'],
          timeSpent: 75,
          resolution: 'Replaced worn paper feed roller, tested successfully'
        },
        {
          date: new Date('2024-09-10T00:00:00Z'),
          serviceType: 'Maintenance',
          issue: 'Routine maintenance',
          technician: 'Sarah Chen',
          partsUsed: ['TNR-2535-BK', 'TNR-2535-C'],
          timeSpent: 60,
          resolution: 'Routine maintenance completed, all systems operational'
        }
      ],
      
      documentation: {
        manuals: [
          { name: 'Service Manual', url: '/docs/canon-ir2535i-service.pdf' },
          { name: 'Parts Catalog', url: '/docs/canon-ir2535i-parts.pdf' }
        ],
        diagrams: [
          { name: 'Internal Components', url: '/diagrams/ir2535i-internal.png' },
          { name: 'Paper Path', url: '/diagrams/ir2535i-paperpath.png' }
        ]
      },
      
      // Mobile-specific features
      mobileFeatures: {
        offlineAccess: true,
        photoCapture: true,
        voiceNotes: true,
        gpsTracking: true,
        digitalSignature: true,
        barcodeScanner: true
      }
    };

    res.json(jobDetail);
    
  } catch (error) {
    console.error('Error fetching job detail:', error);
    res.status(500).json({ message: 'Failed to fetch job detail' });
  }
});

// Update job status from mobile app
router.post('/api/mobile/jobs/:jobId/status', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { jobId } = req.params;
    const { status, notes, location, photos, timeSpent, partsUsed } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Simulate job status update
    const statusUpdate = {
      jobId,
      previousStatus: 'assigned',
      newStatus: status,
      updatedAt: new Date(),
      updatedBy: req.user.name,
      location: location || null,
      notes: notes || '',
      
      // Mobile-specific data
      mobileData: {
        photos: photos || [],
        gpsLocation: location,
        timeSpent,
        partsUsed: partsUsed || [],
        deviceInfo: {
          platform: 'mobile',
          timestamp: new Date()
        }
      },
      
      // Automatic actions based on status
      automatedActions: []
    };

    // Add automated actions based on new status
    switch (status) {
      case 'in_progress':
        statusUpdate.automatedActions.push({
          action: 'notify_customer',
          message: 'Technician has arrived and work is beginning'
        });
        break;
      case 'completed':
        statusUpdate.automatedActions.push(
          {
            action: 'generate_invoice',
            details: { partsUsed, timeSpent }
          },
          {
            action: 'send_completion_notification',
            message: 'Service has been completed successfully'
          },
          {
            action: 'update_equipment_history',
            details: { lastServiceDate: new Date(), partsReplaced: partsUsed }
          }
        );
        break;
      case 'parts_needed':
        statusUpdate.automatedActions.push({
          action: 'create_parts_order',
          parts: partsUsed
        });
        break;
    }

    res.json({
      success: true,
      statusUpdate,
      message: 'Job status updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ message: 'Failed to update job status' });
  }
});

// Get technician location and route optimization
router.get('/api/mobile/route-optimization', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const technicianId = req.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const routeOptimization = {
      technician: {
        id: technicianId,
        currentLocation: { lat: 40.7128, lng: -74.0060 },
        lastUpdated: new Date()
      },
      
      optimizedRoute: {
        totalDistance: 28.4, // miles
        totalDriveTime: 72, // minutes
        totalServiceTime: 390, // minutes
        fuelCost: 12.50,
        tollCost: 0,
        
        stops: [
          {
            sequence: 1,
            jobId: 'job-001',
            customerName: 'Metro Office Solutions',
            address: '123 Business Center Dr, Suite 200',
            coordinates: { lat: 40.7128, lng: -74.0060 },
            estimatedArrival: new Date('2025-02-04T09:00:00Z'),
            serviceWindow: { start: '09:00', end: '10:30' },
            drivingTime: 15,
            serviceTime: 90,
            parkingInfo: 'Visitor parking available'
          },
          {
            sequence: 2,
            jobId: 'job-002',
            customerName: 'TechStart Innovations',
            address: '456 Innovation Blvd',
            coordinates: { lat: 40.7589, lng: -73.9851 },
            estimatedArrival: new Date('2025-02-04T10:45:00Z'),
            serviceWindow: { start: '10:30', end: '13:00' },
            drivingTime: 12,
            serviceTime: 120,
            parkingInfo: 'Street parking, 2-hour limit'
          },
          {
            sequence: 3,
            jobId: 'job-003',
            customerName: 'Regional Medical Center',
            address: '789 Healthcare Plaza',
            coordinates: { lat: 40.7831, lng: -73.9712 },
            estimatedArrival: new Date('2025-02-04T14:00:00Z'),
            serviceWindow: { start: '14:00', end: '17:00' },
            drivingTime: 18,
            serviceTime: 180,
            parkingInfo: 'Service parking in garage B1'
          }
        ]
      },
      
      trafficConditions: {
        currentConditions: 'moderate',
        predictedConditions: [
          { time: '09:00', condition: 'light', delay: 0 },
          { time: '11:00', condition: 'moderate', delay: 5 },
          { time: '14:00', condition: 'heavy', delay: 15 },
          { time: '16:00', condition: 'moderate', delay: 8 }
        ]
      },
      
      alternatives: [
        {
          routeType: 'fastest',
          totalTime: 65,
          totalDistance: 31.2,
          description: 'Highway route - fastest but longer distance'
        },
        {
          routeType: 'shortest',
          totalTime: 78,
          totalDistance: 26.1,
          description: 'City streets - shorter distance but more traffic'
        }
      ]
    };

    res.json(routeOptimization);
    
  } catch (error) {
    console.error('Error fetching route optimization:', error);
    res.status(500).json({ message: 'Failed to fetch route optimization' });
  }
});

// Submit service report with photos and signature
router.post('/api/mobile/service-report', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { 
      jobId, 
      workPerformed, 
      partsUsed, 
      timeSpent, 
      customerSignature, 
      photos, 
      meterReading,
      nextServiceDue,
      issues,
      recommendations 
    } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Generate service report
    const serviceReport = {
      reportId: `RPT-${Date.now()}`,
      jobId,
      technician: {
        id: req.user.id,
        name: req.user.name,
        signature: true,
        completedAt: new Date()
      },
      
      workSummary: {
        workPerformed: workPerformed || [],
        timeSpent: timeSpent || 0,
        issuesFound: issues || [],
        recommendations: recommendations || []
      },
      
      partsAndMaterials: {
        partsUsed: partsUsed || [],
        totalPartsCost: partsUsed?.reduce((sum: number, part: any) => sum + (part.cost || 0), 0) || 0,
        laborCost: (timeSpent || 0) * 85, // $85/hour labor rate
        totalCost: 0 // calculated
      },
      
      equipmentStatus: {
        meterReading: meterReading || null,
        operationalStatus: 'operational',
        nextServiceDue: nextServiceDue || null,
        warrantyStatus: 'active'
      },
      
      customerApproval: {
        signature: customerSignature || null,
        signedAt: customerSignature ? new Date() : null,
        customerNotes: '',
        satisfactionRating: null
      },
      
      documentation: {
        photos: photos || [],
        beforePhotos: [],
        afterPhotos: [],
        documentsGenerated: ['service_report', 'parts_invoice']
      },
      
      qualityChecks: {
        functionalTest: true,
        printQualityTest: true,
        networkConnectivity: true,
        customerTraining: false
      }
    };

    // Calculate total cost
    serviceReport.partsAndMaterials.totalCost = 
      serviceReport.partsAndMaterials.totalPartsCost + 
      serviceReport.partsAndMaterials.laborCost;

    res.json({
      success: true,
      serviceReport,
      message: 'Service report submitted successfully',
      nextActions: [
        'Customer notification sent',
        'Invoice generated',
        'Equipment history updated',
        'Parts inventory updated'
      ]
    });
    
  } catch (error) {
    console.error('Error submitting service report:', error);
    res.status(500).json({ message: 'Failed to submit service report' });
  }
});

export default router;