import Foundation
import LocalAuthentication
import Combine
import SwiftUI

/// Gates the app behind Face ID / Touch ID / passcode on cold launch and after
/// an idle timeout in the background. Layered on top of the existing Supabase
/// auth so that even a valid session stays locked until the user proves
/// physical presence.
///
/// Uses `.deviceOwnerAuthentication` (not `.biometryAny`) so the OS falls back
/// to passcode when biometrics aren't enrolled — otherwise a user with no
/// Face ID setup would be locked out entirely.
@MainActor
final class BiometricLockManager: ObservableObject {

    /// Published state: true when the app is currently locked and the user
    /// must authenticate before any content can be shown.
    ///
    /// Initialized from the keychain: if a saved access token exists, we're
    /// resuming an existing session and the lock engages immediately to avoid
    /// a brief flash of the signed-in UI before biometrics prompt. Fresh
    /// launches with no saved session start unlocked and go through the
    /// normal password-based LoginView.
    @Published private(set) var isLocked: Bool

    /// How long the app can be in the background before we re-lock. Matches
    /// the 10-minute figure used by most enterprise MDM policies.
    private let idleTimeout: TimeInterval = 10 * 60

    private var backgroundedAt: Date?

    init(keychain: KeychainManager = .shared) {
        // If there's a stored access token we're resuming a session, so start
        // locked. Otherwise this is a fresh launch that will route to Login.
        self.isLocked = keychain.getAccessToken() != nil
    }

    /// Resets the lock state on successful user authentication.
    func unlock() {
        isLocked = false
        backgroundedAt = nil
    }

    /// Re-apply the lock (manual sign-out, session expiry, etc.).
    func relock() {
        isLocked = true
    }

    /// Engage the lock explicitly — e.g. when a saved session is restored at
    /// cold launch, we want the user to pass biometric before we show their
    /// data even though no password prompt was required.
    func requireUnlock() {
        isLocked = true
    }

    /// Called from `ScenePhase` hook in `PrintyxApp`.
    func scenePhaseChanged(_ phase: ScenePhase) {
        switch phase {
        case .background, .inactive:
            if backgroundedAt == nil {
                backgroundedAt = Date()
            }
        case .active:
            if let backgroundedAt, Date().timeIntervalSince(backgroundedAt) >= idleTimeout {
                isLocked = true
            }
            self.backgroundedAt = nil
        @unknown default:
            break
        }
    }

    /// Kicks off the biometric prompt. If biometrics aren't available the OS
    /// falls back to the device passcode. If the user cancels, the lock stays
    /// engaged — they can retry with the button on the lock screen.
    func authenticate(reason: String = "Unlock Printyx") async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"

        var evalError: NSError?
        let policy: LAPolicy = .deviceOwnerAuthentication
        guard context.canEvaluatePolicy(policy, error: &evalError) else {
            // No biometrics and no passcode set. Leave the lock on — a device
            // with no passcode has bigger problems, but we don't want to blow
            // it open either.
            return false
        }

        return await withCheckedContinuation { continuation in
            context.evaluatePolicy(policy, localizedReason: reason) { success, _ in
                Task { @MainActor in
                    if success {
                        self.unlock()
                    }
                    continuation.resume(returning: success)
                }
            }
        }
    }
}
