import Foundation
import Combine

/// Central API client for all Printyx backend communication.
/// Handles authentication headers, tenant context, token refresh, and request/response lifecycle.
@MainActor
final class APIClient: ObservableObject {

    // MARK: - Configuration

    struct Configuration {
        let baseURL: URL              // Express backend (printyx.net)
        let edgeFunctionsURL: URL     // Supabase Edge Functions (functions.printyx.net)
        let supabaseURL: URL          // Supabase Auth via Kong (api.printyx.net)
        let supabaseAnonKey: String

        static let production = Configuration(
            baseURL: URL(string: "https://printyx.net")!,
            edgeFunctionsURL: URL(string: "https://functions.printyx.net")!,
            supabaseURL: URL(string: "https://api.printyx.net")!,
            supabaseAnonKey: AppConfig.supabaseAnonKey
        )

        static let development = Configuration(
            baseURL: URL(string: "http://localhost:5000")!,
            edgeFunctionsURL: URL(string: "http://localhost:8000")!,
            supabaseURL: URL(string: "https://api.printyx.net")!,
            supabaseAnonKey: AppConfig.supabaseAnonKey
        )
    }

    // MARK: - Properties

    private let configuration: Configuration
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let keychain: KeychainManager
    private let pinner: CertificatePinner
    private var isRefreshingToken = false
    private var pendingRequests: [CheckedContinuation<Data, Error>] = []

    @Published var isAuthenticated = false

    // MARK: - Init

    init(
        configuration: Configuration = .production,
        keychain: KeychainManager = .shared,
        sessionConfiguration: URLSessionConfiguration? = nil
    ) {
        self.configuration = configuration
        self.keychain = keychain

        let sessionConfig = sessionConfiguration ?? {
            let cfg = URLSessionConfiguration.default
            cfg.timeoutIntervalForRequest = 30
            cfg.timeoutIntervalForResource = 60
            cfg.waitsForConnectivity = true
            // URLSession-level cache for GET responses. This is separate from
            // PersistentResponseCache — URLCache respects Cache-Control
            // headers and sits closer to the transport, while
            // PersistentResponseCache is our offline-aware fallback. Sized
            // modestly to keep the app bundle footprint small.
            cfg.urlCache = URLCache(
                memoryCapacity: 10 * 1024 * 1024,
                diskCapacity: 50 * 1024 * 1024
            )
            cfg.requestCachePolicy = .useProtocolCachePolicy
            return cfg
        }()
        let pinner = CertificatePinner()
        self.pinner = pinner
        self.session = URLSession(
            configuration: sessionConfig,
            delegate: pinner,
            delegateQueue: nil
        )

        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // 1. ISO8601 with fractional seconds — handles PostgreSQL timestamps:
            //    "2024-01-15T10:30:00.123456+00:00", "2024-01-15T10:30:00.123Z", etc.
            let isoFractional = ISO8601DateFormatter()
            isoFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = isoFractional.date(from: dateString) {
                return date
            }

            // 2. ISO8601 without fractional seconds:
            //    "2024-01-15T10:30:00+00:00", "2024-01-15T10:30:00Z"
            let isoBasic = ISO8601DateFormatter()
            isoBasic.formatOptions = [.withInternetDateTime]
            if let date = isoBasic.date(from: dateString) {
                return date
            }

            // 3. DateFormatter fallbacks for edge cases
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)

            // DateFormatter fallbacks covering all PostgreSQL output formats:
            // - With colon timezone (xxx = +00:00): timestamptz columns
            // - With RFC822 timezone (Z = +0000): some serializations
            // - Without timezone: timestamp (no tz) columns
            for fmt in [
                "yyyy-MM-dd'T'HH:mm:ss.SSSSSSxxx",
                "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
                "yyyy-MM-dd'T'HH:mm:ssxxx",
                "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZ",
                "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
                "yyyy-MM-dd'T'HH:mm:ssZ",
                "yyyy-MM-dd'T'HH:mm:ss.SSSSSS",
                "yyyy-MM-dd'T'HH:mm:ss.SSS",
                "yyyy-MM-dd'T'HH:mm:ss",
                "yyyy-MM-dd",
            ] {
                formatter.dateFormat = fmt
                if let date = formatter.date(from: dateString) {
                    return date
                }
            }

            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(dateString)")
        }
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase

        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        self.encoder.keyEncodingStrategy = .convertToSnakeCase

        self.isAuthenticated = keychain.getAccessToken() != nil

        // Hand the write-queue a replay closure so it can re-submit queued
        // mutations once connectivity returns without depending on this class.
        OfflineWriteQueue.shared.configure { [weak self] write in
            guard let self else { return }
            try await self.replayQueuedWrite(write)
        }
    }

    // MARK: - Public API

    /// Execute a typed API request and decode the response.
    func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        let data = try await executeRequest(endpoint)
        do {
            return try decoder.decode(T.self, from: data)
        } catch let decodingError as DecodingError {
            // Log detailed decode error for debugging
            let detail: String
            switch decodingError {
            case .typeMismatch(let type, let context):
                detail = "Type mismatch: expected \(type) at \(context.codingPath.map(\.stringValue).joined(separator: ".")) — \(context.debugDescription)"
            case .valueNotFound(let type, let context):
                detail = "Value not found: \(type) at \(context.codingPath.map(\.stringValue).joined(separator: ".")) — \(context.debugDescription)"
            case .keyNotFound(let key, let context):
                detail = "Key not found: '\(key.stringValue)' at \(context.codingPath.map(\.stringValue).joined(separator: ".")) — \(context.debugDescription)"
            case .dataCorrupted(let context):
                detail = "Data corrupted at \(context.codingPath.map(\.stringValue).joined(separator: ".")) — \(context.debugDescription)"
            @unknown default:
                detail = decodingError.localizedDescription
            }
            #if DEBUG
            print("[APIClient] Decode error for \(T.self) on \(endpoint.path): \(detail)")
            if let rawJSON = String(data: data.prefix(500), encoding: .utf8) {
                print("[APIClient] Response preview: \(rawJSON)")
            }
            #else
            _ = detail // avoid unused-variable warning in release
            #endif
            throw APIError.decodingError(decodingError)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Execute a request where the server wraps the array in `{ "data": [...] }`.
    /// Tries wrapped format first, falls back to raw array.
    func requestArray<T: Decodable>(_ endpoint: APIEndpoint) async throws -> [T] {
        let data = try await executeRequest(endpoint)
        // Try wrapped { data: [...] } format first
        if let wrapped = try? decoder.decode(WrappedArrayResponse<T>.self, from: data) {
            return wrapped.data
        }
        // Fall back to raw array
        return try decoder.decode([T].self, from: data)
    }

    /// Execute an API request that returns no meaningful body (e.g., DELETE).
    @discardableResult
    func requestVoid(_ endpoint: APIEndpoint) async throws -> Data {
        try await executeRequest(endpoint)
    }

    /// Execute an API request and return raw Data (e.g., PDF downloads).
    func requestData(_ endpoint: APIEndpoint) async throws -> Data {
        try await executeRequest(endpoint)
    }

    // MARK: - Request Execution

    /// Response cache is only consulted for safe GET requests. Writes don't
    /// go through the cache; they go through the write queue when offline.
    private var cache: PersistentResponseCache { .shared }

    private func executeRequest(_ endpoint: APIEndpoint) async throws -> Data {
        let urlRequest = try buildRequest(for: endpoint)

        // Offline-first read: if we're known to be offline and this is a safe
        // GET, serve stale cache rather than failing.
        if endpoint.method == .get, !NetworkMonitor.shared.isConnected {
            if let cached = cache.load(
                tenantId: keychain.getTenantId(),
                path: endpoint.path,
                query: queryString(for: endpoint)
            ) {
                return cached
            }
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await performRequest(urlRequest)
        } catch let apiError as APIError {
            if case .networkError = apiError {
                // GETs transparently fall back to cache.
                if endpoint.method == .get {
                    if let cached = cache.load(
                        tenantId: keychain.getTenantId(),
                        path: endpoint.path,
                        query: queryString(for: endpoint)
                    ) {
                        return cached
                    }
                }
                // Mutations opt into the offline queue — auth endpoints are
                // excluded because replaying them has no value.
                if endpoint.queueableWhenOffline {
                    enqueueForOffline(endpoint)
                    throw APIError.offlineQueued
                }
            }
            throw apiError
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            if endpoint.method == .get {
                cache.save(
                    data: data,
                    tenantId: keychain.getTenantId(),
                    path: endpoint.path,
                    query: queryString(for: endpoint)
                )
            }
            return data

        case 400:
            // Bad request — extract error message (e.g., invalid login credentials)
            let errorMessage: String?
            if let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data) {
                errorMessage = errorResponse.displayMessage
            } else {
                errorMessage = nil
            }
            throw APIError.validationError(
                message: errorMessage ?? "Invalid request",
                details: nil
            )

        case 401:
            // Attempt token refresh, then retry
            if endpoint.requiresAuth {
                try await refreshAccessToken()
                let retryRequest = try buildRequest(for: endpoint)
                let (retryData, retryResponse) = try await performRequest(retryRequest)
                guard let retryHTTP = retryResponse as? HTTPURLResponse,
                      (200...299).contains(retryHTTP.statusCode) else {
                    self.isAuthenticated = false
                    throw APIError.unauthorized
                }
                return retryData
            }
            throw APIError.unauthorized

        case 403:
            throw APIError.forbidden

        case 404:
            throw APIError.notFound

        case 422:
            let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data)
            throw APIError.validationError(
                message: errorResponse?.displayMessage ?? "Validation failed",
                details: errorResponse?.details
            )

        case 429:
            let retryAfter = httpResponse.value(forHTTPHeaderField: "Retry-After")
                .flatMap { TimeInterval($0) }
            throw APIError.rateLimited(retryAfter: retryAfter)

        case 500...599:
            // Try structured JSON error first, then fall back to raw response text
            let errorMessage: String?
            if let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data) {
                errorMessage = errorResponse.displayMessage
            } else if let rawText = String(data: data, encoding: .utf8), !rawText.isEmpty,
                      !rawText.hasPrefix("<!") && !rawText.hasPrefix("<html") {
                // Show raw text if it's not HTML (e.g., plain text error from proxy)
                errorMessage = rawText.prefix(200).description
            } else {
                errorMessage = nil
            }
            throw APIError.serverError(
                statusCode: httpResponse.statusCode,
                message: errorMessage
            )

        default:
            throw APIError.unknown(statusCode: httpResponse.statusCode)
        }
    }

    private func performRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }
    }

    /// Deterministic query string used as part of the cache key. We sort keys
    /// so a tab-switch that reorders query items doesn't cause a cache miss.
    private func queryString(for endpoint: APIEndpoint) -> String? {
        guard let items = endpoint.queryItems, !items.isEmpty else { return nil }
        return items
            .sorted(by: { $0.name < $1.name })
            .map { "\($0.name)=\($0.value ?? "")" }
            .joined(separator: "&")
    }

    // MARK: - Offline write queue support

    private func enqueueForOffline(_ endpoint: APIEndpoint) {
        let bodyData: Data?
        if let body = endpoint.body {
            bodyData = try? encoder.encode(AnyEncodable(body))
        } else {
            bodyData = nil
        }
        let write = QueuedWrite(
            id: UUID(),
            method: endpoint.method.rawValue,
            path: endpoint.path,
            bodyJSON: bodyData,
            tenantId: keychain.getTenantId(),
            createdAt: Date(),
            attempts: 0,
            lastError: nil
        )
        OfflineWriteQueue.shared.enqueue(write)
    }

    /// Replays a previously-queued write. Builds a fresh URLRequest from the
    /// stored path + body so auth headers and tenant context pick up any
    /// changes since enqueue time. Attaches the raw JSON bytes verbatim to
    /// sidestep encoder re-serialisation.
    fileprivate func replayQueuedWrite(_ write: QueuedWrite) async throws {
        let method = HTTPMethod(rawValue: write.method) ?? .post
        let endpoint = APIEndpoint(
            path: write.path,
            method: method,
            queryItems: nil,
            body: nil,
            requiresAuth: true
        )
        var urlRequest = try buildRequest(for: endpoint)
        urlRequest.httpBody = write.bodyJSON

        let (_, response) = try await performRequest(urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        // 409 (conflict) is treated as success — the resource likely already
        // exists because the user re-submitted online. Anything else bubbles
        // up so the queue can retry.
        guard (200...299).contains(http.statusCode) || http.statusCode == 409 else {
            throw APIError.serverError(statusCode: http.statusCode, message: nil)
        }
    }

    // MARK: - Request Building

    private func buildRequest(for endpoint: APIEndpoint) throws -> URLRequest {
        // Route requests to the correct backend:
        // 1. Auth endpoints (/auth/*) → api.printyx.net (Kong → GoTrue)
        // 2. API endpoints (/api/*) → functions.printyx.net (Edge Functions, strip /api/ prefix)
        //    This includes /api/mobile-auth/* for login/refresh (bypasses Kong)
        // 3. Everything else → printyx.net (Express backend)
        let isAuthEndpoint = endpoint.path.hasPrefix("/auth/")
        let isApiEndpoint = endpoint.path.hasPrefix("/api/")

        let baseURL: URL
        let path: String

        if isAuthEndpoint {
            baseURL = configuration.supabaseURL
            path = endpoint.path
        } else if isApiEndpoint {
            // Route to Edge Functions, stripping /api/ prefix (matches web app behavior)
            // e.g., /api/tasks → /tasks, /api/customers/123 → /customers/123
            baseURL = configuration.edgeFunctionsURL
            path = String(endpoint.path.dropFirst(4)) // "/api/tasks" → "/tasks"
        } else {
            baseURL = configuration.baseURL
            path = endpoint.path
        }

        guard var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: true) else {
            throw APIError.invalidURL
        }

        if let queryItems = endpoint.queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("printyx-ios", forHTTPHeaderField: "X-Client")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

        // Auth header
        if endpoint.requiresAuth, let token = keychain.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // For Supabase auth endpoints, add apikey header
        if isAuthEndpoint {
            request.setValue(configuration.supabaseAnonKey, forHTTPHeaderField: "apikey")
            if !endpoint.requiresAuth {
                request.setValue("Bearer \(configuration.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
            }
        }

        // For Edge Function calls, add apikey header (Supabase convention)
        if isApiEndpoint {
            request.setValue(configuration.supabaseAnonKey, forHTTPHeaderField: "apikey")
        }

        // Tenant context
        if let tenantId = keychain.getTenantId() {
            request.setValue(tenantId, forHTTPHeaderField: "x-tenant-id")
        }

        // Body
        if let body = endpoint.body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        return request
    }

    // MARK: - Token Refresh

    private func refreshAccessToken() async throws {
        guard !isRefreshingToken else {
            // Wait for the in-progress refresh
            _ = try await withCheckedThrowingContinuation { continuation in
                pendingRequests.append(continuation)
            }
            return
        }

        isRefreshingToken = true
        defer {
            isRefreshingToken = false
            pendingRequests.forEach { $0.resume(returning: Data()) }
            pendingRequests.removeAll()
        }

        guard let refreshToken = keychain.getRefreshToken() else {
            throw APIError.tokenRefreshFailed
        }

        struct RefreshBody: Encodable {
            let refreshToken: String
        }

        let endpoint = APIEndpoint.refreshToken(body: RefreshBody(refreshToken: refreshToken))
        let request = try buildRequest(for: endpoint)
        let (data, response) = try await performRequest(request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            keychain.clearAll()
            isAuthenticated = false
            throw APIError.tokenRefreshFailed
        }

        struct TokenResponse: Decodable {
            let accessToken: String
            let refreshToken: String
            let expiresIn: Int
            let user: SupabaseUser?
        }

        let tokenResponse = try decoder.decode(TokenResponse.self, from: data)
        keychain.setAccessToken(tokenResponse.accessToken)
        keychain.setRefreshToken(tokenResponse.refreshToken)
    }
}

// MARK: - Type-erased Encodable wrapper

struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        _encode = { encoder in
            try wrapped.encode(to: encoder)
        }
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}

// MARK: - Wrapped Array Response

/// Many edge functions return `{ "data": [...], "total": N }` instead of a raw array.
struct WrappedArrayResponse<T: Decodable>: Decodable {
    let data: [T]
    let total: Int?
    let page: Int?
    let limit: Int?
    let unread: Int?
    let hasMore: Bool?
}
