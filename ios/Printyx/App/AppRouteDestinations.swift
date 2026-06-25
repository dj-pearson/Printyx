import SwiftUI

/// Single source of truth that maps an `AppRoute` to its destination view.
///
/// Every tab's `NavigationStack` applies one
/// `.navigationDestination(for: AppRoute.self) { AppRouteDestination(route: $0, apiClient: apiClient) }`
/// so a deep link or a global-search result for ANY record type opens its
/// detail regardless of which tab the user is on. Previously only
/// `.businessRecord`, `.opportunity`, `.serviceTicket`, and `.equipment` had a
/// live destination — the other six (quote, proposal, contract, invoice, task,
/// contact) fell through to "Unknown route" or a tab that pushed nothing.
struct AppRouteDestination: View {
    let route: AppRoute
    let apiClient: APIClient

    @ViewBuilder
    var body: some View {
        switch route {
        case .businessRecord(let id):
            CRMDetailView(crmService: CRMService(apiClient: apiClient), recordId: id)
                .environmentObject(apiClient)

        case .contact(let id):
            RecordLoaderView(load: { try await ContactService(apiClient: apiClient).fetchContact(id: id) }) {
                ContactDeepLinkDetail(contact: $0)
            }

        case .opportunity(let id):
            OpportunityDetailView(
                opportunityService: OpportunityService(apiClient: apiClient),
                opportunityId: id
            )

        case .quote(let id):
            RecordLoaderView(load: { try await QuoteService(apiClient: apiClient).fetchQuote(id: id) }) {
                QuoteDeepLinkDetail(quote: $0)
            }

        case .proposal(let id):
            ProposalDetailView(quoteService: QuoteService(apiClient: apiClient), proposalId: id)

        case .serviceTicket(let id):
            ServiceTicketDetailView(ticketId: id)
                .environmentObject(apiClient)

        case .equipment(let id):
            EquipmentDetailPlaceholder(id: id)

        case .contract(let id):
            RecordLoaderView(load: { try await ContractService(apiClient: apiClient).fetchContract(id: id) }) {
                ContractDeepLinkDetail(contract: $0)
            }

        case .invoice(let id):
            RecordLoaderView(load: { try await InvoiceService(apiClient: apiClient).fetchInvoice(id: id) }) {
                InvoiceDeepLinkDetail(invoice: $0)
            }

        case .task(let id):
            TaskDetailView(taskService: TaskService(apiClient: apiClient), taskId: id)
        }
    }
}

// MARK: - Generic id → object loader

/// Fetches a record by id then renders `content`. Used for deep-link / search
/// destinations whose rich detail screens take a fully-loaded object (and are
/// presented as sheets elsewhere). Keeps push navigation working without
/// nesting those sheet-style `NavigationStack`s.
struct RecordLoaderView<Model, Content: View>: View {
    let load: () async throws -> Model
    @ViewBuilder let content: (Model) -> Content

    @State private var model: Model? = nil
    @State private var errorMessage: String? = nil

    var body: some View {
        Group {
            if let model {
                content(model)
            } else if let errorMessage {
                ErrorView(message: errorMessage, retryAction: { await reload() })
            } else {
                LoadingView()
            }
        }
        .task { await reload() }
    }

    private func reload() async {
        errorMessage = nil
        do {
            model = try await load()
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Push-native deep-link detail screens
//
// Lightweight read-only detail screens used for deep links / search results.
// They intentionally do NOT wrap themselves in a `NavigationStack` (unlike the
// richer sheet-presented `ContactDetailView` / `InvoiceDetailView` /
// `ContractDetailView`), so they push cleanly onto the active tab stack. Richer
// editing lives in IOS-058/062/063.

struct QuoteDeepLinkDetail: View {
    let quote: Quote

    var body: some View {
        List {
            Section {
                LabeledContent("Quote #", value: quote.quoteNumber ?? "—")
                LabeledContent("Status", value: quote.status?.displayName ?? "—")
                LabeledContent("Total", value: Formatters.currency(quote.totalAmount))
                if let validUntil = quote.validUntil {
                    LabeledContent("Valid Until", value: validUntil.shortFormatted)
                }
            }
            if let notes = quote.notes, !notes.isEmpty {
                Section("Notes") { Text(notes) }
            }
        }
        .navigationTitle(quote.displayTitle)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ContactDeepLinkDetail: View {
    let contact: Contact

    var body: some View {
        List {
            Section {
                if let title = contact.title { LabeledContent("Title", value: title) }
                if let company = contact.companyName { LabeledContent("Company", value: company) }
            }
            Section("Contact") {
                if let email = contact.email, let url = URL(string: "mailto:\(email)") {
                    Link(destination: url) { LabeledContent("Email", value: email) }
                }
                if let phone = contact.phone ?? contact.mobilePhone, let url = URL(string: "tel:\(phone)") {
                    Link(destination: url) { LabeledContent("Phone", value: phone) }
                }
            }
            if let notes = contact.notes, !notes.isEmpty {
                Section("Notes") { Text(notes) }
            }
        }
        .navigationTitle(contact.displayName)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct InvoiceDeepLinkDetail: View {
    let invoice: Invoice

    var body: some View {
        List {
            Section {
                LabeledContent("Status", value: (invoice.status ?? "—").capitalized)
                if let customer = invoice.customerName { LabeledContent("Customer", value: customer) }
            }
            Section("Amounts") {
                LabeledContent("Total", value: Formatters.currency(invoice.totalAmount))
                LabeledContent("Paid", value: Formatters.currency(invoice.amountPaid))
                LabeledContent("Balance Due", value: Formatters.currency(invoice.amountDue))
            }
            Section("Dates") {
                if let issue = invoice.issueDate { LabeledContent("Issued", value: issue.shortFormatted) }
                if let due = invoice.dueDate { LabeledContent("Due", value: due.shortFormatted) }
            }
        }
        .navigationTitle(invoice.displayTitle)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ContractDeepLinkDetail: View {
    let contract: Contract

    var body: some View {
        List {
            Section {
                LabeledContent("Status", value: (contract.status ?? "—").capitalized)
                if let type = contract.type { LabeledContent("Type", value: type.capitalized) }
                if let customer = contract.customerName { LabeledContent("Customer", value: customer) }
            }
            Section("Value") {
                if contract.monthlyAmount != nil {
                    LabeledContent("Monthly", value: Formatters.currency(contract.monthlyAmount))
                }
                if contract.annualValue != nil {
                    LabeledContent("Annual", value: Formatters.currency(contract.annualValue))
                }
            }
            Section("Term") {
                if let start = contract.startDate { LabeledContent("Start", value: start.shortFormatted) }
                if let end = contract.endDate { LabeledContent("End", value: end.shortFormatted) }
            }
        }
        .navigationTitle(contract.displayTitle)
        .navigationBarTitleDisplayMode(.inline)
    }
}
