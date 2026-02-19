import SwiftUI

/// List view for service tickets with stats, filters, and search.
struct ServiceTicketListView: View {
    @StateObject private var viewModel: ServiceTicketListViewModel
    @State private var showingCreate = false
    @State private var selectedTicket: ServiceTicket?

    init(ticketService: ServiceTicketService) {
        _viewModel = StateObject(wrappedValue: ServiceTicketListViewModel(ticketService: ticketService))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Stats
                statsBar

                // Status filter chips
                statusFilterChips

                // Search
                SearchBar(text: $viewModel.searchText, placeholder: "Search tickets...")
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.bottom, AppTheme.Spacing.sm)

                // Content
                if viewModel.isLoading && viewModel.tickets.isEmpty {
                    LoadingView(message: "Loading tickets...")
                } else if let error = viewModel.error, viewModel.tickets.isEmpty {
                    ErrorView(message: error, retryAction: { await viewModel.refresh() })
                } else if viewModel.filteredTickets.isEmpty {
                    EmptyStateView(
                        icon: "wrench.and.screwdriver",
                        title: "No Service Tickets",
                        message: "Create a ticket to track service requests.",
                        actionTitle: "New Ticket",
                        action: { showingCreate = true }
                    )
                } else {
                    ticketList
                }
            }
            .navigationTitle("Service Tickets")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCreate = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.printyxPrimary)
                    }
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $showingCreate) {
                ServiceTicketFormView { _ in
                    Task { await viewModel.refresh() }
                }
            }
            .sheet(item: $selectedTicket) { ticket in
                ServiceTicketDetailView(ticket: ticket)
            }
            .task {
                if viewModel.tickets.isEmpty {
                    await viewModel.loadInitial()
                }
            }
            .onChange(of: viewModel.selectedStatus) { _, _ in
                Task { await viewModel.refresh() }
            }
        }
    }

    // MARK: - Stats Bar

    private var statsBar: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            MetricCard(label: "Open", value: "\(viewModel.openCount)", icon: "circle", color: .statusNew)
            MetricCard(label: "In Progress", value: "\(viewModel.inProgressCount)", icon: "wrench.and.screwdriver", color: .statusActive)
            MetricCard(label: "Urgent", value: "\(viewModel.urgentCount)", icon: "exclamationmark.triangle", color: .statusOverdue)
            MetricCard(label: "Resolved", value: "\(viewModel.resolvedCount)", icon: "checkmark.circle.fill", color: .statusCompleted)
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
                ForEach(TicketStatus.allCases) { status in
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

    // MARK: - Ticket List

    private var ticketList: some View {
        List {
            ForEach(viewModel.filteredTickets) { ticket in
                ServiceTicketRow(ticket: ticket)
                    .contentShape(Rectangle())
                    .onTapGesture { selectedTicket = ticket }
                    .swipeActions(edge: .trailing) {
                        if ticket.status != "resolved" && ticket.status != "closed" {
                            Button {
                                Task { await viewModel.escalateTicket(ticket) }
                            } label: {
                                Label("Escalate", systemImage: "arrow.up.circle")
                            }
                            .tint(.orange)
                        }
                    }
            }

            if viewModel.isLoadingMore {
                InlineLoadingView()
            }
        }
        .listStyle(.insetGrouped)
    }
}

// MARK: - Service Ticket Row

struct ServiceTicketRow: View {
    let ticket: ServiceTicket

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            Image(systemName: ticket.statusEnum.icon)
                .font(.system(size: 20))
                .foregroundStyle(statusColor)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                HStack(spacing: AppTheme.Spacing.sm) {
                    if let number = ticket.ticketNumber {
                        Text("#\(number)")
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                    }
                    Text(ticket.displayTitle)
                        .font(.printyxSubheadline)
                        .lineLimit(1)
                }

                HStack(spacing: AppTheme.Spacing.sm) {
                    StatusBadge.ticketStatus(ticket.status ?? "open")

                    if let priority = ticket.priority {
                        PriorityIndicator(priority: priority)
                    }

                    if let customer = ticket.customerName {
                        Text(customer)
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: AppTheme.Spacing.xs) {
                if let equipment = ticket.equipmentName {
                    Text(equipment)
                        .font(.printyxSmall)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if let date = ticket.scheduledDate {
                    Text(date.shortFormatted)
                        .font(.system(size: 10))
                        .foregroundStyle(date.isPast ? Color.red : Color.secondary)
                }
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }

    private var statusColor: Color {
        switch ticket.status {
        case "open": .statusNew
        case "in_progress": .statusActive
        case "on_hold": .statusPending
        case "waiting_parts": .priorityHigh
        case "scheduled": .printyxAccent
        case "resolved": .statusCompleted
        case "closed": .statusCancelled
        default: .secondary
        }
    }
}

// MARK: - StatusBadge extension for tickets

extension StatusBadge {
    static func ticketStatus(_ status: String) -> StatusBadge {
        let color: Color = switch status {
        case "open": .statusNew
        case "in_progress": .statusActive
        case "on_hold": .statusPending
        case "waiting_parts": .priorityHigh
        case "scheduled": .printyxAccent
        case "resolved": .statusCompleted
        case "closed": .statusCancelled
        default: .secondary
        }
        let label = status.replacingOccurrences(of: "_", with: " ").capitalized
        return StatusBadge(label, color: color)
    }
}

// MARK: - Placeholder Views

struct ServiceTicketFormView: View {
    var onSave: ((ServiceTicket) -> Void)?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Text("Create Service Ticket")
                .font(.printyxHeadline)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .navigationTitle("New Ticket")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel") { dismiss() }
                    }
                }
        }
    }
}

struct ServiceTicketDetailView: View {
    let ticket: ServiceTicket
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Details") {
                    LabeledContent("Status", value: ticket.statusEnum.displayName)
                    LabeledContent("Priority", value: ticket.priorityEnum.displayName)
                    if let customer = ticket.customerName {
                        LabeledContent("Customer", value: customer)
                    }
                    if let equipment = ticket.equipmentName {
                        LabeledContent("Equipment", value: equipment)
                    }
                }

                if let description = ticket.description {
                    Section("Description") {
                        Text(description)
                            .font(.printyxBody)
                    }
                }

                if let scheduled = ticket.scheduledDate {
                    Section("Schedule") {
                        LabeledContent("Scheduled", value: scheduled.fullFormatted)
                    }
                }
            }
            .navigationTitle(ticket.displayTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
