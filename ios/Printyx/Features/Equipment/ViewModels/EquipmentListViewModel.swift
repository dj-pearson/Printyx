import Foundation
import Combine

/// View model for the equipment list screen.
@MainActor
final class EquipmentListViewModel: ObservableObject {

    // MARK: - Published State

    @Published var equipment: [Equipment] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var error: String?
    @Published var searchText = ""

    // MARK: - Pagination

    private var currentPage = 1
    private var hasMore = true
    private let pageSize = 25

    // MARK: - Dependencies

    private let equipmentService: EquipmentService
    private var searchCancellable: AnyCancellable?

    init(equipmentService: EquipmentService) {
        self.equipmentService = equipmentService
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

    var filteredEquipment: [Equipment] {
        var filtered = equipment
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            filtered = filtered.filter {
                ($0.displayName.lowercased().contains(query)) ||
                ($0.serialNumber?.lowercased().contains(query) ?? false) ||
                ($0.customerName?.lowercased().contains(query) ?? false)
            }
        }
        return filtered
    }

    var activeCount: Int { equipment.filter { $0.status == "active" }.count }
    var needsServiceCount: Int { equipment.filter { $0.needsService }.count }

    // MARK: - Data Loading

    func loadInitial() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        currentPage = 1

        do {
            let fetched = try await equipmentService.fetchEquipment(page: 1, limit: pageSize)
            self.equipment = fetched
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
            let fetched = try await equipmentService.fetchEquipment(page: nextPage, limit: pageSize)
            equipment.append(contentsOf: fetched)
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
