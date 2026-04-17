import Foundation

/// Service layer for manager / sales-leader reports. Each method hits a
/// dedicated team-reports endpoint on the Express + Edge Functions backend.
/// The caller is expected to gate access behind `roleLevel >= 5`.
@MainActor
final class ManagerReportsService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func fetchPipeline() async throws -> TeamPipelineSummary {
        try await apiClient.request(.teamPipeline())
    }

    func fetchActivitiesByRep(days: Int = 7) async throws -> [TeamRepActivity] {
        try await apiClient.requestArray(.teamActivitiesByRep(days: days))
    }

    func fetchLeaderboard(period: String = "month") async throws -> [TeamLeaderboardEntry] {
        try await apiClient.requestArray(.teamLeaderboard(period: period))
    }

    func fetchNoTouchAlerts(days: Int = 3) async throws -> [TeamNoTouchAlert] {
        try await apiClient.requestArray(.teamNoTouchAlerts(days: days))
    }
}
