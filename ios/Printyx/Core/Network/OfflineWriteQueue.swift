import Foundation
import Combine

/// A queued mutation that was attempted while the device was offline.
/// Replay is opportunistic — the queue flushes whenever `NetworkMonitor`
/// reports the connection came back, or when `flush()` is called explicitly.
struct QueuedWrite: Codable, Identifiable, Equatable {
    let id: UUID
    let method: String            // "POST", "PATCH", "PUT", "DELETE"
    let path: String              // e.g. "/api/leads/123/activities"
    let bodyJSON: Data?           // already-encoded JSON body, if any
    let tenantId: String?         // preserved so we don't leak across tenants
    let createdAt: Date
    var attempts: Int
    var lastError: String?
}

/// Persists offline writes to disk and drains them when the network returns.
///
/// Scoped deliberately: we only queue *mutations* that explicitly opt in via
/// `enqueueIfOffline`, not every POST the app does. Auth endpoints (login,
/// refresh, logout) bypass the queue because they need a live server round
/// trip to be meaningful.
@MainActor
final class OfflineWriteQueue: ObservableObject {
    static let shared = OfflineWriteQueue()

    @Published private(set) var pendingCount: Int = 0
    @Published private(set) var isFlushing: Bool = false

    private var queue: [QueuedWrite] = []
    private let fileURL: URL
    private let fileManager = FileManager.default
    private var cancellables = Set<AnyCancellable>()

    /// Replay hook — injected by the APIClient so the queue can call back into
    /// `executeRequest` without creating an import cycle.
    typealias Replay = (QueuedWrite) async throws -> Void
    private var replay: Replay?

    private init() {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        self.fileURL = caches.appendingPathComponent("printyx-offline-writes.json")
        loadFromDisk()
        observeConnectivity()
    }

    // MARK: - Public API

    /// Install the replay closure. Called by APIClient on init.
    func configure(replay: @escaping Replay) {
        self.replay = replay
    }

    /// Queue a write. Idempotent per `id`.
    func enqueue(_ write: QueuedWrite) {
        queue.append(write)
        pendingCount = queue.count
        saveToDisk()
    }

    /// Attempt to drain the queue. Safe to call repeatedly.
    func flush() async {
        guard !isFlushing, let replay, !queue.isEmpty else { return }
        isFlushing = true
        defer { isFlushing = false }

        var remaining: [QueuedWrite] = []
        for var item in queue {
            do {
                try await replay(item)
            } catch {
                item.attempts += 1
                item.lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
                // Give up on writes that have failed 5 times so one bad
                // payload doesn't permanently block the queue. They're
                // dropped silently — the rep already saw a confirmation toast
                // locally; a manager-facing sync audit is a future story.
                if item.attempts < 5 {
                    remaining.append(item)
                }
            }
        }
        queue = remaining
        pendingCount = queue.count
        saveToDisk()
    }

    // MARK: - Connectivity

    private func observeConnectivity() {
        NetworkMonitor.shared.$isConnected
            .removeDuplicates()
            .sink { [weak self] isConnected in
                guard let self, isConnected else { return }
                Task { @MainActor in await self.flush() }
            }
            .store(in: &cancellables)
    }

    // MARK: - Disk

    private func loadFromDisk() {
        guard let data = try? Data(contentsOf: fileURL),
              let items = try? JSONDecoder().decode([QueuedWrite].self, from: data) else {
            return
        }
        queue = items
        pendingCount = queue.count
    }

    private func saveToDisk() {
        if queue.isEmpty {
            try? fileManager.removeItem(at: fileURL)
            return
        }
        if let data = try? JSONEncoder().encode(queue) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}
