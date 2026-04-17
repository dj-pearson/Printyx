import SwiftUI

/// A colored badge indicating status (task, lead, quote, etc.).
/// Optionally renders a leading SF Symbol so meaning isn't color-only —
/// important for color-blind users and for VoiceOver users who hear the label.
struct StatusBadge: View {
    let text: String
    let color: Color
    let icon: String?

    init(_ text: String, color: Color, icon: String? = nil) {
        self.text = text
        self.color = color
        self.icon = icon
    }

    var body: some View {
        HStack(spacing: 4) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .semibold))
            }
            Text(text)
                .font(.printyxSmall)
                .fontWeight(.semibold)
        }
        .foregroundStyle(color)
        .padding(.horizontal, AppTheme.Spacing.sm)
        .padding(.vertical, AppTheme.Spacing.xs)
        .background(color.opacity(0.12))
        .cornerRadius(AppTheme.Radius.sm)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
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
        let icon: String = switch status {
        case "todo": "circle"
        case "in_progress": "clock"
        case "review": "magnifyingglass"
        case "completed": "checkmark.circle.fill"
        case "cancelled": "xmark.circle"
        default: "circle"
        }
        let label = status.replacingOccurrences(of: "_", with: " ").capitalized
        return StatusBadge(label, color: color, icon: icon)
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
        let icon: String = switch priority {
        case "urgent", "critical": "exclamationmark.triangle.fill"
        case "high": "arrow.up"
        case "medium": "equal"
        case "low": "arrow.down"
        default: "circle"
        }
        return StatusBadge(priority.capitalized, color: color, icon: icon)
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
        let icon: String = switch status {
        case "draft": "doc"
        case "sent": "paperplane"
        case "accepted": "checkmark.seal.fill"
        case "rejected": "xmark.seal"
        case "expired": "clock.badge.xmark"
        default: "doc"
        }
        return StatusBadge(status.capitalized, color: color, icon: icon)
    }

    /// Interest/temperature badge.
    static func interest(_ level: String) -> StatusBadge {
        let color: Color = switch level.lowercased() {
        case "hot": .priorityUrgent
        case "warm": .priorityHigh
        case "cold": .priorityLow
        default: .secondary
        }
        let icon: String = switch level.lowercased() {
        case "hot": "flame.fill"
        case "warm": "thermometer.medium"
        case "cold": "snowflake"
        default: "thermometer.low"
        }
        return StatusBadge(level.capitalized, color: color, icon: icon)
    }
}
