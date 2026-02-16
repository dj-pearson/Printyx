import SwiftUI

/// Visual priority indicator with icon and color.
struct PriorityIndicator: View {
    let priority: String

    private var color: Color {
        switch priority {
        case "urgent": .priorityUrgent
        case "high": .priorityHigh
        case "medium": .priorityMedium
        case "low": .priorityLow
        default: .secondary
        }
    }

    private var icon: String {
        switch priority {
        case "urgent": "exclamationmark.2"
        case "high": "arrow.up"
        case "medium": "minus"
        case "low": "arrow.down"
        default: "minus"
        }
    }

    var body: some View {
        Image(systemName: icon)
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(color)
            .frame(width: 20, height: 20)
    }
}

/// Avatar circle with initials for contacts/users.
struct AvatarView: View {
    let initials: String
    var size: CGFloat = 40
    var backgroundColor: Color = .printyxPrimary

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(backgroundColor)
            .clipShape(Circle())
    }
}

/// Completion percentage ring.
struct CompletionRing: View {
    let percentage: Int
    var size: CGFloat = 36
    var lineWidth: CGFloat = 3

    private var progress: Double {
        Double(min(max(percentage, 0), 100)) / 100.0
    }

    private var color: Color {
        switch percentage {
        case 0..<25: .statusOverdue
        case 25..<50: .priorityHigh
        case 50..<75: .statusPending
        case 75...100: .statusCompleted
        default: .secondary
        }
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color(.systemGray5), lineWidth: lineWidth)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))

            Text("\(percentage)%")
                .font(.system(size: size * 0.28, weight: .bold, design: .rounded))
                .foregroundStyle(color)
        }
        .frame(width: size, height: size)
    }
}
