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
    #if DEBUG
    private static let debugSupabaseURL = "https://api.printyx.net"
    private static let debugSupabaseAnonKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NDk5ODEwMCwiZXhwIjo0OTIwNjcxNzAwLCJyb2xlIjoiYW5vbiJ9.deZlFDdzzNQtSseKfZc2PXZpiYYHHsy6V8NE2cByL7c"
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
