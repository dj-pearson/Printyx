import Foundation

/// Service layer for task CRUD operations against the Printyx API.
@MainActor
final class TaskService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - List / Search

    func fetchTasks(
        assignedTo: String? = nil,
        myTasks: Bool = false,
        status: String? = nil,
        priority: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) async throws -> [PrintyxTask] {
        try await apiClient.request(
            .tasks(assignedTo: assignedTo, myTasks: myTasks, status: status, priority: priority, page: page, limit: limit)
        )
    }

    func fetchTaskStats(myTasks: Bool = false) async throws -> TaskStats {
        try await apiClient.request(.taskStats(myTasks: myTasks))
    }

    // MARK: - CRUD

    func fetchTask(id: String) async throws -> PrintyxTask {
        try await apiClient.request(.task(id: id))
    }

    func createTask(_ request: CreateTaskRequest) async throws -> PrintyxTask {
        try await apiClient.request(.createTask(body: request))
    }

    func updateTask(id: String, _ request: UpdateTaskRequest) async throws -> PrintyxTask {
        try await apiClient.request(.updateTask(id: id, body: request))
    }

    func deleteTask(id: String) async throws {
        try await apiClient.requestVoid(.deleteTask(id: id))
    }

    // MARK: - Comments & Time

    func addComment(taskId: String, content: String) async throws -> TaskComment {
        try await apiClient.request(
            .addTaskComment(taskId: taskId, body: AddCommentRequest(content: content))
        )
    }

    func logTime(taskId: String, minutes: Int, description: String? = nil) async throws -> TaskTimeLog {
        try await apiClient.request(
            .logTaskTime(taskId: taskId, body: LogTimeRequest(minutes: minutes, description: description))
        )
    }

    // MARK: - Bulk Operations

    func bulkUpdate(_ request: BulkUpdateRequest) async throws {
        try await apiClient.requestVoid(.bulkUpdateTasks(body: request))
    }

    // MARK: - Quick Status Update

    func markCompleted(id: String) async throws -> PrintyxTask {
        try await updateTask(id: id, UpdateTaskRequest(status: "completed", completionPercentage: 100))
    }

    func moveToInProgress(id: String) async throws -> PrintyxTask {
        try await updateTask(id: id, UpdateTaskRequest(status: "in_progress"))
    }
}
