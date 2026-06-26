import SwiftUI

/// Form for creating a new task.
struct TaskFormView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var priority: TaskPriority = .medium
    @State private var dueDate = Date().addingTimeInterval(7 * 24 * 60 * 60)
    @State private var hasDueDate = true
    @State private var tags = ""
    @State private var isSaving = false
    @State private var error: String?

    // Injected externally when this view is used from a parent with a service
    var taskService: TaskService?
    var onCreated: ((PrintyxTask) -> Void)?

    var body: some View {
        NavigationStack {
            navigationContent
        }
    }

    private var mainContent: some View {
        Form {
            errorSection
            detailsSection
            prioritySection
            dueDateSection
            tagsSection
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if let error {
            Section {
                ErrorBanner(message: error, onDismiss: { self.error = nil })
            }
        }
    }

    private var detailsSection: some View {
        Section("Task Details") {
            TextField("Task title *", text: $title)
                .font(.printyxSubheadline)

            TextField("Description", text: $description, axis: .vertical)
                .lineLimit(3...6)
        }
    }

    private var prioritySection: some View {
        Section("Priority") {
            Picker("Priority", selection: $priority) {
                ForEach(TaskPriority.allCases) { p in
                    HStack {
                        PriorityIndicator(priority: p.rawValue)
                        Text(p.displayName)
                    }
                    .tag(p)
                }
            }
            .pickerStyle(.inline)
            .labelsHidden()
        }
    }

    @ViewBuilder
    private var dueDateSection: some View {
        Section("Due Date") {
            Toggle("Set Due Date", isOn: $hasDueDate)
            if hasDueDate {
                DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)
            }
        }
    }

    private var tagsSection: some View {
        Section("Tags") {
            TextField("Tags (comma separated)", text: $tags)
                .textInputAutocapitalization(.never)
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Task { await createTask() }
            } label: {
                if isSaving {
                    ProgressView()
                } else {
                    Text("Create")
                        .fontWeight(.semibold)
                }
            }
            .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
        }
    }

    private var navigationContent: some View {
        mainContent
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
    }

    private func createTask() async {
        guard let taskService else { return }
        isSaving = true
        error = nil

        let request = CreateTaskRequest(
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description,
            priority: priority.rawValue,
            dueDate: hasDueDate ? dueDate : nil,
            tags: tags.isEmpty ? nil : tags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        )

        do {
            let task = try await taskService.createTask(request)
            onCreated?(task)
            dismiss()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isSaving = false
    }
}
