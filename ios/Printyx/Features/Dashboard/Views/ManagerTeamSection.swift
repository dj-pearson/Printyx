import SwiftUI

/// The "My Team" section rendered on Home for managers (roleLevel >= 5).
/// Four cards — Pipeline, Activities by Rep, Leaderboard, No-Touch Alerts —
/// each wired to an independent load so one 500 doesn't blank the section.
struct ManagerTeamSection: View {
    @StateObject private var viewModel: ManagerReportsViewModel

    init(apiClient: APIClient) {
        _viewModel = StateObject(
            wrappedValue: ManagerReportsViewModel(
                service: ManagerReportsService(apiClient: apiClient)
            )
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            Text("MY TEAM")
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
                .tracking(0.5)

            pipelineCard
            activitiesCard
            leaderboardCard
            noTouchCard
        }
        .task { await viewModel.loadAll() }
    }

    // MARK: - Pipeline

    private var pipelineCard: some View {
        TeamCard(title: "Team Pipeline", icon: "chart.pie.fill", error: viewModel.pipelineError) {
            Task { await viewModel.loadPipeline() }
        } content: {
            HStack(alignment: .top, spacing: AppTheme.Spacing.lg) {
                pipelineStat(
                    label: "Open",
                    value: currency(viewModel.pipeline?.pipelineValue)
                )
                pipelineStat(
                    label: "Weighted",
                    value: currency(viewModel.pipeline?.weightedValue)
                )
                pipelineStat(
                    label: "Deals",
                    value: "\(viewModel.pipeline?.openOpportunityCount ?? 0)"
                )
            }
        }
    }

    private func pipelineStat(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.printyxSubheadline)
        }
    }

    // MARK: - Activities by rep

    private var activitiesCard: some View {
        TeamCard(title: "Activity This Week", icon: "bolt.fill", error: viewModel.activitiesError) {
            Task { await viewModel.loadActivities() }
        } content: {
            if viewModel.activities.isEmpty {
                Text("No activity logged yet this week.")
                    .font(.printyxCaption)
                    .foregroundStyle(.tertiary)
            } else {
                VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                    let maxCount = max(viewModel.activities.map(\.totalCount).max() ?? 1, 1)
                    ForEach(viewModel.activities.prefix(6)) { rep in
                        activityBar(rep: rep, maxCount: maxCount)
                    }
                }
            }
        }
    }

    private func activityBar(rep: TeamRepActivity, maxCount: Int) -> some View {
        HStack(spacing: AppTheme.Spacing.sm) {
            Text(rep.name ?? "Rep")
                .font(.printyxCaption)
                .lineLimit(1)
                .frame(width: 96, alignment: .leading)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(.tertiarySystemFill))
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.printyxPrimary)
                        .frame(width: geo.size.width * CGFloat(rep.totalCount) / CGFloat(maxCount))
                }
            }
            .frame(height: 8)

            Text("\(rep.totalCount)")
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
                .frame(width: 28, alignment: .trailing)
        }
    }

    // MARK: - Leaderboard

    private var leaderboardCard: some View {
        TeamCard(title: "Leaderboard · Month", icon: "trophy.fill", error: viewModel.leaderboardError) {
            Task { await viewModel.loadLeaderboard() }
        } content: {
            if viewModel.leaderboard.isEmpty {
                Text("No closed-won deals yet this month.")
                    .font(.printyxCaption)
                    .foregroundStyle(.tertiary)
            } else {
                VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                    ForEach(viewModel.leaderboard.prefix(5)) { entry in
                        HStack {
                            Text("\(entry.rank ?? 0).")
                                .font(.printyxCaption)
                                .foregroundStyle(.secondary)
                                .frame(width: 20, alignment: .leading)
                            Text(entry.name ?? "Rep")
                                .font(.printyxCaption)
                                .lineLimit(1)
                            Spacer()
                            Text(currency(entry.closedWonAmount))
                                .font(.printyxCaption)
                        }
                    }
                }
            }
        }
    }

    // MARK: - No-touch alerts

    private var noTouchCard: some View {
        TeamCard(title: "No-Touch Alerts", icon: "exclamationmark.bubble.fill", error: viewModel.noTouchError) {
            Task { await viewModel.loadNoTouch() }
        } content: {
            if viewModel.noTouchAlerts.isEmpty {
                Text("All reps have recent touches — nice work.")
                    .font(.printyxCaption)
                    .foregroundStyle(.tertiary)
            } else {
                VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                    ForEach(viewModel.noTouchAlerts.prefix(5)) { alert in
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(alert.repName ?? "Rep")
                                    .font(.printyxCaption)
                                    .lineLimit(1)
                                Text(alert.opportunityName ?? alert.customerName ?? "")
                                    .font(.printyxSmall)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            if let days = alert.daysSinceLastActivity {
                                StatusBadge("\(days)d", color: .priorityHigh)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private func currency(_ value: Double?) -> String {
        guard let v = value else { return "—" }
        return v.formatted(.currency(code: "USD").precision(.fractionLength(0)))
    }
}

// MARK: - Team card shell

private struct TeamCard<Content: View>: View {
    let title: String
    let icon: String
    let error: String?
    let retry: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            HStack {
                Label(title, systemImage: icon)
                    .font(.printyxSubheadline)
                Spacer()
                if error != nil {
                    Button("Retry", action: retry)
                        .font(.printyxSmall)
                        .foregroundStyle(Color.printyxPrimary)
                }
            }

            if let error {
                Text(error)
                    .font(.printyxSmall)
                    .foregroundStyle(.secondary)
            } else {
                content()
            }
        }
        .padding(AppTheme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(AppTheme.Radius.md)
    }
}
