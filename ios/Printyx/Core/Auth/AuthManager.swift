import Foundation
import Combine

/// Manages authentication state, login/logout, and token lifecycle.
@MainActor
final class AuthManager: ObservableObject {

    @Published var currentUser: AppUser?
    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var error: String?

    private let apiClient: APIClient
    private let keychain: KeychainManager

    init(apiClient: APIClient, keychain: KeychainManager = .shared) {
        self.apiClient = apiClient
        self.keychain = keychain
        checkExistingSession()
    }

    // MARK: - Session Check

    private func checkExistingSession() {
        guard let token = keychain.getAccessToken() else {
            isLoading = false
            return
        }

        // Decode JWT to check expiry and extract user info
        if let jwt = JWTPayload.decode(from: token) {
            if jwt.exp > Date() {
                // Token still valid
                self.currentUser = AppUser(
                    id: jwt.sub,
                    email: jwt.email ?? keychain.getUserEmail() ?? "",
                    firstName: nil,
                    lastName: nil,
                    tenantId: jwt.tenantId ?? keychain.getTenantId() ?? "",
                    roleLevel: jwt.roleLevel ?? keychain.getRoleLevel() ?? 1,
                    isPlatformAdmin: jwt.isPlatformUser
                )
                self.isAuthenticated = true
                self.apiClient.isAuthenticated = true
                isLoading = false

                // Refresh user info in background
                Task { await refreshUserInfo() }
            } else {
                // Token expired, try refresh
                Task {
                    await attemptTokenRefresh()
                    isLoading = false
                }
            }
        } else {
            isLoading = false
        }
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        error = nil
        isLoading = true

        // Retry login up to 3 times for transient server errors (e.g., Kong 503 "no available server")
        let maxRetries = 3
        var lastError: Error?

        for attempt in 0..<maxRetries {
            do {
                let body = LoginRequest(email: email, password: password)
                let response: AuthTokenResponse = try await apiClient.request(
                    .login(body: body)
                )

                // Store tokens
                keychain.setAccessToken(response.accessToken)
                keychain.setRefreshToken(response.refreshToken)
                keychain.setUserId(response.user.id)

                if let email = response.user.email {
                    keychain.setUserEmail(email)
                }

                // Extract tenant info from JWT or user metadata
                if let tenantId = response.user.appMetadata?.tenantId {
                    keychain.setTenantId(tenantId)
                }

                if let roleLevel = response.user.appMetadata?.roleLevel {
                    keychain.setRoleLevel(roleLevel)
                }

                // Build user object
                self.currentUser = AppUser(
                    id: response.user.id,
                    email: response.user.email ?? email,
                    firstName: response.user.userMetadata?.firstName,
                    lastName: response.user.userMetadata?.lastName,
                    tenantId: response.user.appMetadata?.tenantId ?? "",
                    roleLevel: response.user.appMetadata?.roleLevel ?? 1,
                    isPlatformAdmin: response.user.appMetadata?.isPlatformUser ?? false
                )
                self.isAuthenticated = true
                self.apiClient.isAuthenticated = true
                isLoading = false
                return // Success — exit early
            } catch let apiError as APIError {
                lastError = apiError
                // Only retry on server errors (5xx), not client errors (4xx)
                if case .serverError = apiError, attempt < maxRetries - 1 {
                    try? await Task.sleep(nanoseconds: UInt64((attempt + 1) * 2) * 1_000_000_000)
                    continue
                }
                break
            } catch {
                lastError = error
                break
            }
        }

        // All retries failed — show the error
        if let apiError = lastError as? APIError {
            self.error = apiError.errorDescription
        } else if let lastError {
            self.error = lastError.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Logout

    func logout() {
        keychain.clearAll()
        currentUser = nil
        isAuthenticated = false
        apiClient.isAuthenticated = false
    }

    // MARK: - Token Refresh

    private func attemptTokenRefresh() async {
        guard let refreshToken = keychain.getRefreshToken() else {
            logout()
            return
        }

        struct RefreshBody: Encodable {
            let refreshToken: String
        }

        do {
            let response: AuthTokenResponse = try await apiClient.request(
                .refreshToken(body: RefreshBody(refreshToken: refreshToken))
            )

            keychain.setAccessToken(response.accessToken)
            keychain.setRefreshToken(response.refreshToken)

            self.currentUser = AppUser(
                id: response.user.id,
                email: response.user.email ?? keychain.getUserEmail() ?? "",
                firstName: response.user.userMetadata?.firstName,
                lastName: response.user.userMetadata?.lastName,
                tenantId: response.user.appMetadata?.tenantId ?? keychain.getTenantId() ?? "",
                roleLevel: response.user.appMetadata?.roleLevel ?? keychain.getRoleLevel() ?? 1,
                isPlatformAdmin: response.user.appMetadata?.isPlatformUser ?? false
            )
            self.isAuthenticated = true
            self.apiClient.isAuthenticated = true
        } catch {
            logout()
        }
    }

    // MARK: - Refresh User Info

    private func refreshUserInfo() async {
        do {
            let user: SupabaseUser = try await apiClient.request(.currentUser())
            self.currentUser = AppUser(
                id: user.id,
                email: user.email ?? currentUser?.email ?? "",
                firstName: user.userMetadata?.firstName ?? currentUser?.firstName,
                lastName: user.userMetadata?.lastName ?? currentUser?.lastName,
                tenantId: user.appMetadata?.tenantId ?? currentUser?.tenantId ?? "",
                roleLevel: user.appMetadata?.roleLevel ?? currentUser?.roleLevel ?? 1,
                isPlatformAdmin: user.appMetadata?.isPlatformUser ?? false
            )
        } catch {
            // Non-critical — keep existing user info
        }
    }
}
