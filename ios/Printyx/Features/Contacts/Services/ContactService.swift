import Foundation

/// Service layer for contact operations.
@MainActor
final class ContactService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - List / Search

    func fetchContacts(
        companyId: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) async throws -> [Contact] {
        try await apiClient.requestArray(
            .contacts(companyId: companyId, search: search, page: page, limit: limit)
        )
    }

    // MARK: - CRUD

    func fetchContact(id: String) async throws -> Contact {
        try await apiClient.request(.contact(id: id))
    }

    func createContact(_ request: CreateContactRequest) async throws -> Contact {
        try await apiClient.request(.createContact(body: request))
    }

    func updateContact(id: String, _ request: UpdateContactRequest) async throws -> Contact {
        try await apiClient.request(.updateContact(id: id, body: request))
    }

    func deleteContact(id: String) async throws {
        try await apiClient.requestVoid(.deleteContact(id: id))
    }
}
