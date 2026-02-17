import SwiftUI

/// Detailed view of a single task with editing, comments, and time tracking.
struct TaskDetailView: View {
    @StateObject private var viewModel: TaskDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showingStatusPicker = false
    @State private var showingTimeLog = false

    init(taskService: TaskService, taskId: String) {
        _viewModel = StateObject(wrappedValue: TaskDetailViewModel(taskService: taskService, taskId: taskId))
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    LoadingView()
                } else if let error = viewModel.error, viewModel.task == nil {
                    ErrorView(message: error, retryAction: { await viewModel.load() })
                } else {
                    taskContent
                }
            }
            .navigationTitle(viewModel.isNewTask ? "New Task" : "Task Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            if await viewModel.save() {
                                dismiss()
                            }
                        }
                    } label: {
                        if viewModel.isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(viewModel.isSaving)
                }
            }
            .task {
                await viewModel.load()
            }
        }
    }

    // MARK: - Content

    private var taskContent: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.lg) {
                // Error banner
                if let error = viewModel.error {
                    ErrorBanner(message: error, onDismiss: { viewModel.error = nil })
                        .padding(.horizontal)
                }

                // Status & Priority Quick Actions
                statusSection

                // Main Fields
                fieldsSection

                // Dates
                datesSection

                // Progress
                progressSection

                // Tags
                tagsSection

                // Comments
                commentsSection

                // Time Tracking
                timeSection
            }
            .padding(.vertical, AppTheme.Spacing.lg)
        }
    }

    // MARK: - Status Section

    private var statusSection: some View {
        VStack(spacing: AppTheme.Spacing.md) {
            HStack(spacing: AppTheme.Spacing.md) {
                ForEach(TaskStatus.allCases) { status in
                    Button {
                        Task { await viewModel.updateStatus(status) }
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: status.icon)
                                .font(.system(size: 20))
                            Text(status.displayName)
                                .font(.printyxSmall)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppTheme.Spacing.sm)
                        .background(viewModel.status == status ? statusColor(status).opacity(0.15) : Color(.systemGray6))
                        .cornerRadius(AppTheme.Radius.sm)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppTheme.Radius.sm)
                                .stroke(viewModel.status == status ? statusColor(status) : .clear, lineWidth: 2)
                        )
                    }
                    .foregroundStyle(viewModel.status == status ? statusColor(status) : .secondary)
                }
            }
        }
        .padding(.horizontal)
    }

    private func statusColor(_ status: TaskStatus) -> Color {
        switch status {
        case .todo: .statusNew
        case .inProgress: .statusActive
        case .review: .statusPending
        case .completed: .statusCompleted
        case .cancelled: .statusCancelled
        }
    }

    // MARK: - Fields Section

    private var fieldsSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Details")
                .font(.printyxHeadline)
                .padding(.horizontal)

            VStack(spacing: AppTheme.Spacing.sm) {
                TextField("Task title", text: $viewModel.title)
                    .font(.printyxSubheadline)
                    .textFieldStyle(.roundedBorder)

                TextField("Description (optional)", text: $viewModel.description, axis: .vertical)
                    .font(.printyxBody)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3...8)

                Picker("Priority", selection: $viewModel.priority) {
                    ForEach(TaskPriority.allCases) { p in
                        Text(p.displayName).tag(p)
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Dates Section

    private var datesSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Schedule")
                .font(.printyxHeadline)
                .padding(.horizontal)

            VStack(spacing: AppTheme.Spacing.sm) {
                HStack {
                    Text("Start Date")
                        .font(.printyxBody)
                    Spacer()
                    DatePicker("", selection: Binding(
                        get: { viewModel.startDate ?? Date() },
                        set: { viewModel.startDate = $0 }
                    ), displayedComponents: .date)
                    .labelsHidden()
                }

                HStack {
                    Text("Due Date")
                        .font(.printyxBody)
                    Spacer()
                    DatePicker("", selection: Binding(
                        get: { viewModel.dueDate ?? Date() },
                        set: { viewModel.dueDate = $0 }
                    ), displayedComponents: .date)
                    .labelsHidden()
                }

                HStack {
                    Text("Estimated Hours")
                        .font(.printyxBody)
                    Spacer()
                    TextField("0", text: $viewModel.estimatedHours)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .textFieldStyle(.roundedBorder)
                }
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Progress")
                .font(.printyxHeadline)
                .padding(.horizontal)

            VStack(spacing: AppTheme.Spacing.sm) {
                HStack {
                    Text("Completion")
                        .font(.printyxBody)
                    Spacer()
                    Text("\(viewModel.completionPercentage)%")
                        .font(.printyxSubheadline)
                        .foregroundStyle(Color.printyxPrimary)
                }

                Slider(value: Binding(
                    get: { Double(viewModel.completionPercentage) },
                    set: { viewModel.completionPercentage = Int($0) }
                ), in: 0...100, step: 5)
                .tint(Color.printyxPrimary)

                // Time tracked
                if let tracked = viewModel.task?.timeTracked, tracked > 0 {
                    HStack {
                        Text("Time Tracked")
                            .font(.printyxBody)
                        Spacer()
                        Text("\(tracked / 60)h \(tracked % 60)m")
                            .font(.printyxSubheadline)
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Tags Section

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Tags")
                .font(.printyxHeadline)
                .padding(.horizontal)

            TextField("Enter tags separated by commas", text: $viewModel.tags)
                .font(.printyxBody)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)
        }
    }

    // MARK: - Comments Section

    private var commentsSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            HStack {
                Text("Comments")
                    .font(.printyxHeadline)
                if let count = viewModel.task?.commentCount, count > 0 {
                    Text("(\(count))")
                        .font(.printyxCaption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal)

            HStack(spacing: AppTheme.Spacing.sm) {
                TextField("Add a comment...", text: $viewModel.newComment)
                    .textFieldStyle(.roundedBorder)

                Button {
                    Task { await viewModel.addComment() }
                } label: {
                    Image(systemName: "paperplane.fill")
                        .foregroundStyle(Color.printyxPrimary)
                }
                .disabled(viewModel.newComment.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Time Section

    private var timeSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Log Time")
                .font(.printyxHeadline)
                .padding(.horizontal)

            HStack(spacing: AppTheme.Spacing.sm) {
                TextField("Minutes", text: $viewModel.timeMinutes)
                    .keyboardType(.numberPad)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)

                TextField("Description (optional)", text: $viewModel.timeDescription)
                    .textFieldStyle(.roundedBorder)

                Button {
                    Task { await viewModel.logTime() }
                } label: {
                    Image(systemName: "clock.badge.checkmark")
                        .foregroundStyle(Color.printyxPrimary)
                }
            }
            .padding(.horizontal)
        }
    }
}
