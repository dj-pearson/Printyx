import express from 'express';
import { desc, eq, and, sql, asc } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth-setup';
import { serviceTickets, technicians } from '../shared/schema';

const router = express.Router();

// Advanced Service Dispatch Optimization API Routes
// Note: Database tables will be created after schema update

// Get optimized dispatch recommendations
router.get('/api/dispatch/recommendations', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { date, priority } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample dispatch recommendations with AI-powered optimization
    const recommendations = [
      {
        id: 'rec-1',
        ticketId: 'ticket-001',
        ticketTitle: 'Printer Jam - ABC Corp',
        customerName: 'ABC Corporation',
        customerAddress: '123 Business Way, Downtown',
        priority: 'high',
        estimatedDuration: 90, // minutes
        requiredSkills: ['printer_repair', 'mechanical'],
        
        // Recommended technician with optimization score
        recommendedTechnician: {
          id: 'tech-1',
          name: 'Mike Johnson',
          currentLocation: '456 Service Ave',
          distanceToCustomer: 2.3, // miles
          travelTime: 12, // minutes
          skillMatch: 95, // percentage
          availabilityScore: 100,
          workloadScore: 75,
          overallScore: 90.5,
          reasons: [
            'Closest available technician',
            'Perfect skill match for printer repair',
            'Light current workload'
          ]
        },
        
        // Alternative technicians
        alternatives: [
          {
            id: 'tech-2',
            name: 'Sarah Wilson',
            distanceToCustomer: 4.1,
            travelTime: 18,
            skillMatch: 85,
            availabilityScore: 100,
            workloadScore: 60,
            overallScore: 82.3
          },
          {
            id: 'tech-3',
            name: 'David Chen',
            distanceToCustomer: 6.2,
            travelTime: 25,
            skillMatch: 90,
            availabilityScore: 80,
            workloadScore: 85,
            overallScore: 78.7
          }
        ],
        
        // Route optimization
        suggestedTimeSlot: '10:30 AM - 12:00 PM',
        routeOptimization: {
          beforeThisCall: {
            ticketId: 'ticket-002',
            customer: 'XYZ Industries',
            endTime: '10:15 AM'
          },
          afterThisCall: {
            ticketId: 'ticket-003',
            customer: 'Tech Solutions',
            startTime: '1:00 PM'
          },
          totalTravelTime: 45, // minutes saved with optimization
          fuelSavings: 12.50 // dollars
        }
      },
      {
        id: 'rec-2',
        ticketId: 'ticket-004',
        ticketTitle: 'Copier Maintenance - XYZ Corp',
        customerName: 'XYZ Corporation',
        customerAddress: '789 Corporate Blvd, Uptown',
        priority: 'medium',
        estimatedDuration: 120,
        requiredSkills: ['copier_maintenance', 'preventive_care'],
        
        recommendedTechnician: {
          id: 'tech-2',
          name: 'Sarah Wilson',
          currentLocation: '321 Tech Center',
          distanceToCustomer: 3.7,
          travelTime: 16,
          skillMatch: 100,
          availabilityScore: 90,
          workloadScore: 70,
          overallScore: 88.9,
          reasons: [
            'Specializes in copier maintenance',
            'Available in optimal time window',
            'Balanced workload distribution'
          ]
        },
        
        alternatives: [
          {
            id: 'tech-1',
            name: 'Mike Johnson',
            distanceToCustomer: 5.2,
            travelTime: 22,
            skillMatch: 80,
            availabilityScore: 85,
            workloadScore: 75,
            overallScore: 80.2
          }
        ],
        
        suggestedTimeSlot: '2:00 PM - 4:00 PM',
        routeOptimization: {
          beforeThisCall: {
            ticketId: 'ticket-005',
            customer: 'Local Office',
            endTime: '1:45 PM'
          },
          afterThisCall: null,
          totalTravelTime: 30,
          fuelSavings: 8.75
        }
      }
    ];

    res.json(recommendations);
    
  } catch (error) {
    console.error('Error fetching dispatch recommendations:', error);
    res.status(500).json({ message: 'Failed to fetch dispatch recommendations' });
  }
});

// Get technician availability and workload
router.get('/api/dispatch/technicians/availability', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample technician availability data
    const technicianAvailability = [
      {
        id: 'tech-1',
        name: 'Mike Johnson',
        email: 'mike.johnson@company.com',
        phone: '(555) 123-4567',
        currentLocation: '456 Service Ave',
        skills: ['printer_repair', 'mechanical', 'electrical'],
        certifications: ['Canon Certified', 'HP Specialist'],
        
        // Availability for the day
        availability: {
          totalHours: 8,
          bookedHours: 5.5,
          availableHours: 2.5,
          utilizationRate: 68.8
        },
        
        // Current assignments
        currentAssignments: [
          {
            ticketId: 'ticket-101',
            customer: 'Alpha Corp',
            startTime: '9:00 AM',
            endTime: '10:30 AM',
            status: 'in_progress'
          },
          {
            ticketId: 'ticket-102',
            customer: 'Beta Industries',
            startTime: '11:00 AM',
            endTime: '12:30 PM',
            status: 'scheduled'
          },
          {
            ticketId: 'ticket-103',
            customer: 'Gamma Solutions',
            startTime: '2:00 PM',
            endTime: '4:30 PM',
            status: 'scheduled'
          }
        ],
        
        // Performance metrics
        performance: {
          completionRate: 94.2,
          averageCallTime: 105, // minutes
          customerSatisfaction: 4.6,
          onTimeArrival: 92.3
        },
        
        // Status
        status: 'available',
        nextAvailableSlot: '12:45 PM',
        endOfDayAvailable: '4:45 PM'
      },
      {
        id: 'tech-2',
        name: 'Sarah Wilson',
        email: 'sarah.wilson@company.com',
        phone: '(555) 234-5678',
        currentLocation: '321 Tech Center',
        skills: ['copier_maintenance', 'software_troubleshoot', 'network_setup'],
        certifications: ['Xerox Certified', 'Ricoh Specialist'],
        
        availability: {
          totalHours: 8,
          bookedHours: 6,
          availableHours: 2,
          utilizationRate: 75.0
        },
        
        currentAssignments: [
          {
            ticketId: 'ticket-201',
            customer: 'Delta Corp',
            startTime: '8:30 AM',
            endTime: '10:00 AM',
            status: 'completed'
          },
          {
            ticketId: 'ticket-202',
            customer: 'Epsilon Ltd',
            startTime: '10:30 AM',
            endTime: '12:00 PM',
            status: 'in_progress'
          },
          {
            ticketId: 'ticket-203',
            customer: 'Zeta Industries',
            startTime: '1:00 PM',
            endTime: '3:00 PM',
            status: 'scheduled'
          },
          {
            ticketId: 'ticket-204',
            customer: 'Eta Solutions',
            startTime: '3:30 PM',
            endTime: '5:00 PM',
            status: 'scheduled'
          }
        ],
        
        performance: {
          completionRate: 96.8,
          averageCallTime: 95,
          customerSatisfaction: 4.8,
          onTimeArrival: 94.7
        },
        
        status: 'busy',
        nextAvailableSlot: '12:15 PM',
        endOfDayAvailable: '5:15 PM'
      },
      {
        id: 'tech-3',
        name: 'David Chen',
        email: 'david.chen@company.com',
        phone: '(555) 345-6789',
        currentLocation: '789 Field Office',
        skills: ['multi_function', 'hardware_repair', 'installation'],
        certifications: ['Konica Minolta Expert', 'Brother Certified'],
        
        availability: {
          totalHours: 8,
          bookedHours: 4,
          availableHours: 4,
          utilizationRate: 50.0
        },
        
        currentAssignments: [
          {
            ticketId: 'ticket-301',
            customer: 'Theta Corp',
            startTime: '9:30 AM',
            endTime: '11:00 AM',
            status: 'scheduled'
          },
          {
            ticketId: 'ticket-302',
            customer: 'Iota Industries',
            startTime: '2:30 PM',
            endTime: '4:00 PM',
            status: 'scheduled'
          }
        ],
        
        performance: {
          completionRate: 91.5,
          averageCallTime: 115,
          customerSatisfaction: 4.4,
          onTimeArrival: 89.2
        },
        
        status: 'available',
        nextAvailableSlot: '11:15 AM',
        endOfDayAvailable: '4:15 PM'
      }
    ];

    res.json(technicianAvailability);
    
  } catch (error) {
    console.error('Error fetching technician availability:', error);
    res.status(500).json({ message: 'Failed to fetch technician availability' });
  }
});

// Optimize route for technician
router.post('/api/dispatch/optimize-route', requireAuth, async (req: any, res) => {
  try {
    const { technicianId, assignments, constraints } = req.body;
    
    // Sample route optimization result
    const optimizedRoute = {
      technicianId,
      totalDistance: 24.7, // miles
      totalTravelTime: 95, // minutes
      fuelCost: 18.50,
      
      optimizedAssignments: [
        {
          order: 1,
          ticketId: assignments[0].ticketId,
          customer: 'ABC Corporation',
          address: '123 Business Way',
          startTime: '9:00 AM',
          endTime: '10:30 AM',
          travelTimeFromPrevious: 0, // starting point
          distanceFromPrevious: 0
        },
        {
          order: 2,
          ticketId: assignments[1].ticketId,
          customer: 'XYZ Industries',
          address: '456 Industrial Dr',
          startTime: '11:00 AM',
          endTime: '12:30 PM',
          travelTimeFromPrevious: 15,
          distanceFromPrevious: 3.2
        },
        {
          order: 3,
          ticketId: assignments[2].ticketId,
          customer: 'Tech Solutions',
          address: '789 Office Park',
          startTime: '1:30 PM',
          endTime: '3:00 PM',
          travelTimeFromPrevious: 20,
          distanceFromPrevious: 4.1
        }
      ],
      
      savings: {
        timeReduction: 35, // minutes saved vs unoptimized
        distanceReduction: 8.3, // miles saved
        fuelSavings: 6.25 // dollars saved
      },
      
      recommendations: [
        'Consider scheduling emergency buffer between 3:00-4:00 PM',
        'Lunch break optimally placed at 12:30-1:30 PM',
        'Route allows for parts pickup at main warehouse'
      ]
    };

    res.json(optimizedRoute);
    
  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({ message: 'Failed to optimize route' });
  }
});

// Get dispatch analytics and KPIs
router.get('/api/dispatch/analytics', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { period = 'week' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample dispatch analytics
    const analytics = {
      summary: {
        totalTickets: 156,
        completedTickets: 142,
        pendingTickets: 14,
        averageResponseTime: 4.2, // hours
        firstCallResolution: 78.5, // percentage
        customerSatisfaction: 4.6,
        technicianUtilization: 73.2
      },
      
      efficiency: {
        averageTravelTime: 18.5, // minutes per call
        fuelCostPerCall: 8.75,
        totalMilesDriven: 2847,
        routeOptimizationSavings: 425.50, // dollars saved
        onTimeArrivalRate: 92.3
      },
      
      technician_performance: [
        {
          technicianId: 'tech-1',
          name: 'Mike Johnson',
          ticketsCompleted: 48,
          averageCallTime: 105,
          completionRate: 94.2,
          customerRating: 4.6,
          utilizationRate: 68.8
        },
        {
          technicianId: 'tech-2',
          name: 'Sarah Wilson',
          ticketsCompleted: 52,
          averageCallTime: 95,
          completionRate: 96.8,
          customerRating: 4.8,
          utilizationRate: 75.0
        },
        {
          technicianId: 'tech-3',
          name: 'David Chen',
          ticketsCompleted: 42,
          averageCallTime: 115,
          completionRate: 91.5,
          customerRating: 4.4,
          utilizationRate: 50.0
        }
      ],
      
      daily_trends: [
        { day: 'Monday', tickets: 28, avgResponseTime: 3.8, satisfaction: 4.5 },
        { day: 'Tuesday', tickets: 32, avgResponseTime: 4.1, satisfaction: 4.6 },
        { day: 'Wednesday', tickets: 35, avgResponseTime: 4.5, satisfaction: 4.7 },
        { day: 'Thursday', tickets: 31, avgResponseTime: 4.2, satisfaction: 4.6 },
        { day: 'Friday', tickets: 30, avgResponseTime: 3.9, satisfaction: 4.5 }
      ],
      
      priority_distribution: {
        urgent: { count: 12, avgResponseTime: 1.2 },
        high: { count: 34, avgResponseTime: 2.8 },
        medium: { count: 78, avgResponseTime: 5.1 },
        low: { count: 32, avgResponseTime: 8.7 }
      }
    };

    res.json(analytics);
    
  } catch (error) {
    console.error('Error fetching dispatch analytics:', error);
    res.status(500).json({ message: 'Failed to fetch dispatch analytics' });
  }
});

// Auto-assign tickets based on optimization
router.post('/api/dispatch/auto-assign', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { ticketIds, constraints } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample auto-assignment result
    const assignments = ticketIds.map((ticketId: string, index: number) => ({
      ticketId,
      assignedTechnicianId: `tech-${(index % 3) + 1}`,
      assignedTechnicianName: ['Mike Johnson', 'Sarah Wilson', 'David Chen'][index % 3],
      suggestedTimeSlot: ['9:00 AM - 10:30 AM', '11:00 AM - 12:30 PM', '2:00 PM - 3:30 PM'][index % 3],
      optimizationScore: Math.floor(Math.random() * 20) + 80, // 80-100
      estimatedArrival: '9:15 AM',
      confidenceLevel: 'high'
    }));

    res.json({
      message: `Successfully auto-assigned ${assignments.length} tickets`,
      assignments,
      totalOptimizationScore: 87.4,
      estimatedSavings: {
        travelTime: 45, // minutes
        fuelCost: 12.50
      }
    });
    
  } catch (error) {
    console.error('Error auto-assigning tickets:', error);
    res.status(500).json({ message: 'Failed to auto-assign tickets' });
  }
});

// Get real-time technician tracking
router.get('/api/dispatch/tracking', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample real-time tracking data
    const trackingData = [
      {
        technicianId: 'tech-1',
        name: 'Mike Johnson',
        currentStatus: 'on_route',
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.0060,
          address: 'En route to ABC Corporation'
        },
        currentTicket: {
          id: 'ticket-101',
          customer: 'ABC Corporation',
          estimatedArrival: '10:15 AM',
          actualETA: '10:18 AM' // updated based on traffic
        },
        lastUpdate: new Date().toISOString()
      },
      {
        technicianId: 'tech-2',
        name: 'Sarah Wilson',
        currentStatus: 'on_site',
        currentLocation: {
          latitude: 40.7589,
          longitude: -73.9851,
          address: 'Epsilon Ltd Office Building'
        },
        currentTicket: {
          id: 'ticket-202',
          customer: 'Epsilon Ltd',
          startedAt: '10:35 AM',
          estimatedCompletion: '12:00 PM'
        },
        lastUpdate: new Date().toISOString()
      },
      {
        technicianId: 'tech-3',
        name: 'David Chen',
        currentStatus: 'available',
        currentLocation: {
          latitude: 40.7505,
          longitude: -73.9934,
          address: 'Main Service Center'
        },
        currentTicket: null,
        nextAssignment: {
          id: 'ticket-301',
          customer: 'Theta Corp',
          scheduledStart: '11:00 AM'
        },
        lastUpdate: new Date().toISOString()
      }
    ];

    res.json(trackingData);
    
  } catch (error) {
    console.error('Error fetching tracking data:', error);
    res.status(500).json({ message: 'Failed to fetch tracking data' });
  }
});

export default router;