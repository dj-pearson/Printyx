import SwiftUI

/// List view for service tickets with stats, filters, and search.
struct ServiceTicketListView: View {
    @EnvironmentObject private var apiClient: APIClient
    @StateObject private var viewModel: ServiceTicketListViewModel
    @State private var showingCreate = false
    @State private var showingSearch = false
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
                GlobalSearchToolbarButton(isPresented: $showingSearch)

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCreate = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.printyxPrimary)
                    }
                    .accessibilityLabel("Add ticket")
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
            .sheet(isPresented: $showingSearch) {
                UniversalSearchSheet(apiClient: apiClient)
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

// MARK: - Service Ticket Form

/// Basic ticket creation form. Customer and equipment pickers fetch from
/// existing services; photos / signatures intentionally deferred to a
/// follow-up story so the first cut ships sooner.
struct ServiceTicketFormView: View {
    @EnvironmentObject private var apiClient: APIClient
    var onSave: ((ServiceTicket) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var priority: TicketPriority = .medium
    @State private var scheduledDate: Date? = nil
    @State private var selectedCustomer: BusinessRecord?
    @State private var selectedEquipment: Equipment?
    @State private var isSaving = false
    @State private var error: String?
    @State private var showingCustomerPicker = false
    @State private var showingEquipmentPicker = false

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Ticket") {
                    TextField("Title (required)", text: $title)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...8)
                    Picker("Priority", selection: $priority) {
                        ForEach(TicketPriority.allCases) { p in
                            Text(p.displayName).tag(p)
                        }
                    }
                }

                Section("Customer") {
                    Button {
                        showingCustomerPicker = true
                    } label: {
                        HStack {
                            Text(selectedCustomer?.displayName ?? "Select customer")
                                .foregroundStyle(selectedCustomer == nil ? .secondary : .primary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(.tertiary)
                        }
                    }
                }

                Section("Equipment (optional)") {
                    Button {
                        showingEquipmentPicker = true
                    } label: {
                        HStack {
                            Text(selectedEquipment?.displayName ?? "Select equipment")
                                .foregroundStyle(selectedEquipment == nil ? .secondary : .primary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .disabled(selectedCustomer == nil)
                }

                Section("Schedule (optional)") {
                    Toggle("Schedule a visit", isOn: Binding(
                        get: { scheduledDate != nil },
                        set: { scheduledDate = $0 ? (scheduledDate ?? Date().addingTimeInterval(86_400)) : nil }
                    ))
                    if let bindingDate = Binding($scheduledDate) {
                        DatePicker("Scheduled for", selection: bindingDate)
                    }
                }

                if let error {
                    Section {
                        Text(error)
                            .font(.printyxCaption)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("New Ticket")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save").fontWeight(.semibold)
                        }
                    }
                    .disabled(!canSave)
                }
            }
            .sheet(isPresented: $showingCustomerPicker) {
                CustomerPickerSheet(apiClient: apiClient) { record in
                    selectedCustomer = record
                    // Reset equipment if the customer changed.
                    selectedEquipment = nil
                }
            }
            .sheet(isPresented: $showingEquipmentPicker) {
                if let customerId = selectedCustomer?.id {
                    EquipmentPickerSheet(apiClient: apiClient, customerId: customerId) { eq in
                        selectedEquipment = eq
                    }
                }
            }
        }
    }

    private func save() async {
        error = nil
        isSaving = true
        defer { isSaving = false }

        let request = CreateServiceTicketRequest(
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description,
            priority: priority.rawValue,
            customerId: selectedCustomer?.id,
            equipmentId: selectedEquipment?.id,
            scheduledDate: scheduledDate
        )

        do {
            let ticket = try await ServiceTicketService(apiClient: apiClient).createTicket(request)
            onSave?(ticket)
            dismiss()
        } catch let apiError as APIError {
            if case .offlineQueued = apiError {
                // Queued for later — the write will replay when connectivity
                // returns. Dismiss without firing onSave; the parent list
                // will pick the ticket up on its next refresh.
                dismiss()
                return
            }
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Customer / Equipment pickers

/// Tiny bottom-sheet picker that searches the CRM list for a customer.
struct CustomerPickerSheet: View {
    let apiClient: APIClient
    let onSelect: (BusinessRecord) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var records: [BusinessRecord] = []
    @State private var searchText = ""
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(records) { record in
                    Button {
                        onSelect(record)
                        dismiss()
                    } label: {
                        VStack(alignment: .leading) {
                            Text(record.displayName)
                                .font(.printyxSubheadline)
                                .foregroundStyle(Color.primary)
                            if let city = record.city {
                                Text(city)
                                    .font(.printyxCaption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                if isLoading { InlineLoadingView() }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $searchText, prompt: "Search customers")
            .navigationTitle("Customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task { await load() }
            .onChange(of: searchText) { _, _ in
                Task { await load() }
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            records = try await CRMService(apiClient: apiClient).fetchCustomers(
                search: searchText.isEmpty ? nil : searchText,
                limit: 25
            )
        } catch {
            records = []
        }
    }
}

/// Picker scoped to a single customer's installed equipment.
struct EquipmentPickerSheet: View {
    let apiClient: APIClient
    let customerId: String
    let onSelect: (Equipment) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var items: [Equipment] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            List {
                if items.isEmpty && !isLoading {
                    Text("No equipment on file for this customer.")
                        .font(.printyxCaption)
                        .foregroundStyle(.secondary)
                }
                ForEach(items) { eq in
                    Button {
                        onSelect(eq)
                        dismiss()
                    } label: {
                        VStack(alignment: .leading) {
                            Text(eq.displayName)
                                .font(.printyxSubheadline)
                                .foregroundStyle(Color.primary)
                            if let serial = eq.serialNumber {
                                Text("S/N \(serial)")
                                    .font(.printyxCaption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                if isLoading { InlineLoadingView() }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Equipment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task { await load() }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await EquipmentService(apiClient: apiClient).fetchEquipment(
                customerId: customerId,
                limit: 50
            )
        } catch {
            items = []
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
