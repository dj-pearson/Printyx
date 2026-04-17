import Foundation
import UserNotifications
import UIKit
import Combine

/// Coordinates Apple Push Notification Service (APNs) registration, foreground
/// presentation, and tap-to-route handling. One instance lives as an
/// `@StateObject` in `PrintyxApp` and is also set as the
/// `UNUserNotificationCenter.delegate`.
///
/// Flow:
///   1. App launch: `requestAuthorizationIfNeeded()` asks the user to opt in.
///   2. On allow: iOS calls back with a device token via
///      `AppDelegate.application(didRegisterForRemoteNotificationsWithDeviceToken:)`
///      which forwards here via `handle(deviceToken:)`.
///   3. We POST the token to `/api/mobile/device-tokens` so the backend can
///      target this device.
///   4. Incoming notifications fire `userNotificationCenter(:willPresent:)` for
///      foreground banners and `userNotificationCenter(:didReceive:)` for taps.
///   5. Taps route via `AppRouter.push(_:)` using an `AppRoute` encoded in the
///      notification's `userInfo` (`route_type` + `route_id`).
@MainActor
final class PushNotificationManager: NSObject, ObservableObject {

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published private(set) var deviceToken: String?

    private let apiClient: APIClient
    private weak var router: AppRouter?

    init(apiClient: APIClient) {
        self.apiClient = apiClient
        super.init()
        UNUserNotificationCenter.current().delegate = self
        refreshAuthorizationStatus()
    }

    /// Wire the router late — it isn't available at init time because
    /// `PushNotificationManager` is constructed before SwiftUI's
    /// environment objects are resolved.
    func attach(router: AppRouter) {
        self.router = router
    }

    // MARK: - Authorization

    func requestAuthorizationIfNeeded() {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { [weak self] settings in
            guard let self else { return }
            Task { @MainActor in
                self.authorizationStatus = settings.authorizationStatus
                switch settings.authorizationStatus {
                case .notDetermined:
                    let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
                    self.authorizationStatus = granted ? .authorized : .denied
                    if granted {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                case .authorized, .provisional, .ephemeral:
                    // Already opted in — just make sure APNs registration is live.
                    UIApplication.shared.registerForRemoteNotifications()
                case .denied:
                    break
                @unknown default:
                    break
                }
            }
        }
    }

    private func refreshAuthorizationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            Task { @MainActor in
                self?.authorizationStatus = settings.authorizationStatus
            }
        }
    }

    // MARK: - Token handling

    /// Called from the `UIApplicationDelegateAdaptor` when APNs hands us a
    /// device token. Persists the hex string and POSTs it to the backend.
    func handle(deviceToken tokenData: Data) {
        let hex = tokenData.map { String(format: "%02x", $0) }.joined()
        deviceToken = hex
        Task { await registerTokenWithBackend(hex) }
    }

    func handleRegistrationFailed(error: Error) {
        // No publisher yet — silently swallow in debug so launch doesn't
        // look broken on simulators that can't register for APNs.
        #if DEBUG
        print("[Push] APNs registration failed: \(error.localizedDescription)")
        #endif
    }

    private func registerTokenWithBackend(_ token: String) async {
        struct Body: Encodable {
            let token: String
            let platform: String
            let bundleId: String
            let environment: String
        }
        let body = Body(
            token: token,
            platform: "ios",
            bundleId: Bundle.main.bundleIdentifier ?? "net.printyx.mainapp",
            environment: AppConfig.isDebug ? "development" : "production"
        )
        do {
            try await apiClient.requestVoid(.registerDeviceToken(body: body))
        } catch {
            // Non-fatal — we'll re-register on next launch. Don't surface
            // to the user, push is opt-in and secondary to core flows.
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension PushNotificationManager: UNUserNotificationCenterDelegate {

    /// Decide how to present a notification that arrives while the app is
    /// foregrounded. For all Printyx notifications we want the banner +
    /// sound so the rep doesn't miss an assigned lead or escalated ticket.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge, .list])
    }

    /// Handle a notification tap. We expect the payload to carry a typed
    /// route we can push via AppRouter.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        Task { @MainActor in
            self.routeNotification(userInfo: userInfo)
            completionHandler()
        }
    }

    /// Translate a push payload into an AppRoute and hand it to the router.
    /// Supports two payload shapes:
    ///   - `{ "route_type": "service_ticket", "route_id": "abc" }`
    ///   - `{ "type": "ticket_escalated", "entity_type": "ticket",
    ///        "entity_id": "abc" }`  — matches the backend notifications
    ///     table schema.
    func routeNotification(userInfo: [AnyHashable: Any]) {
        guard let router else { return }

        let rawType = (userInfo["route_type"] as? String)
            ?? (userInfo["entity_type"] as? String)
        let rawId = (userInfo["route_id"] as? String)
            ?? (userInfo["entity_id"] as? String)

        guard let rawType, let rawId, !rawId.isEmpty else { return }

        let route: AppRoute?
        switch rawType {
        case "lead", "customer", "prospect", "business_record":
            route = .businessRecord(id: rawId)
        case "contact":
            route = .contact(id: rawId)
        case "opportunity":
            route = .opportunity(id: rawId)
        case "quote":
            route = .quote(id: rawId)
        case "proposal":
            route = .proposal(id: rawId)
        case "ticket", "service_ticket":
            route = .serviceTicket(id: rawId)
        case "equipment":
            route = .equipment(id: rawId)
        case "contract":
            route = .contract(id: rawId)
        case "invoice":
            route = .invoice(id: rawId)
        case "task":
            route = .task(id: rawId)
        default:
            route = nil
        }

        if let route {
            router.push(route)
        }
    }
}
