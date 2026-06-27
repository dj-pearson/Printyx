import Foundation

extension Date {

    // Cached formatters — DateFormatter is expensive to allocate, and these
    // were previously re-created on every access (once per list row). Static
    // lets are created once and are thread-safe to read.
    private static let shortDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    private static let fullDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    private static let timeOnlyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short
        return f
    }()

    /// "2 hours ago", "3 days ago", etc. Uses the shared cached formatter.
    var relativeDescription: String {
        Formatters.relativeDate.localizedString(for: self, relativeTo: Date())
    }

    /// "Jan 15, 2026"
    var shortFormatted: String {
        Date.shortDateFormatter.string(from: self)
    }

    /// "Jan 15, 2026 at 3:30 PM"
    var fullFormatted: String {
        Date.fullDateFormatter.string(from: self)
    }

    /// "3:30 PM"
    var timeFormatted: String {
        Date.timeOnlyFormatter.string(from: self)
    }

    /// Whether the date is in the past.
    var isPast: Bool {
        self < Date()
    }

    /// Whether the date is today.
    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    /// Whether the date is within the next N days.
    func isWithinDays(_ days: Int) -> Bool {
        guard let futureDate = Calendar.current.date(byAdding: .day, value: days, to: Date()) else {
            return false
        }
        return self >= Date() && self <= futureDate
    }

    /// Number of days from today (negative = past).
    var daysFromNow: Int {
        Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: Calendar.current.startOfDay(for: self)).day ?? 0
    }
}
