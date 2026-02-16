import Foundation

/// Service layer for quotes and proposals.
@MainActor
final class QuoteService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - Proposals

    func fetchProposals(status: String? = nil, customerId: String? = nil, page: Int = 1, limit: Int = 25) async throws -> [Proposal] {
        try await apiClient.request(.proposals(status: status, customerId: customerId, page: page, limit: limit))
    }

    func fetchProposal(id: String) async throws -> Proposal {
        try await apiClient.request(.proposal(id: id))
    }

    func createProposal(_ request: CreateProposalRequest) async throws -> Proposal {
        try await apiClient.request(.createProposal(body: request))
    }

    func updateProposal(id: String, _ request: UpdateProposalRequest) async throws -> Proposal {
        try await apiClient.request(.updateProposal(id: id, body: request))
    }

    func updateProposalStatus(id: String, status: String) async throws -> Proposal {
        try await apiClient.request(.updateProposalStatus(id: id, body: UpdateProposalStatusRequest(status: status)))
    }

    func sendProposal(id: String) async throws {
        try await apiClient.requestVoid(.sendProposal(id: id))
    }

    func downloadProposalPDF(id: String) async throws -> Data {
        try await apiClient.requestData(.proposalPDF(id: id))
    }

    func fetchProposalTemplates() async throws -> [ProposalTemplate] {
        try await apiClient.request(.proposalTemplates())
    }

    // MARK: - Quotes

    func fetchQuotes(status: String? = nil, page: Int = 1, limit: Int = 25) async throws -> [Quote] {
        try await apiClient.request(.quotes(status: status, page: page, limit: limit))
    }

    func fetchQuote(id: String) async throws -> Quote {
        try await apiClient.request(.quote(id: id))
    }

    func createQuote(_ request: CreateQuoteRequest) async throws -> Quote {
        try await apiClient.request(.createQuote(body: request))
    }

    func updateQuote(id: String, _ request: UpdateQuoteRequest) async throws -> Quote {
        try await apiClient.request(.updateQuote(id: id, body: request))
    }
}
