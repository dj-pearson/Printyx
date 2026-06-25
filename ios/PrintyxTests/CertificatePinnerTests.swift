import XCTest
@testable import Printyx

/// Guards the SPKI certificate pinner (IOS-069). The Release-only test fails
/// CI if any tracked backend host still has an empty pin set, which would ship
/// an app that fails-closed on every TLS handshake to that host.
final class CertificatePinnerTests: XCTestCase {

    func testTracksTheThreeBackendHosts() {
        let pinner = CertificatePinner()
        let tracked = Set(pinner.trackedHosts)
        XCTAssertTrue(tracked.contains("printyx.net"))
        XCTAssertTrue(tracked.contains("api.printyx.net"))
        XCTAssertTrue(tracked.contains("functions.printyx.net"))
    }

    /// In Release, an empty pin set fails the handshake (fail-closed), so every
    /// tracked host must have real pins before shipping. DEBUG bypasses pinning
    /// entirely, so this is skipped there (keeps the Debug PR check green until
    /// IOS-014 populates the pins; the Release CI job enforces it).
    func testReleaseHasNoEmptyPinSets() throws {
        #if DEBUG
        throw XCTSkip("Pinning is bypassed in DEBUG; empty pins are enforced in Release builds.")
        #else
        let pinner = CertificatePinner()
        XCTAssertTrue(
            pinner.hostsWithEmptyPins.isEmpty,
            "Release build has empty SPKI pin sets for \(pinner.hostsWithEmptyPins). Populate them (IOS-014) before shipping."
        )
        #endif
    }
}
