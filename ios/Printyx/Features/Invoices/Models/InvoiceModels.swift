import Foundation

// MARK: - Invoice

struct Invoice: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?

    var invoiceNumber: String?
    var status: String?

    // Customer
    var customerId: String?
    var customerName: String?
    var billingEmail: String?

    // Amounts
    var subtotal: Double?
    var taxAmount: Double?
    var discountAmount: Double?
    var totalAmount: Double?
    var amountPaid: Double?
    var amountDue: Double?

    // Dates
    var issueDate: Date?
    var dueDate: Date?
    var paidDate: Date?
    var sentDate: Date?

    // Terms
    var paymentTerms: String?
    var currency: String?
    var notes: String?

    // Related
    var contractId: String?
    var quoteId: String?

    // Line items count
    var lineItemCount: Int?

    // Metadata
    var createdBy: String?
    var createdAt: Date?
    var updatedAt: Date?

    // MARK: - Codable
    //
    // The `invoices` edge function returns raw `select('*')` columns. Per
    // CLAUDE.md the canonical columns are `invoice_status` / `balance_due` /
    // `amount_paid` / `total_amount` / `paid_date`; the legacy `status` /
    // `amount_due` columns are phantom. The old synthesized Codable decoded
    // `status` and `amountDue`, which silently came back nil — breaking status
    // chips, Overdue/Paid metrics, and Mark-Paid gating (IOS-030). This decoder
    // prefers the canonical column and falls back to the legacy one.

    private enum CodingKeys: String, CodingKey {
        // Keys arrive camelCased (.convertFromSnakeCase).
        case id, tenantId, invoiceNumber
        case invoiceStatus, status
        case customerId, customerName, billingEmail
        case subtotal, subtotalAmount, taxAmount, discountAmount, totalAmount, amountPaid
        case balanceDue, amountDue
        case issueDate, dueDate, paidDate, sentDate
        case paymentTerms, currency, notes
        case contractId, quoteId, lineItemCount
        case createdBy, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        tenantId = try c.decodeIfPresent(String.self, forKey: .tenantId)
        invoiceNumber = try c.decodeIfPresent(String.self, forKey: .invoiceNumber)
        status = try c.decodeIfPresent(String.self, forKey: .invoiceStatus)
            ?? c.decodeIfPresent(String.self, forKey: .status)
        customerId = try c.decodeIfPresent(String.self, forKey: .customerId)
        customerName = try c.decodeIfPresent(String.self, forKey: .customerName)
        billingEmail = try c.decodeIfPresent(String.self, forKey: .billingEmail)
        subtotal = try c.decodeIfPresent(Double.self, forKey: .subtotal)
            ?? c.decodeIfPresent(Double.self, forKey: .subtotalAmount)
        taxAmount = try c.decodeIfPresent(Double.self, forKey: .taxAmount)
        discountAmount = try c.decodeIfPresent(Double.self, forKey: .discountAmount)
        totalAmount = try c.decodeIfPresent(Double.self, forKey: .totalAmount)
        amountPaid = try c.decodeIfPresent(Double.self, forKey: .amountPaid)
        amountDue = try c.decodeIfPresent(Double.self, forKey: .balanceDue)
            ?? c.decodeIfPresent(Double.self, forKey: .amountDue)
        issueDate = try c.decodeIfPresent(Date.self, forKey: .issueDate)
        dueDate = try c.decodeIfPresent(Date.self, forKey: .dueDate)
        paidDate = try c.decodeIfPresent(Date.self, forKey: .paidDate)
        sentDate = try c.decodeIfPresent(Date.self, forKey: .sentDate)
        paymentTerms = try c.decodeIfPresent(String.self, forKey: .paymentTerms)
        currency = try c.decodeIfPresent(String.self, forKey: .currency)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        contractId = try c.decodeIfPresent(String.self, forKey: .contractId)
        quoteId = try c.decodeIfPresent(String.self, forKey: .quoteId)
        lineItemCount = try c.decodeIfPresent(Int.self, forKey: .lineItemCount)
        createdBy = try c.decodeIfPresent(String.self, forKey: .createdBy)
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(tenantId, forKey: .tenantId)
        try c.encodeIfPresent(invoiceNumber, forKey: .invoiceNumber)
        try c.encodeIfPresent(status, forKey: .invoiceStatus)
        try c.encodeIfPresent(customerId, forKey: .customerId)
        try c.encodeIfPresent(customerName, forKey: .customerName)
        try c.encodeIfPresent(billingEmail, forKey: .billingEmail)
        try c.encodeIfPresent(subtotal, forKey: .subtotal)
        try c.encodeIfPresent(taxAmount, forKey: .taxAmount)
        try c.encodeIfPresent(discountAmount, forKey: .discountAmount)
        try c.encodeIfPresent(totalAmount, forKey: .totalAmount)
        try c.encodeIfPresent(amountPaid, forKey: .amountPaid)
        try c.encodeIfPresent(amountDue, forKey: .balanceDue)
        try c.encodeIfPresent(issueDate, forKey: .issueDate)
        try c.encodeIfPresent(dueDate, forKey: .dueDate)
        try c.encodeIfPresent(paidDate, forKey: .paidDate)
        try c.encodeIfPresent(sentDate, forKey: .sentDate)
        try c.encodeIfPresent(paymentTerms, forKey: .paymentTerms)
        try c.encodeIfPresent(currency, forKey: .currency)
        try c.encodeIfPresent(notes, forKey: .notes)
        try c.encodeIfPresent(contractId, forKey: .contractId)
        try c.encodeIfPresent(quoteId, forKey: .quoteId)
        try c.encodeIfPresent(lineItemCount, forKey: .lineItemCount)
        try c.encodeIfPresent(createdBy, forKey: .createdBy)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(updatedAt, forKey: .updatedAt)
    }

    // MARK: - Computed

    var displayTitle: String {
        if let num = invoiceNumber { return "INV-\(num)" }
        return "Invoice"
    }

    var isOverdue: Bool {
        guard let dueDate, status != "paid" && status != "cancelled" else { return false }
        return dueDate.isPast
    }

    var daysUntilDue: Int? {
        dueDate?.daysFromNow
    }

    var statusEnum: InvoiceStatus {
        InvoiceStatus(rawValue: status ?? "") ?? .draft
    }
}

// MARK: - Invoice Line Item

struct InvoiceLineItem: Identifiable, Codable {
    let id: String
    let invoiceId: String?
    var description: String?
    var quantity: Double?
    var unitPrice: Double?
    var amount: Double?
    var taxRate: Double?
    var sortOrder: Int?
}

// MARK: - Invoice Status

enum InvoiceStatus: String, CaseIterable, Identifiable {
    case draft
    case open               // backend default for a newly-issued invoice
    case sent
    case viewed
    case partiallyPaid = "partially_paid"
    case paid
    case overdue
    case cancelled
    case void = "void"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .draft: "Draft"
        case .open: "Open"
        case .sent: "Sent"
        case .viewed: "Viewed"
        case .partiallyPaid: "Partial"
        case .paid: "Paid"
        case .overdue: "Overdue"
        case .cancelled: "Cancelled"
        case .void: "Void"
        }
    }

    var icon: String {
        switch self {
        case .draft: "doc.badge.ellipsis"
        case .open: "doc.text"
        case .sent: "paperplane"
        case .viewed: "eye"
        case .partiallyPaid: "dollarsign.circle"
        case .paid: "checkmark.seal.fill"
        case .overdue: "exclamationmark.triangle"
        case .cancelled: "xmark.circle"
        case .void: "slash.circle"
        }
    }
}

// MARK: - DTOs

struct CreateInvoiceRequest: Encodable {
    var customerId: String?
    var dueDate: Date?
    var paymentTerms: String?
    var notes: String?
}

struct UpdateInvoiceRequest: Encodable {
    var status: String?
    var dueDate: Date?
    var notes: String?
    var paymentTerms: String?
}
