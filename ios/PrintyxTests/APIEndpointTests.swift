import XCTest
@testable import Printyx

final class APIEndpointTests: XCTestCase {

    // MARK: - queueableWhenOffline

    func testGetsAreNeverQueued() {
        let endpoint = APIEndpoint(path: "/api/leads", method: .get)
        XCTAssertFalse(endpoint.queueableWhenOffline)
    }

    func testPostToApiIsQueued() {
        let endpoint = APIEndpoint(path: "/api/leads/123/activities", method: .post)
        XCTAssertTrue(endpoint.queueableWhenOffline)
    }

    func testAuthLoginIsNotQueued() {
        let endpoint = APIEndpoint.login(body: EmptyBody())
        XCTAssertFalse(endpoint.queueableWhenOffline)
    }

    func testAuthLogoutIsNotQueued() {
        let endpoint = APIEndpoint.logout()
        XCTAssertFalse(endpoint.queueableWhenOffline)
    }

    func testRefreshTokenIsNotQueued() {
        let endpoint = APIEndpoint.refreshToken(body: EmptyBody())
        XCTAssertFalse(endpoint.queueableWhenOffline)
    }

    // MARK: - Manager endpoints

    func testManagerEndpointsConstructed() {
        XCTAssertEqual(APIEndpoint.teamPipeline().path, "/api/team-reports/pipeline")
        XCTAssertEqual(APIEndpoint.teamLeaderboard().path, "/api/team-reports/leaderboard")
        XCTAssertEqual(APIEndpoint.teamNoTouchAlerts().path, "/api/team-reports/no-touch")
        XCTAssertEqual(APIEndpoint.teamActivitiesByRep().path, "/api/team-reports/activities")
    }

    private struct EmptyBody: Encodable {}
}
