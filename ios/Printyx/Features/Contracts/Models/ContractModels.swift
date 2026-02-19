import Foundation

// MARK: - Contract

struct Contract: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?

    var contractNumber: String?
    var title: String?
    var type: String?               // service, maintenance, lease, supply
    var status: String?

    // Customer
    var customerId: String?
    var customerName: String?

    // Terms
    var startDate: Date?
    var endDate: Date?
    var autoRenew: Bool?
    var renewalTermMonths: Int?
    var billingFrequency: String?   // monthly, quarterly, annually
    var paymentTerms: String?

    // Financial
    var monthlyAmount: Double?
    var annualValue: Double?
    var totalValue: Double?

    // Coverage
    var coverageType: String?       // full, parts_only, labor_only
    var includesSupplies: Bool?
    var slaResponseHours: Int?

    // Equipment covered
    var equipmentCount: Int?

    // Metadata
    var notes: String?
    var createdBy: String?
    var createdAt: Date?
    var updatedAt: Date?

    // MARK: - Computed

    var displayTitle: String {
        title ?? contractNumber ?? "Contract"
    }

    var isExpiring: Bool {
        endDate?.isWithinDays(30) ?? false
    }

    var isExpired: Bool {
        endDate?.isPast ?? false
    }

    var daysUntilExpiry: Int? {
        endDate?.daysFromNow
    }

    var statusEnum: ContractStatus {
        ContractStatus(rawValue: status ?? "") ?? .active
    }
}

// MARK: - Contract Status

enum ContractStatus: String, CaseIterable, Identifiable {
    case draft
    case active
    case expiring
    case expired
    case renewed
    case cancelled
    case churned

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .draft: "Draft"
        case .active: "Active"
        case .expiring: "Expiring"
        case .expired: "Expired"
        case .renewed: "Renewed"
        case .cancelled: "Cancelled"
        case .churned: "Churned"
        }
    }

    var icon: String {
        switch self {
        case .draft: "doc.badge.ellipsis"
        case .active: "checkmark.seal.fill"
        case .expiring: "clock.badge.exclamationmark"
        case .expired: "xmark.seal"
        case .renewed: "arrow.triangle.2.circlepath"
        case .cancelled: "xmark.circle"
        case .churned: "person.crop.circle.badge.minus"
        }
    }
}

// MARK: - Contract Renewal

struct ContractRenewal: Identifiable, Codable {
    let id: String
    let contractId: String?
    let contractNumber: String?
    let customerName: String?
    let endDate: Date?
    let annualValue: Double?
    let riskScore: Int?             // 0-100
    let status: String?             // pending, renewed, churned
    let notes: String?
    let createdAt: Date?
}

// MARK: - DTOs

struct CreateContractRequest: Encodable {
    let title: String
    var customerId: String?
    var type: String = "service"
    var startDate: Date?
    var endDate: Date?
    var monthlyAmount: Double?
    var billingFrequency: String = "monthly"
    var coverageType: String?
    var notes: String?
}

struct UpdateContractRequest: Encodable {
    var title: String?
    var status: String?
    var startDate: Date?
    var endDate: Date?
    var monthlyAmount: Double?
    var annualValue: Double?
    var billingFrequency: String?
    var autoRenew: Bool?
    var notes: String?
}
