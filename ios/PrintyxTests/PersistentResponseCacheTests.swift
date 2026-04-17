import XCTest
@testable import Printyx

@MainActor
final class PersistentResponseCacheTests: XCTestCase {

    override func setUp() async throws {
        PersistentResponseCache.shared.clear()
    }

    func testRoundTrip() {
        let cache = PersistentResponseCache.shared
        let payload = #"{"data":[{"id":"1"}]}"#.data(using: .utf8)!

        cache.save(data: payload, tenantId: "tenant-A", path: "/api/leads", query: "page=1")
        let loaded = cache.load(tenantId: "tenant-A", path: "/api/leads", query: "page=1")

        XCTAssertEqual(loaded, payload)
    }

    func testTenantIsolation() {
        // Save under tenant A, read under tenant B — must miss.
        let cache = PersistentResponseCache.shared
        let payload = #"{"data":[]}"#.data(using: .utf8)!

        cache.save(data: payload, tenantId: "tenant-A", path: "/api/leads", query: nil)

        XCTAssertNil(cache.load(tenantId: "tenant-B", path: "/api/leads", query: nil))
        XCTAssertNotNil(cache.load(tenantId: "tenant-A", path: "/api/leads", query: nil))
    }

    func testQueryVariantSeparation() {
        // Different query params → different cache keys.
        let cache = PersistentResponseCache.shared
        let payloadA = Data("a".utf8)
        let payloadB = Data("b".utf8)

        cache.save(data: payloadA, tenantId: "t", path: "/x", query: "page=1")
        cache.save(data: payloadB, tenantId: "t", path: "/x", query: "page=2")

        XCTAssertEqual(cache.load(tenantId: "t", path: "/x", query: "page=1"), payloadA)
        XCTAssertEqual(cache.load(tenantId: "t", path: "/x", query: "page=2"), payloadB)
    }

    func testMaxAgeExclusion() {
        let cache = PersistentResponseCache.shared
        let payload = Data("x".utf8)
        cache.save(data: payload, tenantId: "t", path: "/y", query: nil)

        // Zero maxAge means anything older than "now" is excluded.
        XCTAssertNil(cache.load(tenantId: "t", path: "/y", query: nil, maxAge: 0))
    }
}
