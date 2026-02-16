import Foundation

// MARK: - Supabase Auth Models

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct AuthTokenResponse: Decodable {
    let accessToken: String
    let tokenType: String
    let expiresIn: Int
    let expiresAt: Int?
    let refreshToken: String
    let user: SupabaseUser
}

struct SupabaseUser: Decodable {
    let id: String
    let email: String?
    let phone: String?
    let appMetadata: AppMetadata?
    let userMetadata: UserMetadata?
    let createdAt: String?

    struct AppMetadata: Decodable {
        let tenantId: String?
        let roleId: String?
        let roleLevel: Int?
        let teamId: String?
        let accessScope: String?
        let isPlatformUser: Bool?
    }

    struct UserMetadata: Decodable {
        let firstName: String?
        let lastName: String?
        let avatarUrl: String?
    }
}

// MARK: - JWT Decoding

struct JWTPayload {
    let sub: String
    let email: String?
    let exp: Date
    let tenantId: String?
    let roleLevel: Int?
    let teamId: String?
    let isPlatformUser: Bool

    static func decode(from token: String) -> JWTPayload? {
        let segments = token.split(separator: ".")
        guard segments.count == 3 else { return nil }

        let payloadSegment = String(segments[1])
        guard let data = base64URLDecode(payloadSegment),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        let sub = json["sub"] as? String ?? ""
        let email = json["email"] as? String
        let exp = (json["exp"] as? TimeInterval).map { Date(timeIntervalSince1970: $0) } ?? Date()

        let appMetadata = json["app_metadata"] as? [String: Any]
        let tenantId = appMetadata?["tenantId"] as? String
        let roleLevel = appMetadata?["roleLevel"] as? Int
        let teamId = appMetadata?["teamId"] as? String
        let isPlatformUser = appMetadata?["isPlatformUser"] as? Bool ?? false

        return JWTPayload(
            sub: sub,
            email: email,
            exp: exp,
            tenantId: tenantId,
            roleLevel: roleLevel,
            teamId: teamId,
            isPlatformUser: isPlatformUser
        )
    }

    private static func base64URLDecode(_ string: String) -> Data? {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 {
            base64.append(contentsOf: String(repeating: "=", count: 4 - remainder))
        }
        return Data(base64Encoded: base64)
    }
}

// MARK: - App User

struct AppUser: Identifiable, Equatable {
    let id: String
    let email: String
    let firstName: String?
    let lastName: String?
    let tenantId: String
    let roleLevel: Int
    let isPlatformAdmin: Bool

    var displayName: String {
        if let first = firstName, let last = lastName {
            return "\(first) \(last)"
        }
        return email
    }

    var initials: String {
        if let first = firstName?.first, let last = lastName?.first {
            return "\(first)\(last)".uppercased()
        }
        return String(email.prefix(2)).uppercased()
    }
}
