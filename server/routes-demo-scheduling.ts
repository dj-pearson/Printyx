import express from 'express';
import { desc, eq, and, sql, asc } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './auth-setup';
import { businessRecords } from '../shared/schema';

const router = express.Router();

// Demo Scheduling API Routes
// Note: Database tables will be created after schema update

// Get all scheduled demos
router.get('/api/demos', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // For now, return sample demo data structure until schema is updated
    const sampleDemos = [
      {
        id: 'demo-1',
        businessRecordId: 'customer-1',
        customerName: 'ABC Corporation',
        contactPerson: 'John Smith',
        scheduledDate: new Date('2025-01-10'),
        scheduledTime: '10:00 AM',
        duration: 60,
        demoType: 'equipment',
        equipmentModels: ['Canon imageRUNNER ADVANCE C3330i'],
        demoLocation: 'customer_site',
        assignedSalesRep: 'Sales Rep Name',
        status: 'scheduled',
        confirmationStatus: 'pending',
        preparationCompleted: false,
        demoObjectives: 'Demonstrate color printing capabilities and scan-to-email features',
        proposalAmount: 15000,
        createdAt: new Date('2025-01-05')
      },
      {
        id: 'demo-2', 
        businessRecordId: 'customer-2',
        customerName: 'XYZ Industries',
        contactPerson: 'Jane Doe',
        scheduledDate: new Date('2025-01-12'),
        scheduledTime: '2:00 PM',
        duration: 90,
        demoType: 'equipment',
        equipmentModels: ['Xerox VersaLink C7000'],
        demoLocation: 'dealer_showroom',
        assignedSalesRep: 'Sales Rep Name',
        status: 'confirmed',
        confirmationStatus: 'confirmed',
        preparationCompleted: true,
        demoObjectives: 'Show high-volume color printing and finishing options',
        proposalAmount: 25000,
        createdAt: new Date('2025-01-06')
      }
    ];

    res.json(sampleDemos);
    
  } catch (error) {
    console.error('Error fetching demos:', error);
    res.status(500).json({ message: 'Failed to fetch demos' });
  }
});

// Get available customers for demo scheduling
router.get('/api/demos/customers', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Get real customers from business records
    const customers = await db
      .select({
        id: businessRecords.id,
        companyName: businessRecords.companyName,
        primaryContactName: businessRecords.primaryContactName,
        phone: businessRecords.phone,
        email: businessRecords.email,
        addressLine1: businessRecords.addressLine1,
        city: businessRecords.city,
        state: businessRecords.state,
        zipCode: businessRecords.zipCode
      })
      .from(businessRecords)
      .where(and(
        eq(businessRecords.tenantId, tenantId),
        eq(businessRecords.recordType, 'customer')
      ))
      .orderBy(asc(businessRecords.companyName));

    res.json(customers);
    
  } catch (error) {
    console.error('Error fetching customers for demo:', error);
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
});

// Create new demo schedule
router.post('/api/demos', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const {
      businessRecordId,
      scheduledDate,
      scheduledTime,
      duration,
      demoType,
      equipmentModels,
      demoLocation,
      demoAddress,
      demoCity,
      demoState,
      demoZipCode,
      demoObjectives,
      customerRequirements,
      proposalAmount
    } = req.body;

    // For now, return success response until schema is updated
    const newDemo = {
      id: `demo-${Date.now()}`,
      tenantId,
      businessRecordId,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      duration: duration || 60,
      demoType: demoType || 'equipment',
      equipmentModels: equipmentModels || [],
      demoLocation: demoLocation || 'customer_site',
      demoAddress,
      demoCity,
      demoState,
      demoZipCode,
      assignedSalesRep: userId,
      status: 'scheduled',
      confirmationStatus: 'pending',
      preparationCompleted: false,
      demoObjectives,
      customerRequirements,
      proposalAmount,
      createdBy: userId,
      createdAt: new Date()
    };

    res.status(201).json(newDemo);
    
  } catch (error) {
    console.error('Error creating demo:', error);
    res.status(500).json({ message: 'Failed to create demo' });
  }
});

// Update demo status
router.put('/api/demos/:id/status', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, confirmationStatus } = req.body;
    
    // For now, return success response until schema is updated
    res.json({ 
      message: 'Demo status updated successfully',
      id,
      status,
      confirmationStatus,
      updatedAt: new Date()
    });
    
  } catch (error) {
    console.error('Error updating demo status:', error);
    res.status(500).json({ message: 'Failed to update demo status' });
  }
});

// Get demo preparation checklist
router.get('/api/demos/:id/checklist', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Sample preparation checklist
    const checklist = [
      {
        id: 'prep-1',
        category: 'equipment',
        taskName: 'Prepare demonstration equipment',
        taskDescription: 'Ensure all equipment is clean, loaded with paper, and functioning properly',
        isCompleted: false,
        priority: 'high',
        estimatedMinutes: 30
      },
      {
        id: 'prep-2',
        category: 'materials',
        taskName: 'Gather marketing materials',
        taskDescription: 'Collect brochures, spec sheets, and comparison documents',
        isCompleted: false,
        priority: 'medium',
        estimatedMinutes: 15
      },
      {
        id: 'prep-3',
        category: 'customer_research',
        taskName: 'Review customer requirements',
        taskDescription: 'Study customer needs and prepare targeted demonstration points',
        isCompleted: true,
        priority: 'high',
        estimatedMinutes: 20,
        completedAt: new Date()
      },
      {
        id: 'prep-4',
        category: 'logistics',
        taskName: 'Confirm appointment',
        taskDescription: 'Call customer to confirm time, location, and attendees',
        isCompleted: false,
        priority: 'high',
        estimatedMinutes: 10
      }
    ];
    
    res.json(checklist);
    
  } catch (error) {
    console.error('Error fetching demo checklist:', error);
    res.status(500).json({ message: 'Failed to fetch demo checklist' });
  }
});

// Update preparation checklist item
router.put('/api/demos/:demoId/checklist/:itemId', requireAuth, async (req: any, res) => {
  try {
    const { demoId, itemId } = req.params;
    const { isCompleted } = req.body;
    
    // For now, return success response until schema is updated
    res.json({
      message: 'Checklist item updated successfully',
      demoId,
      itemId,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      updatedAt: new Date()
    });
    
  } catch (error) {
    console.error('Error updating checklist item:', error);
    res.status(500).json({ message: 'Failed to update checklist item' });
  }
});

// Get equipment availability
router.get('/api/demos/equipment-availability', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Sample equipment availability
    const equipment = [
      {
        id: 'eq-1',
        equipmentModel: 'Canon imageRUNNER ADVANCE C3330i',
        equipmentSerialNumber: 'CAN001',
        currentLocation: 'showroom',
        isAvailable: true,
        equipmentCondition: 'excellent',
        totalDemoCount: 15,
        lastDemoDate: new Date('2025-01-03')
      },
      {
        id: 'eq-2',
        equipmentModel: 'Xerox VersaLink C7000',
        equipmentSerialNumber: 'XER001',
        currentLocation: 'showroom',
        isAvailable: true,
        equipmentCondition: 'good',
        totalDemoCount: 22,
        lastDemoDate: new Date('2025-01-04')
      },
      {
        id: 'eq-3',
        equipmentModel: 'HP LaserJet Enterprise M611dn',
        equipmentSerialNumber: 'HP001',
        currentLocation: 'customer_site',
        isAvailable: false,
        equipmentCondition: 'excellent',
        totalDemoCount: 8,
        lastDemoDate: new Date('2025-01-05')
      }
    ];
    
    res.json(equipment);
    
  } catch (error) {
    console.error('Error fetching equipment availability:', error);
    res.status(500).json({ message: 'Failed to fetch equipment availability' });
  }
});

export default router;