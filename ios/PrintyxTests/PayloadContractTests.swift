import XCTest
@testable import Printyx

/// Golden-payload decode tests (IOS-031).
///
/// iOS Codable models kept drifting from the edge-function response shapes, so
/// screens rendered but showed empty data (IOS-027 dashboard, IOS-028 search,
/// IOS-030 invoices). These tests decode *captured-shape* JSON — matching the
/// real `today-dashboard`, `activities`, `search`, and `invoices` edge
/// functions — through the EXACT decoder the live client uses
/// (`APIClient.makeJSONDecoder()`), so a future model change that breaks the
/// contract fails CI instead of silently shipping blank UI.
///
/// Follow-up (tracked in ios-docs): backfill behavioural unit tests for the
/// logic-heavy ViewModels/Services using MockURLProtocol; this file covers the
/// decode/contract layer where the regressions actually originated.
///
/// `@MainActor` because `APIClient` (and its `makeJSONDecoder()`) is
/// main-actor-isolated; the stored `decoder` initializer below runs in the
/// type's actor context.
@MainActor
final class PayloadContractTests: XCTestCase {

    private let decoder = APIClient.makeJSONDecoder()

    private func data(_ json: String) -> Data { Data(json.utf8) }

    // MARK: - Today Dashboard (IOS-027)

    func testTodayDashboardDecodesRealPayload() throws {
        // Mirrors supabase/functions/today-dashboard/index.ts response.
        let json = """
        {
          "date": "2026-06-25T00:00:00.000Z",
          "appointments": [],
          "appointmentCount": 3,
          "tasks": [],
          "taskCount": 7,
          "overdueTasks": [],
          "overdueCount": 2,
          "recentActivities": [],
          "pendingApprovals": [],
          "pendingApprovalCount": 1,
          "metrics": { "newLeads": 4, "todayRevenue": 12500.5, "dealsWon": 2 }
        }
        """
        let dash = try decoder.decode(TodayDashboard.self, from: data(json))
        XCTAssertEqual(dash.openTasks, 7)
        XCTAssertEqual(dash.overdueTaskCount, 2)
        XCTAssertEqual(dash.appointments, 3)
        XCTAssertEqual(dash.pendingApprovals, 1)
        XCTAssertEqual(dash.newLeads, 4)
        XCTAssertEqual(dash.todayRevenue, 12500.5, accuracy: 0.001)
        XCTAssertEqual(dash.dealsWon, 2)
    }

    // MARK: - Activity Feed (IOS-027)

    func testActivityFeedDecodesAndMapsColumns() throws {
        // Mirrors supabase/functions/activities/index.ts list response (raw
        // business_record_activities rows wrapped in { data, total, ... }).
        let json = """
        {
          "data": [
            {
              "id": "act-1",
              "activity_type": "call",
              "subject": "Called about renewal",
              "notes": "Left voicemail",
              "business_record_id": "br-99",
              "created_by": "user-5",
              "created_at": "2026-06-24T15:30:00.000Z"
            },
            {
              "id": "act-2",
              "activity_type": "note",
              "subject": "Onsite visit",
              "description": "Replaced fuser",
              "company_id": "co-7",
              "user": { "id": "u9", "full_name": "Pat Lee" },
              "created_at": "2026-06-23T09:00:00.000Z"
            }
          ],
          "total": 2, "page": 1, "limit": 20
        }
        """
        let wrapped = try decoder.decode(WrappedArrayResponse<ActivityItem>.self, from: data(json))
        XCTAssertEqual(wrapped.data.count, 2)

        let first = wrapped.data[0]
        XCTAssertEqual(first.type, "call")
        XCTAssertEqual(first.title, "Called about renewal")
        XCTAssertEqual(first.description, "Left voicemail")
        XCTAssertEqual(first.entityId, "br-99")
        XCTAssertEqual(first.entityType, "business_record")
        XCTAssertEqual(first.userId, "user-5")
        XCTAssertNotNil(first.createdAt)
        XCTAssertNotNil(first.route, "An activity with a business_record_id should route")

        let second = wrapped.data[1]
        XCTAssertEqual(second.type, "note")
        XCTAssertEqual(second.title, "Onsite visit")
        XCTAssertEqual(second.description, "Replaced fuser")     // falls back to `description`
        XCTAssertEqual(second.entityId, "co-7")                  // falls back to company_id
        XCTAssertEqual(second.userName, "Pat Lee")               // nested user.full_name
    }

    // MARK: - Global Search (IOS-028)

    func testSearchEmptyBucketsDecodeToEmptyResults() throws {
        let json = """
        { "query": "zzz", "totalResults": 0, "results": {} }
        """
        let resp = try decoder.decode(SearchResponse.self, from: data(json))
        XCTAssertEqual(resp.total, 0)
        XCTAssertTrue(resp.results.isEmpty)
    }

    func testSearchFlattensKeyedBucketsIntoTypedResults() throws {
        // Mirrors supabase/functions/search/index.ts keyed-object response.
        let json = """
        {
          "query": "acme",
          "totalResults": 7,
          "results": {
            "businessRecords": [
              { "id": "br1", "company_name": "Acme Corp", "primary_contact_name": "Jane", "record_type": "customer", "status": "active" }
            ],
            "contacts": [
              { "id": "c1", "first_name": "John", "last_name": "Doe", "email": "j@x.com", "phone": "5551212" }
            ],
            "quotes": [
              { "id": "q1", "quote_number": "Q-100", "title": "Big deal", "status": "draft", "total_amount": 5000 }
            ],
            "tickets": [
              { "id": "t1", "ticket_number": "T-1", "title": "Paper jam", "status": "open" }
            ],
            "equipment": [
              { "id": "e1", "serial_number": "SN1", "model_number": "MX-5", "manufacturer": "Canon" }
            ],
            "projects": [
              { "id": "p1", "name": "Migration", "description": "d", "status": "open" }
            ],
            "users": [
              { "id": "u1", "first_name": "Sam", "last_name": "Smith", "email": "s@x.com" }
            ]
          }
        }
        """
        let resp = try decoder.decode(SearchResponse.self, from: data(json))
        // 5 routable buckets; projects + users intentionally excluded.
        XCTAssertEqual(resp.results.count, 5)
        XCTAssertEqual(resp.total, 7)

        XCTAssertTrue(resp.results.contains { $0.type == "customer" && $0.title == "Acme Corp" })
        XCTAssertTrue(resp.results.contains { $0.type == "contact" && $0.title == "John Doe" })
        XCTAssertTrue(resp.results.contains { $0.type == "quote" && $0.title == "Quote #Q-100" })
        XCTAssertTrue(resp.results.contains { $0.type == "ticket" && $0.title == "Ticket #T-1" })
        XCTAssertTrue(resp.results.contains { $0.type == "equipment" && $0.title == "SN1" })

        XCTAssertFalse(resp.results.contains { $0.type == "project" })
        XCTAssertFalse(resp.results.contains { $0.type == "user" })
    }

    // MARK: - Invoices (IOS-030)

    func testInvoiceDecodesCanonicalColumns() throws {
        // Mirrors supabase/functions/invoices/index.ts list response: raw
        // select('*') columns wrapped in { data, total, ... }.
        let json = """
        {
          "data": [
            {
              "id": "inv1",
              "invoice_number": "1042",
              "invoice_status": "open",
              "total_amount": 1200.0,
              "amount_paid": 200.0,
              "balance_due": 1000.0,
              "paid_date": null,
              "due_date": "2026-07-01T00:00:00.000Z",
              "customerName": "Acme Corp"
            }
          ],
          "total": 1, "page": 1, "limit": 50
        }
        """
        let wrapped = try decoder.decode(WrappedArrayResponse<Invoice>.self, from: data(json))
        let inv = try XCTUnwrap(wrapped.data.first)
        XCTAssertEqual(inv.status, "open")              // from invoice_status, not phantom status
        XCTAssertEqual(inv.invoiceNumber, "1042")
        XCTAssertEqual(inv.totalAmount, 1200.0)
        XCTAssertEqual(inv.amountPaid, 200.0)
        XCTAssertEqual(inv.amountDue, 1000.0)           // from balance_due, not amount_due
        XCTAssertEqual(inv.statusEnum, .open)
        XCTAssertEqual(inv.customerName, "Acme Corp")
    }

    func testInvoiceFallsBackToLegacyColumns() throws {
        // A payload that only carries the legacy columns must still decode so we
        // don't regress older backends mid-rollout.
        let json = """
        {
          "id": "inv2",
          "status": "paid",
          "amount_due": 50.0,
          "total_amount": 300.0
        }
        """
        let inv = try decoder.decode(Invoice.self, from: data(json))
        XCTAssertEqual(inv.status, "paid")
        XCTAssertEqual(inv.amountDue, 50.0)
        XCTAssertEqual(inv.statusEnum, .paid)
    }
}
