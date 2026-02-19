import SwiftUI

/// List view for contracts with status filters and renewal alerts.
struct ContractListView: View {
    @StateObject private var viewModel: ContractListViewModel
    @State private var selectedContract: Contract?

    init(contractService: ContractService) {
        _viewModel = StateObject(wrappedValue: ContractListViewModel(contractService: contractService))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Stats
                HStack(spacing: AppTheme.Spacing.md) {
                    MetricCard(label: "Active", value: "\(viewModel.activeCount)", icon: "checkmark.seal.fill", color: .statusActive)
                    MetricCard(label: "Expiring", value: "\(viewModel.expiringCount)", icon: "clock.badge.exclamationmark", color: .statusPending)
                    MetricCard(label: "Annual Value", value: formatCurrency(viewModel.totalAnnualValue), icon: "dollarsign.circle", color: .printyxPrimary)
                }
                .padding(.horizontal, AppTheme.Spacing.lg)
                .padding(.vertical, AppTheme.Spacing.sm)

                // Status filter
                statusFilterChips

                // Search
                SearchBar(text: $viewModel.searchText, placeholder: "Search contracts...")
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.bottom, AppTheme.Spacing.sm)

                // Content
                if viewModel.isLoading && viewModel.contracts.isEmpty {
                    LoadingView(message: "Loading contracts...")
                } else if let error = viewModel.error, viewModel.contracts.isEmpty {
                    ErrorView(message: error, retryAction: { await viewModel.refresh() })
                } else if viewModel.filteredContracts.isEmpty {
                    EmptyStateView(
                        icon: "doc.badge.ellipsis",
                        title: "No Contracts",
                        message: "Contracts will appear here once created."
                    )
                } else {
                    contractList
                }
            }
            .navigationTitle("Contracts")
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(item: $selectedContract) { contract in
                ContractDetailView(contract: contract)
            }
            .task {
                if viewModel.contracts.isEmpty {
                    await viewModel.loadInitial()
                }
            }
            .onChange(of: viewModel.selectedStatus) { _, _ in
                Task { await viewModel.refresh() }
            }
        }
    }

    // MARK: - Status Filter

    private var statusFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppTheme.Spacing.sm) {
                chipButton("All", isSelected: viewModel.selectedStatus == nil) {
                    viewModel.selectedStatus = nil
                }
                ForEach(ContractStatus.allCases) { status in
                    chipButton(status.displayName, isSelected: viewModel.selectedStatus == status) {
                        viewModel.selectedStatus = status
                    }
                }
            }
            .padding(.horizontal, AppTheme.Spacing.lg)
        }
        .padding(.bottom, AppTheme.Spacing.sm)
    }

    private func chipButton(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
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

    // MARK: - Contract List

    private var contractList: some View {
        List {
            // Expiring soon section
            let expiring = viewModel.filteredContracts.filter { $0.isExpiring && !$0.isExpired }
            if !expiring.isEmpty {
                Section("Expiring Soon") {
                    ForEach(expiring) { contract in
                        ContractRow(contract: contract)
                            .contentShape(Rectangle())
                            .onTapGesture { selectedContract = contract }
                    }
                }
            }

            // All contracts
            Section("All Contracts") {
                ForEach(viewModel.filteredContracts) { contract in
                    ContractRow(contract: contract)
                        .contentShape(Rectangle())
                        .onTapGesture { selectedContract = contract }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        if value >= 1_000 {
            return formatter.string(from: NSNumber(value: value / 1_000)).map { "\($0)K" } ?? "$\(Int(value))"
        }
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }
}

// MARK: - Contract Row

struct ContractRow: View {
    let contract: Contract

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            Image(systemName: contract.statusEnum.icon)
                .font(.system(size: 20))
                .foregroundStyle(statusColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                Text(contract.displayTitle)
                    .font(.printyxSubheadline)
                    .lineLimit(1)

                HStack(spacing: AppTheme.Spacing.sm) {
                    StatusBadge.contractStatus(contract.status ?? "active")

                    if let customer = contract.customerName {
                        Text(customer)
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: AppTheme.Spacing.xs) {
                if let amount = contract.monthlyAmount, amount > 0 {
                    Text(formatCurrency(amount) + "/mo")
                        .font(.printyxCaption)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.printyxPrimary)
                }
                if let endDate = contract.endDate {
                    Text(endDate.shortFormatted)
                        .font(.system(size: 10))
                        .foregroundStyle(endDate.isPast ? .red : .tertiary)
                }
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }

    private var statusColor: Color {
        switch contract.status {
        case "active": .statusCompleted
        case "expiring": .statusPending
        case "expired": .statusOverdue
        case "draft": .priorityLow
        case "renewed": .statusNew
        case "cancelled", "churned": .statusCancelled
        default: .secondary
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

// MARK: - StatusBadge extension for contracts

extension StatusBadge {
    static func contractStatus(_ status: String) -> StatusBadge {
        let color: Color = switch status {
        case "active": .statusCompleted
        case "expiring": .statusPending
        case "expired": .statusOverdue
        case "draft": .priorityLow
        case "renewed": .statusNew
        case "cancelled", "churned": .statusCancelled
        default: .secondary
        }
        return StatusBadge(status.capitalized, color: color)
    }
}

// MARK: - Contract Detail

struct ContractDetailView: View {
    let contract: Contract
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Contract Info") {
                    if let number = contract.contractNumber {
                        LabeledContent("Number", value: number)
                    }
                    LabeledContent("Status", value: contract.statusEnum.displayName)
                    if let type = contract.type {
                        LabeledContent("Type", value: type.capitalized)
                    }
                }

                Section("Customer") {
                    LabeledContent("Customer", value: contract.customerName ?? "—")
                }

                Section("Terms") {
                    if let start = contract.startDate {
                        LabeledContent("Start Date", value: start.shortFormatted)
                    }
                    if let end = contract.endDate {
                        LabeledContent("End Date", value: end.shortFormatted)
                    }
                    if let billing = contract.billingFrequency {
                        LabeledContent("Billing", value: billing.capitalized)
                    }
                    LabeledContent("Auto-Renew", value: contract.autoRenew == true ? "Yes" : "No")
                }

                Section("Financial") {
                    if let monthly = contract.monthlyAmount {
                        LabeledContent("Monthly Amount", value: formatCurrency(monthly))
                    }
                    if let annual = contract.annualValue {
                        LabeledContent("Annual Value", value: formatCurrency(annual))
                    }
                }

                if let coverage = contract.coverageType {
                    Section("Coverage") {
                        LabeledContent("Type", value: coverage.replacingOccurrences(of: "_", with: " ").capitalized)
                        LabeledContent("Includes Supplies", value: contract.includesSupplies == true ? "Yes" : "No")
                        if let sla = contract.slaResponseHours {
                            LabeledContent("SLA Response", value: "\(sla) hours")
                        }
                    }
                }
            }
            .navigationTitle(contract.displayTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }
}
