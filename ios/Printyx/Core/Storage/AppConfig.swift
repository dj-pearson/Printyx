import Foundation

/// Centralized app configuration. Values come from environment or Info.plist at build time.
enum AppConfig {
    // MARK: - API
    static var apiBaseURL: String {
        #if DEBUG
        return ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:5000"
        #else
        return "https://printyx.net"
        #endif
    }

    // MARK: - Edge Functions (for Supabase Edge Functions only)
    static var edgeFunctionsURL: String {
        "https://functions.printyx.net"
    }

    // MARK: - Supabase
    // Values MUST be injected at build time via Info.plist (SUPABASE_URL /
    // SUPABASE_ANON_KEY). Release builds fail closed if injection didn't
    // happen — previously a hardcoded anon-key fallback lived here, which
    // defeated key rotation and left stale keys live in every shipped build.
    // The DEBUG fallback no longer HARDCODES the anon key (PROD-005/PA-014). The
    // previous literal was the same token committed in mobile/eas.json: it is in git
    // history, carried a ~100-year expiry (iat 2025-12-06, exp 2125-12-06), and could
    // not be rotated without a code change — the exact failure the comment above
    // describes, just narrowed to DEBUG rather than removed. Debug builds now read it
    // from the environment, matching how apiBaseURL already resolves API_BASE_URL.
    #if DEBUG
    private static let debugSupabaseURL =
        ProcessInfo.processInfo.environment["SUPABASE_URL"] ?? "https://api.printyx.net"
    private static let debugSupabaseAnonKey =
        ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] ?? ""
    #endif

    static var supabaseURL: String {
        if let value = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
           !value.isEmpty,
           !value.hasPrefix("$("),
           value.hasPrefix("http") {
            return value
        }
        #if DEBUG
        return debugSupabaseURL
        #else
        fatalError("SUPABASE_URL is not configured. Inject via Info.plist at build time.")
        #endif
    }

    static var supabaseAnonKey: String {
        if let value = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
           !value.isEmpty,
           !value.hasPrefix("$("),
           value.hasPrefix("eyJ") {
            return value
        }
        #if DEBUG
        // Fail closed in DEBUG too rather than handing back "" — an empty key produces
        // confusing 401s from GoTrue instead of naming the missing configuration.
        guard !debugSupabaseAnonKey.isEmpty else {
            fatalError(
                "SUPABASE_ANON_KEY is not configured. Set it in the scheme's environment "
                    + "variables (or inject via Info.plist). It is deliberately not hardcoded."
            )
        }
        return debugSupabaseAnonKey
        #else
        fatalError("SUPABASE_ANON_KEY is not configured. Inject via Info.plist at build time.")
        #endif
    }

    // MARK: - App Info
    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    static var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    static var fullVersion: String {
        "\(appVersion) (\(buildNumber))"
    }

    // MARK: - Feature Flags
    static var isDebug: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
}
