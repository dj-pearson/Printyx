import Foundation
import CoreLocation

/// A one-shot CoreLocation helper for the quick-log flow.
///
/// The activity logger doesn't need continuous tracking — it just wants a single
/// "good-enough" fix at the moment the rep taps Log. We ask for when-in-use
/// authorization, request a single location, and time out after 3 seconds so
/// the POST is never blocked waiting for GPS to warm up.
@MainActor
final class QuickLogLocationProvider: NSObject, ObservableObject {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation?, Never>?
    private let timeoutSeconds: TimeInterval = 3.0

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    /// Request a single location fix. Returns `nil` when the user has denied
    /// permission, the device is in airplane mode, or the fix doesn't arrive
    /// in time. Never throws — the activity log must still succeed without GPS.
    func fetchOnce() async -> CLLocation? {
        let status = manager.authorizationStatus
        switch status {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
            // Fall through to request — the system will deliver the update
            // after the user chooses in the prompt.
        case .denied, .restricted:
            return nil
        default:
            break
        }

        return await withCheckedContinuation { (cont: CheckedContinuation<CLLocation?, Never>) in
            self.continuation = cont
            self.manager.requestLocation()

            // Safety net — if CoreLocation never fires, unblock after `timeoutSeconds`.
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(timeoutSeconds * 1_000_000_000))
                self.resumeOnce(with: nil)
            }
        }
    }

    private func resumeOnce(with location: CLLocation?) {
        guard let cont = continuation else { return }
        continuation = nil
        cont.resume(returning: location)
    }
}

extension QuickLogLocationProvider: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let latest = locations.last
        Task { @MainActor in
            self.resumeOnce(with: latest)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            self.resumeOnce(with: nil)
        }
    }
}
