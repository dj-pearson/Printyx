import Foundation

// MARK: - Proposal

struct Proposal: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?
    var title: String?
    var status: ProposalStatus?
    var customerId: String?
    var customerName: String?
    var contactName: String?
    var contactEmail: String?
    var templateId: String?
    var totalAmount: Double?
    var validUntil: Date?
    var sentDate: Date?
    var acceptedDate: Date?
    var notes: String?
    var terms: String?
    var createdBy: String?
    var createdAt: Date?
    var updatedAt: Date?

    var displayTitle: String {
        title ?? "Untitled Proposal"
    }

    var isExpired: Bool {
        guard let validUntil, status != .accepted else { return false }
        return validUntil.isPast
    }
}

// MARK: - Proposal Status

enum ProposalStatus: String, Codable, CaseIterable, Identifiable {
    case draft
    case sent
    case accepted
    case rejected
    case expired

    var id: String { rawValue }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = ProposalStatus(rawValue: rawValue) ?? .draft
    }

    var displayName: String { rawValue.capitalized }

    var icon: String {
        switch self {
        case .draft: "doc.text"
        case .sent: "paperplane"
        case .accepted: "checkmark.seal"
        case .rejected: "xmark.seal"
        case .expired: "clock.badge.exclamationmark"
        }
    }
}

// MARK: - Quote

struct Quote: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?
    var leadId: String?
    var customerId: String?
    var quoteNumber: String?
    var title: String?
    var status: QuoteStatus?
    var totalAmount: Double?
    var validUntil: Date?
    var terms: String?
    var notes: String?
    var createdBy: String?
    var sentDate: Date?
    var acceptedDate: Date?
    var createdAt: Date?
    var updatedAt: Date?
    var lineItems: [QuoteLineItem]?

    var displayTitle: String {
        title ?? quoteNumber ?? "Untitled Quote"
    }

    var isExpired: Bool {
        guard let validUntil, status != .accepted else { return false }
        return validUntil.isPast
    }
}

// MARK: - Quote Status

enum QuoteStatus: String, Codable, CaseIterable, Identifiable {
    case draft
    case sent
    case accepted
    case rejected
    case expired

    var id: String { rawValue }
    var displayName: String { rawValue.capitalized }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = QuoteStatus(rawValue: rawValue) ?? .draft
    }
}

// MARK: - Quote Line Item

struct QuoteLineItem: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?
    var quoteId: String?
    var description: String?
    var quantity: Int?
    var unitPrice: Double?
    var totalPrice: Double?
    var createdAt: Date?

    var calculatedTotal: Double {
        Double(quantity ?? 0) * (unitPrice ?? 0)
    }
}

// MARK: - Proposal Template

struct ProposalTemplate: Identifiable, Codable {
    let id: String
    let tenantId: String?
    var name: String?
    var description: String?
    var content: String?
    var category: String?
    var createdAt: Date?
}

// MARK: - DTOs

struct CreateProposalRequest: Encodable {
    let title: String
    var customerId: String?
    var templateId: String?
    var totalAmount: Double?
    var validUntil: Date?
    var notes: String?
    var terms: String?
}

struct UpdateProposalRequest: Encodable {
    var title: String?
    var customerId: String?
    var totalAmount: Double?
    var validUntil: Date?
    var notes: String?
    var terms: String?
}

struct UpdateProposalStatusRequest: Encodable {
    let status: String
}

struct CreateQuoteRequest: Encodable {
    let title: String
    var leadId: String?
    var customerId: String?
    var totalAmount: Double?
    var validUntil: Date?
    var terms: String?
    var notes: String?
    var lineItems: [CreateLineItemRequest]?
}

struct CreateLineItemRequest: Encodable {
    let description: String
    let quantity: Int
    let unitPrice: Double
}

struct UpdateQuoteRequest: Encodable {
    var title: String?
    var totalAmount: Double?
    var validUntil: Date?
    var terms: String?
    var notes: String?
    var status: String?
}
