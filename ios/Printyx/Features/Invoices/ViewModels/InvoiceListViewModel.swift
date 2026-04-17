import Foundation
import Combine

/// View model for the invoice list screen.
@MainActor
final class InvoiceListViewModel: ObservableObject {

    // MARK: - Published State

    @Published var invoices: [Invoice] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var error: String?
    @Published var searchText = ""
    @Published var selectedStatus: InvoiceStatus?

    // MARK: - Pagination

    private var currentPage = 1
    private var hasMore = true
    private let pageSize = 25

    // MARK: - Dependencies

    private let invoiceService: InvoiceService
    private var searchCancellable: AnyCancellable?

    init(invoiceService: InvoiceService) {
        self.invoiceService = invoiceService
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

    var filteredInvoices: [Invoice] {
        var filtered = invoices
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            filtered = filtered.filter {
                ($0.invoiceNumber?.lowercased().contains(query) ?? false) ||
                ($0.customerName?.lowercased().contains(query) ?? false)
            }
        }
        return filtered
    }

    var totalOutstanding: Double {
        invoices.filter { $0.status != "paid" && $0.status != "cancelled" }
            .compactMap(\.amountDue)
            .reduce(0, +)
    }

    var overdueCount: Int { invoices.filter { $0.isOverdue }.count }
    var paidCount: Int { invoices.filter { $0.status == "paid" }.count }

    // MARK: - Data Loading

    func loadInitial() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        currentPage = 1

        do {
            let fetched = try await invoiceService.fetchInvoices(
                status: selectedStatus?.rawValue,
                page: 1,
                limit: pageSize
            )
            self.invoices = fetched
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
            let fetched = try await invoiceService.fetchInvoices(
                status: selectedStatus?.rawValue,
                page: nextPage,
                limit: pageSize
            )
            invoices.append(contentsOf: fetched)
            currentPage = nextPage
            if fetched.count < pageSize { hasMore = false }
        } catch {
            // Swallow — retried on next scroll.
        }
    }

    func refresh() async {
        await loadInitial()
    }

    // MARK: - Quick Actions

    func markAsPaid(_ invoice: Invoice) async {
        do {
            let updated = try await invoiceService.markAsPaid(id: invoice.id)
            if let index = invoices.firstIndex(where: { $0.id == invoice.id }) {
                invoices[index] = updated
            }
        } catch {
            self.error = "Failed to update invoice"
        }
    }
}
