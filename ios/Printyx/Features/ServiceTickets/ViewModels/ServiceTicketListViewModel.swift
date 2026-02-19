import Foundation
import Combine

/// View model for the service ticket list screen.
@MainActor
final class ServiceTicketListViewModel: ObservableObject {

    // MARK: - Published State

    @Published var tickets: [ServiceTicket] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var error: String?
    @Published var searchText = ""
    @Published var selectedStatus: TicketStatus?
    @Published var selectedPriority: TicketPriority?

    // MARK: - Pagination

    private var currentPage = 1
    private var hasMore = true
    private let pageSize = 25

    // MARK: - Dependencies

    private let ticketService: ServiceTicketService
    private var searchCancellable: AnyCancellable?

    init(ticketService: ServiceTicketService) {
        self.ticketService = ticketService
        setupSearch()
    }

    // MARK: - Search Debounce

    private func setupSearch() {
        searchCancellable = $searchText
            .debounce(for: .milliseconds(400), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] _ in
                Task { await self?.refresh() }
            }
    }

    // MARK: - Computed

    var openCount: Int { tickets.filter { $0.status == "open" }.count }
    var inProgressCount: Int { tickets.filter { $0.status == "in_progress" }.count }
    var urgentCount: Int { tickets.filter { $0.priority == "urgent" || $0.priority == "critical" }.count }
    var resolvedCount: Int { tickets.filter { $0.status == "resolved" || $0.status == "closed" }.count }

    var filteredTickets: [ServiceTicket] {
        var filtered = tickets
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            filtered = filtered.filter {
                ($0.title?.lowercased().contains(query) ?? false) ||
                ($0.ticketNumber?.lowercased().contains(query) ?? false) ||
                ($0.customerName?.lowercased().contains(query) ?? false) ||
                ($0.equipmentName?.lowercased().contains(query) ?? false)
            }
        }
        return filtered
    }

    // MARK: - Data Loading

    func loadInitial() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        currentPage = 1

        do {
            let fetched = try await ticketService.fetchTickets(
                status: selectedStatus?.rawValue,
                priority: selectedPriority?.rawValue,
                page: 1,
                limit: pageSize
            )
            self.tickets = fetched.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
            self.hasMore = fetched.count >= pageSize
        } catch let apiError as APIError {
            self.error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func loadMore() async {
        guard !isLoadingMore, hasMore else { return }
        isLoadingMore = true

        do {
            let nextPage = currentPage + 1
            let more = try await ticketService.fetchTickets(
                status: selectedStatus?.rawValue,
                priority: selectedPriority?.rawValue,
                page: nextPage,
                limit: pageSize
            )
            self.tickets.append(contentsOf: more)
            self.currentPage = nextPage
            self.hasMore = more.count >= pageSize
        } catch {
            // Silently fail on pagination
        }

        isLoadingMore = false
    }

    func refresh() async {
        await loadInitial()
    }

    // MARK: - Quick Actions

    func closeTicket(_ ticket: ServiceTicket, resolution: String) async {
        do {
            let updated = try await ticketService.closeTicket(id: ticket.id, resolution: resolution)
            if let index = tickets.firstIndex(where: { $0.id == ticket.id }) {
                tickets[index] = updated
            }
        } catch {
            self.error = "Failed to close ticket"
        }
    }

    func escalateTicket(_ ticket: ServiceTicket) async {
        do {
            let updated = try await ticketService.escalateTicket(id: ticket.id)
            if let index = tickets.firstIndex(where: { $0.id == ticket.id }) {
                tickets[index] = updated
            }
        } catch {
            self.error = "Failed to escalate ticket"
        }
    }
}
