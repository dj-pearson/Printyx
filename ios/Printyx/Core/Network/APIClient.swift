import Foundation
import Combine

/// Central API client for all Printyx backend communication.
/// Handles authentication headers, tenant context, token refresh, and request/response lifecycle.
@MainActor
final class APIClient: ObservableObject {

    // MARK: - Configuration

    struct Configuration {
        let baseURL: URL
        let supabaseURL: URL
        let supabaseAnonKey: String

        static let production = Configuration(
            baseURL: URL(string: "https://printyx.net")!,
            supabaseURL: URL(string: AppConfig.supabaseURL)!,
            supabaseAnonKey: AppConfig.supabaseAnonKey
        )

        static let development = Configuration(
            baseURL: URL(string: "http://localhost:5000")!,
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
    private var isRefreshingToken = false
    private var pendingRequests: [CheckedContinuation<Data, Error>] = []

    @Published var isAuthenticated = false

    // MARK: - Init

    init(configuration: Configuration = .production, keychain: KeychainManager = .shared) {
        self.configuration = configuration
        self.keychain = keychain

        let sessionConfig = URLSessionConfiguration.default
        sessionConfig.timeoutIntervalForRequest = 30
        sessionConfig.timeoutIntervalForResource = 60
        sessionConfig.waitsForConnectivity = true
        self.session = URLSession(configuration: sessionConfig)

        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            if let date = ISO8601DateFormatter().date(from: dateString) {
                return date
            }
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
            if let date = formatter.date(from: dateString) {
                return date
            }
            formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
            if let date = formatter.date(from: dateString) {
                return date
            }
            formatter.dateFormat = "yyyy-MM-dd"
            if let date = formatter.date(from: dateString) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(dateString)")
        }
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase

        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        self.encoder.keyEncodingStrategy = .convertToSnakeCase

        self.isAuthenticated = keychain.getAccessToken() != nil
    }

    // MARK: - Public API

    /// Execute a typed API request and decode the response.
    func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        let data = try await executeRequest(endpoint)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
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

    private func executeRequest(_ endpoint: APIEndpoint) async throws -> Data {
        let urlRequest = try buildRequest(for: endpoint)

        let (data, response) = try await performRequest(urlRequest)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return data

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

    // MARK: - Request Building

    private func buildRequest(for endpoint: APIEndpoint) throws -> URLRequest {
        // Determine base URL: auth endpoints go to Supabase, API endpoints go to Express backend
        let isAuthEndpoint = endpoint.path.hasPrefix("/auth/")
        let baseURL = isAuthEndpoint ? configuration.supabaseURL : configuration.baseURL

        // Keep the full path including /api/ prefix for Express backend routing
        let path = endpoint.path

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
