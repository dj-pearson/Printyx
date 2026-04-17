import Foundation

/// Persists the most recently viewed CRM record across the app so the quick-log
/// flow can auto-link the next activity without the rep having to pick one.
///
/// Records older than one hour are treated as stale and returned as nil — after
/// that much time the rep is probably starting fresh and we don't want to attach
/// an activity to the wrong customer.
@MainActor
final class LastViewedRecordStore: ObservableObject {
    static let shared = LastViewedRecordStore()

    @Published private(set) var current: LastViewedRecord?

    private let defaultsKey = "com.printyx.lastViewedRecord"
    private let staleAfter: TimeInterval = 60 * 60 // 1 hour

    private init() {
        self.current = loadFromDefaults()
    }

    /// Record that the rep just viewed a CRM detail screen.
    func record(id: String, kind: QuickLogRecordKind, displayName: String) {
        let snapshot = LastViewedRecord(
            id: id,
            kind: kind,
            displayName: displayName,
            viewedAt: Date()
        )
        current = snapshot
        save(snapshot)
    }

    /// Returns the most recent record if it's still fresh, otherwise nil.
    func fresh() -> LastViewedRecord? {
        guard let snapshot = current else { return nil }
        if Date().timeIntervalSince(snapshot.viewedAt) > staleAfter {
            return nil
        }
        return snapshot
    }

    func clear() {
        current = nil
        UserDefaults.standard.removeObject(forKey: defaultsKey)
    }

    // MARK: - Persistence

    private func loadFromDefaults() -> LastViewedRecord? {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey) else { return nil }
        return try? JSONDecoder().decode(LastViewedRecord.self, from: data)
    }

    private func save(_ snapshot: LastViewedRecord) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults.standard.set(data, forKey: defaultsKey)
    }
}
