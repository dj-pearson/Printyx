import SwiftUI

/// A colored badge indicating status (task, lead, quote, etc.).
struct StatusBadge: View {
    let text: String
    let color: Color

    init(_ text: String, color: Color) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text)
            .font(.printyxSmall)
            .fontWeight(.semibold)
            .foregroundStyle(color)
            .padding(.horizontal, AppTheme.Spacing.sm)
            .padding(.vertical, AppTheme.Spacing.xs)
            .background(color.opacity(0.12))
            .cornerRadius(AppTheme.Radius.sm)
    }
}

// MARK: - Convenience Initializers

extension StatusBadge {
    /// Task status badge.
    static func taskStatus(_ status: String) -> StatusBadge {
        let color: Color = switch status {
        case "todo": .statusNew
        case "in_progress": .statusActive
        case "review": .statusPending
        case "completed": .statusCompleted
        case "cancelled": .statusCancelled
        default: .secondary
        }
        let label = status.replacingOccurrences(of: "_", with: " ").capitalized
        return StatusBadge(label, color: color)
    }

    /// Priority badge.
    static func priority(_ priority: String) -> StatusBadge {
        let color: Color = switch priority {
        case "low": .priorityLow
        case "medium": .priorityMedium
        case "high": .priorityHigh
        case "urgent": .priorityUrgent
        default: .secondary
        }
        return StatusBadge(priority.capitalized, color: color)
    }

    /// CRM record type badge.
    static func recordType(_ type: String) -> StatusBadge {
        let color: Color = switch type {
        case "lead": .stageNew
        case "prospect": .stageQualified
        case "customer": .stageClosedWon
        case "former_customer": .statusCancelled
        default: .secondary
        }
        let label = type.replacingOccurrences(of: "_", with: " ").capitalized
        return StatusBadge(label, color: color)
    }

    /// Quote/Proposal status badge.
    static func quoteStatus(_ status: String) -> StatusBadge {
        let color: Color = switch status {
        case "draft": .priorityLow
        case "sent": .statusNew
        case "accepted": .statusCompleted
        case "rejected": .statusOverdue
        case "expired": .statusCancelled
        default: .secondary
        }
        return StatusBadge(status.capitalized, color: color)
    }

    /// Interest/temperature badge.
    static func interest(_ level: String) -> StatusBadge {
        let color: Color = switch level.lowercased() {
        case "hot": .priorityUrgent
        case "warm": .priorityHigh
        case "cold": .priorityLow
        default: .secondary
        }
        return StatusBadge(level.capitalized, color: color)
    }
}
