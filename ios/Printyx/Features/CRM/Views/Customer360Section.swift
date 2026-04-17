import SwiftUI

/// Customer 360 quick-look — five horizontally-scrolling preview strips (Contacts,
/// Equipment, Contracts, Open Tickets, Recent Invoices) rendered below the CRM
/// detail header. Each strip fetches at most three records lazily and fails
/// silently so one broken endpoint never collapses the whole detail view.
struct Customer360Section: View {
    let customerId: String
    let apiClient: APIClient

    var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Customer 360")
                .font(.printyxHeadline)

            Customer360ContactsStrip(customerId: customerId, service: ContactService(apiClient: apiClient))
            Customer360EquipmentStrip(customerId: customerId, service: EquipmentService(apiClient: apiClient))
            Customer360ContractsStrip(customerId: customerId, service: ContractService(apiClient: apiClient))
            Customer360TicketsStrip(customerId: customerId, service: ServiceTicketService(apiClient: apiClient))
            Customer360InvoicesStrip(customerId: customerId, service: InvoiceService(apiClient: apiClient))
        }
    }
}

// MARK: - Shared strip container

private struct C360Strip<Content: View>: View {
    let title: String
    let icon: String
    let isLoading: Bool
    let isEmpty: Bool
    let errorMessage: String?
    let emptyMessage: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            HStack {
                Label(title, systemImage: icon)
                    .font(.printyxSubheadline)
                Spacer()
                if isLoading {
                    ProgressView().scaleEffect(0.7)
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.printyxSmall)
                    .foregroundStyle(.secondary)
            } else if isEmpty && !isLoading {
                Text(emptyMessage)
                    .font(.printyxSmall)
                    .foregroundStyle(.tertiary)
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

// MARK: - Contacts Strip

private struct Customer360ContactsStrip: View {
    let customerId: String
    let service: ContactService
    @State private var contacts: [Contact] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        C360Strip(
            title: "Contacts",
            icon: "person.crop.circle",
            isLoading: isLoading,
            isEmpty: contacts.isEmpty,
            errorMessage: errorMessage,
            emptyMessage: "No contacts on file."
        ) {
            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                ForEach(contacts.prefix(3)) { contact in
                    HStack {
                        Text(contact.displayName)
                            .font(.printyxCaption)
                        Spacer()
                        if let role = contact.role {
                            StatusBadge(role.replacingOccurrences(of: "_", with: " ").capitalized, color: .printyxPrimary)
                        }
                    }
                }
            }
        }
        .task {
            do {
                contacts = try await service.fetchContacts(companyId: customerId, limit: 3)
            } catch {
                errorMessage = "Unavailable"
            }
            isLoading = false
        }
    }
}

// MARK: - Equipment Strip

private struct Customer360EquipmentStrip: View {
    let customerId: String
    let service: EquipmentService
    @State private var equipment: [Equipment] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        C360Strip(
            title: "Equipment",
            icon: "printer",
            isLoading: isLoading,
            isEmpty: equipment.isEmpty,
            errorMessage: errorMessage,
            emptyMessage: "No equipment installed."
        ) {
            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                ForEach(equipment.prefix(3)) { item in
                    HStack {
                        Text(item.displayName)
                            .font(.printyxCaption)
                            .lineLimit(1)
                        Spacer()
                        if let serial = item.serialNumber {
                            Text(serial)
                                .font(.printyxSmall)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
        }
        .task {
            do {
                equipment = try await service.fetchEquipment(customerId: customerId, limit: 3)
            } catch {
                errorMessage = "Unavailable"
            }
            isLoading = false
        }
    }
}

// MARK: - Contracts Strip

private struct Customer360ContractsStrip: View {
    let customerId: String
    let service: ContractService
    @State private var contracts: [Contract] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        C360Strip(
            title: "Contracts",
            icon: "doc.badge.ellipsis",
            isLoading: isLoading,
            isEmpty: contracts.isEmpty,
            errorMessage: errorMessage,
            emptyMessage: "No active contracts."
        ) {
            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                ForEach(contracts.prefix(3)) { contract in
                    HStack {
                        Text(contract.displayTitle)
                            .font(.printyxCaption)
                            .lineLimit(1)
                        Spacer()
                        if contract.isExpiring {
                            StatusBadge("Expiring", color: .priorityHigh)
                        } else if let status = contract.status {
                            StatusBadge(status.capitalized, color: .printyxPrimary)
                        }
                    }
                }
            }
        }
        .task {
            do {
                contracts = try await service.fetchContracts(customerId: customerId, limit: 3)
            } catch {
                errorMessage = "Unavailable"
            }
            isLoading = false
        }
    }
}

// MARK: - Tickets Strip

private struct Customer360TicketsStrip: View {
    let customerId: String
    let service: ServiceTicketService
    @State private var tickets: [ServiceTicket] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        C360Strip(
            title: "Open Tickets",
            icon: "wrench.and.screwdriver",
            isLoading: isLoading,
            isEmpty: tickets.isEmpty,
            errorMessage: errorMessage,
            emptyMessage: "No open tickets."
        ) {
            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                ForEach(tickets.prefix(3)) { ticket in
                    HStack {
                        Text(ticket.displayTitle)
                            .font(.printyxCaption)
                            .lineLimit(1)
                        Spacer()
                        if let priority = ticket.priority {
                            StatusBadge.priority(priority)
                        }
                    }
                }
            }
        }
        .task {
            do {
                // The list endpoint supports a search filter; we filter by status
                // server-side and compute customer match client-side because the
                // tickets list endpoint doesn't take a customerId today.
                let all = try await service.fetchTickets(status: "open", limit: 10)
                tickets = all.filter { $0.customerId == customerId }
            } catch {
                errorMessage = "Unavailable"
            }
            isLoading = false
        }
    }
}

// MARK: - Invoices Strip

private struct Customer360InvoicesStrip: View {
    let customerId: String
    let service: InvoiceService
    @State private var invoices: [Invoice] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        C360Strip(
            title: "Recent Invoices",
            icon: "doc.richtext",
            isLoading: isLoading,
            isEmpty: invoices.isEmpty,
            errorMessage: errorMessage,
            emptyMessage: "No invoices yet."
        ) {
            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                ForEach(invoices.prefix(3)) { invoice in
                    HStack {
                        Text(invoice.displayTitle)
                            .font(.printyxCaption)
                            .lineLimit(1)
                        Spacer()
                        if let total = invoice.totalAmount {
                            Text(total, format: .currency(code: invoice.currency ?? "USD"))
                                .font(.printyxSmall)
                                .foregroundStyle(.secondary)
                        }
                        if invoice.isOverdue {
                            StatusBadge("Overdue", color: .statusOverdue)
                        }
                    }
                }
            }
        }
        .task {
            do {
                invoices = try await service.fetchInvoices(customerId: customerId, limit: 3)
            } catch {
                errorMessage = "Unavailable"
            }
            isLoading = false
        }
    }
}
