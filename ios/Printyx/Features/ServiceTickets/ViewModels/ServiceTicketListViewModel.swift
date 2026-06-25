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
    /// Server-side counts across ALL tickets (IOS-074). Nil until loaded; the
    /// stat cards fall back to page-derived counts in the meantime.
    @Published var stats: TicketStats?

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

    // Prefer server-side totals; fall back to page-derived counts until loaded.
    var openCount: Int { stats?.open ?? tickets.filter { $0.status == "open" }.count }
    var inProgressCount: Int { stats?.inProgress ?? tickets.filter { $0.status == "in_progress" }.count }
    var urgentCount: Int { stats?.urgent ?? tickets.filter { $0.priority == "urgent" || $0.priority == "critical" }.count }
    var resolvedCount: Int { stats?.resolved ?? tickets.filter { $0.status == "resolved" || $0.status == "closed" }.count }

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
        // Refresh the global stat-card counts (don't block the list / fail it).
        Task { await loadStats() }
    }

    /// Loads server-side counts for the stat cards. Best-effort: a failure
    /// leaves the page-derived fallback in place rather than erroring the list.
    func loadStats() async {
        if let stats = try? await ticketService.fetchStats() {
            self.stats = stats
        }
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
            let updated = try await ticketService.escalateTicket(id: ticket.id, from: ticket.priority)
            if let index = tickets.firstIndex(where: { $0.id == ticket.id }) {
                tickets[index] = updated
            }
        } catch {
            self.error = "Failed to escalate ticket"
        }
    }
}
