import Foundation
import Combine

/// View model for the contracts list screen.
@MainActor
final class ContractListViewModel: ObservableObject {

    // MARK: - Published State

    @Published var contracts: [Contract] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var error: String?
    @Published var searchText = ""
    @Published var selectedStatus: ContractStatus?

    // MARK: - Pagination

    private var currentPage = 1
    private var hasMore = true
    private let pageSize = 25

    // MARK: - Dependencies

    private let contractService: ContractService
    private var searchCancellable: AnyCancellable?

    init(contractService: ContractService) {
        self.contractService = contractService
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

    // MARK: - Computed

    var filteredContracts: [Contract] {
        var filtered = contracts
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            filtered = filtered.filter {
                ($0.title?.lowercased().contains(query) ?? false) ||
                ($0.contractNumber?.lowercased().contains(query) ?? false) ||
                ($0.customerName?.lowercased().contains(query) ?? false)
            }
        }
        return filtered
    }

    var activeCount: Int { contracts.filter { $0.status == "active" }.count }
    var expiringCount: Int { contracts.filter { $0.isExpiring }.count }

    var totalAnnualValue: Double {
        contracts.compactMap(\.annualValue).reduce(0, +)
    }

    // MARK: - Data Loading

    func loadInitial() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        currentPage = 1

        do {
            let fetched = try await contractService.fetchContracts(
                status: selectedStatus?.rawValue,
                page: 1,
                limit: pageSize
            )
            self.contracts = fetched
            self.hasMore = fetched.count >= pageSize
        } catch let apiError as APIError {
            self.error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Page forward when the user scrolls to the bottom of the list.
    func loadMore() async {
        guard hasMore, !isLoading, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        let nextPage = currentPage + 1
        do {
            let fetched = try await contractService.fetchContracts(
                status: selectedStatus?.rawValue,
                page: nextPage,
                limit: pageSize
            )
            contracts.append(contentsOf: fetched)
            currentPage = nextPage
            if fetched.count < pageSize { hasMore = false }
        } catch {
            // Swallow — retried on next scroll.
        }
    }

    func refresh() async {
        await loadInitial()
    }
}
