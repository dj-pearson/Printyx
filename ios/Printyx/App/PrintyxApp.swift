import SwiftUI

@main
struct PrintyxApp: App {
    @StateObject private var apiClient = APIClient()
    @StateObject private var networkMonitor = NetworkMonitor.shared

    var body: some Scene {
        WindowGroup {
            RootView(apiClient: apiClient)
                .environmentObject(apiClient)
                .environmentObject(networkMonitor)
        }
    }
}
