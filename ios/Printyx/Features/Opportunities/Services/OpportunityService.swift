import Foundation

/// Service layer for opportunity/deal pipeline operations.
@MainActor
final class OpportunityService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func fetchOpportunities(stage: String? = nil, page: Int = 1, limit: Int = 25) async throws -> [Opportunity] {
        try await apiClient.requestArray(.opportunities(stage: stage, page: page, limit: limit))
    }

    func fetchOpportunity(id: String) async throws -> Opportunity {
        try await apiClient.request(.opportunity(id: id))
    }

    func createOpportunity(_ request: CreateOpportunityRequest) async throws -> Opportunity {
        try await apiClient.request(.createOpportunity(body: request))
    }

    func updateOpportunity(id: String, _ request: UpdateOpportunityRequest) async throws -> Opportunity {
        try await apiClient.request(.updateOpportunity(id: id, body: request))
    }

    func updateStage(id: String, stage: String) async throws -> Opportunity {
        try await apiClient.request(.updateOpportunityStage(id: id, body: UpdateStageRequest(stage: stage)))
    }
}
