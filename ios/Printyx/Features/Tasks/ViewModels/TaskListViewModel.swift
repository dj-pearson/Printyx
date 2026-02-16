import Foundation
import Combine

/// View model for the task list screen with filtering, search, and pagination.
@MainActor
final class TaskListViewModel: ObservableObject {

    // MARK: - Published State

    @Published var tasks: [PrintyxTask] = []
    @Published var stats: TaskStats?
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var error: String?
    @Published var searchText = ""

    // Filters
    @Published var selectedStatus: TaskStatus?
    @Published var selectedPriority: TaskPriority?
    @Published var showMyTasksOnly = true
    @Published var sortBy: SortOption = .dueDate

    enum SortOption: String, CaseIterable, Identifiable {
        case dueDate = "Due Date"
        case priority = "Priority"
        case status = "Status"
        case createdAt = "Created"
        case title = "Title"

        var id: String { rawValue }
    }

    // MARK: - Pagination

    private var currentPage = 1
    private var hasMore = true
    private let pageSize = 25

    // MARK: - Dependencies

    private let taskService: TaskService
    private var searchCancellable: AnyCancellable?

    init(taskService: TaskService) {
        self.taskService = taskService
        setupSearch()
    }

    // MARK: - Search Debounce

    private func setupSearch() {
        searchCancellable = $searchText
            .debounce(for: .milliseconds(400), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { [weak self] _ in
                Task { await self?.refresh() }
            }
    }

    // MARK: - Data Loading

    func loadInitial() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        currentPage = 1

        do {
            async let tasksRequest = taskService.fetchTasks(
                myTasks: showMyTasksOnly,
                status: selectedStatus?.rawValue,
                priority: selectedPriority?.rawValue,
                page: 1,
                limit: pageSize
            )
            async let statsRequest = taskService.fetchTaskStats(myTasks: showMyTasksOnly)

            let (fetchedTasks, fetchedStats) = try await (tasksRequest, statsRequest)
            self.tasks = sortTasks(fetchedTasks)
            self.stats = fetchedStats
            self.hasMore = fetchedTasks.count >= pageSize
        } catch let apiError as APIError {
            self.error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func loadMore() async {
        guard !isLoadingMore, hasMore else { return }
        isLoadingMore = true

        do {
            let nextPage = currentPage + 1
            let moreTasks = try await taskService.fetchTasks(
                myTasks: showMyTasksOnly,
                status: selectedStatus?.rawValue,
                priority: selectedPriority?.rawValue,
                page: nextPage,
                limit: pageSize
            )
            self.tasks.append(contentsOf: sortTasks(moreTasks))
            self.currentPage = nextPage
            self.hasMore = moreTasks.count >= pageSize
        } catch {
            // Silently fail on pagination errors
        }

        isLoadingMore = false
    }

    func refresh() async {
        await loadInitial()
    }

    // MARK: - Quick Actions

    func completeTask(_ task: PrintyxTask) async {
        do {
            let updated = try await taskService.markCompleted(id: task.id)
            if let index = tasks.firstIndex(where: { $0.id == task.id }) {
                tasks[index] = updated
            }
            // Refresh stats
            stats = try? await taskService.fetchTaskStats(myTasks: showMyTasksOnly)
        } catch {
            self.error = "Failed to complete task"
        }
    }

    func startTask(_ task: PrintyxTask) async {
        do {
            let updated = try await taskService.moveToInProgress(id: task.id)
            if let index = tasks.firstIndex(where: { $0.id == task.id }) {
                tasks[index] = updated
            }
        } catch {
            self.error = "Failed to update task"
        }
    }

    func deleteTask(_ task: PrintyxTask) async {
        do {
            try await taskService.deleteTask(id: task.id)
            tasks.removeAll { $0.id == task.id }
            stats = try? await taskService.fetchTaskStats(myTasks: showMyTasksOnly)
        } catch {
            self.error = "Failed to delete task"
        }
    }

    // MARK: - Filtering

    var filteredTasks: [PrintyxTask] {
        var filtered = tasks

        if !searchText.isEmpty {
            let query = searchText.lowercased()
            filtered = filtered.filter {
                $0.title.lowercased().contains(query) ||
                ($0.description?.lowercased().contains(query) ?? false) ||
                ($0.tags?.contains(where: { $0.lowercased().contains(query) }) ?? false)
            }
        }

        return filtered
    }

    var upcomingTasks: [PrintyxTask] {
        filteredTasks
            .filter { $0.status != .completed && $0.status != .cancelled }
            .filter { $0.dueDate?.isWithinDays(7) ?? false }
            .sorted { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) }
    }

    var overdueTasks: [PrintyxTask] {
        filteredTasks.filter { $0.isOverdue }
    }

    // MARK: - Sorting

    private func sortTasks(_ tasks: [PrintyxTask]) -> [PrintyxTask] {
        tasks.sorted { a, b in
            switch sortBy {
            case .dueDate:
                return (a.dueDate ?? .distantFuture) < (b.dueDate ?? .distantFuture)
            case .priority:
                return a.priority.sortOrder < b.priority.sortOrder
            case .status:
                return a.status.sortOrder < b.status.sortOrder
            case .createdAt:
                return (a.createdAt ?? .distantPast) > (b.createdAt ?? .distantPast)
            case .title:
                return a.title.localizedCompare(b.title) == .orderedAscending
            }
        }
    }
}
