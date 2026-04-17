import SwiftUI

/// Main task list screen with search, filters, stats, and swipe actions.
struct TaskListView: View {
    @StateObject private var viewModel: TaskListViewModel
    @State private var showingCreateTask = false
    @State private var showingFilters = false
    @State private var showingArchive = false
    @State private var selectedTask: PrintyxTask?

    init(taskService: TaskService) {
        _viewModel = StateObject(wrappedValue: TaskListViewModel(taskService: taskService))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Stats Header
                if let stats = viewModel.stats {
                    TaskStatsBar(stats: stats)
                }

                // Search & Filter Bar
                HStack(spacing: AppTheme.Spacing.sm) {
                    SearchBar(text: $viewModel.searchText, placeholder: "Search tasks...")

                    Button {
                        showingFilters.toggle()
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .font(.system(size: 22))
                            .foregroundStyle(hasActiveFilters ? Color.printyxPrimary : .secondary)
                    }
                    .frame(width: 44, height: 44)
                }
                .padding(.horizontal, AppTheme.Spacing.lg)
                .padding(.vertical, AppTheme.Spacing.sm)

                // Content
                if viewModel.isLoading && viewModel.tasks.isEmpty {
                    LoadingView(message: "Loading tasks...")
                } else if let error = viewModel.error, viewModel.tasks.isEmpty {
                    ErrorView(message: error, retryAction: { await viewModel.refresh() })
                } else if viewModel.activeTasks.isEmpty && viewModel.completedTasks.isEmpty {
                    EmptyStateView(
                        icon: "checklist",
                        title: "No Tasks",
                        message: viewModel.searchText.isEmpty
                            ? "Create your first task to get started."
                            : "No tasks match your search.",
                        actionTitle: "Create Task",
                        action: { showingCreateTask = true }
                    )
                } else {
                    taskList
                }
            }
            .navigationTitle("Tasks")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCreateTask = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.printyxPrimary)
                    }
                    .accessibilityLabel("Add task")
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Sort By", selection: $viewModel.sortBy) {
                            ForEach(TaskListViewModel.SortOption.allCases) { option in
                                Text(option.rawValue).tag(option)
                            }
                        }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down.circle")
                            .font(.system(size: 20))
                    }
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $showingCreateTask) {
                TaskFormView(
                    taskService: TaskService(apiClient: APIClient()),
                    onCreated: { _ in
                        Task { await viewModel.refresh() }
                    }
                )
            }
            .sheet(isPresented: $showingFilters) {
                TaskFilterSheet(viewModel: viewModel)
                    .presentationDetents([.medium])
            }
            .sheet(item: $selectedTask) { task in
                TaskDetailView(taskService: TaskService(apiClient: APIClient()), taskId: task.id)
            }
            .task {
                if viewModel.tasks.isEmpty {
                    await viewModel.loadInitial()
                }
            }
            .onChange(of: viewModel.selectedStatus) { _, _ in
                Task { await viewModel.refresh() }
            }
            .onChange(of: viewModel.selectedPriority) { _, _ in
                Task { await viewModel.refresh() }
            }
            .onChange(of: viewModel.showMyTasksOnly) { _, _ in
                Task { await viewModel.refresh() }
            }
        }
    }

    // MARK: - Task List

    private var taskList: some View {
        List {
            // Overdue section
            if !viewModel.overdueTasks.isEmpty {
                Section {
                    ForEach(viewModel.overdueTasks) { task in
                        TaskRowView(task: task)
                            .contentShape(Rectangle())
                            .onTapGesture { selectedTask = task }
                            .swipeActions(edge: .trailing) {
                                swipeActions(for: task)
                            }
                    }
                } header: {
                    Label("Overdue (\(viewModel.overdueTasks.count))", systemImage: "exclamationmark.circle")
                        .foregroundStyle(.red)
                        .font(.printyxCaption)
                }
            }

            // Upcoming section
            if !viewModel.upcomingTasks.isEmpty {
                Section {
                    ForEach(viewModel.upcomingTasks) { task in
                        TaskRowView(task: task)
                            .contentShape(Rectangle())
                            .onTapGesture { selectedTask = task }
                            .swipeActions(edge: .trailing) {
                                swipeActions(for: task)
                            }
                    }
                } header: {
                    Label("Due This Week", systemImage: "calendar")
                        .font(.printyxCaption)
                }
            }

            // Active tasks (sorted by due date)
            if !viewModel.activeTasks.isEmpty {
                Section {
                    ForEach(viewModel.activeTasks) { task in
                        TaskRowView(task: task)
                            .contentShape(Rectangle())
                            .onTapGesture { selectedTask = task }
                            .swipeActions(edge: .trailing) {
                                swipeActions(for: task)
                            }
                            .swipeActions(edge: .leading) {
                                Button {
                                    Task { await viewModel.completeTask(task) }
                                } label: {
                                    Label("Complete", systemImage: "checkmark")
                                }
                                .tint(.green)
                            }
                    }

                    // Pagination
                    if viewModel.isLoadingMore {
                        InlineLoadingView()
                    } else {
                        Color.clear
                            .frame(height: 1)
                            .onAppear {
                                Task { await viewModel.loadMore() }
                            }
                    }
                } header: {
                    Text("Active Tasks (\(viewModel.activeTasks.count))")
                        .font(.printyxCaption)
                }
            }

            // Completed / Archive section
            if !viewModel.completedTasks.isEmpty && !showingArchive {
                Section {
                    Button {
                        withAnimation { showingArchive = true }
                    } label: {
                        HStack {
                            Image(systemName: "archivebox")
                                .foregroundStyle(.secondary)
                            Text("Completed (\(viewModel.completedTasks.count))")
                                .foregroundStyle(.secondary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
            }

            if showingArchive && !viewModel.completedTasks.isEmpty {
                Section {
                    ForEach(viewModel.completedTasks) { task in
                        TaskRowView(task: task)
                            .contentShape(Rectangle())
                            .onTapGesture { selectedTask = task }
                            .opacity(0.7)
                    }
                } header: {
                    HStack {
                        Label("Archive (\(viewModel.completedTasks.count))", systemImage: "archivebox")
                            .font(.printyxCaption)
                        Spacer()
                        Button("Hide") {
                            withAnimation { showingArchive = false }
                        }
                        .font(.printyxCaption)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    // MARK: - Swipe Actions

    @ViewBuilder
    private func swipeActions(for task: PrintyxTask) -> some View {
        Button(role: .destructive) {
            Task { await viewModel.deleteTask(task) }
        } label: {
            Label("Delete", systemImage: "trash")
        }

        if task.status == .todo {
            Button {
                Task { await viewModel.startTask(task) }
            } label: {
                Label("Start", systemImage: "play")
            }
            .tint(.blue)
        }
    }

    private var hasActiveFilters: Bool {
        viewModel.selectedStatus != nil || viewModel.selectedPriority != nil
    }
}

// MARK: - Stats Bar

struct TaskStatsBar: View {
    let stats: TaskStats

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppTheme.Spacing.md) {
                StatChip(label: "To Do", value: stats.todo, color: .statusNew)
                StatChip(label: "In Progress", value: stats.inProgress, color: .statusActive)
                StatChip(label: "Review", value: stats.review, color: .statusPending)
                StatChip(label: "Done", value: stats.completed, color: .statusCompleted)
                if stats.overdue > 0 {
                    StatChip(label: "Overdue", value: stats.overdue, color: .statusOverdue)
                }
            }
            .padding(.horizontal, AppTheme.Spacing.lg)
            .padding(.vertical, AppTheme.Spacing.sm)
        }
    }
}

struct StatChip: View {
    let label: String
    let value: Int
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(color)
            Text(label)
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, AppTheme.Spacing.md)
        .padding(.vertical, AppTheme.Spacing.sm)
        .background(color.opacity(0.08))
        .cornerRadius(AppTheme.Radius.sm)
    }
}

// MARK: - Filter Sheet

struct TaskFilterSheet: View {
    @ObservedObject var viewModel: TaskListViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Status") {
                    Picker("Status", selection: $viewModel.selectedStatus) {
                        Text("All").tag(nil as TaskStatus?)
                        ForEach(TaskStatus.allCases) { status in
                            Label(status.displayName, systemImage: status.icon)
                                .tag(status as TaskStatus?)
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section("Priority") {
                    Picker("Priority", selection: $viewModel.selectedPriority) {
                        Text("All").tag(nil as TaskPriority?)
                        ForEach(TaskPriority.allCases) { p in
                            Text(p.displayName).tag(p as TaskPriority?)
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section {
                    Toggle("My Tasks Only", isOn: $viewModel.showMyTasksOnly)
                }

                Section {
                    Button("Clear All Filters") {
                        viewModel.selectedStatus = nil
                        viewModel.selectedPriority = nil
                        viewModel.showMyTasksOnly = true
                    }
                    .foregroundStyle(.red)
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
