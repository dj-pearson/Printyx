import SwiftUI

/// Floating "+ Log" button pinned to the bottom-right of the main tab view.
/// Tapping it presents `QuickLogSheet`.
struct QuickLogFAB: View {
    @ObservedObject var viewModel: QuickLogViewModel
    @Binding var isPresented: Bool

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            isPresented = true
        } label: {
            HStack(spacing: AppTheme.Spacing.xs) {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .bold))
                Text("Log")
                    .font(.printyxSubheadline)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, AppTheme.Spacing.lg)
            .padding(.vertical, AppTheme.Spacing.md)
            .background(Color.printyxPrimary)
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.18), radius: 8, x: 0, y: 4)
        }
        .accessibilityLabel("Log activity")
        .accessibilityHint("Opens a quick activity log for the last viewed record.")
    }
}
