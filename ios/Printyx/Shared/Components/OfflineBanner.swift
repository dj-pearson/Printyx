import SwiftUI

/// Thin banner shown above the tab bar when `NetworkMonitor` reports the
/// device is offline. Kept intentionally small so it doesn't cover list
/// content — reps still want to interact with cached data.
struct OfflineBanner: View {
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @EnvironmentObject var writeQueue: OfflineWriteQueue

    var body: some View {
        Group {
            if !networkMonitor.isConnected {
                bannerContent(
                    icon: "wifi.slash",
                    message: pendingMessage,
                    color: .orange
                )
            } else if writeQueue.pendingCount > 0 {
                bannerContent(
                    icon: "arrow.triangle.2.circlepath",
                    message: "Syncing \(writeQueue.pendingCount) change\(writeQueue.pendingCount == 1 ? "" : "s")…",
                    color: .blue
                )
            }
        }
        // Animate only when the values that drive the banner actually change.
        // (Previously keyed on `UUID()` in MainTabView, which re-evaluated the
        // animation on every render and produced no stable transition.)
        .animation(.easeInOut(duration: 0.2), value: animationToken)
    }

    /// Stable token combining the two inputs that decide what the banner shows,
    /// so `.animation(value:)` fires exactly on connectivity / queue changes.
    private var animationToken: String {
        "\(networkMonitor.isConnected)-\(writeQueue.pendingCount)"
    }

    private var pendingMessage: String {
        let pending = writeQueue.pendingCount
        if pending == 0 { return "You're offline — showing cached data." }
        return "Offline — \(pending) change\(pending == 1 ? "" : "s") queued."
    }

    private func bannerContent(icon: String, message: String, color: Color) -> some View {
        HStack(spacing: AppTheme.Spacing.sm) {
            Image(systemName: icon)
            Text(message)
                .font(.printyxCaption)
                .lineLimit(1)
            Spacer()
        }
        .foregroundStyle(.white)
        .padding(.horizontal, AppTheme.Spacing.md)
        .padding(.vertical, AppTheme.Spacing.sm)
        .frame(maxWidth: .infinity)
        .background(color)
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message)
    }
}
