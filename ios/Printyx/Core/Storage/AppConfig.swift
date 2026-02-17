import Foundation

/// Centralized app configuration. Values come from environment or Info.plist at build time.
enum AppConfig {
    // MARK: - API
    static var apiBaseURL: String {
        #if DEBUG
        return ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:5000"
        #else
        return "https://app.printyx.net"
        #endif
    }

    // MARK: - Edge Functions (for Supabase Edge Functions only)
    static var edgeFunctionsURL: String {
        "https://functions.printyx.net"
    }

    // MARK: - Supabase
    // Read from Info.plist (injected at build time via Xcode build settings)
    static var supabaseURL: String {
        Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? "https://api.printyx.net"
    }

    static var supabaseAnonKey: String {
        Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String
            ?? "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NDk5ODEwMCwiZXhwIjo0OTIwNjcxNzAwLCJyb2xlIjoiYW5vbiJ9.deZlFDdzzNQtSseKfZc2PXZpiYYHHsy6V8NE2cByL7c"
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
