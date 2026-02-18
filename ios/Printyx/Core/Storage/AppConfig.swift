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
    // Read from Info.plist (injected at build time via Xcode build settings)
    // Falls back to hardcoded defaults if build variables are unresolved
    private static let defaultSupabaseURL = "https://api.printyx.net"
    private static let defaultSupabaseAnonKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NDk5ODEwMCwiZXhwIjo0OTIwNjcxNzAwLCJyb2xlIjoiYW5vbiJ9.deZlFDdzzNQtSseKfZc2PXZpiYYHHsy6V8NE2cByL7c"

    static var supabaseURL: String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
              !value.isEmpty,
              !value.hasPrefix("$("),
              value.hasPrefix("http") else {
            return defaultSupabaseURL
        }
        return value
    }

    static var supabaseAnonKey: String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
              !value.isEmpty,
              !value.hasPrefix("$("),
              value.hasPrefix("eyJ") else {
            return defaultSupabaseAnonKey
        }
        return value
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
