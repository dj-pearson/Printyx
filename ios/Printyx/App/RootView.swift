import SwiftUI

/// Root view that switches between login and main content based on auth state.
struct RootView: View {
    @EnvironmentObject var apiClient: APIClient
    @StateObject private var authManager: AuthManager

    init() {
        // Initialize with a temporary APIClient; the real one comes from environment
        let client = APIClient()
        _authManager = StateObject(wrappedValue: AuthManager(apiClient: client))
    }

    var body: some View {
        Group {
            if authManager.isLoading {
                LaunchScreenView()
            } else if authManager.isAuthenticated {
                MainTabView(
                    apiClient: apiClient,
                    authManager: authManager
                )
            } else {
                LoginView(authManager: authManager)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
        .animation(.easeInOut(duration: 0.3), value: authManager.isLoading)
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
