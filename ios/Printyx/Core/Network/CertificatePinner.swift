import Foundation
import CryptoKit

/// SPKI (Subject Public Key Info) certificate pinner for Printyx backend hosts.
///
/// Pinning compares the SHA-256 of the server's public-key DER encoding against
/// a hardcoded allow-list. SPKI pins survive cert rotation as long as the same
/// key-pair is reused, which is the common operational pattern.
///
/// ## How to populate the pin list
/// 1. Fetch the leaf cert from each host:
///    `openssl s_client -connect printyx.net:443 -servername printyx.net | openssl x509 -pubkey -noout > pub.pem`
/// 2. Hash the SPKI:
///    `openssl pkey -pubin -in pub.pem -outform der | openssl dgst -sha256 -binary | base64`
/// 3. Paste the base64 digest into `pinsByHost` below.
/// 4. Pin at least TWO keys per host (current + backup) so rotation doesn't
///    brick the app when the primary cert is replaced.
///
/// ## Fail-open DEBUG, fail-closed Release
/// DEBUG builds skip pinning entirely so hitting `localhost` during dev works.
/// Release builds fail the TLS handshake if the pin set is empty OR if the
/// server's SPKI isn't in the set. This is safe because TLS still runs first —
/// the pinner just adds an additional check after the default chain validation.
final class CertificatePinner: NSObject, URLSessionDelegate {

    /// Hosts that MUST be pinned in Release. Any other host is passed through
    /// to default trust evaluation (for Apple services, system calls, etc.).
    private let pinsByHost: [String: Set<String>] = [
        // TODO: populate with real SPKI-SHA256 base64 digests before shipping.
        // Example shape:
        // "printyx.net": [
        //     "base64-sha256-of-current-spki=",
        //     "base64-sha256-of-backup-spki=",
        // ],
        "printyx.net": [],
        "api.printyx.net": [],
        "functions.printyx.net": [],
    ]

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        let host = challenge.protectionSpace.host

        // Only pin hosts we explicitly track.
        guard let expectedPins = pinsByHost[host] else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        // DEBUG: skip pinning so localhost + dev testing works.
        #if DEBUG
        completionHandler(.performDefaultHandling, nil)
        return
        #else
        // Release: empty pin set = fail closed. Forces operators to populate
        // the pin list before shipping.
        guard !expectedPins.isEmpty else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // Run default chain validation first.
        var error: CFError?
        guard SecTrustEvaluateWithError(serverTrust, &error) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // Compare SPKI digests of every cert in the chain against the pin set.
        // Any match is enough — this handles servers that present intermediate
        // or leaf pins equivalently.
        guard let chain = SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate] else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        for cert in chain {
            guard let spkiDigest = Self.spkiSHA256Base64(for: cert) else { continue }
            if expectedPins.contains(spkiDigest) {
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
                return
            }
        }

        completionHandler(.cancelAuthenticationChallenge, nil)
        #endif
    }

    // MARK: - SPKI hashing

    static func spkiSHA256Base64(for cert: SecCertificate) -> String? {
        guard let key = SecCertificateCopyKey(cert),
              let der = SecKeyCopyExternalRepresentation(key, nil) as Data? else {
            return nil
        }
        let digest = SHA256.hash(data: der)
        return Data(digest).base64EncodedString()
    }
}
