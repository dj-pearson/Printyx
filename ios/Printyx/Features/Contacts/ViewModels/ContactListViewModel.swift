import Foundation
import Combine

/// View model for the contacts list screen.
@MainActor
final class ContactListViewModel: ObservableObject {

    // MARK: - Published State

    @Published var contacts: [Contact] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var searchText = ""

    // MARK: - Pagination

    private var currentPage = 1
    private var hasMore = true
    private let pageSize = 25

    // MARK: - Dependencies

    private let contactService: ContactService
    private var searchCancellable: AnyCancellable?

    init(contactService: ContactService) {
        self.contactService = contactService
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

    var filteredContacts: [Contact] {
        var filtered = contacts
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            filtered = filtered.filter {
                ($0.displayName.lowercased().contains(query)) ||
                ($0.email?.lowercased().contains(query) ?? false) ||
                ($0.companyName?.lowercased().contains(query) ?? false)
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
            let fetched = try await contactService.fetchContacts(page: 1, limit: pageSize)
            self.contacts = fetched
            self.hasMore = fetched.count >= pageSize
        } catch let apiError as APIError {
            self.error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func loadMore() async {
        guard !isLoading, hasMore else { return }

        do {
            let nextPage = currentPage + 1
            let more = try await contactService.fetchContacts(page: nextPage, limit: pageSize)
            self.contacts.append(contentsOf: more)
            self.currentPage = nextPage
            self.hasMore = more.count >= pageSize
        } catch {
            // Silently fail on pagination
        }
    }

    func refresh() async {
        await loadInitial()
    }

    func deleteContact(_ contact: Contact) async {
        do {
            try await contactService.deleteContact(id: contact.id)
            contacts.removeAll { $0.id == contact.id }
        } catch {
            self.error = "Failed to delete contact"
        }
    }
}
