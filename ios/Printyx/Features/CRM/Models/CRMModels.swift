import Foundation

// MARK: - Business Record (Unified Lead/Customer)

struct BusinessRecord: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?

    // Record Type & Status
    var recordType: RecordType
    var status: String?

    // Company Information
    var companyName: String?
    var accountNumber: String?
    var accountType: String?
    var website: String?
    var industry: String?
    var companySize: String?
    var employeeCount: Int?
    var annualRevenue: Double?

    // Rating
    var customerRating: String?     // Hot, Warm, Cold
    var customerPriority: String?
    var isActive: Bool?

    // Primary Contact
    var primaryContactName: String?
    var primaryContactEmail: String?
    var primaryContactPhone: String?
    var primaryContactTitle: String?

    // Billing Contact
    var billingContactName: String?
    var billingContactEmail: String?
    var billingContactPhone: String?

    // Address
    var addressLine1: String?
    var addressLine2: String?
    var city: String?
    var state: String?
    var postalCode: String?
    var country: String?

    // Billing Address
    var billingAddressLine1: String?
    var billingCity: String?
    var billingState: String?
    var billingPostalCode: String?

    // Communication
    var phone: String?
    var fax: String?
    var preferredContactMethod: String?

    // Sales Pipeline
    var source: String?
    var estimatedAmount: Double?
    var probability: Int?
    var closeDate: Date?
    var salesStage: String?
    var interestLevel: String?       // hot, warm, cold

    // Assignment
    var ownerId: String?
    var assignedSalesRep: String?
    var territory: String?
    var leadScore: Int?
    var priority: String?

    // Customer-Specific
    var customerNumber: String?
    var companyDisplayId: String?
    var urlSlug: String?
    var customerSince: Date?

    // Financial
    var creditLimit: Double?
    var paymentTerms: String?
    var taxExempt: Bool?
    var customerTier: String?

    // Activity
    var lastContactDate: Date?
    var nextFollowUpDate: Date?

    // Metadata
    var notes: String?
    var createdBy: String?
    var createdAt: Date?
    var updatedAt: Date?

    // MARK: - Computed

    var displayName: String {
        companyName ?? primaryContactName ?? "Unknown"
    }

    var fullAddress: String? {
        let parts = [addressLine1, city, state, postalCode].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    var initials: String {
        let name = companyName ?? primaryContactName ?? ""
        let words = name.split(separator: " ")
        if words.count >= 2 {
            return "\(words[0].prefix(1))\(words[1].prefix(1))".uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    var needsFollowUp: Bool {
        guard let nextFollowUp = nextFollowUpDate else { return false }
        return nextFollowUp.isPast || nextFollowUp.isToday
    }
}

// MARK: - Record Type

enum RecordType: String, Codable, CaseIterable, Identifiable {
    case lead
    case prospect
    case customer
    case formerCustomer = "former_customer"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .lead: "Lead"
        case .prospect: "Prospect"
        case .customer: "Customer"
        case .formerCustomer: "Former Customer"
        }
    }

    var icon: String {
        switch self {
        case .lead: "person.badge.plus"
        case .prospect: "person.crop.circle.badge.questionmark"
        case .customer: "person.crop.circle.badge.checkmark"
        case .formerCustomer: "person.crop.circle.badge.minus"
        }
    }

    var sortOrder: Int {
        switch self {
        case .lead: 0
        case .prospect: 1
        case .customer: 2
        case .formerCustomer: 3
        }
    }
}

// MARK: - Lead Activity

struct LeadActivity: Identifiable, Codable {
    let id: String
    let leadId: String?
    let type: String?            // call, email, meeting, note, task
    let subject: String?
    let description: String?
    let activityDate: Date?
    let createdBy: String?
    let createdAt: Date?

    var icon: String {
        switch type {
        case "call": return "phone"
        case "email": return "envelope"
        case "meeting": return "person.2"
        case "note": return "note.text"
        case "task": return "checkmark.circle"
        default: return "circle"
        }
    }
}

// MARK: - CRM DTOs

struct CreateBusinessRecordRequest: Encodable {
    let companyName: String
    var recordType: String = "lead"
    var primaryContactName: String?
    var primaryContactEmail: String?
    var primaryContactPhone: String?
    var primaryContactTitle: String?
    var phone: String?
    var website: String?
    var industry: String?
    var source: String?
    var interestLevel: String?
    var estimatedAmount: Double?
    var notes: String?
    var addressLine1: String?
    var city: String?
    var state: String?
    var postalCode: String?
}

struct UpdateBusinessRecordRequest: Encodable {
    var companyName: String?
    var recordType: String?
    var status: String?
    var primaryContactName: String?
    var primaryContactEmail: String?
    var primaryContactPhone: String?
    var primaryContactTitle: String?
    var phone: String?
    var website: String?
    var industry: String?
    var source: String?
    var interestLevel: String?
    var estimatedAmount: Double?
    var probability: Int?
    var salesStage: String?
    var notes: String?
    var addressLine1: String?
    var city: String?
    var state: String?
    var postalCode: String?
    var nextFollowUpDate: Date?
    var priority: String?
    var customerRating: String?
}

struct CreateActivityRequest: Encodable {
    let type: String
    let subject: String
    var description: String?
    var activityDate: Date?
}

// MARK: - Lead Sources

enum LeadSource: String, CaseIterable, Identifiable {
    case website
    case referral
    case coldCall = "cold_call"
    case tradeShow = "trade_show"
    case socialMedia = "social_media"
    case advertisement
    case partner
    case other

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .website: "Website"
        case .referral: "Referral"
        case .coldCall: "Cold Call"
        case .tradeShow: "Trade Show"
        case .socialMedia: "Social Media"
        case .advertisement: "Advertisement"
        case .partner: "Partner"
        case .other: "Other"
        }
    }
}
