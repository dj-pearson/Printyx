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
