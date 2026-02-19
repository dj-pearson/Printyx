import Foundation
import Combine

/// View model for the Home/Dashboard tab.
@MainActor
final class HomeViewModel: ObservableObject {

    // MARK: - Published State

    @Published var dashboard: TodayDashboard?
    @Published var activities: [ActivityItem] = []
    @Published var notifications: [AppNotification] = []
    @Published var searchResults: [SearchResult] = []
    @Published var isLoading = false
    @Published var isSearching = false
    @Published var error: String?
    @Published var searchText = ""
    @Published var showingSearch = false

    var unreadNotificationCount: Int {
        notifications.filter { $0.isRead != true }.count
    }

    // MARK: - Dependencies

    private let dashboardService: DashboardService
    private var searchCancellable: AnyCancellable?

    init(dashboardService: DashboardService) {
        self.dashboardService = dashboardService
        setupSearch()
    }

    // MARK: - Search Debounce

    private func setupSearch() {
        searchCancellable = $searchText
            .debounce(for: .milliseconds(400), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] query in
                guard let self, !query.isEmpty else {
                    self?.searchResults = []
                    return
                }
                Task { await self.performSearch(query) }
            }
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

    // MARK: - Search

    private func performSearch(_ query: String) async {
        isSearching = true
        do {
            searchResults = try await dashboardService.search(query: query)
        } catch {
            searchResults = []
        }
        isSearching = false
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
