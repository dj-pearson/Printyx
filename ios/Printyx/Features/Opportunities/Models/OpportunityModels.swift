import Foundation

// MARK: - Opportunity

/// Opportunities are high-value business records in the sales pipeline.
/// They share the BusinessRecord model but are filtered by estimated value > 0 or high priority.
struct Opportunity: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?

    var companyName: String?
    var primaryContactName: String?
    var primaryContactEmail: String?
    var primaryContactPhone: String?

    var recordType: String?
    var status: String?
    var salesStage: String?
    var estimatedAmount: Double?
    var probability: Int?
    var closeDate: Date?
    var source: String?
    var interestLevel: String?
    var priority: String?
    var ownerId: String?
    var assignedSalesRep: String?
    var territory: String?
    var notes: String?
    var customerRating: String?

    var createdAt: Date?
    var updatedAt: Date?

    // MARK: - Computed

    var displayName: String {
        companyName ?? primaryContactName ?? "Opportunity"
    }

    var weightedValue: Double {
        let amount = estimatedAmount ?? 0
        let prob = Double(probability ?? 50) / 100.0
        return amount * prob
    }

    var isClosingSoon: Bool {
        closeDate?.isWithinDays(14) ?? false
    }

    var initials: String {
        let name = companyName ?? ""
        let words = name.split(separator: " ")
        if words.count >= 2 {
            return "\(words[0].prefix(1))\(words[1].prefix(1))".uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }
}

// MARK: - Deal Stage

enum DealStage: String, CaseIterable, Identifiable {
    case new
    case contacted
    case qualified
    case proposal
    case negotiation
    case closedWon = "closed_won"
    case closedLost = "closed_lost"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .new: "New"
        case .contacted: "Contacted"
        case .qualified: "Qualified"
        case .proposal: "Proposal"
        case .negotiation: "Negotiation"
        case .closedWon: "Closed Won"
        case .closedLost: "Closed Lost"
        }
    }

    var color: String {
        switch self {
        case .new: "3B82F6"
        case .contacted: "8B5CF6"
        case .qualified: "06B6D4"
        case .proposal: "F59E0B"
        case .negotiation: "F97316"
        case .closedWon: "22C55E"
        case .closedLost: "EF4444"
        }
    }

    var sortOrder: Int {
        switch self {
        case .new: 0
        case .contacted: 1
        case .qualified: 2
        case .proposal: 3
        case .negotiation: 4
        case .closedWon: 5
        case .closedLost: 6
        }
    }
}

// MARK: - DTOs

struct CreateOpportunityRequest: Encodable {
    let companyName: String
    var primaryContactName: String?
    var primaryContactEmail: String?
    var estimatedAmount: Double?
    var probability: Int?
    var closeDate: Date?
    var salesStage: String?
    var source: String?
    var priority: String?
    var notes: String?
}

struct UpdateOpportunityRequest: Encodable {
    var companyName: String?
    var primaryContactName: String?
    var primaryContactEmail: String?
    var estimatedAmount: Double?
    var probability: Int?
    var closeDate: Date?
    var salesStage: String?
    var source: String?
    var priority: String?
    var notes: String?
    var interestLevel: String?
}

struct UpdateStageRequest: Encodable {
    let stage: String
}
