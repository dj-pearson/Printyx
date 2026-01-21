# Implementation Guide: Customer Portal Integration

**Priority:** ⭐⭐⭐⭐⭐ Highest
**Effort:** 4-6 weeks
**Impact:** Very High - Affects all customers
**Risk:** Medium (customer-facing, requires testing)

---

## Overview

Transform the standalone Customer Portal into an integrated self-service hub where customers can:

- View and submit service tickets
- Track equipment status and meter readings
- Access invoices and payment history
- Search knowledge base for help articles
- View assigned tasks and action items

---

## Current State Analysis

### Existing Customer Portal Files

**Frontend:**

- `client/src/pages/CustomerSelfServicePortal.tsx` - Main portal page
- `client/src/components/customer-portal/` - Portal components (if exists)

**Backend:**

- `server/routes-customer-portal.ts` - Portal API routes (likely minimal)
- `shared/customer-portal-schema.ts` - Portal data models

**Current Capabilities:**

- Basic customer information display
- Minimal self-service features
- No integration with core systems

**Gaps:**

- ❌ No service ticket visibility
- ❌ No equipment status
- ❌ No invoice access
- ❌ No knowledge base integration
- ❌ No task visibility

---

## Phase 1: Backend API Endpoints (Week 1-2)

### 1.1 Service Tickets Endpoint

**File:** `server/routes-customer-portal.ts`

```typescript
// GET /api/customer-portal/tickets
// Returns service tickets for the authenticated customer

router.get('/tickets', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.session?.tenantId;

    // Get customer record for this user
    const customer = await db
      .select()
      .from(customers)
      .where(and(eq(customers.userId, userId), eq(customers.tenantId, tenantId)))
      .limit(1);

    if (!customer.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerId = customer[0].id;

    // Get service tickets for this customer
    const tickets = await db
      .select({
        id: serviceTickets.id,
        ticketNumber: serviceTickets.ticketNumber,
        title: serviceTickets.title,
        description: serviceTickets.description,
        status: serviceTickets.status,
        priority: serviceTickets.priority,
        createdAt: serviceTickets.createdAt,
        scheduledDate: serviceTickets.scheduledDate,
        completedAt: serviceTickets.completedAt,
        technicianName: technicians.name,
        equipmentName: equipment.name,
      })
      .from(serviceTickets)
      .leftJoin(technicians, eq(serviceTickets.technicianId, technicians.id))
      .leftJoin(equipment, eq(serviceTickets.equipmentId, equipment.id))
      .where(and(eq(serviceTickets.customerId, customerId), eq(serviceTickets.tenantId, tenantId)))
      .orderBy(desc(serviceTickets.createdAt))
      .limit(100);

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching customer tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// POST /api/customer-portal/tickets
// Create new service ticket from customer portal

router.post('/tickets', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.session?.tenantId;
    const { equipmentId, title, description, priority } = req.body;

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description required' });
    }

    // Get customer record
    const customer = await db
      .select()
      .from(customers)
      .where(and(eq(customers.userId, userId), eq(customers.tenantId, tenantId)))
      .limit(1);

    if (!customer.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Generate ticket number
    const ticketNumber = await generateTicketNumber(tenantId);

    // Create service ticket
    const [newTicket] = await db
      .insert(serviceTickets)
      .values({
        ticketNumber,
        customerId: customer[0].id,
        equipmentId: equipmentId || null,
        title,
        description,
        status: 'open',
        priority: priority || 'medium',
        source: 'customer_portal',
        tenantId,
        createdAt: new Date(),
      })
      .returning();

    // TODO: Notify service team (email, SMS, etc.)

    res.status(201).json(newTicket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});
```

### 1.2 Equipment Status Endpoint

```typescript
// GET /api/customer-portal/equipment
// Returns equipment list with status for customer

router.get('/equipment', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.session?.tenantId;

    const customer = await db
      .select()
      .from(customers)
      .where(and(eq(customers.userId, userId), eq(customers.tenantId, tenantId)))
      .limit(1);

    if (!customer.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get equipment with latest meter reading
    const equipmentList = await db
      .select({
        id: equipment.id,
        name: equipment.name,
        serialNumber: equipment.serialNumber,
        model: equipment.model,
        status: equipment.status,
        installDate: equipment.installDate,
        warrantyEndDate: equipment.warrantyEndDate,
        location: equipment.location,
        lastMeterReading: meterReadings.reading,
        lastMeterDate: meterReadings.readingDate,
        nextMaintenanceDate: equipment.nextMaintenanceDate,
      })
      .from(equipment)
      .leftJoin(
        meterReadings,
        and(
          eq(meterReadings.equipmentId, equipment.id),
          // Get only the latest meter reading
          sql`${meterReadings.id} = (
            SELECT id FROM ${meterReadings}
            WHERE equipment_id = ${equipment.id}
            ORDER BY reading_date DESC
            LIMIT 1
          )`,
        ),
      )
      .where(and(eq(equipment.customerId, customer[0].id), eq(equipment.tenantId, tenantId)))
      .orderBy(equipment.name);

    res.json(equipmentList);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// GET /api/customer-portal/equipment/:id/history
// Returns service history for specific equipment

router.get('/equipment/:id/history', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const tenantId = req.session?.tenantId;

    // Verify customer owns this equipment
    const customer = await db
      .select()
      .from(customers)
      .where(and(eq(customers.userId, userId), eq(customers.tenantId, tenantId)))
      .limit(1);

    const equipmentRecord = await db
      .select()
      .from(equipment)
      .where(
        and(
          eq(equipment.id, parseInt(id)),
          eq(equipment.customerId, customer[0].id),
          eq(equipment.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!equipmentRecord.length) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Get service history
    const history = await db
      .select({
        id: serviceTickets.id,
        ticketNumber: serviceTickets.ticketNumber,
        title: serviceTickets.title,
        status: serviceTickets.status,
        createdAt: serviceTickets.createdAt,
        completedAt: serviceTickets.completedAt,
        technicianName: technicians.name,
        resolution: serviceTickets.resolution,
      })
      .from(serviceTickets)
      .leftJoin(technicians, eq(serviceTickets.technicianId, technicians.id))
      .where(
        and(eq(serviceTickets.equipmentId, parseInt(id)), eq(serviceTickets.tenantId, tenantId)),
      )
      .orderBy(desc(serviceTickets.createdAt))
      .limit(50);

    res.json(history);
  } catch (error) {
    console.error('Error fetching equipment history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});
```

### 1.3 Billing/Invoices Endpoint

```typescript
// GET /api/customer-portal/invoices
// Returns invoice list for customer

router.get('/invoices', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.session?.tenantId;

    const customer = await db
      .select()
      .from(customers)
      .where(and(eq(customers.userId, userId), eq(customers.tenantId, tenantId)))
      .limit(1);

    if (!customer.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const invoiceList = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        amountPaid: invoices.amountPaid,
        status: invoices.status,
        pdfUrl: invoices.pdfUrl,
      })
      .from(invoices)
      .where(and(eq(invoices.customerId, customer[0].id), eq(invoices.tenantId, tenantId)))
      .orderBy(desc(invoices.invoiceDate))
      .limit(100);

    res.json(invoiceList);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/customer-portal/payment-methods
// Returns saved payment methods for customer

router.get('/payment-methods', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.session?.tenantId;

    const customer = await db
      .select()
      .from(customers)
      .where(and(eq(customers.userId, userId), eq(customers.tenantId, tenantId)))
      .limit(1);

    if (!customer.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const paymentMethods = await db
      .select({
        id: subscriptionPaymentMethods.id,
        type: subscriptionPaymentMethods.paymentMethodType,
        last4: subscriptionPaymentMethods.last4Digits,
        isDefault: subscriptionPaymentMethods.isDefault,
        expiryMonth: subscriptionPaymentMethods.expiryMonth,
        expiryYear: subscriptionPaymentMethods.expiryYear,
      })
      .from(subscriptionPaymentMethods)
      .where(
        and(
          eq(subscriptionPaymentMethods.customerId, customer[0].id),
          eq(subscriptionPaymentMethods.tenantId, tenantId),
        ),
      );

    res.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});
```

### 1.4 Knowledge Base Search Endpoint

```typescript
// GET /api/customer-portal/knowledge-base/search
// Search knowledge base articles (customer-accessible only)

router.get('/knowledge-base/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query; // search query
    const tenantId = req.session?.tenantId;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    // Search articles (simplified - use full-text search in production)
    const articles = await db
      .select({
        id: knowledgeBaseArticles.id,
        title: knowledgeBaseArticles.title,
        slug: knowledgeBaseArticles.slug,
        excerpt: knowledgeBaseArticles.excerpt,
        category: knowledgeBaseCategories.name,
      })
      .from(knowledgeBaseArticles)
      .leftJoin(
        knowledgeBaseCategories,
        eq(knowledgeBaseArticles.categoryId, knowledgeBaseCategories.id),
      )
      .where(
        and(
          eq(knowledgeBaseArticles.tenantId, tenantId),
          eq(knowledgeBaseArticles.isPublished, true),
          eq(knowledgeBaseArticles.isCustomerVisible, true), // Only customer-accessible
          or(
            sql`${knowledgeBaseArticles.title} ILIKE ${'%' + q + '%'}`,
            sql`${knowledgeBaseArticles.content} ILIKE ${'%' + q + '%'}`,
          ),
        ),
      )
      .limit(20);

    res.json(articles);
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    res.status(500).json({ error: 'Failed to search articles' });
  }
});
```

---

## Phase 2: Frontend Components (Week 3-4)

### 2.1 Portal Dashboard Layout

**File:** `client/src/pages/CustomerSelfServicePortal.tsx`

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketList } from "@/components/customer-portal/TicketList";
import { EquipmentDashboard } from "@/components/customer-portal/EquipmentDashboard";
import { InvoiceList } from "@/components/customer-portal/InvoiceList";
import { KnowledgeBaseSearch } from "@/components/customer-portal/KnowledgeBaseSearch";
import { AlertCircle, FileText, Settings, HelpCircle } from "lucide-react";

export default function CustomerSelfServicePortal() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Portal</h1>
          <p className="text-muted-foreground">
            Manage your equipment, tickets, and invoices
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              2 scheduled this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Equipment</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              All operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,450</div>
            <p className="text-xs text-muted-foreground">
              2 invoices due soon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Help Articles</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">
              Available resources
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tickets">Service Tickets</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="help">Help Center</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          <TicketList />
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          <EquipmentDashboard />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <InvoiceList />
        </TabsContent>

        <TabsContent value="help" className="space-y-4">
          <KnowledgeBaseSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 2.2 Service Ticket Component

**File:** `client/src/components/customer-portal/TicketList.tsx`

```typescript
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, User, Settings } from "lucide-react";
import { format } from "date-fns";
import { CreateTicketDialog } from "./CreateTicketDialog";
import { useState } from "react";

export function TicketList() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['/api/customer-portal/tickets'],
  });

  const statusColors = {
    open: 'bg-yellow-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500',
    cancelled: 'bg-gray-500',
  };

  if (isLoading) {
    return <div>Loading tickets...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Service Tickets</CardTitle>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tickets?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No service tickets found. Create one to get started.
              </div>
            ) : (
              tickets?.map((ticket: any) => (
                <Card key={ticket.id} className="border-l-4" style={{
                  borderLeftColor: statusColors[ticket.status as keyof typeof statusColors]
                }}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">#{ticket.ticketNumber}</span>
                          <Badge variant="outline">{ticket.status}</Badge>
                          {ticket.priority === 'urgent' && (
                            <Badge variant="destructive">Urgent</Badge>
                          )}
                        </div>
                        <h3 className="text-lg font-medium">{ticket.title}</h3>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">{ticket.description}</p>

                      <div className="flex flex-wrap gap-4 pt-2">
                        {ticket.equipmentName && (
                          <div className="flex items-center gap-1">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                            <span>{ticket.equipmentName}</span>
                          </div>
                        )}

                        {ticket.technicianName && (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{ticket.technicianName}</span>
                          </div>
                        )}

                        {ticket.scheduledDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(ticket.scheduledDate), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground pt-2">
                        Created {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
```

### 2.3 Equipment Dashboard Component

**File:** `client/src/components/customer-portal/EquipmentDashboard.tsx`

```typescript
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Settings, Calendar, Activity } from "lucide-react";
import { format } from "date-fns";

export function EquipmentDashboard() {
  const { data: equipment, isLoading } = useQuery({
    queryKey: ['/api/customer-portal/equipment'],
  });

  if (isLoading) {
    return <div>Loading equipment...</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {equipment?.map((item: any) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{item.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{item.model}</p>
              </div>
              <Badge variant={
                item.status === 'active' ? 'default' :
                item.status === 'maintenance' ? 'secondary' :
                'destructive'
              }>
                {item.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">SN:</span>
                <span className="font-mono">{item.serialNumber}</span>
              </div>

              {item.lastMeterReading && (
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Meter:</span>
                  <span className="font-semibold">{item.lastMeterReading.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">
                    ({format(new Date(item.lastMeterDate), 'MMM d')})
                  </span>
                </div>
              )}

              {item.nextMaintenanceDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Next PM:</span>
                  <span>{format(new Date(item.nextMaintenanceDate), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>

            {item.warrantyEndDate && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Warranty</span>
                  <span>{format(new Date(item.warrantyEndDate), 'MMM yyyy')}</span>
                </div>
                <Progress value={calculateWarrantyProgress(item.installDate, item.warrantyEndDate)} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function calculateWarrantyProgress(installDate: string, warrantyEndDate: string): number {
  const now = new Date();
  const start = new Date(installDate);
  const end = new Date(warrantyEndDate);
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}
```

---

## Phase 3: Testing & Refinement (Week 5-6)

### 3.1 Unit Tests

**File:** `server/__tests__/customer-portal.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';

describe('Customer Portal API', () => {
  describe('GET /api/customer-portal/tickets', () => {
    it('should return tickets for authenticated customer', async () => {
      const response = await request(app)
        .get('/api/customer-portal/tickets')
        .set('Cookie', 'session=test-session')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app).get('/api/customer-portal/tickets').expect(401);
    });

    it('should only return tickets for the authenticated customer', async () => {
      const response = await request(app)
        .get('/api/customer-portal/tickets')
        .set('Cookie', 'session=customer1-session')
        .expect(200);

      // Verify all tickets belong to this customer
      response.body.forEach((ticket: any) => {
        expect(ticket.customerId).toBe(1);
      });
    });
  });

  describe('POST /api/customer-portal/tickets', () => {
    it('should create a new ticket', async () => {
      const newTicket = {
        title: 'Printer not working',
        description: 'The printer is showing an error code',
        priority: 'high',
        equipmentId: 123,
      };

      const response = await request(app)
        .post('/api/customer-portal/tickets')
        .set('Cookie', 'session=test-session')
        .send(newTicket)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(newTicket.title);
      expect(response.body.status).toBe('open');
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/customer-portal/tickets')
        .set('Cookie', 'session=test-session')
        .send({ title: 'Test' }) // missing description
        .expect(400);
    });
  });
});
```

### 3.2 E2E Tests

**File:** `testing/e2e/customer-portal.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Customer Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Login as customer
    await page.goto('/login');
    await page.fill('[name="email"]', 'customer@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/customer-self-service-portal');
  });

  test('should display customer dashboard', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Customer Portal');

    // Check stats cards are visible
    await expect(page.locator('text=Open Tickets')).toBeVisible();
    await expect(page.locator('text=Equipment')).toBeVisible();
    await expect(page.locator('text=Unpaid Invoices')).toBeVisible();
  });

  test('should display service tickets', async ({ page }) => {
    await page.click('text=Service Tickets');

    // Wait for tickets to load
    await page.waitForSelector('[data-testid="ticket-list"]');

    // Should show ticket cards
    const tickets = page.locator('[data-testid="ticket-card"]');
    await expect(tickets.first()).toBeVisible();
  });

  test('should create a new service ticket', async ({ page }) => {
    await page.click('text=Service Tickets');
    await page.click('text=New Ticket');

    // Fill form
    await page.fill('[name="title"]', 'Test ticket');
    await page.fill('[name="description"]', 'This is a test ticket');
    await page.selectOption('[name="priority"]', 'medium');

    // Submit
    await page.click('button:has-text("Create Ticket")');

    // Should show success message
    await expect(page.locator('text=Ticket created successfully')).toBeVisible();

    // Should appear in list
    await expect(page.locator('text=Test ticket')).toBeVisible();
  });

  test('should display equipment list', async ({ page }) => {
    await page.click('text=Equipment');

    // Wait for equipment to load
    await page.waitForSelector('[data-testid="equipment-card"]');

    // Should show equipment cards with details
    const equipment = page.locator('[data-testid="equipment-card"]').first();
    await expect(equipment).toContainText('SN:');
    await expect(equipment).toContainText('Meter:');
  });

  test('should display invoice list', async ({ page }) => {
    await page.click('text=Billing');

    // Wait for invoices to load
    await page.waitForSelector('[data-testid="invoice-list"]');

    // Should show invoices
    const invoices = page.locator('[data-testid="invoice-row"]');
    await expect(invoices.first()).toBeVisible();

    // Should show total amount and status
    await expect(invoices.first()).toContainText('$');
    await expect(invoices.first()).toContainText(/paid|unpaid|overdue/i);
  });

  test('should search knowledge base', async ({ page }) => {
    await page.click('text=Help Center');

    // Search for articles
    await page.fill('[placeholder*="Search"]', 'printer troubleshooting');
    await page.keyboard.press('Enter');

    // Should show search results
    await page.waitForSelector('[data-testid="article-result"]');
    const results = page.locator('[data-testid="article-result"]');
    await expect(results.first()).toBeVisible();
  });
});
```

---

## Security Considerations

### Authentication & Authorization

1. **Verify customer ownership** on every request
   - Always check `userId` from session matches customer record
   - Filter all queries by `customerId` AND `tenantId`
   - Never trust client-provided IDs

2. **Row-level security**
   - Use existing RLS patterns from tenant middleware
   - Add customer-level filtering on top of tenant filtering

3. **Data visibility rules**

   ```typescript
   // Only show customer's own data
   WHERE customerId = (SELECT id FROM customers WHERE userId = req.user.id)

   // Only show customer-accessible KB articles
   WHERE isCustomerVisible = true AND isPublished = true

   // Redact sensitive fields in responses
   SELECT id, invoiceNumber, totalAmount
   -- Don't expose internal notes, cost data, etc.
   ```

### API Rate Limiting

```typescript
// Apply rate limiting to customer portal endpoints
import rateLimit from 'express-rate-limit';

const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each customer to 100 requests per window
  message: 'Too many requests from this customer',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use('/customer-portal', portalLimiter);
```

---

## Performance Optimization

### Caching Strategy

```typescript
// Cache equipment data (changes infrequently)
const { data: equipment } = useQuery({
  queryKey: ['/api/customer-portal/equipment'],
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 30 * 60 * 1000, // 30 minutes
});

// Real-time ticket data (changes frequently)
const { data: tickets } = useQuery({
  queryKey: ['/api/customer-portal/tickets'],
  refetchInterval: 30 * 1000, // Poll every 30 seconds
});
```

### Database Indexes

```sql
-- Add indexes for customer portal queries
CREATE INDEX idx_service_tickets_customer ON service_tickets(customer_id, created_at DESC);
CREATE INDEX idx_equipment_customer ON equipment(customer_id, status);
CREATE INDEX idx_invoices_customer ON invoices(customer_id, invoice_date DESC);
CREATE INDEX idx_meter_readings_equipment ON meter_readings(equipment_id, reading_date DESC);
```

---

## Deployment Checklist

### Pre-Launch

- [ ] All API endpoints tested with customer accounts
- [ ] E2E tests passing
- [ ] Security review completed
- [ ] Performance testing done (100+ concurrent customers)
- [ ] Mobile responsive design verified
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Customer-facing copy reviewed
- [ ] Help documentation updated

### Beta Launch

- [ ] Select 5-10 friendly customers for beta
- [ ] Set up monitoring/analytics
- [ ] Create feedback collection mechanism
- [ ] Train customer support team
- [ ] Prepare rollback plan

### Full Launch

- [ ] Announce to all customers via email
- [ ] Update marketing materials
- [ ] Monitor support ticket volume
- [ ] Track adoption metrics
- [ ] Collect NPS/CSAT feedback

---

## Success Metrics

### Week 1 Post-Launch

- Portal login rate: Target 30%+ of customers
- Feature usage: Tickets (50%), Equipment (70%), Billing (40%)
- Support ticket reduction: Baseline measurement

### Month 1 Post-Launch

- Portal adoption: Target 60%+ of customers
- Self-service ticket creation: Target 40%+ of all tickets
- Support ticket reduction: Target -20%
- CSAT score: Target 8.0+ / 10

### Month 3 Post-Launch

- Portal adoption: Target 80%+ of customers
- Self-service rate: Target 60%+ of customer interactions
- Support ticket reduction: Target -35%
- Customer retention: +5-10% improvement

---

## Troubleshooting Guide

### Common Issues

**Issue: Customer can't see their tickets**

- Verify customer record exists for this user
- Check `customerId` is correctly set on tickets
- Verify tenant ID matches

**Issue: Equipment not showing**

- Check equipment records have correct `customerId`
- Verify customer owns this equipment
- Check for data visibility filters

**Issue: Performance slow with many customers**

- Review database indexes
- Enable query result caching
- Implement pagination for large lists

---

## Next Steps After Portal Integration

1. **Email notifications** - Notify customers of ticket updates
2. **Mobile app** - Native mobile customer portal
3. **Payment processing** - Allow customers to pay invoices online
4. **Document uploads** - Let customers attach photos to tickets
5. **Real-time chat** - Live chat with support team
6. **Usage analytics** - Show customers their equipment usage trends

---

This implementation guide provides a complete roadmap for integrating the Customer Portal with core Printyx features. Follow the phases sequentially, test thoroughly, and measure impact at each stage.
