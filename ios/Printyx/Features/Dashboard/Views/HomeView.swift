import SwiftUI

/// Home dashboard tab with today's snapshot, quick actions, activity feed, and notifications.
struct HomeView: View {
    @EnvironmentObject private var apiClient: APIClient
    @EnvironmentObject private var router: AppRouter
    @StateObject private var viewModel: HomeViewModel
    @ObservedObject var authManager: AuthManager
    @State private var activeQuickAction: HomeQuickAction?

    /// Managers (roleLevel >= 5) see the team roll-up section. Reps don't.
    private var showsManagerSection: Bool {
        (authManager.currentUser?.roleLevel ?? 0) >= 5
    }

    init(dashboardService: DashboardService, authManager: AuthManager) {
        _viewModel = StateObject(wrappedValue: HomeViewModel(dashboardService: dashboardService))
        self.authManager = authManager
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppTheme.Spacing.lg) {
                    if viewModel.isLoading && viewModel.dashboard == nil {
                        LoadingView(message: "Loading dashboard...")
                            .frame(height: 300)
                    } else if let error = viewModel.error, viewModel.dashboard == nil {
                        ErrorView(message: error, retryAction: { await viewModel.refresh() })
                    } else {
                        // Greeting
                        greetingSection

                        // Search bar
                        searchSection

                        // KPI Snapshot
                        if let dashboard = viewModel.dashboard {
                            snapshotSection(dashboard)
                        }

                        // Quick Actions
                        quickActionsSection

                        // My Team (managers only)
                        if showsManagerSection {
                            ManagerTeamSection(apiClient: apiClient)
                        }

                        // Notifications
                        if !viewModel.notifications.isEmpty {
                            notificationsSection
                        }

                        // Activity Feed
                        if !viewModel.activities.isEmpty {
                            activitySection
                        }
                    }
                }
                .padding(.horizontal, AppTheme.Spacing.lg)
                .padding(.bottom, AppTheme.Spacing.xxl)
            }
            .navigationTitle("Home")
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $viewModel.showingSearch) {
                // Present the working, routing search sheet (IOS-028). The old
                // in-Home GlobalSearchView whose rows never routed has been
                // removed.
                UniversalSearchSheet(apiClient: apiClient)
            }
            .task {
                if viewModel.dashboard == nil {
                    await viewModel.loadInitial()
                }
            }
        }
    }

    // MARK: - Greeting

    private var greetingSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                Text(greetingText)
                    .font(.printyxTitle)
                Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()))
                    .font(.printyxCaption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if let user = authManager.currentUser {
                AvatarView(initials: user.initials, size: 44)
            }
        }
        .padding(.top, AppTheme.Spacing.sm)
    }

    private var greetingText: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let name = authManager.currentUser?.firstName ?? ""
        let greeting: String
        switch hour {
        case 0..<12: greeting = "Good morning"
        case 12..<17: greeting = "Good afternoon"
        default: greeting = "Good evening"
        }
        return name.isEmpty ? greeting : "\(greeting), \(name)"
    }

    // MARK: - Search

    private var searchSection: some View {
        Button {
            viewModel.showingSearch = true
        } label: {
            HStack(spacing: AppTheme.Spacing.sm) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.secondary)
                Text("Search everything...")
                    .font(.printyxBody)
                    .foregroundStyle(.tertiary)
                Spacer()
            }
            .padding(.horizontal, AppTheme.Spacing.md)
            .padding(.vertical, AppTheme.Spacing.sm + 2)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(AppTheme.Radius.md)
        }
    }

    // MARK: - Snapshot KPIs

    private func snapshotSection(_ dashboard: TodayDashboard) -> some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            Text("TODAY'S SNAPSHOT")
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
                .tracking(0.5)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: AppTheme.Spacing.sm) {
                MetricCard(
                    label: "Open Tasks",
                    value: "\(dashboard.openTasks)",
                    icon: "checklist",
                    color: .printyxPrimary
                )
                MetricCard(
                    label: "Overdue",
                    value: "\(dashboard.overdueTaskCount)",
                    icon: "clock.badge.exclamationmark",
                    color: .statusOverdue
                )
                MetricCard(
                    label: "Appts",
                    value: "\(dashboard.appointments)",
                    icon: "calendar",
                    color: .printyxAccent
                )
                MetricCard(
                    label: "New Leads",
                    value: "\(dashboard.newLeads)",
                    icon: "person.badge.plus",
                    color: .statusNew
                )
            }

            // Revenue + deals-won the backend already returns (previously
            // dropped on the floor by the old data contract — IOS-027).
            HStack(spacing: AppTheme.Spacing.md) {
                MetricCard(
                    label: "Revenue Today",
                    value: formatRevenue(dashboard.todayRevenue),
                    icon: "dollarsign.circle",
                    color: .statusCompleted
                )
                MetricCard(
                    label: "Deals Won",
                    value: "\(dashboard.dealsWon)",
                    icon: "trophy",
                    color: .printyxSecondary
                )
            }
        }
    }

    private func formatRevenue(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"

        // Abbreviate with one decimal in the low range so $1,500 reads "$1.5K"
        // (not "$2K" — the old code divided then rounded to whole units), and
        // drop a trailing ".0" so $2,000 reads "$2K".
        func abbreviated(_ scaled: Double, _ suffix: String) -> String {
            let hasFraction = scaled.truncatingRemainder(dividingBy: 1) != 0
            formatter.maximumFractionDigits = (scaled < 10 && hasFraction) ? 1 : 0
            let base = formatter.string(from: NSNumber(value: scaled)) ?? "$\(Int(scaled))"
            return "\(base)\(suffix)"
        }

        let magnitude = abs(value)
        if magnitude >= 1_000_000 {
            return abbreviated(value / 1_000_000, "M")
        } else if magnitude >= 1_000 {
            return abbreviated(value / 1_000, "K")
        }
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }

    // MARK: - Quick Actions

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            Text("QUICK ACTIONS")
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
                .tracking(0.5)

            HStack(spacing: AppTheme.Spacing.md) {
                QuickActionButton(icon: "person.badge.plus", label: "New Lead", color: .stageNew) {
                    activeQuickAction = .newLead
                }
                QuickActionButton(icon: "wrench.and.screwdriver", label: "New Ticket", color: .printyxAccent) {
                    activeQuickAction = .newTicket
                }
                QuickActionButton(icon: "checkmark.circle", label: "New Task", color: .printyxPrimary) {
                    activeQuickAction = .newTask
                }
                QuickActionButton(icon: "doc.text", label: "New Quote", color: .printyxSecondary) {
                    activeQuickAction = .newQuote
                }
            }
        }
        .sheet(item: $activeQuickAction) { action in
            quickActionSheet(for: action)
        }
    }

    @ViewBuilder
    private func quickActionSheet(for action: HomeQuickAction) -> some View {
        switch action {
        case .newLead:
            CRMFormView(crmService: CRMService(apiClient: apiClient)) { _ in
                Task { await viewModel.refresh() }
            }
        case .newTicket:
            ServiceTicketFormView { _ in
                Task { await viewModel.refresh() }
            }
        case .newTask:
            TaskFormView(taskService: TaskService(apiClient: apiClient)) { _ in
                Task { await viewModel.refresh() }
            }
        case .newQuote:
            ProposalFormView(quoteService: QuoteService(apiClient: apiClient)) { _ in
                Task { await viewModel.refresh() }
            }
        }
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            HStack {
                Text("NOTIFICATIONS")
                    .font(.printyxSmall)
                    .foregroundStyle(.secondary)
                    .tracking(0.5)

                if viewModel.unreadNotificationCount > 0 {
                    Text("\(viewModel.unreadNotificationCount)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.statusOverdue)
                        .clipShape(Capsule())
                }

                Spacer()

                if viewModel.unreadNotificationCount > 0 {
                    Button("Mark all read") {
                        Task { await viewModel.markAllRead() }
                    }
                    .font(.printyxSmall)
                    .foregroundStyle(Color.printyxPrimary)
                }
            }

            VStack(spacing: 0) {
                ForEach(viewModel.notifications.prefix(5)) { notification in
                    NotificationRow(notification: notification)
                        .onTapGesture {
                            Task { await viewModel.markNotificationRead(notification) }
                        }

                    if notification.id != viewModel.notifications.prefix(5).last?.id {
                        Divider().padding(.leading, 44)
                    }
                }
            }
            .background(Color(.secondarySystemBackground))
            .cornerRadius(AppTheme.Radius.md)
        }
    }

    // MARK: - Activity Feed

    private var activitySection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            Text("RECENT ACTIVITY")
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
                .tracking(0.5)

            VStack(spacing: 0) {
                ForEach(viewModel.activities.prefix(8)) { activity in
                    Button {
                        if let route = activity.route { router.push(route) }
                    } label: {
                        ActivityRow(activity: activity)
                    }
                    .buttonStyle(.plain)
                    .disabled(activity.route == nil)

                    if activity.id != viewModel.activities.prefix(8).last?.id {
                        Divider().padding(.leading, 44)
                    }
                }
            }
            .background(Color(.secondarySystemBackground))
            .cornerRadius(AppTheme.Radius.md)
        }
    }
}

// MARK: - Quick Action Button

/// Discriminant for the four Home quick-action sheets. Used as the `.sheet(item:)`
/// identifier so SwiftUI can swap the presented view when the rep taps a
/// different button without double-presentation.
enum HomeQuickAction: String, Identifiable {
    case newLead, newTicket, newTask, newQuote
    var id: String { rawValue }
}

struct QuickActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            VStack(spacing: AppTheme.Spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundStyle(color)
                    .frame(width: 44, height: 44)
                    .background(color.opacity(0.12))
                    .clipShape(Circle())

                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

// MARK: - Notification Row

struct NotificationRow: View {
    let notification: AppNotification

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            Image(systemName: notification.icon)
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: notification.iconColor))
                .frame(width: 28)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                Text(notification.title ?? "Notification")
                    .font(.printyxCaption)
                    .fontWeight(notification.isRead == true ? .regular : .semibold)
                    .lineLimit(1)

                if let message = notification.message {
                    Text(message)
                        .font(.printyxSmall)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }

            Spacer()

            if let date = notification.createdAt {
                Text(date.relativeDescription)
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }

            if notification.isRead != true {
                Circle()
                    .fill(Color.printyxPrimary)
                    .frame(width: 8, height: 8)
            }
        }
        .padding(.horizontal, AppTheme.Spacing.md)
        .padding(.vertical, AppTheme.Spacing.sm)
        .opacity(notification.isRead == true ? 0.7 : 1.0)
    }
}

// MARK: - Activity Row

struct ActivityRow: View {
    let activity: ActivityItem

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            Image(systemName: activity.icon)
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: activity.iconColor))
                .frame(width: 28, height: 28)
                .background(Color(hex: activity.iconColor).opacity(0.12))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(activity.title ?? "Activity")
                    .font(.printyxCaption)
                    .lineLimit(1)
                if let desc = activity.description {
                    Text(desc)
                        .font(.printyxSmall)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if let date = activity.createdAt {
                Text(date.relativeDescription)
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, AppTheme.Spacing.md)
        .padding(.vertical, AppTheme.Spacing.sm)
    }
}

// The former in-Home `GlobalSearchView` was removed (IOS-028): its rows didn't
// route anywhere, duplicating the working `UniversalSearchSheet` which Home now
// presents directly. Keeping a single search implementation prevents the two
// from drifting apart again.
