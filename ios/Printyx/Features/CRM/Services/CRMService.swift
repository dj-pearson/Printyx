import Foundation

/// Service layer for CRM operations — customers, leads, and business records.
@MainActor
final class CRMService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - Business Records (Unified)

    func fetchBusinessRecords(
        search: String? = nil,
        recordType: String? = nil,
        status: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) async throws -> [BusinessRecord] {
        try await apiClient.request(
            .businessRecords(search: search, recordType: recordType, status: status, page: page, limit: limit)
        )
    }

    // MARK: - Customers

    func fetchCustomers(search: String? = nil, status: String? = nil, page: Int = 1, limit: Int = 25) async throws -> [BusinessRecord] {
        try await apiClient.request(.customers(search: search, status: status, page: page, limit: limit))
    }

    func fetchCustomer(id: String) async throws -> BusinessRecord {
        try await apiClient.request(.customer(id: id))
    }

    func createCustomer(_ request: CreateBusinessRecordRequest) async throws -> BusinessRecord {
        try await apiClient.request(.createCustomer(body: request))
    }

    func updateCustomer(id: String, _ request: UpdateBusinessRecordRequest) async throws -> BusinessRecord {
        try await apiClient.request(.updateCustomer(id: id, body: request))
    }

    func deleteCustomer(id: String) async throws {
        try await apiClient.requestVoid(.deleteCustomer(id: id))
    }

    // MARK: - Leads

    func fetchLeads(search: String? = nil, status: String? = nil, page: Int = 1, limit: Int = 25) async throws -> [BusinessRecord] {
        try await apiClient.request(.leads(search: search, status: status, page: page, limit: limit))
    }

    func fetchLead(id: String) async throws -> BusinessRecord {
        try await apiClient.request(.lead(id: id))
    }

    func createLead(_ request: CreateBusinessRecordRequest) async throws -> BusinessRecord {
        try await apiClient.request(.createLead(body: request))
    }

    func updateLead(id: String, _ request: UpdateBusinessRecordRequest) async throws -> BusinessRecord {
        try await apiClient.request(.updateLead(id: id, body: request))
    }

    func convertLead(id: String) async throws -> BusinessRecord {
        try await apiClient.request(.convertLead(id: id))
    }

    // MARK: - Lead Activities

    func fetchLeadActivities(leadId: String) async throws -> [LeadActivity] {
        try await apiClient.request(.leadActivities(leadId: leadId))
    }

    func createLeadActivity(leadId: String, _ request: CreateActivityRequest) async throws -> LeadActivity {
        try await apiClient.request(.createLeadActivity(leadId: leadId, body: request))
    }
}
