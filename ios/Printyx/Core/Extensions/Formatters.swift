import Foundation

/// Shared formatters reused across the app to avoid re-instantiating
/// NumberFormatter / DateFormatter in every row of every list. These are
/// thread-safe in iOS (Apple documents NumberFormatter as thread-safe as of
/// iOS 7). Access from any actor is fine.
enum Formatters {

    /// USD currency with no fractional digits. Most printer-dealer pricing
    /// rounds to whole dollars, and in a list context the decimal noise
    /// makes rows harder to scan.
    static let currencyUSDNoFraction: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.maximumFractionDigits = 0
        return f
    }()

    /// USD currency with two fractional digits for invoice / amount-due
    /// contexts where cents matter.
    static let currencyUSD: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.maximumFractionDigits = 2
        return f
    }()

    /// Integer formatter with grouping separators (e.g. 12,345 meter reads).
    static let integer: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return f
    }()

    /// Short relative date formatter — "Yesterday", "2 days ago", etc.
    static let relativeDate: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f
    }()

    // MARK: - Convenience wrappers

    /// Format a Double as USD with no fractional digits. Returns "—" for nil.
    static func currencyRounded(_ value: Double?) -> String {
        guard let value else { return "—" }
        return currencyUSDNoFraction.string(from: NSNumber(value: value)) ?? "—"
    }

    /// Format a Double as USD with cents. Returns "—" for nil.
    static func currency(_ value: Double?) -> String {
        guard let value else { return "—" }
        return currencyUSD.string(from: NSNumber(value: value)) ?? "—"
    }
}
