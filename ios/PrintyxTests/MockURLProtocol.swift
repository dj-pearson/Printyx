import Foundation

/// URLProtocol that lets tests hand-roll HTTP responses for any request.
/// Register via a `URLSessionConfiguration` whose `protocolClasses` puts
/// `MockURLProtocol` at index 0, then set `MockURLProtocol.handler` to the
/// closure that produces the desired response.
final class MockURLProtocol: URLProtocol {
    /// Closure type — return a tuple of (HTTPURLResponse, body data, optional
    /// error). Returning an error short-circuits delivery and surfaces via
    /// URLSession's `networkError`.
    typealias Handler = (URLRequest) throws -> (HTTPURLResponse, Data)

    /// Thread-safe handler storage. Accessed from URLSession's delegate queue.
    nonisolated(unsafe) static var handler: Handler?

    /// Record of every request that hit the protocol — useful for
    /// asserting headers, body shape, retry counts, etc.
    nonisolated(unsafe) static var recordedRequests: [URLRequest] = []

    static func reset() {
        handler = nil
        recordedRequests = []
    }

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        Self.recordedRequests.append(request)

        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

/// Builds an `APIClient` wired to MockURLProtocol. Every test that hits the
/// network should use this to avoid accidentally touching the real backend.
@MainActor
enum MockAPIClientFactory {
    static func make(keychain: KeychainManager = .shared) -> APIClient {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.protocolClasses = [MockURLProtocol.self]
        cfg.timeoutIntervalForRequest = 5
        cfg.timeoutIntervalForResource = 5
        return APIClient(
            configuration: .production,
            keychain: keychain,
            sessionConfiguration: cfg
        )
    }
}
