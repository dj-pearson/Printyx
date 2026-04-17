import XCTest
@testable import Printyx

@MainActor
final class LastViewedRecordStoreTests: XCTestCase {

    // Using the shared store is fine because each test clears it first —
    // UserDefaults writes are scoped to the test bundle.
    func testRecordAndFreshWithinTTL() {
        let store = LastViewedRecordStore.shared
        store.clear()

        store.record(id: "rec-1", kind: .lead, displayName: "Acme Corp")

        let snapshot = store.fresh()
        XCTAssertNotNil(snapshot)
        XCTAssertEqual(snapshot?.id, "rec-1")
        XCTAssertEqual(snapshot?.kind, .lead)
        XCTAssertEqual(snapshot?.displayName, "Acme Corp")
    }

    func testOverwritingKeepsLatest() {
        let store = LastViewedRecordStore.shared
        store.clear()

        store.record(id: "rec-1", kind: .lead, displayName: "Acme")
        store.record(id: "rec-2", kind: .customer, displayName: "Beta Inc")

        XCTAssertEqual(store.fresh()?.id, "rec-2")
        XCTAssertEqual(store.fresh()?.kind, .customer)
    }

    func testClearRemovesSnapshot() {
        let store = LastViewedRecordStore.shared
        store.record(id: "rec-1", kind: .lead, displayName: "Acme")
        store.clear()

        XCTAssertNil(store.fresh())
        XCTAssertNil(store.current)
    }
}
