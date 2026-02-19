import Foundation

/// Service layer for service ticket operations.
@MainActor
final class ServiceTicketService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - List / Search

    func fetchTickets(
        status: String? = nil,
        priority: String? = nil,
        assignedTo: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) async throws -> [ServiceTicket] {
        try await apiClient.request(
            .serviceTickets(status: status, priority: priority, assignedTo: assignedTo, search: search, page: page, limit: limit)
        )
    }

    // MARK: - CRUD

    func fetchTicket(id: String) async throws -> ServiceTicket {
        try await apiClient.request(.serviceTicket(id: id))
    }

    func createTicket(_ request: CreateServiceTicketRequest) async throws -> ServiceTicket {
        try await apiClient.request(.createServiceTicket(body: request))
    }

    func updateTicket(id: String, _ request: UpdateServiceTicketRequest) async throws -> ServiceTicket {
        try await apiClient.request(.updateServiceTicket(id: id, body: request))
    }

    // MARK: - Timeline

    func fetchUpdates(ticketId: String) async throws -> [TicketUpdate] {
        try await apiClient.request(.serviceTicketUpdates(ticketId: ticketId))
    }

    func addNote(ticketId: String, content: String) async throws -> TicketUpdate {
        try await apiClient.request(
            .addServiceTicketNote(ticketId: ticketId, body: AddTicketNoteRequest(type: "note", content: content))
        )
    }

    // MARK: - Quick Status Updates

    func closeTicket(id: String, resolution: String) async throws -> ServiceTicket {
        try await updateTicket(id: id, UpdateServiceTicketRequest(status: "resolved", resolution: resolution))
    }

    func escalateTicket(id: String) async throws -> ServiceTicket {
        try await updateTicket(id: id, UpdateServiceTicketRequest(priority: "urgent"))
    }
}
