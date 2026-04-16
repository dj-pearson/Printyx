import SwiftUI

/// Full-screen lock that blocks access to app content until the user passes
/// a biometric (or passcode fallback) challenge.
struct BiometricLockView: View {
    @ObservedObject var lockManager: BiometricLockManager
    @State private var didAttempt = false

    var body: some View {
        VStack(spacing: AppTheme.Spacing.xl) {
            Spacer()

            Image(systemName: "lock.shield.fill")
                .font(.system(size: 64))
                .foregroundStyle(Color.printyxPrimary)

            Text("Printyx Locked")
                .font(.printyxTitle)

            Text("Authenticate to view your customer data.")
                .font(.printyxBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, AppTheme.Spacing.xl)

            Spacer()

            Button {
                Task { await lockManager.authenticate() }
            } label: {
                Label("Unlock", systemImage: "faceid")
                    .font(.printyxSubheadline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppTheme.Spacing.md)
                    .background(Color.printyxPrimary)
                    .cornerRadius(AppTheme.Radius.md)
            }
            .padding(.horizontal, AppTheme.Spacing.xl)
            .padding(.bottom, AppTheme.Spacing.xxl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
        .task {
            // Prompt automatically on first appearance so the user doesn't
            // have to tap a button just to get into their app.
            guard !didAttempt else { return }
            didAttempt = true
            _ = await lockManager.authenticate()
        }
    }
}
