import Foundation

/// Service layer for invoice operations.
@MainActor
final class InvoiceService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - List / Search

    func fetchInvoices(
        status: String? = nil,
        customerId: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) async throws -> [Invoice] {
        try await apiClient.request(
            .invoices(status: status, customerId: customerId, search: search, page: page, limit: limit)
        )
    }

    // MARK: - CRUD

    func fetchInvoice(id: String) async throws -> Invoice {
        try await apiClient.request(.invoice(id: id))
    }

    func createInvoice(_ request: CreateInvoiceRequest) async throws -> Invoice {
        try await apiClient.request(.createInvoice(body: request))
    }

    func updateInvoice(id: String, _ request: UpdateInvoiceRequest) async throws -> Invoice {
        try await apiClient.request(.updateInvoice(id: id, body: request))
    }

    // MARK: - Quick Actions

    func markAsPaid(id: String) async throws -> Invoice {
        try await updateInvoice(id: id, UpdateInvoiceRequest(status: "paid"))
    }

    func markAsSent(id: String) async throws -> Invoice {
        try await updateInvoice(id: id, UpdateInvoiceRequest(status: "sent"))
    }
}
