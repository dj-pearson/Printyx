import Foundation
import Combine

/// View model for the opportunities pipeline view.
@MainActor
final class OpportunityListViewModel: ObservableObject {

    @Published var opportunities: [Opportunity] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var error: String?
    @Published var searchText = ""
    @Published var selectedStage: DealStage?
    @Published var viewMode: ViewMode = .pipeline

    private var currentPage = 1
    private let pageSize = 50
    private var hasMore = true

    enum ViewMode: String, CaseIterable, Identifiable {
        case pipeline = "Pipeline"
        case list = "List"

        var id: String { rawValue }
    }

    private let opportunityService: OpportunityService
    private var searchCancellable: AnyCancellable?

    init(opportunityService: OpportunityService) {
        self.opportunityService = opportunityService
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
        currentPage = 1
        hasMore = true

        do {
            let fetched = try await opportunityService.fetchOpportunities(
                stage: selectedStage?.rawValue,
                page: currentPage,
                limit: pageSize
            )
            self.opportunities = fetched
            self.hasMore = fetched.count >= pageSize
        } catch let apiError as APIError {
            self.error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Page forward when the user scrolls to the bottom of the list. Safe to
    /// call repeatedly — no-ops when a page is already in flight or when
    /// the server has returned a short page.
    func loadMore() async {
        guard hasMore, !isLoading, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        let nextPage = currentPage + 1
        do {
            let fetched = try await opportunityService.fetchOpportunities(
                stage: selectedStage?.rawValue,
                page: nextPage,
                limit: pageSize
            )
            opportunities.append(contentsOf: fetched)
            currentPage = nextPage
            if fetched.count < pageSize { hasMore = false }
        } catch {
            // Swallow — the next scroll will retry. Errors here are almost
            // always cell-drop noise; bubbling them up would interrupt the
            // rep mid-flow for no good reason.
        }
    }

    func refresh() async {
        await loadInitial()
    }

    // MARK: - Pipeline Data

    /// Opportunities grouped by stage for pipeline view.
    var pipelineStages: [(stage: DealStage, opportunities: [Opportunity])] {
        let activeCases = DealStage.allCases.filter { $0 != .closedWon && $0 != .closedLost }
        return activeCases.map { stage in
            let stageOpps = filteredOpportunities.filter { $0.salesStage == stage.rawValue }
            return (stage, stageOpps)
        }
    }

    var filteredOpportunities: [Opportunity] {
        var result = opportunities
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter {
                ($0.companyName?.lowercased().contains(query) ?? false) ||
                ($0.primaryContactName?.lowercased().contains(query) ?? false)
            }
        }
        return result
    }

    // MARK: - Metrics

    var totalPipelineValue: Double {
        filteredOpportunities
            .filter { $0.salesStage != "closed_lost" }
            .compactMap(\.estimatedAmount)
            .reduce(0, +)
    }

    var weightedPipelineValue: Double {
        filteredOpportunities
            .filter { $0.salesStage != "closed_lost" }
            .map(\.weightedValue)
            .reduce(0, +)
    }

    var closingSoonCount: Int {
        filteredOpportunities.filter(\.isClosingSoon).count
    }

    // MARK: - Actions

    func updateStage(_ opportunity: Opportunity, to stage: DealStage) async {
        do {
            let updated = try await opportunityService.updateStage(id: opportunity.id, stage: stage.rawValue)
            if let index = opportunities.firstIndex(where: { $0.id == opportunity.id }) {
                opportunities[index] = updated
            }
        } catch {
            self.error = "Failed to update stage"
        }
    }
}
