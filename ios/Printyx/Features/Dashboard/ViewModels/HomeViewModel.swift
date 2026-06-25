import Foundation
import Combine

/// View model for the Home/Dashboard tab.
@MainActor
final class HomeViewModel: ObservableObject {

    // MARK: - Published State

    @Published var dashboard: TodayDashboard?
    @Published var activities: [ActivityItem] = []
    @Published var notifications: [AppNotification] = []
    @Published var isLoading = false
    @Published var error: String?
    // Global search now lives entirely in UniversalSearchSheet / its own
    // GlobalSearchViewModel (IOS-028). Home only owns the toggle that presents
    // the sheet.
    @Published var showingSearch = false

    var unreadNotificationCount: Int {
        notifications.filter { $0.isRead != true }.count
    }

    // MARK: - Dependencies

    private let dashboardService: DashboardService

    init(dashboardService: DashboardService) {
        self.dashboardService = dashboardService
    }

    // MARK: - Data Loading

    func loadInitial() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil

        do {
            async let dashboardRequest = dashboardService.fetchTodayDashboard()
            async let activitiesRequest = dashboardService.fetchActivities(page: 1, limit: 10)
            async let notificationsRequest = dashboardService.fetchNotifications(page: 1, limit: 10)

            let (fetchedDashboard, fetchedActivities, fetchedNotifications) = try await (
                dashboardRequest, activitiesRequest, notificationsRequest
            )

            self.dashboard = fetchedDashboard
            self.activities = fetchedActivities
            self.notifications = fetchedNotifications
        } catch let apiError as APIError {
            self.error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func refresh() async {
        await loadInitial()
    }

    // MARK: - Notifications

    func markNotificationRead(_ notification: AppNotification) async {
        do {
            try await dashboardService.markNotificationRead(id: notification.id)
            if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
                notifications[index].isRead = true
            }
        } catch {
            // Silently fail
        }
    }

    func markAllRead() async {
        do {
            try await dashboardService.markAllNotificationsRead()
            for i in notifications.indices {
                notifications[i].isRead = true
            }
        } catch {
            // Silently fail
        }
    }
}
