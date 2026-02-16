import Foundation

/// Centralized app configuration. Values come from environment or Info.plist at build time.
enum AppConfig {
    // MARK: - API
    static var apiBaseURL: String {
        #if DEBUG
        return ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:5000"
        #else
        return "https://api.printyx.net"
        #endif
    }

    // MARK: - Supabase
    static var supabaseURL: String {
        ProcessInfo.processInfo.environment["SUPABASE_URL"] ?? "https://api.printyx.net"
    }

    static var supabaseAnonKey: String {
        ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] ?? ""
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
