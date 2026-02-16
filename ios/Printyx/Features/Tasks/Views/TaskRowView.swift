import SwiftUI

/// A single task row in the list.
struct TaskRowView: View {
    let task: PrintyxTask

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            // Status icon
            Image(systemName: task.status.icon)
                .font(.system(size: 20))
                .foregroundStyle(statusColor)
                .frame(width: 28)

            // Content
            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                // Title
                Text(task.title)
                    .font(.printyxSubheadline)
                    .foregroundStyle(task.status == .completed ? .secondary : .primary)
                    .strikethrough(task.status == .completed)
                    .lineLimit(2)

                // Meta row
                HStack(spacing: AppTheme.Spacing.sm) {
                    StatusBadge.priority(task.priority.rawValue)

                    if let dueDate = task.dueDate {
                        dueDateLabel(dueDate)
                    }

                    if let commentCount = task.commentCount, commentCount > 0 {
                        Label("\(commentCount)", systemImage: "bubble.left")
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                    }
                }

                // Tags
                if let tags = task.tags, !tags.isEmpty {
                    HStack(spacing: AppTheme.Spacing.xs) {
                        ForEach(tags.prefix(3), id: \.self) { tag in
                            Text(tag)
                                .font(.printyxSmall)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(.systemGray6))
                                .cornerRadius(4)
                        }
                        if tags.count > 3 {
                            Text("+\(tags.count - 3)")
                                .font(.printyxSmall)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Spacer()

            // Right side: completion ring or priority indicator
            if let percentage = task.completionPercentage, percentage > 0, task.status != .completed {
                CompletionRing(percentage: percentage, size: 32)
            } else {
                PriorityIndicator(priority: task.priority.rawValue)
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }

    private var statusColor: Color {
        switch task.status {
        case .todo: return .statusNew
        case .inProgress: return .statusActive
        case .review: return .statusPending
        case .completed: return .statusCompleted
        case .cancelled: return .statusCancelled
        }
    }

    @ViewBuilder
    private func dueDateLabel(_ date: Date) -> some View {
        let isOverdue = task.isOverdue
        HStack(spacing: 2) {
            Image(systemName: isOverdue ? "exclamationmark.circle" : "calendar")
                .font(.system(size: 10))
            Text(date.shortFormatted)
                .font(.printyxSmall)
        }
        .foregroundStyle(isOverdue ? Color.statusOverdue : .secondary)
    }
}
