import Foundation
import Combine

/// Standalone view-model for the global search sheet. Lives outside any single
/// feature so the same sheet can be presented from any tab root.
@MainActor
final class GlobalSearchViewModel: ObservableObject {

    @Published var searchText: String = ""
    @Published private(set) var results: [SearchResult] = []
    @Published private(set) var isSearching: Bool = false
    @Published private(set) var errorMessage: String?

    private let dashboardService: DashboardService
    private var searchCancellable: AnyCancellable?
    private var currentTask: Task<Void, Never>?

    init(dashboardService: DashboardService) {
        self.dashboardService = dashboardService
        wire()
    }

    /// Debounce search text so we don't hammer the server with every keystroke.
    /// Matches the 400ms debounce used elsewhere in the app.
    private func wire() {
        searchCancellable = $searchText
            .debounce(for: .milliseconds(400), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] query in
                guard let self else { return }
                let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
                self.currentTask?.cancel()
                if trimmed.isEmpty {
                    self.results = []
                    self.errorMessage = nil
                    return
                }
                self.currentTask = Task { [weak self] in
                    await self?.performSearch(trimmed)
                }
            }
    }

    private func performSearch(_ query: String) async {
        isSearching = true
        errorMessage = nil
        defer { isSearching = false }
        do {
            results = try await dashboardService.search(query: query)
        } catch is CancellationError {
            // Superseded by a newer query — not an error to surface.
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
            results = []
        } catch {
            errorMessage = error.localizedDescription
            results = []
        }
    }

    /// Translate a search hit into the typed AppRoute the router understands.
    /// Returns nil for result types that don't map cleanly (rare — server
    /// controls the vocabulary).
    func route(for result: SearchResult) -> AppRoute? {
        guard !result.id.isEmpty else { return nil }
        switch result.type {
        case "customer", "lead", "prospect", "business_record":
            return .businessRecord(id: result.id)
        case "contact":
            return .contact(id: result.id)
        case "opportunity":
            return .opportunity(id: result.id)
        case "quote":
            return .quote(id: result.id)
        case "proposal":
            return .proposal(id: result.id)
        case "ticket", "service_ticket":
            return .serviceTicket(id: result.id)
        case "equipment":
            return .equipment(id: result.id)
        case "contract":
            return .contract(id: result.id)
        case "invoice":
            return .invoice(id: result.id)
        case "task":
            return .task(id: result.id)
        default:
            return nil
        }
    }
}
