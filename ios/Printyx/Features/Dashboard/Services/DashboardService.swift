import Foundation

/// Service layer for dashboard, activity feed, notifications, and global search.
@MainActor
final class DashboardService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - Dashboard

    func fetchTodayDashboard() async throws -> TodayDashboard {
        try await apiClient.request(.todayDashboard())
    }

    // MARK: - Activity Feed

    func fetchActivities(page: Int = 1, limit: Int = 20) async throws -> [ActivityItem] {
        try await apiClient.requestArray(.activityFeed(page: page, limit: limit))
    }

    // MARK: - Notifications

    func fetchNotifications(page: Int = 1, limit: Int = 25) async throws -> [AppNotification] {
        try await apiClient.requestArray(.notifications(page: page, limit: limit))
    }

    func markNotificationRead(id: String) async throws {
        try await apiClient.requestVoid(.markNotificationRead(id: id))
    }

    func markAllNotificationsRead() async throws {
        try await apiClient.requestVoid(.markAllNotificationsRead())
    }

    // MARK: - Search

    func search(query: String) async throws -> [SearchResult] {
        let response: SearchResponse = try await apiClient.request(.globalSearch(query: query))
        return response.results ?? []
    }
}
