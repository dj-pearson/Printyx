import Foundation

// MARK: - Today Dashboard

/// Mirrors the real `today-dashboard` edge-function payload
/// (supabase/functions/today-dashboard/index.ts). The previous model decoded
/// flat keys (openTasks/overdueInvoices/pipelineValue/monthlyRevenue) that the
/// backend never sends, so every KPI silently rendered 0 (IOS-027).
struct TodayDashboard: Codable {
    let taskCount: Int?
    let overdueCount: Int?
    let appointmentCount: Int?
    let pendingApprovalCount: Int?
    let metrics: Metrics?

    struct Metrics: Codable {
        let newLeads: Int?
        let todayRevenue: Double?
        let dealsWon: Int?
    }

    // MARK: Convenience accessors for the snapshot cards (default to 0 only
    // when the field is genuinely absent, not because of a key mismatch).
    var openTasks: Int { taskCount ?? 0 }
    var overdueTaskCount: Int { overdueCount ?? 0 }
    var appointments: Int { appointmentCount ?? 0 }
    var pendingApprovals: Int { pendingApprovalCount ?? 0 }
    var newLeads: Int { metrics?.newLeads ?? 0 }
    var todayRevenue: Double { metrics?.todayRevenue ?? 0 }
    var dealsWon: Int { metrics?.dealsWon ?? 0 }
}

// MARK: - Activity Item

/// Decodes raw `business_record_activities` rows returned by the `activities`
/// edge function (and the dashboard's `recentActivities`). The backend column
/// names (activity_type/subject/notes/business_record_id/created_by) don't
/// match the UI's vocabulary, so a custom decoder maps them — otherwise every
/// feed row fell back to the generic "Activity" title + grey circle (IOS-027).
struct ActivityItem: Identifiable, Codable {
    let id: String
    let type: String?           // deal_closed, ticket_created, lead_converted, quote_accepted, etc.
    let title: String?
    let description: String?
    let entityType: String?     // lead, customer, ticket, quote, etc.
    let entityId: String?
    let userId: String?
    let userName: String?
    let createdAt: Date?

    private enum CodingKeys: String, CodingKey {
        // NOTE: APIClient's decoder uses .convertFromSnakeCase, so incoming
        // snake_case keys arrive here already camelCased — hence "activityType",
        // "businessRecordId", "createdBy", etc.
        case id
        case type, activityType
        case title, subject
        case description, notes
        case entityType
        case entityId, businessRecordId, companyId
        case userId, createdBy
        case userName
        case user
        case createdAt
    }

    /// Nested `user:user_id (id, full_name)` join the dashboard route adds.
    private struct NestedUser: Decodable {
        let id: String?
        let fullName: String?
        let name: String?
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        type = try c.decodeIfPresent(String.self, forKey: .type)
            ?? c.decodeIfPresent(String.self, forKey: .activityType)
        title = try c.decodeIfPresent(String.self, forKey: .title)
            ?? c.decodeIfPresent(String.self, forKey: .subject)
        description = try c.decodeIfPresent(String.self, forKey: .description)
            ?? c.decodeIfPresent(String.self, forKey: .notes)

        let resolvedEntityId = try c.decodeIfPresent(String.self, forKey: .entityId)
            ?? c.decodeIfPresent(String.self, forKey: .businessRecordId)
            ?? c.decodeIfPresent(String.self, forKey: .companyId)
        entityId = resolvedEntityId
        // Rows carry no explicit entityType; a business_record_id/company_id
        // means the activity hangs off a CRM record, so route there.
        if let explicitType = try c.decodeIfPresent(String.self, forKey: .entityType) {
            entityType = explicitType
        } else if resolvedEntityId != nil {
            entityType = "business_record"
        } else {
            entityType = nil
        }

        // `try?` of decodeIfPresent yields NestedUser?? — flatten to NestedUser?.
        let nested = (try? c.decodeIfPresent(NestedUser.self, forKey: .user)) ?? nil
        userId = try c.decodeIfPresent(String.self, forKey: .userId)
            ?? c.decodeIfPresent(String.self, forKey: .createdBy)
            ?? nested?.id
        userName = try c.decodeIfPresent(String.self, forKey: .userName)
            ?? nested?.fullName ?? nested?.name
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(type, forKey: .activityType)
        try c.encodeIfPresent(title, forKey: .subject)
        try c.encodeIfPresent(description, forKey: .notes)
        try c.encodeIfPresent(entityType, forKey: .entityType)
        try c.encodeIfPresent(entityId, forKey: .businessRecordId)
        try c.encodeIfPresent(userId, forKey: .createdBy)
        try c.encodeIfPresent(userName, forKey: .userName)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
    }

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

    /// The detail route this activity points at, derived from entityType +
    /// entityId. `nil` when the activity carries no linkable entity (the feed
    /// row is then rendered non-tappable). Drives IOS-027 row routing.
    var route: AppRoute? {
        guard let entityId, !entityId.isEmpty else { return nil }
        switch (entityType ?? "").lowercased() {
        case "business_record", "customer", "lead", "prospect", "company":
            return .businessRecord(id: entityId)
        case "contact":
            return .contact(id: entityId)
        case "opportunity", "deal":
            return .opportunity(id: entityId)
        case "quote":
            return .quote(id: entityId)
        case "proposal":
            return .proposal(id: entityId)
        case "ticket", "service_ticket":
            return .serviceTicket(id: entityId)
        case "equipment":
            return .equipment(id: entityId)
        case "contract":
            return .contract(id: entityId)
        case "invoice":
            return .invoice(id: entityId)
        case "task":
            return .task(id: entityId)
        default:
            return nil
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

/// The `search` edge function (supabase/functions/search/index.ts) returns a
/// *keyed object* of raw rows — `{ results: { businessRecords, contacts,
/// quotes, tickets, equipment, projects, users } }` — not a flat array. The old
/// model decoded `{ results: [SearchResult] }`, so global search always showed
/// "No Results" in production (IOS-028). This decoder flattens every bucket into
/// typed `[SearchResult]`, synthesizing a `type` + `title` per row.
struct SearchResponse: Decodable {
    let results: [SearchResult]
    let total: Int?

    private enum CodingKeys: String, CodingKey {
        case results, totalResults
    }

    private enum BucketKeys: String, CodingKey {
        case businessRecords, contacts, quotes, tickets, equipment, projects, users
        case opportunities, invoices, contracts
    }

    // Lightweight row shapes for each bucket. Keys arrive camelCased thanks to
    // the decoder's .convertFromSnakeCase strategy.
    private struct BusinessRecordRow: Decodable {
        let id: String
        let companyName: String?
        let primaryContactName: String?
        let recordType: String?
        let status: String?
    }
    private struct ContactRow: Decodable {
        let id: String
        let firstName: String?
        let lastName: String?
        let email: String?
        let phone: String?
    }
    private struct QuoteRow: Decodable {
        let id: String
        let quoteNumber: String?
        let title: String?
        let status: String?
        let totalAmount: Double?
    }
    private struct TicketRow: Decodable {
        let id: String
        let ticketNumber: String?
        let title: String?
        let status: String?
    }
    private struct EquipmentRow: Decodable {
        let id: String
        let serialNumber: String?
        let modelNumber: String?
        let manufacturer: String?
    }

    init(from decoder: Decoder) throws {
        let root = try decoder.container(keyedBy: CodingKeys.self)
        total = try root.decodeIfPresent(Int.self, forKey: .totalResults)

        var flat: [SearchResult] = []
        guard let buckets = try? root.nestedContainer(keyedBy: BucketKeys.self, forKey: .results) else {
            // Backwards-compatible fallback: a flat array (e.g. test fixtures or
            // a future server shape).
            results = (try? root.decode([SearchResult].self, forKey: .results)) ?? []
            return
        }

        for row in (try? buckets.decode([BusinessRecordRow].self, forKey: .businessRecords)) ?? [] {
            // Leads and customers share business_records; status/record_type
            // disambiguates so the row routes to the right detail screen.
            let isLead = (row.recordType ?? "").lowercased().contains("lead")
            flat.append(SearchResult(
                id: row.id,
                type: isLead ? "lead" : "customer",
                title: row.companyName ?? row.primaryContactName ?? "Record",
                subtitle: row.primaryContactName,
                matchField: nil
            ))
        }
        for row in (try? buckets.decode([ContactRow].self, forKey: .contacts)) ?? [] {
            let name = [row.firstName, row.lastName].compactMap { $0 }.joined(separator: " ")
            flat.append(SearchResult(
                id: row.id,
                type: "contact",
                title: name.isEmpty ? (row.email ?? "Contact") : name,
                subtitle: row.email ?? row.phone,
                matchField: nil
            ))
        }
        for row in (try? buckets.decode([QuoteRow].self, forKey: .quotes)) ?? [] {
            flat.append(SearchResult(
                id: row.id,
                type: "quote",
                title: row.quoteNumber.map { "Quote #\($0)" } ?? row.title ?? "Quote",
                subtitle: row.title,
                matchField: nil
            ))
        }
        for row in (try? buckets.decode([TicketRow].self, forKey: .tickets)) ?? [] {
            flat.append(SearchResult(
                id: row.id,
                type: "ticket",
                title: row.ticketNumber.map { "Ticket #\($0)" } ?? row.title ?? "Ticket",
                subtitle: row.title,
                matchField: nil
            ))
        }
        for row in (try? buckets.decode([EquipmentRow].self, forKey: .equipment)) ?? [] {
            flat.append(SearchResult(
                id: row.id,
                type: "equipment",
                title: row.serialNumber ?? row.modelNumber ?? "Equipment",
                subtitle: [row.manufacturer, row.modelNumber].compactMap { $0 }.joined(separator: " "),
                matchField: nil
            ))
        }
        // `projects` and `users` buckets are intentionally omitted: the iOS app
        // has no detail destination for them, so surfacing un-routable rows
        // would be a dead-end tap. Documented gap — add when those screens ship.

        results = flat
    }
}
