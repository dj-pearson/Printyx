import SwiftUI

@main
struct PrintyxApp: App {
    @StateObject private var apiClient = APIClient()
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @StateObject private var writeQueue = OfflineWriteQueue.shared
    @StateObject private var lockManager = BiometricLockManager()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView(apiClient: apiClient)
                .environmentObject(apiClient)
                .environmentObject(networkMonitor)
                .environmentObject(writeQueue)
                .environmentObject(lockManager)
                .onChange(of: scenePhase) { _, newPhase in
                    lockManager.scenePhaseChanged(newPhase)
                    // Opportunistic flush when the app comes back to foreground.
                    if newPhase == .active {
                        Task { await writeQueue.flush() }
                    }
                }
        }
    }
}
