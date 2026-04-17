import SwiftUI

/// Combined Proposals & Quotes list view.
struct QuoteListView: View {
    @StateObject private var viewModel: QuoteListViewModel
    @State private var showingCreateProposal = false
    @State private var showingCreateQuote = false
    @State private var selectedProposal: Proposal?
    @State private var selectedQuote: Quote?

    init(quoteService: QuoteService) {
        _viewModel = StateObject(wrappedValue: QuoteListViewModel(quoteService: quoteService))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Metrics
                metricsBar

                // Tab selector
                Picker("Type", selection: $viewModel.selectedTab) {
                    ForEach(QuoteListViewModel.QuoteTab.allCases) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, AppTheme.Spacing.lg)
                .padding(.vertical, AppTheme.Spacing.sm)

                // Search
                SearchBar(text: $viewModel.searchText, placeholder: "Search \(viewModel.selectedTab.rawValue.lowercased())...")
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.bottom, AppTheme.Spacing.sm)

                // Status filter chips
                statusFilterChips

                // Content
                if viewModel.isLoading && viewModel.proposals.isEmpty {
                    LoadingView(message: "Loading...")
                } else if let error = viewModel.error, viewModel.proposals.isEmpty && viewModel.quotes.isEmpty {
                    ErrorView(message: error, retryAction: { await viewModel.refresh() })
                } else {
                    switch viewModel.selectedTab {
                    case .proposals:
                        proposalsList
                    case .quotes:
                        quotesList
                    }
                }
            }
            .navigationTitle("Quotes & Proposals")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            showingCreateProposal = true
                        } label: {
                            Label("New Proposal", systemImage: "doc.text")
                        }
                        Button {
                            showingCreateQuote = true
                        } label: {
                            Label("New Quote", systemImage: "doc.richtext")
                        }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.printyxPrimary)
                    }
                    .accessibilityLabel("Create proposal or quote")
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $showingCreateProposal) {
                ProposalFormView(quoteService: nil) { _ in
                    Task { await viewModel.refresh() }
                }
            }
            .sheet(isPresented: $showingCreateQuote) {
                QuoteFormView(quoteService: nil) { _ in
                    Task { await viewModel.refresh() }
                }
            }
            .sheet(item: $selectedProposal) { proposal in
                ProposalDetailView(
                    quoteService: QuoteService(apiClient: APIClient()),
                    proposalId: proposal.id
                )
            }
            .task {
                if viewModel.proposals.isEmpty && viewModel.quotes.isEmpty {
                    await viewModel.loadInitial()
                }
            }
            .onChange(of: viewModel.selectedStatus) { _, _ in
                Task { await viewModel.refresh() }
            }
        }
    }

    // MARK: - Metrics

    private var metricsBar: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            MetricCard(
                label: "Total Value",
                value: formatCurrency(viewModel.totalProposalValue),
                icon: "dollarsign.circle",
                color: .printyxPrimary
            )
            MetricCard(
                label: "Accepted",
                value: "\(viewModel.acceptedProposals)",
                icon: "checkmark.seal.fill",
                color: .statusCompleted
            )
            MetricCard(
                label: "Pending",
                value: "\(viewModel.pendingProposals)",
                icon: "clock.fill",
                color: .statusPending
            )
        }
        .padding(.horizontal, AppTheme.Spacing.lg)
        .padding(.vertical, AppTheme.Spacing.sm)
    }

    // MARK: - Status Filter

    private var statusFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppTheme.Spacing.sm) {
                filterChip("All", isSelected: viewModel.selectedStatus == nil) {
                    viewModel.selectedStatus = nil
                }
                ForEach(ProposalStatus.allCases) { status in
                    filterChip(status.displayName, isSelected: viewModel.selectedStatus == status) {
                        viewModel.selectedStatus = status
                    }
                }
            }
            .padding(.horizontal, AppTheme.Spacing.lg)
        }
        .padding(.bottom, AppTheme.Spacing.sm)
    }

    private func filterChip(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.printyxSmall)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, AppTheme.Spacing.md)
                .padding(.vertical, AppTheme.Spacing.xs + 2)
                .background(isSelected ? Color.printyxPrimary.opacity(0.12) : Color(.secondarySystemBackground))
                .foregroundStyle(isSelected ? Color.printyxPrimary : .secondary)
                .cornerRadius(AppTheme.Radius.full)
        }
    }

    // MARK: - Proposals List

    private var proposalsList: some View {
        Group {
            if viewModel.filteredProposals.isEmpty {
                EmptyStateView(
                    icon: "doc.text",
                    title: "No Proposals",
                    message: "Create your first proposal.",
                    actionTitle: "Create Proposal",
                    action: { showingCreateProposal = true }
                )
            } else {
                List {
                    ForEach(viewModel.filteredProposals) { proposal in
                        ProposalRowView(proposal: proposal)
                            .contentShape(Rectangle())
                            .onTapGesture { selectedProposal = proposal }
                            .swipeActions(edge: .trailing) {
                                if proposal.status == .draft {
                                    Button {
                                        Task { await viewModel.sendProposal(proposal) }
                                    } label: {
                                        Label("Send", systemImage: "paperplane")
                                    }
                                    .tint(.blue)
                                }
                            }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
    }

    // MARK: - Quotes List

    private var quotesList: some View {
        Group {
            if viewModel.filteredQuotes.isEmpty {
                EmptyStateView(
                    icon: "doc.richtext",
                    title: "No Quotes",
                    message: "Create your first quote.",
                    actionTitle: "Create Quote",
                    action: { showingCreateQuote = true }
                )
            } else {
                List {
                    ForEach(viewModel.filteredQuotes) { quote in
                        QuoteRowView(quote: quote)
                            .contentShape(Rectangle())
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }
}

// MARK: - Proposal Row

struct ProposalRowView: View {
    let proposal: Proposal

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            Image(systemName: proposal.status?.icon ?? "doc.text")
                .font(.system(size: 20))
                .foregroundStyle(statusColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                Text(proposal.displayTitle)
                    .font(.printyxSubheadline)
                    .lineLimit(1)

                HStack(spacing: AppTheme.Spacing.sm) {
                    if let status = proposal.status {
                        StatusBadge.quoteStatus(status.rawValue)
                    }
                    if let customer = proposal.customerName {
                        Text(customer)
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: AppTheme.Spacing.xs) {
                if let amount = proposal.totalAmount, amount > 0 {
                    Text(formatCurrency(amount))
                        .font(.printyxCaption)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.printyxPrimary)
                }
                if let date = proposal.validUntil {
                    Text(date.isPast ? "Expired" : "Valid \(date.shortFormatted)")
                        .font(.printyxSmall)
                        .foregroundStyle(date.isPast ? .red : .secondary)
                }
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }

    private var statusColor: Color {
        switch proposal.status {
        case .draft: .priorityLow
        case .sent: .statusNew
        case .accepted: .statusCompleted
        case .rejected: .statusOverdue
        case .expired: .statusCancelled
        case .none: .secondary
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }
}

// MARK: - Quote Row

struct QuoteRowView: View {
    let quote: Quote

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            Image(systemName: "doc.richtext")
                .font(.system(size: 20))
                .foregroundStyle(.secondary)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                Text(quote.displayTitle)
                    .font(.printyxSubheadline)
                    .lineLimit(1)

                HStack(spacing: AppTheme.Spacing.sm) {
                    if let status = quote.status {
                        StatusBadge.quoteStatus(status.rawValue)
                    }
                    if let number = quote.quoteNumber {
                        Text("#\(number)")
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            if let amount = quote.totalAmount, amount > 0 {
                Text(formatCurrency(amount))
                    .font(.printyxCaption)
                    .fontWeight(.bold)
                    .foregroundStyle(Color.printyxPrimary)
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }
}
