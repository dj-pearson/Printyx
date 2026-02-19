import Foundation

// MARK: - Contact

struct Contact: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?

    var contactName: String?
    var firstName: String?
    var lastName: String?
    var email: String?
    var phone: String?
    var mobilePhone: String?
    var title: String?
    var department: String?
    var role: String?               // primary, billing, technical, decision_maker

    // Company
    var companyId: String?
    var companyName: String?

    // Address
    var addressLine1: String?
    var city: String?
    var state: String?
    var postalCode: String?

    // Preferences
    var preferredContactMethod: String?
    var doNotContact: Bool?
    var notes: String?

    // Metadata
    var isActive: Bool?
    var createdAt: Date?
    var updatedAt: Date?

    // MARK: - Computed

    var displayName: String {
        if let first = firstName, let last = lastName {
            return "\(first) \(last)"
        }
        return contactName ?? email ?? "Contact"
    }

    var initials: String {
        if let first = firstName?.first, let last = lastName?.first {
            return "\(first)\(last)".uppercased()
        }
        let name = contactName ?? ""
        let words = name.split(separator: " ")
        if words.count >= 2 {
            return "\(words[0].prefix(1))\(words[1].prefix(1))".uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    var roleIcon: String {
        switch role {
        case "primary": return "star.fill"
        case "billing": return "dollarsign.circle"
        case "technical": return "wrench"
        case "decision_maker": return "crown"
        default: return "person"
        }
    }
}

// MARK: - DTOs

struct CreateContactRequest: Encodable {
    var contactName: String?
    var firstName: String?
    var lastName: String?
    var email: String?
    var phone: String?
    var title: String?
    var companyId: String?
    var role: String?
    var notes: String?
}

struct UpdateContactRequest: Encodable {
    var contactName: String?
    var firstName: String?
    var lastName: String?
    var email: String?
    var phone: String?
    var mobilePhone: String?
    var title: String?
    var department: String?
    var role: String?
    var notes: String?
}
