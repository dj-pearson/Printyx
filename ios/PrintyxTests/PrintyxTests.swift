import XCTest
@testable import Printyx

final class PrintyxTests: XCTestCase {

    func testJWTDecoding() throws {
        // A sample JWT payload (base64url-encoded)
        // Header: {"alg": "HS256", "typ": "JWT"}
        // Payload: {"sub": "user-123", "email": "test@printyx.net", "exp": 9999999999, "app_metadata": {"tenantId": "tenant-456", "roleLevel": 5, "isPlatformUser": false}}
        let token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBwcmludHl4Lm5ldCIsImV4cCI6OTk5OTk5OTk5OSwiYXBwX21ldGFkYXRhIjp7InRlbmFudElkIjoidGVuYW50LTQ1NiIsInJvbGVMZXZlbCI6NSwiaXNQbGF0Zm9ybVVzZXIiOmZhbHNlfX0.placeholder"

        let payload = JWTPayload.decode(from: token)
        XCTAssertNotNil(payload)
        XCTAssertEqual(payload?.sub, "user-123")
        XCTAssertEqual(payload?.email, "test@printyx.net")
        XCTAssertEqual(payload?.tenantId, "tenant-456")
        XCTAssertEqual(payload?.roleLevel, 5)
        XCTAssertFalse(payload?.isPlatformUser ?? true)
    }

    func testTaskStatusSortOrder() {
        let statuses = TaskStatus.allCases.sorted { $0.sortOrder < $1.sortOrder }
        XCTAssertEqual(statuses.first, .inProgress)
        XCTAssertEqual(statuses.last, .cancelled)
    }

    func testTaskPrioritySortOrder() {
        let priorities = TaskPriority.allCases.sorted { $0.sortOrder < $1.sortOrder }
        XCTAssertEqual(priorities.first, .urgent)
        XCTAssertEqual(priorities.last, .low)
    }

    func testBusinessRecordDisplayName() {
        var record = BusinessRecord(
            id: "1",
            tenantId: nil,
            recordType: .lead,
            companyName: "Acme Corp"
        )
        XCTAssertEqual(record.displayName, "Acme Corp")

        record.companyName = nil
        record.primaryContactName = "John Doe"
        XCTAssertEqual(record.displayName, "John Doe")
    }

    func testOpportunityWeightedValue() {
        let opp = Opportunity(
            id: "1",
            tenantId: nil,
            estimatedAmount: 100_000,
            probability: 60
        )
        XCTAssertEqual(opp.weightedValue, 60_000)
    }

    func testDealStageSortOrder() {
        let stages = DealStage.allCases.sorted { $0.sortOrder < $1.sortOrder }
        XCTAssertEqual(stages.first, .new)
        XCTAssertEqual(stages.last, .closedLost)
    }
}
