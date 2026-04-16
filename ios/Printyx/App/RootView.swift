import SwiftUI

/// Root view that switches between login and main content based on auth state.
struct RootView: View {
    @EnvironmentObject var apiClient: APIClient
    @EnvironmentObject var lockManager: BiometricLockManager
    @StateObject private var authManager: AuthManager

    init(apiClient: APIClient) {
        _authManager = StateObject(wrappedValue: AuthManager(apiClient: apiClient))
    }

    var body: some View {
        Group {
            if authManager.isLoading {
                LaunchScreenView()
            } else if authManager.isAuthenticated {
                // Biometric lock layered on top of the main UI. We only lock
                // when a session was RESTORED (cold launch with a saved token)
                // or after the idle timeout — fresh password logins do not
                // trigger a redundant biometric challenge.
                if lockManager.isLocked {
                    BiometricLockView(lockManager: lockManager)
                } else {
                    MainTabView(
                        apiClient: apiClient,
                        authManager: authManager
                    )
                }
            } else {
                LoginView(authManager: authManager)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
        .animation(.easeInOut(duration: 0.3), value: authManager.isLoading)
        .animation(.easeInOut(duration: 0.2), value: lockManager.isLocked)
        .onChange(of: authManager.isAuthenticated) { wasAuth, isAuth in
            if !isAuth {
                // Sign-out: clear the lock state so the next sign-in starts clean.
                lockManager.unlock()
            } else if !wasAuth {
                // false → true transitions that happen while the user is on
                // LoginView are explicit logins; those should NOT re-lock.
                // The session-restore path above handles the cold-launch case.
                lockManager.unlock()
            }
        }
    }
}

/// Launch screen shown while checking auth state.
struct LaunchScreenView: View {
    var body: some View {
        VStack(spacing: AppTheme.Spacing.lg) {
            Image(systemName: "printer.fill")
                .font(.system(size: 56))
                .foregroundStyle(Color.printyxPrimary)

            Text("Printyx")
                .font(.printyxTitle)
                .foregroundStyle(Color.printyxPrimary)

            ProgressView()
                .padding(.top, AppTheme.Spacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}
