import Foundation
import Security

/// Secure storage for authentication tokens and sensitive data using iOS Keychain.
final class KeychainManager {
    static let shared = KeychainManager()

    private let service = "net.printyx.ios"

    private enum Key: String {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tenantId = "tenant_id"
        case userId = "user_id"
        case userEmail = "user_email"
        case roleLevel = "role_level"
    }

    private init() {}

    // MARK: - Access Token

    func getAccessToken() -> String? {
        get(key: .accessToken)
    }

    func setAccessToken(_ token: String) {
        set(token, key: .accessToken)
    }

    // MARK: - Refresh Token

    func getRefreshToken() -> String? {
        get(key: .refreshToken)
    }

    func setRefreshToken(_ token: String) {
        set(token, key: .refreshToken)
    }

    // MARK: - Tenant ID

    func getTenantId() -> String? {
        get(key: .tenantId)
    }

    func setTenantId(_ tenantId: String) {
        set(tenantId, key: .tenantId)
    }

    // MARK: - User ID

    func getUserId() -> String? {
        get(key: .userId)
    }

    func setUserId(_ userId: String) {
        set(userId, key: .userId)
    }

    // MARK: - User Email

    func getUserEmail() -> String? {
        get(key: .userEmail)
    }

    func setUserEmail(_ email: String) {
        set(email, key: .userEmail)
    }

    // MARK: - Role Level

    func getRoleLevel() -> Int? {
        get(key: .roleLevel).flatMap { Int($0) }
    }

    func setRoleLevel(_ level: Int) {
        set("\(level)", key: .roleLevel)
    }

    // MARK: - Clear All

    func clearAll() {
        for key in [Key.accessToken, .refreshToken, .tenantId, .userId, .userEmail, .roleLevel] {
            delete(key: key)
        }
    }

    // MARK: - Private Keychain Operations

    private func get(key: Key) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }

        return string
    }

    private func set(_ value: String, key: Key) {
        guard let data = value.data(using: .utf8) else { return }

        // Delete existing item first
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    private func delete(key: Key) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]

        SecItemDelete(query as CFDictionary)
    }
}
