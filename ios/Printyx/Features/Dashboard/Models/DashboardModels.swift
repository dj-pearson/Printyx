import Foundation

// MARK: - Today Dashboard

struct TodayDashboard: Codable {
    let openTasks: Int?
    let dueTodayTasks: Int?
    let openTickets: Int?
    let overdueInvoices: Int?
    let pipelineValue: Double?
    let monthlyRevenue: Double?
    let newLeadsToday: Int?
    let upcomingAppointments: Int?
}

// MARK: - Activity Item

struct ActivityItem: Identifiable, Codable {
    let id: String
    let type: String?           // deal_closed, ticket_created, lead_converted, quote_accepted, etc.
    let title: String?
    let description: String?
    let entityType: String?     // lead, customer, ticket, quote, etc.
    let entityId: String?
    let userId: String?
    let userName: String?
    let metadata: [String: String]?
    let createdAt: Date?

    var icon: String {
        switch type {
        case "deal_closed", "deal_won": return "checkmark.seal.fill"
        case "ticket_created": return "ticket"
        case "ticket_resolved": return "checkmark.circle.fill"
        case "lead_converted": return "person.badge.plus"
        case "lead_created": return "plus.circle"
        case "quote_accepted": return "doc.badge.checkmark"
        case "quote_sent": return "paperplane"
        case "invoice_paid": return "dollarsign.circle.fill"
        case "task_completed": return "checkmark.square.fill"
        case "note_added": return "note.text"
        case "call": return "phone"
        case "email": return "envelope"
        case "meeting": return "person.2"
        default: return "circle.fill"
        }
    }

    var iconColor: String {
        switch type {
        case "deal_closed", "deal_won", "quote_accepted", "ticket_resolved": return "22C55E"
        case "ticket_created": return "F59E0B"
        case "lead_converted", "lead_created": return "3B82F6"
        case "quote_sent": return "8B5CF6"
        case "invoice_paid": return "10B981"
        case "task_completed": return "6366F1"
        default: return "6B7280"
        }
    }
}

// MARK: - Notification

struct AppNotification: Identifiable, Codable {
    let id: String
    let type: String?           // contract_renewal, invoice_overdue, lead_assigned, etc.
    let title: String?
    let message: String?
    let entityType: String?
    let entityId: String?
    var isRead: Bool?
    let createdAt: Date?

    var icon: String {
        switch type {
        case "contract_renewal": return "doc.badge.clock"
        case "invoice_overdue": return "exclamationmark.triangle"
        case "lead_assigned": return "person.badge.plus"
        case "task_due": return "clock.badge.exclamationmark"
        case "ticket_escalated": return "arrow.up.circle"
        case "quote_expired": return "clock.badge.xmark"
        case "approval_needed": return "hand.raised"
        default: return "bell"
        }
    }

    var iconColor: String {
        switch type {
        case "invoice_overdue", "ticket_escalated": return "EF4444"
        case "contract_renewal", "task_due", "quote_expired": return "F59E0B"
        case "lead_assigned": return "3B82F6"
        case "approval_needed": return "8B5CF6"
        default: return "6B7280"
        }
    }
}

// MARK: - Search Result

struct SearchResult: Identifiable, Codable {
    let id: String
    let type: String?           // customer, lead, ticket, quote, task, etc.
    let title: String?
    let subtitle: String?
    let matchField: String?

    var icon: String {
        switch type {
        case "customer": return "building.2"
        case "lead": return "person.badge.plus"
        case "contact": return "person.crop.circle"
        case "ticket", "service_ticket": return "wrench.and.screwdriver"
        case "quote", "proposal": return "doc.text"
        case "invoice": return "doc.richtext"
        case "task": return "checkmark.circle"
        case "equipment": return "printer"
        case "contract": return "doc.badge.ellipsis"
        case "opportunity": return "chart.line.uptrend.xyaxis"
        default: return "magnifyingglass"
        }
    }
}

struct SearchResponse: Codable {
    let results: [SearchResult]?
    let total: Int?
}
