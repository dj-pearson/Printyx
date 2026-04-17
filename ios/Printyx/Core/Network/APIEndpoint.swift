import Foundation

/// Defines the HTTP method for an API request.
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// Describes an API endpoint with its path, method, query parameters, and body.
struct APIEndpoint {
    let path: String
    let method: HTTPMethod
    let queryItems: [URLQueryItem]?
    let body: Encodable?
    let requiresAuth: Bool

    init(
        path: String,
        method: HTTPMethod = .get,
        queryItems: [URLQueryItem]? = nil,
        body: Encodable? = nil,
        requiresAuth: Bool = true
    ) {
        self.path = path
        self.method = method
        self.queryItems = queryItems
        self.body = body
        self.requiresAuth = requiresAuth
    }

    /// Whether this mutation should be queued when the device is offline.
    /// Authentication + refresh + logout explicitly opt out — replaying those
    /// hours later would be nonsense. Everything else under `/api/` is eligible.
    var queueableWhenOffline: Bool {
        guard method != .get else { return false }
        if path.hasPrefix("/auth/") { return false }
        if path.hasPrefix("/api/mobile-auth/") { return false }
        return true
    }
}


// MARK: - Task Endpoints

extension APIEndpoint {
    static func tasks(
        assignedTo: String? = nil,
        myTasks: Bool = false,
        status: String? = nil,
        priority: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let assignedTo { items.append(URLQueryItem(name: "assignedTo", value: assignedTo)) }
        if myTasks { items.append(URLQueryItem(name: "my", value: "true")) }
        if let status { items.append(URLQueryItem(name: "status", value: status)) }
        if let priority { items.append(URLQueryItem(name: "priority", value: priority)) }
        return APIEndpoint(path: "/api/tasks", queryItems: items)
    }

    static func taskStats(myTasks: Bool = false) -> APIEndpoint {
        var items: [URLQueryItem] = []
        if myTasks { items.append(URLQueryItem(name: "my", value: "true")) }
        return APIEndpoint(path: "/api/tasks/stats", queryItems: items)
    }

    static func task(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/tasks/\(id)")
    }

    static func createTask(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/tasks", method: .post, body: body)
    }

    static func updateTask(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/tasks/\(id)", method: .patch, body: body)
    }

    static func deleteTask(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/tasks/\(id)", method: .delete)
    }

    static func addTaskComment(taskId: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/tasks/\(taskId)/comments", method: .post, body: body)
    }

    static func logTaskTime(taskId: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/tasks/\(taskId)/time", method: .post, body: body)
    }

    static func bulkUpdateTasks(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/tasks/bulk", method: .patch, body: body)
    }
}

// MARK: - Customer / CRM Endpoints

extension APIEndpoint {
    static func customers(
        search: String? = nil,
        status: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let search { items.append(URLQueryItem(name: "search", value: search)) }
        if let status { items.append(URLQueryItem(name: "status", value: status)) }
        return APIEndpoint(path: "/api/customers", queryItems: items)
    }

    static func customer(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/customers/\(id)")
    }

    static func createCustomer(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/customers", method: .post, body: body)
    }

    static func updateCustomer(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/customers/\(id)", method: .put, body: body)
    }

    static func deleteCustomer(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/customers/\(id)", method: .delete)
    }

    static func leads(
        search: String? = nil,
        status: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let search { items.append(URLQueryItem(name: "search", value: search)) }
        if let status { items.append(URLQueryItem(name: "status", value: status)) }
        return APIEndpoint(path: "/api/leads", queryItems: items)
    }

    static func lead(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/leads/\(id)")
    }

    static func createLead(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/leads", method: .post, body: body)
    }

    static func updateLead(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/leads/\(id)", method: .put, body: body)
    }

    static func convertLead(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/leads/\(id)/convert", method: .post)
    }

    static func leadActivities(leadId: String) -> APIEndpoint {
        APIEndpoint(path: "/api/leads/\(leadId)/activities")
    }

    static func createLeadActivity(leadId: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/leads/\(leadId)/activities", method: .post, body: body)
    }

    static func businessRecords(
        search: String? = nil,
        recordType: String? = nil,
        status: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let search { items.append(URLQueryItem(name: "search", value: search)) }
        if let recordType { items.append(URLQueryItem(name: "recordType", value: recordType)) }
        if let status { items.append(URLQueryItem(name: "status", value: status)) }
        return APIEndpoint(path: "/api/business-records", queryItems: items)
    }
}

// MARK: - Opportunity Endpoints

extension APIEndpoint {
    static func opportunities(
        stage: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let stage { items.append(URLQueryItem(name: "stage", value: stage)) }
        return APIEndpoint(path: "/api/opportunities", queryItems: items)
    }

    static func opportunity(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/opportunities/\(id)")
    }

    static func createOpportunity(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/opportunities", method: .post, body: body)
    }

    static func updateOpportunity(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/opportunities/\(id)", method: .put, body: body)
    }

    static func updateOpportunityStage(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/opportunities/\(id)/stage", method: .patch, body: body)
    }
}

// MARK: - Quotes / Proposals Endpoints

extension APIEndpoint {
    static func proposals(
        status: String? = nil,
        customerId: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let status { items.append(URLQueryItem(name: "status", value: status)) }
        if let customerId { items.append(URLQueryItem(name: "customerId", value: customerId)) }
        return APIEndpoint(path: "/api/proposals", queryItems: items)
    }

    static func proposal(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/proposals/\(id)")
    }

    static func createProposal(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/proposals", method: .post, body: body)
    }

    static func updateProposal(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/proposals/\(id)", method: .put, body: body)
    }

    static func updateProposalStatus(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/proposals/\(id)/status", method: .patch, body: body)
    }

    static func sendProposal(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/proposals/\(id)/send", method: .post)
    }

    static func proposalPDF(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/proposals/\(id)/pdf")
    }

    static func proposalTemplates() -> APIEndpoint {
        APIEndpoint(path: "/api/proposal-templates")
    }

    static func quotes(
        status: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let status { items.append(URLQueryItem(name: "status", value: status)) }
        return APIEndpoint(path: "/api/quotes", queryItems: items)
    }

    static func quote(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/quotes/\(id)")
    }

    static func createQuote(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/quotes", method: .post, body: body)
    }

    static func updateQuote(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/quotes/\(id)", method: .put, body: body)
    }
}

// MARK: - Dashboard Endpoints

extension APIEndpoint {
    static func todayDashboard() -> APIEndpoint {
        APIEndpoint(path: "/api/today-dashboard")
    }

    static func activityFeed(page: Int = 1, limit: Int = 20) -> APIEndpoint {
        let items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        return APIEndpoint(path: "/api/activities", queryItems: items)
    }

    static func notifications(page: Int = 1, limit: Int = 25) -> APIEndpoint {
        let items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        return APIEndpoint(path: "/api/notifications", queryItems: items)
    }

    static func markNotificationRead(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/notifications/\(id)/read", method: .patch)
    }

    static func markAllNotificationsRead() -> APIEndpoint {
        APIEndpoint(path: "/api/notifications/read-all", method: .patch)
    }

    static func globalSearch(query: String) -> APIEndpoint {
        let items = [URLQueryItem(name: "q", value: query)]
        return APIEndpoint(path: "/api/search", queryItems: items)
    }
}

// MARK: - Manager / Team Reports Endpoints

extension APIEndpoint {
    static func teamPipeline() -> APIEndpoint {
        APIEndpoint(path: "/api/team-reports/pipeline")
    }

    static func teamActivitiesByRep(days: Int = 7) -> APIEndpoint {
        let items = [URLQueryItem(name: "days", value: "\(days)")]
        return APIEndpoint(path: "/api/team-reports/activities", queryItems: items)
    }

    static func teamLeaderboard(period: String = "month") -> APIEndpoint {
        let items = [URLQueryItem(name: "period", value: period)]
        return APIEndpoint(path: "/api/team-reports/leaderboard", queryItems: items)
    }

    static func teamNoTouchAlerts(days: Int = 3) -> APIEndpoint {
        let items = [URLQueryItem(name: "days", value: "\(days)")]
        return APIEndpoint(path: "/api/team-reports/no-touch", queryItems: items)
    }
}

// MARK: - Service Ticket Endpoints

extension APIEndpoint {
    static func serviceTickets(
        status: String? = nil,
        priority: String? = nil,
        assignedTo: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let status { items.append(URLQueryItem(name: "status", value: status)) }
        if let priority { items.append(URLQueryItem(name: "priority", value: priority)) }
        if let assignedTo { items.append(URLQueryItem(name: "assignedTo", value: assignedTo)) }
        if let search { items.append(URLQueryItem(name: "search", value: search)) }
        return APIEndpoint(path: "/api/service-tickets", queryItems: items)
    }

    static func serviceTicket(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/service-tickets/\(id)")
    }

    static func createServiceTicket(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/service-tickets", method: .post, body: body)
    }

    static func updateServiceTicket(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/service-tickets/\(id)", method: .patch, body: body)
    }

    static func serviceTicketUpdates(ticketId: String) -> APIEndpoint {
        APIEndpoint(path: "/api/service-tickets/\(ticketId)/updates")
    }

    static func addServiceTicketNote(ticketId: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/service-tickets/\(ticketId)/updates", method: .post, body: body)
    }
}

// MARK: - Equipment Endpoints

extension APIEndpoint {
    static func equipment(
        customerId: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let customerId { items.append(URLQueryItem(name: "customerId", value: customerId)) }
        if let search { items.append(URLQueryItem(name: "search", value: search)) }
        return APIEndpoint(path: "/api/equipment", queryItems: items)
    }

    static func equipmentDetail(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/equipment/\(id)")
    }

    static func createEquipment(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/equipment", method: .post, body: body)
    }

    static func updateEquipment(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/equipment/\(id)", method: .patch, body: body)
    }

    static func meterReadings(equipmentId: String, page: Int = 1, limit: Int = 25) -> APIEndpoint {
        let items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        return APIEndpoint(path: "/api/meter-readings", queryItems: items + [URLQueryItem(name: "equipmentId", value: equipmentId)])
    }
}

// MARK: - Contract Endpoints

extension APIEndpoint {
    static func contracts(
        status: String? = nil,
        customerId: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let status { items.append(URLQueryItem(name: "status", value: status)) }
        if let customerId { items.append(URLQueryItem(name: "customerId", value: customerId)) }
        if let search { items.append(URLQueryItem(name: "search", value: search)) }
        return APIEndpoint(path: "/api/contracts", queryItems: items)
    }

    static func contract(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/contracts/\(id)")
    }

    static func createContract(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/contracts", method: .post, body: body)
    }

    static func updateContract(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/contracts/\(id)", method: .patch, body: body)
    }

    static func upcomingRenewals(days: Int = 90) -> APIEndpoint {
        let items = [URLQueryItem(name: "days", value: "\(days)")]
        return APIEndpoint(path: "/api/contract-renewal/upcoming", queryItems: items)
    }

    static func renewContract(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/contract-renewal/\(id)/renew", method: .post, body: body)
    }
}

// MARK: - Invoice Endpoints

extension APIEndpoint {
    static func invoices(
        status: String? = nil,
        customerId: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let status { items.append(URLQueryItem(name: "status", value: status)) }
        if let customerId { items.append(URLQueryItem(name: "customerId", value: customerId)) }
        if let search { items.append(URLQueryItem(name: "search", value: search)) }
        return APIEndpoint(path: "/api/invoices", queryItems: items)
    }

    static func invoice(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/invoices/\(id)")
    }

    static func createInvoice(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/invoices", method: .post, body: body)
    }

    static func updateInvoice(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/invoices/\(id)", method: .patch, body: body)
    }
}

// MARK: - Contact Endpoints

extension APIEndpoint {
    static func contacts(
        companyId: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) -> APIEndpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let companyId { items.append(URLQueryItem(name: "companyId", value: companyId)) }
        if let search { items.append(URLQueryItem(name: "search", value: search)) }
        return APIEndpoint(path: "/api/contacts", queryItems: items)
    }

    static func contact(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/contacts/\(id)")
    }

    static func createContact(body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/contacts", method: .post, body: body)
    }

    static func updateContact(id: String, body: Encodable) -> APIEndpoint {
        APIEndpoint(path: "/api/contacts/\(id)", method: .patch, body: body)
    }

    static func deleteContact(id: String) -> APIEndpoint {
        APIEndpoint(path: "/api/contacts/\(id)", method: .delete)
    }
}

// MARK: - Auth Endpoints

extension APIEndpoint {
    static func login(body: Encodable) -> APIEndpoint {
        // Route through Edge Functions to bypass Kong/GoTrue 503 errors
        // /api/mobile-auth/login → Edge Functions strips /api/ → /mobile-auth/login
        APIEndpoint(path: "/api/mobile-auth/login", method: .post, body: body, requiresAuth: false)
    }

    static func refreshToken(body: Encodable) -> APIEndpoint {
        // Route through Edge Functions to bypass Kong/GoTrue 503 errors
        APIEndpoint(path: "/api/mobile-auth/refresh", method: .post, body: body, requiresAuth: false)
    }

    static func currentUser() -> APIEndpoint {
        APIEndpoint(path: "/auth/v1/user")
    }

    /// Revokes the current refresh token server-side. Best-effort only — the
    /// client still clears local keychain state regardless of the response.
    static func logout() -> APIEndpoint {
        APIEndpoint(path: "/auth/v1/logout", method: .post)
    }
}
