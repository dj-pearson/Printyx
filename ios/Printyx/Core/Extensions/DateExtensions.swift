import Foundation

extension Date {

    /// "2 hours ago", "3 days ago", etc.
    var relativeDescription: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: self, relativeTo: Date())
    }

    /// "Jan 15, 2026"
    var shortFormatted: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: self)
    }

    /// "Jan 15, 2026 at 3:30 PM"
    var fullFormatted: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: self)
    }

    /// "3:30 PM"
    var timeFormatted: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: self)
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
