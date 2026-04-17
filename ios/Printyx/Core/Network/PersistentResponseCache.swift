import Foundation

/// File-backed JSON cache for list endpoints. Keyed by (tenant, endpoint path,
/// query string) so that switching tenants doesn't bleed cached data across
/// boundaries — critical for a multi-tenant SaaS.
///
/// The cache is deliberately simple: write-through on every successful GET,
/// read-on-demand when offline or as a priming step before the network call
/// returns. Entries are capped at 1 MB each and the whole cache is capped at
/// 20 MB to keep the iOS `Documents/cache` footprint small.
@MainActor
final class PersistentResponseCache {
    static let shared = PersistentResponseCache()

    private let fileManager = FileManager.default
    private let directoryURL: URL
    private let maxEntryBytes = 1_000_000
    private let maxTotalBytes = 20_000_000
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        self.directoryURL = caches.appendingPathComponent("PrintyxResponseCache", isDirectory: true)
        try? fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
    }

    // MARK: - Key

    /// Hashes (tenant, path, query) to a filesystem-safe filename.
    private func cacheKey(tenantId: String?, path: String, query: String?) -> String {
        var key = (tenantId ?? "notenant") + "|" + path
        if let query, !query.isEmpty { key += "?" + query }
        let data = Data(key.utf8)
        let hash = data.reduce(UInt64(0xcbf29ce484222325)) { acc, b in
            (acc ^ UInt64(b)) &* 0x100000001b3
        }
        return String(hash, radix: 16)
    }

    // MARK: - Read

    /// Returns raw cached response bytes, or nil if absent/expired.
    /// Entries older than `maxAge` are ignored but not eagerly purged.
    func load(
        tenantId: String?,
        path: String,
        query: String?,
        maxAge: TimeInterval = 7 * 24 * 60 * 60
    ) -> Data? {
        let url = directoryURL.appendingPathComponent(cacheKey(tenantId: tenantId, path: path, query: query))
        guard
            let attrs = try? fileManager.attributesOfItem(atPath: url.path),
            let modified = attrs[.modificationDate] as? Date,
            Date().timeIntervalSince(modified) < maxAge,
            let data = try? Data(contentsOf: url)
        else {
            return nil
        }
        return data
    }

    // MARK: - Write

    func save(data: Data, tenantId: String?, path: String, query: String?) {
        guard data.count <= maxEntryBytes else { return }
        let url = directoryURL.appendingPathComponent(cacheKey(tenantId: tenantId, path: path, query: query))
        try? data.write(to: url, options: .atomic)
        enforceTotalCapIfNeeded()
    }

    // MARK: - Size management

    /// Best-effort cap enforcement. Called after writes. Trims oldest entries
    /// until we're under the total-size budget.
    private func enforceTotalCapIfNeeded() {
        guard let contents = try? fileManager.contentsOfDirectory(
            at: directoryURL,
            includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]
        ) else { return }

        let sized: [(url: URL, size: Int, date: Date)] = contents.compactMap { url in
            let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
            guard let size = values?.fileSize, let date = values?.contentModificationDate else { return nil }
            return (url, size, date)
        }

        let total = sized.reduce(0) { $0 + $1.size }
        if total <= maxTotalBytes { return }

        var remaining = total
        for entry in sized.sorted(by: { $0.date < $1.date }) {
            if remaining <= maxTotalBytes { break }
            try? fileManager.removeItem(at: entry.url)
            remaining -= entry.size
        }
    }

    func clear() {
        guard let contents = try? fileManager.contentsOfDirectory(at: directoryURL, includingPropertiesForKeys: nil) else { return }
        for url in contents {
            try? fileManager.removeItem(at: url)
        }
    }
}
