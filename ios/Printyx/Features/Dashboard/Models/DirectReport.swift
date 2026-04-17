import Foundation

/// Minimal representation of another user on the signed-in user's team.
/// Only the fields we actually consume in filter chips are decoded — the
/// backend response is larger but extra fields are ignored by the decoder.
struct DirectReport: Identifiable, Codable, Hashable {
    let id: String
    let firstName: String?
    let lastName: String?
    let email: String?

    var displayName: String {
        if let f = firstName, let l = lastName { return "\(f) \(l)" }
        if let f = firstName { return f }
        if let l = lastName { return l }
        return email ?? "Rep"
    }

    var shortName: String {
        firstName ?? (lastName ?? email ?? "Rep")
    }
}
