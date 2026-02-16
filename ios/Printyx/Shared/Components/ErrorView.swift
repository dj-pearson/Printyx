import SwiftUI

/// Error state with retry capability.
struct ErrorView: View {
    let message: String
    var retryAction: (() async -> Void)?

    var body: some View {
        VStack(spacing: AppTheme.Spacing.lg) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(.orange)

            Text("Something went wrong")
                .font(.printyxHeadline)

            Text(message)
                .font(.printyxBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)

            if let retryAction {
                Button {
                    Task { await retryAction() }
                } label: {
                    Label("Try Again", systemImage: "arrow.clockwise")
                        .font(.printyxSubheadline)
                        .foregroundStyle(.white)
                        .padding(.horizontal, AppTheme.Spacing.xl)
                        .padding(.vertical, AppTheme.Spacing.md)
                        .background(Color.printyxPrimary)
                        .cornerRadius(AppTheme.Radius.md)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(AppTheme.Spacing.xl)
    }
}

/// Inline error banner for non-blocking errors.
struct ErrorBanner: View {
    let message: String
    var onDismiss: (() -> Void)?

    var body: some View {
        HStack(spacing: AppTheme.Spacing.sm) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.red)

            Text(message)
                .font(.printyxCaption)
                .foregroundStyle(.primary)
                .lineLimit(2)

            Spacer()

            if let onDismiss {
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(AppTheme.Spacing.md)
        .background(Color.red.opacity(0.1))
        .cornerRadius(AppTheme.Radius.sm)
    }
}
