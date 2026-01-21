# Mobile Technician App - Implementation Plan

**Project:** Printyx Mobile Technician App
**Timeline:** 12-16 weeks
**Priority:** P0 (Highest Impact)
**Status:** Planning

---

## Executive Summary

A native mobile application for field service technicians that provides offline-capable access to service tickets, equipment information, parts inventory, and customer data. This app will dramatically improve technician productivity and customer satisfaction.

---

## Technical Architecture

### Technology Stack

**Framework:** React Native (Expo)

- **Why:** Maximum code reuse with existing React web codebase
- **Benefits:** Single codebase for iOS and Android, hot reload, OTA updates
- **Tradeoff:** Slightly lower performance than native, but acceptable for this use case

**Key Libraries:**

```json
{
  "react-native": "^0.75.0",
  "expo": "^52.0.0",
  "@react-navigation/native": "^7.0.0",
  "@tanstack/react-query": "^5.60.5",
  "react-hook-form": "^7.55.0",
  "zod": "^3.24.0",
  "watermelondb": "^0.27.0",
  "react-native-camera": "^4.2.1",
  "react-native-vision-camera": "^4.0.0",
  "react-native-qrcode-scanner": "^1.5.5",
  "react-native-maps": "^1.18.0",
  "react-native-geolocation": "^3.4.0",
  "react-native-signature-canvas": "^4.7.2",
  "react-native-pdf": "^6.7.5",
  "@react-native-async-storage/async-storage": "^1.24.0"
}
```

**Offline Database:** WatermelonDB

- High-performance SQLite-based database
- Lazy loading and reactive updates
- Seamless sync with backend
- Proven at scale (used by many production apps)

**State Management:**

- TanStack Query for server state (with persistence)
- React Context for app-level state (auth, theme, settings)
- WatermelonDB for local data persistence

**Backend:** Extend existing Printyx Express.js API

- New routes in `server/routes/mobile-technician.ts`
- Sync endpoints for offline data
- Image upload with compression

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│         Mobile App (React Native)               │
│                                                 │
│  ┌──────────────┐    ┌──────────────────────┐  │
│  │  UI Layer    │◄───┤  React Navigation    │  │
│  │  (Screens)   │    └──────────────────────┘  │
│  └──────┬───────┘                               │
│         │                                       │
│  ┌──────▼──────────────────────────────────┐   │
│  │     State Management Layer             │   │
│  │  - TanStack Query (Server State)       │   │
│  │  - Context API (App State)             │   │
│  └──────┬────────────────┬────────────────┘   │
│         │                │                     │
│  ┌──────▼───────┐ ┌──────▼──────────────────┐  │
│  │  API Client  │ │  WatermelonDB (Local)   │  │
│  │  (HTTP/REST) │ │  - Tickets              │  │
│  │              │ │  - Equipment            │  │
│  │              │ │  - Customers            │  │
│  │              │ │  - Parts Inventory      │  │
│  └──────┬───────┘ └─────────────────────────┘  │
│         │                                       │
│  ┌──────▼──────────────────────────────────┐   │
│  │     Sync Engine (Bidirectional)        │   │
│  │  - Queue mutations when offline        │   │
│  │  - Sync on reconnect                   │   │
│  │  - Conflict resolution                 │   │
│  └──────┬──────────────────────────────────┘   │
└─────────┼───────────────────────────────────────┘
          │
          │ HTTPS/REST API
          │
┌─────────▼───────────────────────────────────────┐
│         Backend (Existing Platform)             │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  New Mobile API Routes                   │   │
│  │  /api/mobile/sync                        │   │
│  │  /api/mobile/tickets                     │   │
│  │  /api/mobile/equipment                   │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  PostgreSQL (Existing Database)          │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## Core Features (MVP)

### Phase 1: Foundation (Weeks 1-4)

**1. Authentication & Onboarding**

- Login with existing Printyx credentials
- Biometric authentication (Face ID/Touch ID)
- Role-based access (only technicians can access)
- Initial data sync (download assigned tickets, equipment list)
- Onboarding tutorial for first-time users

**2. Offline Data Sync**

- Download tickets, equipment, customers, and parts inventory
- Queue mutations (ticket updates, notes, photos) when offline
- Automatic sync when connection restored
- Conflict resolution (last-write-wins with merge for notes)
- Sync status indicator

**3. Navigation & Dashboard**

- Bottom tab navigation:
  - Today (assigned tickets)
  - Tickets (all open tickets)
  - Equipment (quick lookup)
  - Parts (inventory)
  - More (settings, help)
- Dashboard showing:
  - Assigned tickets for today
  - Ticket priority and SLA status
  - Geolocation-based routing
  - Quick actions (call customer, navigate)

### Phase 2: Core Workflows (Weeks 5-8)

**4. Ticket Management**

- View ticket details (customer, equipment, issue description)
- Update ticket status (En Route, On Site, In Progress, Completed)
- Add internal notes and customer-visible updates
- Time tracking (automatic or manual)
- Parts used tracking
- Photo documentation (before/after)
- Digital signature capture for completion
- Generate PDF service report

**5. Equipment Information**

- Search equipment by serial number, location, or customer
- View equipment details:
  - Model, serial number, location
  - Service history
  - Current meter readings
  - Toner levels (if monitored)
  - Warranty status
- Access parts diagrams and manuals (PDF viewer)
- QR code scanner for quick lookup

**6. Camera & Photo Management**

- Native camera integration (high quality)
- Photo annotation (arrows, text, highlights)
- Compress before upload (reduce bandwidth)
- Gallery view of ticket photos
- Attach multiple photos to tickets

### Phase 3: Advanced Features (Weeks 9-12)

**7. Parts Inventory**

- View on-hand parts inventory
- Search parts by number or description
- Check availability before ordering
- Request parts from warehouse
- Record parts used on tickets
- Low stock alerts

**8. Customer Information**

- View customer contact details
- Call customer with one tap (tel: link)
- View service location address
- Navigate to location (Google Maps/Apple Maps integration)
- Access site notes and special instructions

**9. GPS Tracking & Geofencing**

- Background location tracking (with user permission)
- Automatic "Arrived on Site" when entering geofence
- Automatic "Left Site" when leaving geofence
- Route optimization for multiple stops
- Mileage tracking for reimbursement

**10. Notifications**

- Push notifications for new assignments
- SLA breach warnings
- Parts availability updates
- Schedule changes
- Customer messages

### Phase 4: Polish & Optimization (Weeks 13-16)

**11. Performance Optimization**

- Image lazy loading and caching
- Pagination for large lists
- Database query optimization
- Reduce bundle size
- Improve app startup time

**12. Voice Features**

- Voice-to-text for notes (hands-free)
- Voice commands ("Complete ticket", "Add note")

**13. Barcode Scanning**

- Scan parts barcodes for quick entry
- Scan equipment barcodes for lookup

**14. Reporting**

- Daily/weekly technician reports
- Parts usage summary
- Time tracking summary
- Completed tickets list

---

## User Flow Examples

### Starting the Day

1. Technician opens app
2. Dashboard shows 5 assigned tickets for today
3. Tickets are sorted by priority and geolocation
4. Technician reviews details and plans route
5. Taps "Start Navigation" to first stop

### Service Call Workflow

1. Technician arrives → App auto-detects (geofence) and prompts to start ticket
2. Takes "before" photos of issue
3. Scans QR code on equipment → Instant access to service history and manuals
4. Diagnoses issue, adds notes via voice input
5. Scans parts used via barcode
6. Replaces part, takes "after" photos
7. Runs test prints to verify fix
8. Customer signs on device screen
9. App generates PDF service report and emails to customer
10. Ticket marked complete and synced to server

### Offline Scenario

1. Technician is in basement with no cell signal
2. All ticket data already cached locally
3. Works on ticket, takes photos, adds notes
4. Changes are queued in sync engine
5. Returns to surface, app reconnects
6. All changes automatically uploaded
7. Notification confirms sync complete

---

## Screen Mockups (Key Screens)

### Home Dashboard

```
┌─────────────────────────┐
│  ☰  Printyx    🔔 👤   │
├─────────────────────────┤
│  Good morning, John     │
│  You have 5 tickets     │
│  today                  │
├─────────────────────────┤
│  📍 Optimized Route     │
│  Total: 45 miles        │
│  [View Map]             │
├─────────────────────────┤
│  🎫 Assigned Tickets    │
│                         │
│  ┌───────────────────┐  │
│  │ P1 ABC Corp       │  │
│  │ Paper Jam Issue   │  │
│  │ 📍 2.3 mi away    │  │
│  │ ⏰ Due: 2:00 PM   │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │ P2 XYZ Inc        │  │
│  │ Toner Replacement │  │
│  │ 📍 5.1 mi away    │  │
│  │ ⏰ Due: 4:00 PM   │  │
│  └───────────────────┘  │
│                         │
├─────────────────────────┤
│ 🏠 Today | 🎫 Tickets   │
│ 🔧 Equipment | 📦 Parts │
└─────────────────────────┘
```

### Ticket Detail Screen

```
┌─────────────────────────┐
│  ← Ticket #T-2024-1234  │
├─────────────────────────┤
│  Status: [In Progress ▼]│
│                         │
│  👤 ABC Corporation     │
│  📍 123 Main St, Bldg A │
│  [📞 Call] [🗺️ Navigate]│
│                         │
│  🖨️ Equipment           │
│  Canon imageRUNNER C3226│
│  Serial: ABC123456      │
│  [🔍 View Details]      │
│                         │
│  📋 Issue               │
│  Consistent paper jams  │
│  in tray 2. Customer    │
│  reports 5+ jams today. │
│                         │
│  📷 Photos (3)          │
│  [🖼️][🖼️][🖼️] [+ Add]   │
│                         │
│  📝 Notes               │
│  [+ Add Note] [🎤 Voice]│
│  • Checked rollers      │
│  • Cleaned feed path    │
│                         │
│  📦 Parts Used          │
│  [+ Add Part]           │
│  • Feed Roller (x1)     │
│                         │
│  [✓ Complete Ticket]    │
└─────────────────────────┘
```

### QR Scanner Screen

```
┌─────────────────────────┐
│  ← Scan Equipment       │
├─────────────────────────┤
│                         │
│  ┌───────────────────┐  │
│  │                   │  │
│  │   ╔═══════════╗   │  │
│  │   ║ Camera    ║   │  │
│  │   ║ Viewfinder║   │  │
│  │   ║           ║   │  │
│  │   ╚═══════════╝   │  │
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  Point camera at QR     │
│  code on equipment      │
│                         │
│  [💡 Flash] [⚙️ Manual] │
└─────────────────────────┘
```

### Signature Capture

```
┌─────────────────────────┐
│  ← Customer Signature   │
├─────────────────────────┤
│                         │
│  Service Completed:     │
│  Canon imageRUNNER C3226│
│  Issue: Paper Jam       │
│  Resolution: Replaced   │
│  feed roller            │
│                         │
│  ┌───────────────────┐  │
│  │                   │  │
│  │  [Signature Area] │  │
│  │                   │  │
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  Name: John Smith       │
│  Title: Office Manager  │
│                         │
│  [ Clear ] [ ✓ Accept ] │
└─────────────────────────┘
```

---

## Backend Integration

### New API Routes

**File:** `server/routes/mobile-technician.ts`

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac-middleware';
import { db } from '../db';
import { serviceTickets, equipment, customers } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';

const router = Router();

// All routes require technician role
router.use(requireAuth);
router.use(requireRole(['Technician', 'Service Manager', 'Admin']));

/**
 * GET /api/mobile/sync
 * Initial data sync for offline usage
 */
router.get('/sync', async (req, res) => {
  const { tenantId } = req;
  const technicianId = req.session.userId;
  const since = req.query.since; // Last sync timestamp

  try {
    // Get assigned tickets
    const tickets = await db.query.serviceTickets.findMany({
      where: and(
        eq(serviceTickets.tenantId, tenantId),
        eq(serviceTickets.assignedTo, technicianId),
        since ? gte(serviceTickets.updatedAt, new Date(since)) : undefined,
      ),
      with: {
        customer: true,
        equipment: true,
      },
    });

    // Get equipment the technician services
    const equipmentList = await db.query.equipment.findMany({
      where: eq(equipment.tenantId, tenantId),
      limit: 1000, // Reasonable limit
    });

    // Get parts inventory
    const partsInventory = await db.query.partsInventory.findMany({
      where: eq(partsInventory.tenantId, tenantId),
    });

    res.json({
      tickets,
      equipment: equipmentList,
      partsInventory,
      syncTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ message: 'Sync failed' });
  }
});

/**
 * POST /api/mobile/tickets/:id/update
 * Update ticket from mobile app
 */
router.post('/tickets/:id/update', async (req, res) => {
  const { id } = req.params;
  const { status, notes, partsUsed, timeSpent } = req.body;

  try {
    const ticket = await db
      .update(serviceTickets)
      .set({
        status,
        notes,
        partsUsed,
        timeSpent,
        updatedAt: new Date(),
      })
      .where(eq(serviceTickets.id, id))
      .returning();

    res.json(ticket[0]);
  } catch (error) {
    console.error('Ticket update error:', error);
    res.status(500).json({ message: 'Update failed' });
  }
});

/**
 * POST /api/mobile/tickets/:id/photos
 * Upload photos for ticket (multipart)
 */
router.post('/tickets/:id/photos', upload.array('photos', 10), async (req, res) => {
  // Image upload logic with compression
  // Store in Google Cloud Storage
  // Associate with ticket
});

/**
 * POST /api/mobile/tickets/:id/complete
 * Complete ticket with signature
 */
router.post('/tickets/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { signature, customerName } = req.body;

  try {
    // Update ticket to completed
    // Generate PDF service report
    // Email customer
    // Update technician metrics

    res.json({ success: true, reportUrl: 'https://...' });
  } catch (error) {
    console.error('Complete error:', error);
    res.status(500).json({ message: 'Completion failed' });
  }
});

export default router;
```

**Integration in `server/index.ts`:**

```typescript
import mobileTechnicianRoutes from './routes/mobile-technician';

app.use('/api/mobile', mobileTechnicianRoutes);
```

---

## Data Sync Strategy

### Sync Architecture

**Bidirectional Sync:**

- **Download:** Server → Mobile (GET /api/mobile/sync)
- **Upload:** Mobile → Server (POST to various endpoints)

**Sync Triggers:**

- App startup (if connected)
- Pull-to-refresh gesture
- Periodic background sync (every 15 minutes when app is active)
- Immediate on reconnect after offline period
- Before critical operations (completing ticket)

**Conflict Resolution:**

- **Last-Write-Wins:** For most fields (status, time spent)
- **Merge Strategy:** For notes (append both versions with timestamp)
- **Server Authority:** For billing and admin fields
- **Client Validation:** Check server response, retry with latest if conflict

**Sync Queue:**

```typescript
// WatermelonDB sync adapter
import { synchronize } from '@nozbe/watermelondb/sync';

async function syncDatabase() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const response = await fetch('/api/mobile/sync?since=' + lastPulledAt);
      const { tickets, equipment, partsInventory, syncTimestamp } = await response.json();

      return {
        changes: {
          tickets: {
            created: tickets.filter((t) => t.isNew),
            updated: tickets.filter((t) => !t.isNew),
          },
          equipment: { created: [], updated: equipment },
          partsInventory: { created: [], updated: partsInventory },
        },
        timestamp: syncTimestamp,
      };
    },
    pushChanges: async ({ changes }) => {
      // Push local changes to server
      for (const ticket of changes.tickets.updated) {
        await fetch(`/api/mobile/tickets/${ticket.id}/update`, {
          method: 'POST',
          body: JSON.stringify(ticket),
        });
      }
    },
  });
}
```

---

## Security Considerations

### Authentication

- JWT token stored in secure storage (iOS Keychain / Android Keystore)
- Token refresh mechanism (30-day expiration)
- Biometric authentication for quick access
- Auto-lock after 5 minutes of inactivity

### Data Protection

- Database encryption at rest (SQLCipher for WatermelonDB)
- HTTPS for all API calls
- Certificate pinning to prevent MITM attacks
- No sensitive customer data cached unnecessarily

### Permissions

- Camera: For photos and QR scanning
- Location: For GPS tracking and geofencing
- Notifications: For push alerts
- Storage: For offline data and photos

### Compliance

- GDPR: Right to be forgotten (purge local data on logout)
- CCPA: Data access and deletion
- HIPAA: If handling medical office equipment (encrypt PHI)

---

## Testing Strategy

### Unit Tests

- API client functions
- Data transformation utilities
- Sync logic
- Form validation

### Integration Tests

- Sync process (online/offline scenarios)
- Photo upload and compression
- Database operations

### E2E Tests (Detox)

```javascript
describe('Technician Workflow', () => {
  it('should complete a service ticket', async () => {
    await device.launchApp();
    await element(by.id('login-button')).tap();
    await element(by.id('ticket-card-0')).tap();
    await element(by.id('status-dropdown')).tap();
    await element(by.text('In Progress')).tap();
    await element(by.id('add-note-button')).tap();
    await element(by.id('note-input')).typeText('Replaced feed roller');
    await element(by.id('save-note-button')).tap();
    await element(by.id('complete-ticket-button')).tap();
    await expect(element(by.text('Ticket completed'))).toBeVisible();
  });
});
```

### Device Testing Matrix

- iOS: iPhone 12, 13, 14, 15 (various screen sizes)
- Android: Samsung Galaxy S21, S22, Pixel 6, 7
- Tablets: iPad Pro, Samsung Galaxy Tab
- OS Versions: iOS 15+, Android 11+

---

## Performance Targets

### Metrics

- **App Startup:** < 2 seconds (cold start)
- **Ticket List Load:** < 500ms (from local DB)
- **Photo Upload:** < 5 seconds for 3MB image (compressed)
- **Sync Duration:** < 10 seconds for typical daily data
- **Offline Operation:** 100% functional for core workflows
- **Battery Usage:** < 5% per hour of active use

### Optimization Techniques

- Image compression before upload (JPEG quality 80%, max 1920x1080)
- Lazy loading of images in lists
- Virtualized lists (FlatList with optimization)
- Memoization of expensive computations
- Debounced search inputs
- Cached API responses (TanStack Query)

---

## Deployment Strategy

### App Store Submission

**iOS (Apple App Store):**

- Apple Developer Account required ($99/year)
- App Review: 1-3 days typically
- TestFlight for beta testing (100 internal, 10,000 external testers)

**Android (Google Play Store):**

- Google Play Developer Account ($25 one-time)
- Review: Usually same day
- Internal/closed/open testing tracks

### OTA Updates (Expo)

- Push updates without app store approval (JavaScript changes only)
- Native changes require full app store update
- Gradual rollout possible (10% → 50% → 100%)

### Beta Testing Plan

1. **Alpha (Weeks 13-14):** Internal testing with 5 technicians
2. **Beta (Weeks 15-16):** Expand to 20 technicians at 3 customers
3. **Release Candidate (Week 17):** Full testing, prepare for launch
4. **Launch (Week 18):** Rollout to all customers

---

## Training & Documentation

### Technician Training

- 30-minute video walkthrough
- Quick start guide (PDF)
- In-app tutorial (first launch)
- FAQs and troubleshooting guide

### Admin Documentation

- Deployment guide
- API documentation
- Troubleshooting common issues
- Analytics and reporting

---

## Success Metrics (KPIs)

### Adoption

- **Target:** 90% of technicians using app within 30 days
- **Metric:** Daily active users / Total technicians

### Efficiency

- **Target:** 20% reduction in ticket completion time
- **Metric:** Average time from assignment to completion

### Quality

- **Target:** 15% increase in first-time fix rate
- **Metric:** Tickets completed on first visit / Total tickets

### Customer Satisfaction

- **Target:** 10-point increase in NPS
- **Metric:** Post-service survey scores

### Offline Usage

- **Target:** 30% of operations happen offline
- **Metric:** Operations queued for sync / Total operations

---

## Budget Estimate

### Development Costs

- **Mobile Developer (4 months):** $50,000 - $80,000 (contractor/employee)
- **Backend Developer (1 month):** $12,000 - $20,000
- **UI/UX Design:** $5,000 - $10,000
- **QA Testing:** $8,000 - $12,000
- **Total Development:** $75,000 - $122,000

### Ongoing Costs

- **Apple Developer Account:** $99/year
- **Google Play Account:** $25 one-time
- **Expo EAS Build/Update:** $99/month (production plan)
- **Push Notifications (Firebase):** Free tier likely sufficient
- **Image Storage (Google Cloud):** ~$50/month
- **Total Year 1:** ~$2,500 + development costs

### ROI Calculation

- **Time Savings:** 30 technicians × 2 hours/week × $40/hour × 50 weeks = $120,000/year
- **Payback Period:** 7-12 months
- **3-Year ROI:** 400-600%

---

## Risks & Mitigation

| Risk                             | Probability | Impact | Mitigation                                           |
| -------------------------------- | ----------- | ------ | ---------------------------------------------------- |
| Low technician adoption          | Medium      | High   | Training, gamification, management support           |
| Offline sync conflicts           | Medium      | Medium | Robust conflict resolution, testing                  |
| Battery drain issues             | Low         | High   | Optimize location tracking, power management         |
| App store rejection              | Low         | Medium | Follow guidelines strictly, pre-submission checklist |
| Performance on older devices     | Medium      | Low    | Test on older hardware, graceful degradation         |
| Backend API changes breaking app | Medium      | High   | Versioned API, backward compatibility                |

---

## Next Steps (Week 1-2)

### Immediate Actions

1. **Validate with Users:** Interview 5-10 technicians to confirm feature priorities
2. **Design Review:** Create high-fidelity mockups in Figma
3. **Technical Spike:** Prove offline sync with WatermelonDB (2-day prototype)
4. **Backend Planning:** Define API contracts and data models
5. **Resource Allocation:** Hire/contract mobile developer if needed

### Decision Points

- [ ] Approve budget and timeline
- [ ] Select React Native vs Flutter (recommendation: React Native)
- [ ] Define MVP scope (Phase 1-2 vs all phases)
- [ ] Identify beta testing customers

---

## Appendix

### Competitor Analysis

- **ServiceTrade:** Mobile app but limited offline capability
- **FieldAware:** Strong mobile offering but expensive
- **Housecall Pro:** Great UX but not copier-industry specific
- **Printyx Advantage:** Tight integration with existing platform, offline-first design

### Technology Alternatives Considered

- **Flutter:** Better performance, but Dart language barrier
- **Native iOS/Android:** Best performance, but 2x development cost
- **Progressive Web App:** No app store, but limited offline and native features

### References

- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [WatermelonDB Documentation](https://watermelondb.dev/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)

---

## Document History

| Version | Date       | Author | Changes                     |
| ------- | ---------- | ------ | --------------------------- |
| 1.0     | 2025-11-23 | Claude | Initial implementation plan |
