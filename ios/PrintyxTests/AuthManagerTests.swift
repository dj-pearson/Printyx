import XCTest
@testable import Printyx

@MainActor
final class AuthManagerTests: XCTestCase {

    override func setUp() async throws {
        MockURLProtocol.reset()
        KeychainManager.shared.clearAll()
    }

    // MARK: - Login

    func testLoginSuccessStoresTokensAndUser() async throws {
        MockURLProtocol.handler = { request in
            guard request.url?.path.hasSuffix("/mobile-auth/login") == true else {
                let r = HTTPURLResponse(url: request.url!, statusCode: 404, httpVersion: nil, headerFields: nil)!
                return (r, Data())
            }
            let body: [String: Any] = [
                "access_token": "acc-123",
                "refresh_token": "ref-456",
                "expires_in": 3600,
                "user": [
                    "id": "user-1",
                    "email": "rep@printyx.net",
                    "app_metadata": [
                        "tenantId": "tenant-42",
                        "roleLevel": 5,
                        "isPlatformUser": false
                    ]
                ]
            ]
            let r = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (r, try JSONSerialization.data(withJSONObject: body))
        }

        let client = MockAPIClientFactory.make()
        let auth = AuthManager(apiClient: client)
        await auth.login(email: "rep@printyx.net", password: "secret")

        XCTAssertTrue(auth.isAuthenticated)
        XCTAssertEqual(auth.currentUser?.email, "rep@printyx.net")
        XCTAssertEqual(auth.currentUser?.tenantId, "tenant-42")
        XCTAssertEqual(auth.currentUser?.roleLevel, 5)
        XCTAssertEqual(KeychainManager.shared.getAccessToken(), "acc-123")
        XCTAssertEqual(KeychainManager.shared.getTenantId(), "tenant-42")
    }

    func testLoginInvalidCredentialsSurfacesError() async throws {
        MockURLProtocol.handler = { request in
            let r = HTTPURLResponse(url: request.url!, statusCode: 400, httpVersion: nil, headerFields: nil)!
            let body = #"{"error":"invalid_grant","error_description":"Invalid login credentials"}"#
            return (r, Data(body.utf8))
        }

        let client = MockAPIClientFactory.make()
        let auth = AuthManager(apiClient: client)
        await auth.login(email: "rep@printyx.net", password: "wrong")

        XCTAssertFalse(auth.isAuthenticated)
        XCTAssertNil(KeychainManager.shared.getAccessToken())
        XCTAssertNotNil(auth.error)
    }

    // MARK: - Logout

    func testLogoutClearsStateAndAttemptsServerRevoke() async throws {
        KeychainManager.shared.setAccessToken("acc-123")
        KeychainManager.shared.setRefreshToken("ref-456")
        KeychainManager.shared.setTenantId("tenant-42")

        var logoutCalled = false
        MockURLProtocol.handler = { request in
            if request.url?.path.contains("/auth/v1/logout") == true {
                logoutCalled = true
            }
            let r = HTTPURLResponse(url: request.url!, statusCode: 204, httpVersion: nil, headerFields: nil)!
            return (r, Data())
        }

        let client = MockAPIClientFactory.make()
        let auth = AuthManager(apiClient: client)
        auth.logout()

        // Give the best-effort server call a moment to fire. Logout is
        // deliberately async-fire-and-forget so local state clears
        // immediately regardless of the network result.
        try? await Task.sleep(nanoseconds: 300_000_000)

        XCTAssertFalse(auth.isAuthenticated)
        XCTAssertNil(KeychainManager.shared.getAccessToken())
        XCTAssertNil(KeychainManager.shared.getTenantId())
        XCTAssertTrue(logoutCalled, "logout should fire a best-effort POST to /auth/v1/logout")
    }
}
