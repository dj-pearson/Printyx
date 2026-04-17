import XCTest
@testable import Printyx

@MainActor
final class APIClientTests: XCTestCase {

    override func setUp() async throws {
        MockURLProtocol.reset()
    }

    // MARK: - Headers

    func testRequestAttachesStandardHeaders() async throws {
        struct Dummy: Decodable { let ok: Bool }
        MockURLProtocol.handler = { request in
            let url = request.url ?? URL(string: "https://printyx.net")!
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, Data(#"{"ok":true}"#.utf8))
        }

        let client = MockAPIClientFactory.make()
        _ = try await client.request(APIEndpoint(path: "/api/tasks", method: .get)) as Dummy

        let recorded = MockURLProtocol.recordedRequests.last
        XCTAssertEqual(recorded?.value(forHTTPHeaderField: "X-Client"), "printyx-ios")
        XCTAssertEqual(recorded?.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertNotNil(recorded?.value(forHTTPHeaderField: "X-Request-ID"))
    }

    // MARK: - 401 retry

    func testUnauthorizedTriggersRefreshAndRetry() async throws {
        // Simulate: first call returns 401, the refresh call succeeds, the
        // retry returns 200. We count requests by path so we can assert the
        // full sequence.
        let keychain = KeychainManager.shared
        keychain.setAccessToken("expired-token")
        keychain.setRefreshToken("refresh-token-abc")

        var tasksCallCount = 0

        MockURLProtocol.handler = { request in
            let path = request.url?.path ?? ""
            if path.hasSuffix("/mobile-auth/refresh") {
                let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
                let body: [String: Any] = [
                    "access_token": "fresh-access",
                    "refresh_token": "fresh-refresh",
                    "expires_in": 3600,
                    "user": ["id": "user-1"]
                ]
                return (response, try JSONSerialization.data(withJSONObject: body))
            }
            if path.contains("tasks") {
                tasksCallCount += 1
                if tasksCallCount == 1 {
                    let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
                    return (response, Data())
                }
                // Retry succeeds.
                let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
                return (response, Data(#"{"ok":true}"#.utf8))
            }
            let response = HTTPURLResponse(url: request.url!, statusCode: 404, httpVersion: nil, headerFields: nil)!
            return (response, Data())
        }

        struct Dummy: Decodable { let ok: Bool }
        let client = MockAPIClientFactory.make(keychain: keychain)
        let result: Dummy = try await client.request(APIEndpoint(path: "/api/tasks"))

        XCTAssertTrue(result.ok)
        XCTAssertEqual(tasksCallCount, 2, "Expected the tasks endpoint to be called twice (initial + retry)")
        XCTAssertEqual(keychain.getAccessToken(), "fresh-access")
    }

    // MARK: - Cache fallback on network error

    func testNetworkErrorOnGetFallsBackToCache() async throws {
        let keychain = KeychainManager.shared
        keychain.setTenantId("tenant-X")
        PersistentResponseCache.shared.clear()
        PersistentResponseCache.shared.save(
            data: Data(#"{"ok":true}"#.utf8),
            tenantId: "tenant-X",
            path: "/api/tasks",
            query: "limit=25&page=1"
        )

        MockURLProtocol.handler = { _ in
            throw URLError(.notConnectedToInternet)
        }

        struct Dummy: Decodable { let ok: Bool }
        let client = MockAPIClientFactory.make(keychain: keychain)
        let result: Dummy = try await client.request(APIEndpoint(
            path: "/api/tasks",
            queryItems: [
                URLQueryItem(name: "page", value: "1"),
                URLQueryItem(name: "limit", value: "25"),
            ]
        ))

        XCTAssertTrue(result.ok, "APIClient should have served the cached payload instead of bubbling the network error.")
    }

    // MARK: - Offline queue

    func testOfflineMutationIsQueued() async throws {
        MockURLProtocol.handler = { _ in
            throw URLError(.notConnectedToInternet)
        }

        // Drain any leftover queued writes from prior tests.
        OfflineWriteQueue.shared.configure { _ in throw APIError.offlineQueued }
        await OfflineWriteQueue.shared.flush()
        let before = OfflineWriteQueue.shared.pendingCount

        struct Body: Encodable { let title: String }
        let client = MockAPIClientFactory.make()
        do {
            _ = try await client.requestVoid(APIEndpoint(
                path: "/api/tasks",
                method: .post,
                body: Body(title: "offline task")
            ))
            XCTFail("Expected APIError.offlineQueued")
        } catch let apiError as APIError {
            guard case .offlineQueued = apiError else {
                XCTFail("Expected .offlineQueued, got \(apiError)")
                return
            }
        }

        XCTAssertEqual(OfflineWriteQueue.shared.pendingCount, before + 1)
    }
}
