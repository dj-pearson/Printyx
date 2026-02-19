import Foundation

/// Service layer for contract operations.
@MainActor
final class ContractService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - List / Search

    func fetchContracts(
        status: String? = nil,
        customerId: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) async throws -> [Contract] {
        try await apiClient.requestArray(
            .contracts(status: status, customerId: customerId, search: search, page: page, limit: limit)
        )
    }

    // MARK: - CRUD

    func fetchContract(id: String) async throws -> Contract {
        try await apiClient.request(.contract(id: id))
    }

    func createContract(_ request: CreateContractRequest) async throws -> Contract {
        try await apiClient.request(.createContract(body: request))
    }

    func updateContract(id: String, _ request: UpdateContractRequest) async throws -> Contract {
        try await apiClient.request(.updateContract(id: id, body: request))
    }

    // MARK: - Renewals

    func fetchUpcomingRenewals(days: Int = 90) async throws -> [ContractRenewal] {
        try await apiClient.requestArray(.upcomingRenewals(days: days))
    }

    func renewContract(id: String, body: Encodable) async throws {
        try await apiClient.requestVoid(.renewContract(id: id, body: body))
    }
}
