import Foundation

/// Drives the Home-tab "My Team" section for managers (roleLevel >= 5).
/// Each of the four cards loads independently so a single failure collapses
/// only that card — the rest of Home keeps rendering.
@MainActor
final class ManagerReportsViewModel: ObservableObject {

    // Per-card state so one failure doesn't blank the section.
    @Published var pipeline: TeamPipelineSummary?
    @Published var pipelineError: String?

    @Published var activities: [TeamRepActivity] = []
    @Published var activitiesError: String?

    @Published var leaderboard: [TeamLeaderboardEntry] = []
    @Published var leaderboardError: String?

    @Published var noTouchAlerts: [TeamNoTouchAlert] = []
    @Published var noTouchError: String?

    @Published var isLoading = false

    private let service: ManagerReportsService

    init(service: ManagerReportsService) {
        self.service = service
    }

    func loadAll() async {
        isLoading = true
        defer { isLoading = false }

        // Kick all four requests off in parallel; each catches its own error.
        async let pipelineTask: () = loadPipeline()
        async let activitiesTask: () = loadActivities()
        async let leaderboardTask: () = loadLeaderboard()
        async let noTouchTask: () = loadNoTouch()
        _ = await (pipelineTask, activitiesTask, leaderboardTask, noTouchTask)
    }

    func loadPipeline() async {
        pipelineError = nil
        do {
            pipeline = try await service.fetchPipeline()
        } catch {
            pipelineError = errorString(from: error)
        }
    }

    func loadActivities() async {
        activitiesError = nil
        do {
            activities = try await service.fetchActivitiesByRep()
        } catch {
            activitiesError = errorString(from: error)
        }
    }

    func loadLeaderboard() async {
        leaderboardError = nil
        do {
            leaderboard = try await service.fetchLeaderboard()
        } catch {
            leaderboardError = errorString(from: error)
        }
    }

    func loadNoTouch() async {
        noTouchError = nil
        do {
            noTouchAlerts = try await service.fetchNoTouchAlerts()
        } catch {
            noTouchError = errorString(from: error)
        }
    }

    private func errorString(from error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
