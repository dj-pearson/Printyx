import Foundation
import Combine

/// View model for the CRM list — shows leads, prospects, customers with segmented filtering.
@MainActor
final class CRMListViewModel: ObservableObject {

    @Published var records: [BusinessRecord] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var error: String?
    @Published var searchText = ""
    @Published var selectedSegment: CRMSegment = .all
    @Published var sortBy: SortOption = .recent

    enum CRMSegment: String, CaseIterable, Identifiable {
        case all = "All"
        case leads = "Leads"
        case prospects = "Prospects"
        case customers = "Customers"

        var id: String { rawValue }

        var recordType: String? {
            switch self {
            case .all: nil
            case .leads: "lead"
            case .prospects: "prospect"
            case .customers: "customer"
            }
        }
    }

    enum SortOption: String, CaseIterable, Identifiable {
        case recent = "Recent"
        case name = "Name"
        case followUp = "Follow Up"
        case score = "Lead Score"

        var id: String { rawValue }
    }

    private var currentPage = 1
    private var hasMore = true
    private let pageSize = 25
    private let crmService: CRMService
    private var searchCancellable: AnyCancellable?

    init(crmService: CRMService) {
        self.crmService = crmService
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

    // MARK: - Data Loading

    func loadInitial() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        currentPage = 1

        do {
            let fetched = try await crmService.fetchBusinessRecords(
                search: searchText.isEmpty ? nil : searchText,
                recordType: selectedSegment.recordType,
                page: 1,
                limit: pageSize
            )
            self.records = sortRecords(fetched)
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
            let more = try await crmService.fetchBusinessRecords(
                search: searchText.isEmpty ? nil : searchText,
                recordType: selectedSegment.recordType,
                page: nextPage,
                limit: pageSize
            )
            self.records.append(contentsOf: sortRecords(more))
            self.currentPage = nextPage
            self.hasMore = more.count >= pageSize
        } catch {
            // Silent pagination error
        }

        isLoadingMore = false
    }

    func refresh() async {
        await loadInitial()
    }

    // MARK: - Actions

    func deleteRecord(_ record: BusinessRecord) async {
        do {
            try await crmService.deleteCustomer(id: record.id)
            records.removeAll { $0.id == record.id }
        } catch {
            self.error = "Failed to delete record"
        }
    }

    func convertLead(_ record: BusinessRecord) async {
        guard record.recordType == .lead else { return }
        do {
            let converted = try await crmService.convertLead(id: record.id)
            if let index = records.firstIndex(where: { $0.id == record.id }) {
                records[index] = converted
            }
        } catch {
            self.error = "Failed to convert lead"
        }
    }

    // MARK: - Computed

    var filteredRecords: [BusinessRecord] {
        records
    }

    var recordCounts: (leads: Int, prospects: Int, customers: Int) {
        let leads = records.filter { $0.recordType == .lead }.count
        let prospects = records.filter { $0.recordType == .prospect }.count
        let customers = records.filter { $0.recordType == .customer }.count
        return (leads, prospects, customers)
    }

    var needsFollowUp: [BusinessRecord] {
        records.filter { $0.needsFollowUp }
    }

    // MARK: - Sorting

    private func sortRecords(_ records: [BusinessRecord]) -> [BusinessRecord] {
        records.sorted { a, b in
            switch sortBy {
            case .recent:
                return (a.updatedAt ?? .distantPast) > (b.updatedAt ?? .distantPast)
            case .name:
                return a.displayName.localizedCompare(b.displayName) == .orderedAscending
            case .followUp:
                return (a.nextFollowUpDate ?? .distantFuture) < (b.nextFollowUpDate ?? .distantFuture)
            case .score:
                return (a.leadScore ?? 0) > (b.leadScore ?? 0)
            }
        }
    }
}
