import SwiftUI

/// Pipeline and list view for sales opportunities.
struct OpportunityListView: View {
    @EnvironmentObject private var apiClient: APIClient
    @StateObject private var viewModel: OpportunityListViewModel
    @State private var showingCreate = false
    @State private var showingSearch = false
    @State private var selectedOpportunity: Opportunity?

    init(opportunityService: OpportunityService) {
        _viewModel = StateObject(wrappedValue: OpportunityListViewModel(opportunityService: opportunityService))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Pipeline metrics
                pipelineMetrics

                // View mode toggle
                Picker("View", selection: $viewModel.viewMode) {
                    ForEach(OpportunityListViewModel.ViewMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, AppTheme.Spacing.lg)
                .padding(.vertical, AppTheme.Spacing.sm)

                // Search
                SearchBar(text: $viewModel.searchText, placeholder: "Search opportunities...")
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.bottom, AppTheme.Spacing.sm)

                // Content
                if viewModel.isLoading && viewModel.opportunities.isEmpty {
                    LoadingView(message: "Loading pipeline...")
                } else if let error = viewModel.error, viewModel.opportunities.isEmpty {
                    ErrorView(message: error, retryAction: { await viewModel.refresh() })
                } else if viewModel.filteredOpportunities.isEmpty {
                    EmptyStateView(
                        icon: "chart.line.uptrend.xyaxis",
                        title: "No Opportunities",
                        message: "Your sales pipeline is empty.",
                        actionTitle: "Add Opportunity",
                        action: { showingCreate = true }
                    )
                } else {
                    switch viewModel.viewMode {
                    case .pipeline:
                        pipelineView
                    case .list:
                        listView
                    }
                }
            }
            .navigationTitle("Opportunities")
            .toolbar {
                GlobalSearchToolbarButton(isPresented: $showingSearch)

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCreate = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.printyxPrimary)
                    }
                    .accessibilityLabel("Add opportunity")
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $showingCreate) {
                OpportunityFormView(opportunityService: nil) { _ in
                    Task { await viewModel.refresh() }
                }
            }
            .sheet(item: $selectedOpportunity) { opp in
                OpportunityDetailView(
                    opportunityService: OpportunityService(apiClient: apiClient),
                    opportunityId: opp.id
                )
            }
            .sheet(isPresented: $showingSearch) {
                UniversalSearchSheet(apiClient: apiClient)
            }
            .task {
                if viewModel.opportunities.isEmpty {
                    await viewModel.loadInitial()
                }
            }
        }
    }

    // MARK: - Pipeline Metrics

    private var pipelineMetrics: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            MetricCard(
                label: "Pipeline",
                value: formatCurrency(viewModel.totalPipelineValue),
                icon: "chart.bar.fill",
                color: .printyxPrimary
            )

            MetricCard(
                label: "Weighted",
                value: formatCurrency(viewModel.weightedPipelineValue),
                icon: "scale.3d",
                color: .printyxSecondary
            )

            MetricCard(
                label: "Closing Soon",
                value: "\(viewModel.closingSoonCount)",
                icon: "clock.badge.exclamationmark",
                color: .statusPending
            )
        }
        .padding(.horizontal, AppTheme.Spacing.lg)
        .padding(.vertical, AppTheme.Spacing.sm)
    }

    // MARK: - Pipeline View (Kanban-style horizontal scroll)

    private var pipelineView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: AppTheme.Spacing.md) {
                ForEach(viewModel.pipelineStages, id: \.stage) { stageData in
                    PipelineColumn(
                        stage: stageData.stage,
                        opportunities: stageData.opportunities,
                        onSelect: { selectedOpportunity = $0 },
                        onMoveForward: { opp in
                            let stages = DealStage.allCases
                            if let currentIndex = stages.firstIndex(of: stageData.stage),
                               currentIndex + 1 < stages.count {
                                Task { await viewModel.updateStage(opp, to: stages[currentIndex + 1]) }
                            }
                        },
                        onReachedEnd: {
                            Task { await viewModel.loadMore() }
                        }
                    )
                }
            }
            .padding(.horizontal, AppTheme.Spacing.lg)
            .padding(.vertical, AppTheme.Spacing.sm)
        }
    }

    // MARK: - List View

    private var listView: some View {
        List {
            ForEach(viewModel.filteredOpportunities) { opp in
                OpportunityRowView(opportunity: opp)
                    .contentShape(Rectangle())
                    .onTapGesture { selectedOpportunity = opp }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        if value >= 1_000_000 {
            formatter.maximumFractionDigits = 1
            return formatter.string(from: NSNumber(value: value / 1_000_000)).map { "\($0)M" } ?? "$\(Int(value))"
        }
        if value >= 1_000 {
            return formatter.string(from: NSNumber(value: value / 1_000)).map { "\($0)K" } ?? "$\(Int(value))"
        }
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }
}

// MARK: - Metric Card

struct MetricCard: View {
    let label: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: AppTheme.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(color)
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(.primary)
            Text(label)
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppTheme.Spacing.md)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(AppTheme.Radius.md)
    }
}

// MARK: - Pipeline Column

struct PipelineColumn: View {
    let stage: DealStage
    let opportunities: [Opportunity]
    let onSelect: (Opportunity) -> Void
    let onMoveForward: (Opportunity) -> Void
    var onReachedEnd: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            // Header
            HStack {
                Circle()
                    .fill(Color(hex: stage.color))
                    .frame(width: 8, height: 8)
                Text(stage.displayName)
                    .font(.printyxCaption)
                    .fontWeight(.semibold)
                Text("(\(opportunities.count))")
                    .font(.printyxSmall)
                    .foregroundStyle(.secondary)
            }

            // Cards
            if opportunities.isEmpty {
                Text("No deals")
                    .font(.printyxSmall)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppTheme.Spacing.xl)
            } else {
                ForEach(opportunities) { opp in
                    PipelineCard(opportunity: opp)
                        .onTapGesture { onSelect(opp) }
                        .contextMenu {
                            Button {
                                onMoveForward(opp)
                            } label: {
                                Label("Move Forward", systemImage: "arrow.right")
                            }
                        }
                        .onAppear {
                            // When the last card in this column appears, nudge
                            // the view-model to fetch the next page. Safe no-op
                            // if another fetch is already in flight.
                            if opp.id == opportunities.last?.id {
                                onReachedEnd?()
                            }
                        }
                }
            }
        }
        .frame(width: 200)
    }
}

struct PipelineCard: View {
    let opportunity: Opportunity

    var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
            Text(opportunity.displayName)
                .font(.printyxCaption)
                .fontWeight(.medium)
                .lineLimit(2)

            if let amount = opportunity.estimatedAmount, amount > 0 {
                Text(formatCurrency(amount))
                    .font(.printyxSmall)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.printyxPrimary)
            }

            HStack(spacing: AppTheme.Spacing.xs) {
                if let prob = opportunity.probability {
                    Text("\(prob)%")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                }

                if let close = opportunity.closeDate {
                    Text(close.shortFormatted)
                        .font(.system(size: 10))
                        .foregroundStyle(close.isPast ? .red : .secondary)
                }
            }
        }
        .padding(AppTheme.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .cornerRadius(AppTheme.Radius.sm)
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }
}

// MARK: - Opportunity Row (List View)

struct OpportunityRowView: View {
    let opportunity: Opportunity

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            AvatarView(initials: opportunity.initials, size: 40, backgroundColor: stageColor)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                Text(opportunity.displayName)
                    .font(.printyxSubheadline)
                    .lineLimit(1)

                HStack(spacing: AppTheme.Spacing.sm) {
                    if let stage = opportunity.salesStage {
                        StatusBadge(
                            DealStage(rawValue: stage)?.displayName ?? stage,
                            color: stageColor
                        )
                    }
                    if let prob = opportunity.probability {
                        Text("\(prob)% likely")
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: AppTheme.Spacing.xs) {
                if let amount = opportunity.estimatedAmount, amount > 0 {
                    Text(formatCurrency(amount))
                        .font(.printyxCaption)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.printyxPrimary)
                }
                if let close = opportunity.closeDate {
                    Text(close.shortFormatted)
                        .font(.printyxSmall)
                        .foregroundStyle(close.isPast ? .red : .secondary)
                }
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }

    private var stageColor: Color {
        guard let stage = opportunity.salesStage,
              let dealStage = DealStage(rawValue: stage) else { return .secondary }
        return Color(hex: dealStage.color)
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }
}
