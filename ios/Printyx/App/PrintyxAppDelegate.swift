import UIKit
import Foundation

/// UIApplicationDelegate adapter. SwiftUI's App protocol doesn't expose the
/// APNs-specific lifecycle hooks, so we plug in via `UIApplicationDelegateAdaptor`
/// from `PrintyxApp`. The delegate itself holds no state — it just forwards
/// APNs callbacks to `PushNotificationManager` via a shared singleton bridge
/// so SwiftUI's `@StateObject` can still own the manager.
final class PrintyxAppDelegate: NSObject, UIApplicationDelegate {

    /// Set by PrintyxApp during scene setup so this delegate can forward
    /// APNs callbacks without needing to own the manager itself.
    static var pushManager: PushNotificationManager?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            Self.pushManager?.handle(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            Self.pushManager?.handleRegistrationFailed(error: error)
        }
    }
}
