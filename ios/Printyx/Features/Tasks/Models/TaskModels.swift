import Foundation

// MARK: - Task Model

struct PrintyxTask: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?
    var title: String
    var description: String?
    var status: TaskStatus
    var priority: TaskPriority
    var assignedTo: String?
    var createdBy: String?
    var projectId: String?
    var parentTaskId: String?
    var dueDate: Date?
    var startDate: Date?
    var estimatedHours: Int?
    var actualHours: Int?
    var completionPercentage: Int?
    var dependencies: [String]?
    var watchers: [String]?
    var timeTracked: Int?
    var commentCount: Int?
    var attachmentCount: Int?
    var tags: [String]?
    var customFields: [String: String]?
    var createdAt: Date?
    var updatedAt: Date?
    var completedAt: Date?

    /// Whether the task is overdue.
    var isOverdue: Bool {
        guard let dueDate, status != .completed, status != .cancelled else { return false }
        return dueDate.isPast
    }

    /// Days until due (negative = overdue).
    var daysUntilDue: Int? {
        dueDate?.daysFromNow
    }
}

// MARK: - Task Status

enum TaskStatus: String, Codable, CaseIterable, Identifiable {
    case todo
    case inProgress = "in_progress"
    case review
    case completed
    case cancelled

    var id: String { rawValue }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = TaskStatus(rawValue: rawValue) ?? .todo
    }

    var displayName: String {
        switch self {
        case .todo: "To Do"
        case .inProgress: "In Progress"
        case .review: "In Review"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        }
    }

    var icon: String {
        switch self {
        case .todo: "circle"
        case .inProgress: "play.circle"
        case .review: "eye.circle"
        case .completed: "checkmark.circle.fill"
        case .cancelled: "xmark.circle"
        }
    }

    var sortOrder: Int {
        switch self {
        case .inProgress: 0
        case .review: 1
        case .todo: 2
        case .completed: 3
        case .cancelled: 4
        }
    }
}

// MARK: - Task Priority

enum TaskPriority: String, Codable, CaseIterable, Identifiable {
    case low
    case medium
    case high
    case urgent

    var id: String { rawValue }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = TaskPriority(rawValue: rawValue) ?? .medium
    }

    var displayName: String { rawValue.capitalized }

    var sortOrder: Int {
        switch self {
        case .urgent: 0
        case .high: 1
        case .medium: 2
        case .low: 3
        }
    }
}

// MARK: - Task Stats

struct TaskStats: Codable {
    let total: Int
    let todo: Int
    let inProgress: Int
    let review: Int
    let completed: Int
    let cancelled: Int
    let overdue: Int
}

// MARK: - Task Comment

struct TaskComment: Identifiable, Codable {
    let id: String
    let taskId: String
    let userId: String
    let content: String
    let createdAt: Date?
    let userName: String?
}

// MARK: - Task Time Log

struct TaskTimeLog: Identifiable, Codable {
    let id: String
    let taskId: String
    let userId: String
    let minutes: Int
    let description: String?
    let createdAt: Date?
}

// MARK: - Create / Update DTOs

struct CreateTaskRequest: Encodable {
    let title: String
    var description: String?
    var status: String = "todo"
    var priority: String = "medium"
    var assignedTo: String?
    var dueDate: Date?
    var startDate: Date?
    var estimatedHours: Int?
    var tags: [String]?
    var projectId: String?
    var parentTaskId: String?
}

struct UpdateTaskRequest: Encodable {
    var title: String?
    var description: String?
    var status: String?
    var priority: String?
    var assignedTo: String?
    var dueDate: Date?
    var startDate: Date?
    var estimatedHours: Int?
    var actualHours: Int?
    var completionPercentage: Int?
    var tags: [String]?
}

struct AddCommentRequest: Encodable {
    let content: String
}

struct LogTimeRequest: Encodable {
    let minutes: Int
    var description: String?
}

struct BulkUpdateRequest: Encodable {
    let taskIds: [String]
    var status: String?
    var priority: String?
    var assignedTo: String?
}

// MARK: - Paginated Response

struct PaginatedResponse<T: Decodable>: Decodable {
    let data: [T]
    let total: Int?
    let page: Int?
    let limit: Int?
    let hasMore: Bool?
}
