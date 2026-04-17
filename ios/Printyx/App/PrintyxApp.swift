import SwiftUI

@main
struct PrintyxApp: App {
    @UIApplicationDelegateAdaptor(PrintyxAppDelegate.self) private var appDelegate

    @StateObject private var apiClient: APIClient
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @StateObject private var writeQueue = OfflineWriteQueue.shared
    @StateObject private var lockManager = BiometricLockManager()
    @StateObject private var router = AppRouter()
    @StateObject private var pushManager: PushNotificationManager
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Construct APIClient first so other singletons can reference it.
        let client = APIClient()
        _apiClient = StateObject(wrappedValue: client)
        let push = PushNotificationManager(apiClient: client)
        _pushManager = StateObject(wrappedValue: push)
        // Bridge to the UIApplicationDelegate so APNs callbacks can find
        // the (SwiftUI-owned) push manager.
        PrintyxAppDelegate.pushManager = push
    }

    var body: some Scene {
        WindowGroup {
            RootView(apiClient: apiClient)
                .environmentObject(apiClient)
                .environmentObject(networkMonitor)
                .environmentObject(writeQueue)
                .environmentObject(lockManager)
                .environmentObject(router)
                .environmentObject(pushManager)
                .task {
                    // Late-bind router so notification taps can push routes.
                    pushManager.attach(router: router)
                    // Ask for permission on first launch (or re-register if
                    // already granted).
                    pushManager.requestAuthorizationIfNeeded()
                }
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
