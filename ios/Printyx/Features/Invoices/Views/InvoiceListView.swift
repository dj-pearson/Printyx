import SwiftUI

/// List view for invoices with status filters and financial metrics.
struct InvoiceListView: View {
    @StateObject private var viewModel: InvoiceListViewModel
    @State private var selectedInvoice: Invoice?

    init(invoiceService: InvoiceService) {
        _viewModel = StateObject(wrappedValue: InvoiceListViewModel(invoiceService: invoiceService))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Metrics
                HStack(spacing: AppTheme.Spacing.md) {
                    MetricCard(label: "Outstanding", value: formatCurrency(viewModel.totalOutstanding), icon: "dollarsign.circle", color: .printyxPrimary)
                    MetricCard(label: "Overdue", value: "\(viewModel.overdueCount)", icon: "exclamationmark.triangle", color: .statusOverdue)
                    MetricCard(label: "Paid", value: "\(viewModel.paidCount)", icon: "checkmark.seal.fill", color: .statusCompleted)
                }
                .padding(.horizontal, AppTheme.Spacing.lg)
                .padding(.vertical, AppTheme.Spacing.sm)

                // Status filter
                statusFilterChips

                // Search
                SearchBar(text: $viewModel.searchText, placeholder: "Search invoices...")
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.bottom, AppTheme.Spacing.sm)

                // Content
                if viewModel.isLoading && viewModel.invoices.isEmpty {
                    LoadingView(message: "Loading invoices...")
                } else if let error = viewModel.error, viewModel.invoices.isEmpty {
                    ErrorView(message: error, retryAction: { await viewModel.refresh() })
                } else if viewModel.filteredInvoices.isEmpty {
                    EmptyStateView(
                        icon: "doc.richtext",
                        title: "No Invoices",
                        message: "Invoices will appear here."
                    )
                } else {
                    invoiceList
                }
            }
            .navigationTitle("Invoices")
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(item: $selectedInvoice) { invoice in
                InvoiceDetailView(invoice: invoice)
            }
            .task {
                if viewModel.invoices.isEmpty {
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
                ForEach(InvoiceStatus.allCases) { status in
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

    // MARK: - Invoice List

    private var invoiceList: some View {
        List {
            // Overdue section
            let overdue = viewModel.filteredInvoices.filter { $0.isOverdue }
            if !overdue.isEmpty {
                Section("Overdue") {
                    ForEach(overdue) { invoice in
                        InvoiceRow(invoice: invoice)
                            .contentShape(Rectangle())
                            .onTapGesture { selectedInvoice = invoice }
                            .swipeActions(edge: .trailing) {
                                Button {
                                    Task { await viewModel.markAsPaid(invoice) }
                                } label: {
                                    Label("Mark Paid", systemImage: "checkmark")
                                }
                                .tint(.green)
                            }
                    }
                }
            }

            // All invoices
            Section(overdue.isEmpty ? "Invoices" : "All Invoices") {
                ForEach(viewModel.filteredInvoices) { invoice in
                    InvoiceRow(invoice: invoice)
                        .contentShape(Rectangle())
                        .onTapGesture { selectedInvoice = invoice }
                        .swipeActions(edge: .trailing) {
                            if invoice.status != "paid" {
                                Button {
                                    Task { await viewModel.markAsPaid(invoice) }
                                } label: {
                                    Label("Mark Paid", systemImage: "checkmark")
                                }
                                .tint(.green)
                            }
                        }
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

// MARK: - Invoice Row

struct InvoiceRow: View {
    let invoice: Invoice

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            Image(systemName: invoice.statusEnum.icon)
                .font(.system(size: 20))
                .foregroundStyle(statusColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                Text(invoice.displayTitle)
                    .font(.printyxSubheadline)
                    .lineLimit(1)

                HStack(spacing: AppTheme.Spacing.sm) {
                    StatusBadge.invoiceStatus(invoice.status ?? "draft")
                    if let customer = invoice.customerName {
                        Text(customer)
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: AppTheme.Spacing.xs) {
                if let amount = invoice.totalAmount, amount > 0 {
                    Text(formatCurrency(amount))
                        .font(.printyxCaption)
                        .fontWeight(.bold)
                        .foregroundStyle(Color.printyxPrimary)
                }
                if let dueDate = invoice.dueDate {
                    Text(dueDate.isPast ? "Overdue" : "Due \(dueDate.shortFormatted)")
                        .font(.system(size: 10))
                        .foregroundStyle(dueDate.isPast ? Color.red : Color.secondary)
                }
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }

    private var statusColor: Color {
        switch invoice.status {
        case "draft": .priorityLow
        case "sent": .statusNew
        case "viewed": .printyxAccent
        case "partially_paid": .statusPending
        case "paid": .statusCompleted
        case "overdue": .statusOverdue
        case "cancelled", "void": .statusCancelled
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

// MARK: - StatusBadge extension for invoices

extension StatusBadge {
    static func invoiceStatus(_ status: String) -> StatusBadge {
        let color: Color = switch status {
        case "draft": .priorityLow
        case "sent": .statusNew
        case "viewed": .printyxAccent
        case "partially_paid": .statusPending
        case "paid": .statusCompleted
        case "overdue": .statusOverdue
        case "cancelled", "void": .statusCancelled
        default: .secondary
        }
        let label = status.replacingOccurrences(of: "_", with: " ").capitalized
        return StatusBadge(label, color: color)
    }
}

// MARK: - Invoice Detail

struct InvoiceDetailView: View {
    let invoice: Invoice
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Invoice Info") {
                    if let number = invoice.invoiceNumber {
                        LabeledContent("Number", value: "INV-\(number)")
                    }
                    LabeledContent("Status", value: invoice.statusEnum.displayName)
                    if let customer = invoice.customerName {
                        LabeledContent("Customer", value: customer)
                    }
                }

                Section("Amounts") {
                    if let subtotal = invoice.subtotal {
                        LabeledContent("Subtotal", value: formatCurrency(subtotal))
                    }
                    if let tax = invoice.taxAmount, tax > 0 {
                        LabeledContent("Tax", value: formatCurrency(tax))
                    }
                    if let total = invoice.totalAmount {
                        LabeledContent("Total", value: formatCurrency(total))
                    }
                    if let paid = invoice.amountPaid, paid > 0 {
                        LabeledContent("Paid", value: formatCurrency(paid))
                    }
                    if let due = invoice.amountDue, due > 0 {
                        LabeledContent("Amount Due", value: formatCurrency(due))
                    }
                }

                Section("Dates") {
                    if let issued = invoice.issueDate {
                        LabeledContent("Issued", value: issued.shortFormatted)
                    }
                    if let dueDate = invoice.dueDate {
                        LabeledContent("Due", value: dueDate.shortFormatted)
                    }
                    if let paid = invoice.paidDate {
                        LabeledContent("Paid On", value: paid.shortFormatted)
                    }
                }

                if let notes = invoice.notes {
                    Section("Notes") {
                        Text(notes)
                            .font(.printyxBody)
                    }
                }
            }
            .navigationTitle(invoice.displayTitle)
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
