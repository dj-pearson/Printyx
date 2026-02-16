import Foundation

/// View model for viewing and editing a single task.
@MainActor
final class TaskDetailViewModel: ObservableObject {

    @Published var task: PrintyxTask?
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var error: String?
    @Published var successMessage: String?

    // Editable fields
    @Published var title = ""
    @Published var description = ""
    @Published var status: TaskStatus = .todo
    @Published var priority: TaskPriority = .medium
    @Published var dueDate: Date?
    @Published var startDate: Date?
    @Published var estimatedHours: String = ""
    @Published var completionPercentage: Int = 0
    @Published var tags: String = ""

    // Comment
    @Published var newComment = ""

    // Time logging
    @Published var timeMinutes = ""
    @Published var timeDescription = ""

    private let taskService: TaskService
    private let taskId: String?

    var isNewTask: Bool { taskId == nil }

    init(taskService: TaskService, taskId: String? = nil) {
        self.taskService = taskService
        self.taskId = taskId
    }

    // MARK: - Load

    func load() async {
        guard let taskId else { return }
        isLoading = true
        error = nil

        do {
            let fetched = try await taskService.fetchTask(id: taskId)
            self.task = fetched
            populateFields(from: fetched)
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    private func populateFields(from task: PrintyxTask) {
        title = task.title
        description = task.description ?? ""
        status = task.status
        priority = task.priority
        dueDate = task.dueDate
        startDate = task.startDate
        estimatedHours = task.estimatedHours.map { "\($0)" } ?? ""
        completionPercentage = task.completionPercentage ?? 0
        tags = task.tags?.joined(separator: ", ") ?? ""
    }

    // MARK: - Save

    func save() async -> Bool {
        guard !title.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Title is required"
            return false
        }

        isSaving = true
        error = nil

        do {
            if let taskId {
                // Update existing
                let request = UpdateTaskRequest(
                    title: title,
                    description: description.isEmpty ? nil : description,
                    status: status.rawValue,
                    priority: priority.rawValue,
                    dueDate: dueDate,
                    startDate: startDate,
                    estimatedHours: Int(estimatedHours),
                    completionPercentage: completionPercentage,
                    tags: tags.isEmpty ? nil : tags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
                )
                self.task = try await taskService.updateTask(id: taskId, request)
                successMessage = "Task updated"
            } else {
                // Create new
                let request = CreateTaskRequest(
                    title: title,
                    description: description.isEmpty ? nil : description,
                    priority: priority.rawValue,
                    dueDate: dueDate,
                    startDate: startDate,
                    estimatedHours: Int(estimatedHours),
                    tags: tags.isEmpty ? nil : tags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
                )
                self.task = try await taskService.createTask(request)
                successMessage = "Task created"
            }
            isSaving = false
            return true
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isSaving = false
        return false
    }

    // MARK: - Quick Status Change

    func updateStatus(_ newStatus: TaskStatus) async {
        guard let taskId else { return }
        do {
            var req = UpdateTaskRequest(status: newStatus.rawValue)
            if newStatus == .completed {
                req.completionPercentage = 100
            }
            self.task = try await taskService.updateTask(id: taskId, req)
            self.status = newStatus
            if newStatus == .completed {
                completionPercentage = 100
            }
        } catch {
            self.error = "Failed to update status"
        }
    }

    // MARK: - Comments

    func addComment() async {
        guard let taskId, !newComment.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        do {
            _ = try await taskService.addComment(taskId: taskId, content: newComment)
            newComment = ""
            // Refresh task to get updated comment count
            await load()
        } catch {
            self.error = "Failed to add comment"
        }
    }

    // MARK: - Time Logging

    func logTime() async {
        guard let taskId, let minutes = Int(timeMinutes), minutes > 0 else {
            error = "Enter valid minutes"
            return
        }
        do {
            _ = try await taskService.logTime(
                taskId: taskId,
                minutes: minutes,
                description: timeDescription.isEmpty ? nil : timeDescription
            )
            timeMinutes = ""
            timeDescription = ""
            await load()
        } catch {
            self.error = "Failed to log time"
        }
    }
}
