import Foundation

// MARK: - Service Ticket

struct ServiceTicket: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?

    var ticketNumber: String?
    var title: String?
    var description: String?
    var status: String?
    var priority: String?
    var category: String?
    var subcategory: String?

    // Customer & Location
    var customerId: String?
    var customerName: String?
    var locationId: String?
    var locationName: String?
    var siteAddress: String?

    // Equipment
    var equipmentId: String?
    var equipmentName: String?
    var serialNumber: String?
    var modelNumber: String?

    // Assignment
    var assignedTechnicianId: String?
    var assignedTechnicianName: String?
    var assignedTeamId: String?

    // Scheduling
    var scheduledDate: Date?
    var scheduledTime: String?
    var estimatedDuration: Int?       // minutes
    var actualDuration: Int?

    // Resolution
    var resolution: String?
    var resolvedAt: Date?
    var resolvedBy: String?
    var rootCause: String?

    // SLA
    var slaDeadline: Date?
    var responseTime: Int?            // minutes
    var firstResponseAt: Date?

    // Metadata
    var source: String?               // phone, email, portal, walk-in
    var createdBy: String?
    var createdAt: Date?
    var updatedAt: Date?
    var closedAt: Date?

    // MARK: - Computed

    var displayTitle: String {
        title ?? "Ticket \(ticketNumber ?? id.prefix(8).description)"
    }

    var isOverdue: Bool {
        guard let deadline = slaDeadline, status != "resolved" && status != "closed" else { return false }
        return deadline.isPast
    }

    var statusEnum: TicketStatus {
        TicketStatus(rawValue: status ?? "") ?? .open
    }

    var priorityEnum: TicketPriority {
        TicketPriority(rawValue: priority ?? "") ?? .medium
    }
}

// MARK: - Ticket Status

enum TicketStatus: String, CaseIterable, Identifiable {
    case open
    case inProgress = "in_progress"
    case onHold = "on_hold"
    case waitingParts = "waiting_parts"
    case scheduled
    case resolved
    case closed

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .open: "Open"
        case .inProgress: "In Progress"
        case .onHold: "On Hold"
        case .waitingParts: "Waiting Parts"
        case .scheduled: "Scheduled"
        case .resolved: "Resolved"
        case .closed: "Closed"
        }
    }

    var icon: String {
        switch self {
        case .open: "circle"
        case .inProgress: "wrench.and.screwdriver"
        case .onHold: "pause.circle"
        case .waitingParts: "shippingbox"
        case .scheduled: "calendar"
        case .resolved: "checkmark.circle.fill"
        case .closed: "xmark.circle"
        }
    }

    var sortOrder: Int {
        switch self {
        case .open: 0
        case .inProgress: 1
        case .scheduled: 2
        case .waitingParts: 3
        case .onHold: 4
        case .resolved: 5
        case .closed: 6
        }
    }
}

// MARK: - Ticket Priority

enum TicketPriority: String, CaseIterable, Identifiable {
    case low
    case medium
    case high
    case urgent
    case critical

    var id: String { rawValue }

    var displayName: String { rawValue.capitalized }

    var sortOrder: Int {
        switch self {
        case .critical: 0
        case .urgent: 1
        case .high: 2
        case .medium: 3
        case .low: 4
        }
    }
}

// MARK: - Ticket Update (Timeline entry)

struct TicketUpdate: Identifiable, Codable {
    let id: String
    let ticketId: String?
    let type: String?           // note, status_change, assignment, escalation
    let content: String?
    let oldValue: String?
    let newValue: String?
    let userId: String?
    let userName: String?
    let createdAt: Date?

    var icon: String {
        switch type {
        case "note": return "note.text"
        case "status_change": return "arrow.triangle.2.circlepath"
        case "assignment": return "person.badge.plus"
        case "escalation": return "arrow.up.circle"
        case "resolution": return "checkmark.circle.fill"
        case "parts_ordered": return "shippingbox"
        default: return "circle"
        }
    }
}

// MARK: - DTOs

struct CreateServiceTicketRequest: Encodable {
    let title: String
    var description: String?
    var priority: String = "medium"
    var category: String?
    var customerId: String?
    var equipmentId: String?
    var scheduledDate: Date?
}

struct UpdateServiceTicketRequest: Encodable {
    var title: String?
    var description: String?
    var status: String?
    var priority: String?
    var category: String?
    var assignedTechnicianId: String?
    var scheduledDate: Date?
    var resolution: String?
}

struct AddTicketNoteRequest: Encodable {
    let type: String
    let content: String
}
