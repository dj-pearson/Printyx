import SwiftUI

/// Home dashboard tab with today's snapshot, quick actions, activity feed, and notifications.
struct HomeView: View {
    @StateObject private var viewModel: HomeViewModel
    @ObservedObject var authManager: AuthManager

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
                GlobalSearchView(viewModel: viewModel)
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
                    value: "\(dashboard.openTasks ?? 0)",
                    icon: "checklist",
                    color: .printyxPrimary
                )
                MetricCard(
                    label: "Due Today",
                    value: "\(dashboard.dueTodayTasks ?? 0)",
                    icon: "clock.badge.exclamationmark",
                    color: .statusPending
                )
                MetricCard(
                    label: "Tickets",
                    value: "\(dashboard.openTickets ?? 0)",
                    icon: "wrench.and.screwdriver",
                    color: .printyxAccent
                )
                MetricCard(
                    label: "New Leads",
                    value: "\(dashboard.newLeadsToday ?? 0)",
                    icon: "person.badge.plus",
                    color: .statusNew
                )
            }
        }
    }

    // MARK: - Quick Actions

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            Text("QUICK ACTIONS")
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
                .tracking(0.5)

            HStack(spacing: AppTheme.Spacing.md) {
                QuickActionButton(icon: "person.badge.plus", label: "New Lead", color: .stageNew)
                QuickActionButton(icon: "wrench.and.screwdriver", label: "New Ticket", color: .printyxAccent)
                QuickActionButton(icon: "checkmark.circle", label: "New Task", color: .printyxPrimary)
                QuickActionButton(icon: "doc.text", label: "New Quote", color: .printyxSecondary)
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
                    ActivityRow(activity: activity)

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

struct QuickActionButton: View {
    let icon: String
    let label: String
    let color: Color

    var body: some View {
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

// MARK: - Global Search View

struct GlobalSearchView: View {
    @ObservedObject var viewModel: HomeViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SearchBar(text: $viewModel.searchText, placeholder: "Search customers, tickets, quotes...")
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.vertical, AppTheme.Spacing.sm)

                if viewModel.isSearching {
                    LoadingView(message: "Searching...")
                } else if viewModel.searchResults.isEmpty && !viewModel.searchText.isEmpty {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "No Results",
                        message: "Try a different search term."
                    )
                } else {
                    List(viewModel.searchResults) { result in
                        HStack(spacing: AppTheme.Spacing.md) {
                            Image(systemName: result.icon)
                                .font(.system(size: 16))
                                .foregroundStyle(Color.printyxPrimary)
                                .frame(width: 28)

                            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                                Text(result.title ?? "")
                                    .font(.printyxSubheadline)
                                    .lineLimit(1)
                                HStack(spacing: AppTheme.Spacing.sm) {
                                    if let type = result.type {
                                        StatusBadge(type.capitalized, color: .printyxPrimary)
                                    }
                                    if let subtitle = result.subtitle {
                                        Text(subtitle)
                                            .font(.printyxSmall)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
