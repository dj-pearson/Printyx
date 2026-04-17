import Foundation
import Combine

/// View model for the quotes and proposals list.
@MainActor
final class QuoteListViewModel: ObservableObject {

    @Published var proposals: [Proposal] = []
    @Published var quotes: [Quote] = []
    @Published var isLoading = false
    @Published var isLoadingMoreProposals = false
    @Published var isLoadingMoreQuotes = false
    @Published var error: String?
    @Published var searchText = ""
    @Published var selectedTab: QuoteTab = .proposals
    @Published var selectedStatus: ProposalStatus?

    // Per-tab pagination state. Kept separate so switching tabs doesn't reset
    // the other tab's scroll position.
    private var proposalPage = 1
    private var quotePage = 1
    private var hasMoreProposals = true
    private var hasMoreQuotes = true
    private let pageSize = 25

    enum QuoteTab: String, CaseIterable, Identifiable {
        case proposals = "Proposals"
        case quotes = "Quotes"

        var id: String { rawValue }
    }

    private let quoteService: QuoteService
    private var searchCancellable: AnyCancellable?

    init(quoteService: QuoteService) {
        self.quoteService = quoteService
        setupSearch()
    }

    private func setupSearch() {
        searchCancellable = $searchText
            .debounce(for: .milliseconds(400), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] _ in
                Task { await self?.refresh() }
            }
    }

    // MARK: - Loading

    func loadInitial() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        proposalPage = 1
        quotePage = 1
        hasMoreProposals = true
        hasMoreQuotes = true

        do {
            async let proposalsReq = quoteService.fetchProposals(
                status: selectedStatus?.rawValue,
                page: 1,
                limit: pageSize
            )
            async let quotesReq = quoteService.fetchQuotes(
                status: selectedStatus?.rawValue,
                page: 1,
                limit: pageSize
            )

            let (fetchedProposals, fetchedQuotes) = try await (proposalsReq, quotesReq)
            self.proposals = fetchedProposals
            self.quotes = fetchedQuotes
            self.hasMoreProposals = fetchedProposals.count >= pageSize
            self.hasMoreQuotes = fetchedQuotes.count >= pageSize
        } catch let apiError as APIError {
            self.error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Page forward on whichever tab the rep is currently scrolling. The
    /// caller decides which — we don't try to guess from selectedTab because
    /// the view already knows which list fired the onAppear.
    func loadMoreProposals() async {
        guard hasMoreProposals, !isLoading, !isLoadingMoreProposals else { return }
        isLoadingMoreProposals = true
        defer { isLoadingMoreProposals = false }

        let next = proposalPage + 1
        do {
            let fetched = try await quoteService.fetchProposals(
                status: selectedStatus?.rawValue,
                page: next,
                limit: pageSize
            )
            proposals.append(contentsOf: fetched)
            proposalPage = next
            if fetched.count < pageSize { hasMoreProposals = false }
        } catch {
            // Swallow — retried on next scroll.
        }
    }

    func loadMoreQuotes() async {
        guard hasMoreQuotes, !isLoading, !isLoadingMoreQuotes else { return }
        isLoadingMoreQuotes = true
        defer { isLoadingMoreQuotes = false }

        let next = quotePage + 1
        do {
            let fetched = try await quoteService.fetchQuotes(
                status: selectedStatus?.rawValue,
                page: next,
                limit: pageSize
            )
            quotes.append(contentsOf: fetched)
            quotePage = next
            if fetched.count < pageSize { hasMoreQuotes = false }
        } catch {
            // Swallow — retried on next scroll.
        }
    }

    func refresh() async {
        await loadInitial()
    }

    // MARK: - Filtered

    var filteredProposals: [Proposal] {
        guard !searchText.isEmpty else { return proposals }
        let query = searchText.lowercased()
        return proposals.filter {
            ($0.title?.lowercased().contains(query) ?? false) ||
            ($0.customerName?.lowercased().contains(query) ?? false)
        }
    }

    var filteredQuotes: [Quote] {
        guard !searchText.isEmpty else { return quotes }
        let query = searchText.lowercased()
        return quotes.filter {
            ($0.title?.lowercased().contains(query) ?? false) ||
            ($0.quoteNumber?.lowercased().contains(query) ?? false)
        }
    }

    // MARK: - Metrics

    var totalProposalValue: Double {
        proposals.compactMap(\.totalAmount).reduce(0, +)
    }

    var acceptedProposals: Int {
        proposals.filter { $0.status == .accepted }.count
    }

    var pendingProposals: Int {
        proposals.filter { $0.status == .sent }.count
    }

    // MARK: - Actions

    func sendProposal(_ proposal: Proposal) async {
        do {
            try await quoteService.sendProposal(id: proposal.id)
            if let index = proposals.firstIndex(where: { $0.id == proposal.id }) {
                proposals[index].status = .sent
                proposals[index].sentDate = Date()
            }
        } catch {
            self.error = "Failed to send proposal"
        }
    }

    func updateProposalStatus(_ proposal: Proposal, status: ProposalStatus) async {
        do {
            let updated = try await quoteService.updateProposalStatus(id: proposal.id, status: status.rawValue)
            if let index = proposals.firstIndex(where: { $0.id == proposal.id }) {
                proposals[index] = updated
            }
        } catch {
            self.error = "Failed to update status"
        }
    }
}
