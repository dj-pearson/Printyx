import Foundation

// MARK: - Team pipeline summary

/// Rolled-up pipeline numbers for everyone under the signed-in manager.
/// The payload mirrors what the web app's `/api/team-reports/pipeline` returns.
struct TeamPipelineSummary: Codable {
    let pipelineValue: Double?
    let weightedValue: Double?
    let openOpportunityCount: Int?
    let closedWonThisMonth: Double?
    let closedWonCount: Int?
}

// MARK: - Per-rep activity counts

struct TeamRepActivity: Identifiable, Codable {
    var id: String { userId }
    let userId: String
    let name: String?
    let callCount: Int?
    let emailCount: Int?
    let meetingCount: Int?
    let noteCount: Int?

    var totalCount: Int {
        (callCount ?? 0) + (emailCount ?? 0) + (meetingCount ?? 0) + (noteCount ?? 0)
    }
}

// MARK: - Leaderboard

struct TeamLeaderboardEntry: Identifiable, Codable {
    var id: String { userId }
    let userId: String
    let name: String?
    let closedWonAmount: Double?
    let closedWonCount: Int?
    let rank: Int?
}

// MARK: - No-touch alert

/// A rep who has not logged any activity against an open opportunity in >= N days.
struct TeamNoTouchAlert: Identifiable, Codable {
    var id: String { "\(userId)-\(opportunityId ?? "")" }
    let userId: String
    let repName: String?
    let opportunityId: String?
    let opportunityName: String?
    let customerName: String?
    let daysSinceLastActivity: Int?
    let openAmount: Double?
}
