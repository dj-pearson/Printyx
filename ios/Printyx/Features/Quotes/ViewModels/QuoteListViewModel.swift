import Foundation
import Combine

/// View model for the quotes and proposals list.
@MainActor
final class QuoteListViewModel: ObservableObject {

    @Published var proposals: [Proposal] = []
    @Published var quotes: [Quote] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var searchText = ""
    @Published var selectedTab: QuoteTab = .proposals
    @Published var selectedStatus: ProposalStatus?

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

        do {
            async let proposalsReq = quoteService.fetchProposals(
                status: selectedStatus?.rawValue,
                limit: 50
            )
            async let quotesReq = quoteService.fetchQuotes(
                status: selectedStatus?.rawValue,
                limit: 50
            )

            let (fetchedProposals, fetchedQuotes) = try await (proposalsReq, quotesReq)
            self.proposals = fetchedProposals
            self.quotes = fetchedQuotes
        } catch let apiError as APIError {
            self.error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
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
