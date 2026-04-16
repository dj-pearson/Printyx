import SwiftUI

/// Detailed view of a single CRM record with editing, activities, and actions.
struct CRMDetailView: View {
    @EnvironmentObject private var apiClient: APIClient
    @StateObject private var viewModel: CRMDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showingActivityForm = false
    @State private var showingConvertConfirm = false

    init(crmService: CRMService, recordId: String) {
        _viewModel = StateObject(wrappedValue: CRMDetailViewModel(crmService: crmService, recordId: recordId))
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    LoadingView()
                } else if let error = viewModel.error, viewModel.record == nil {
                    ErrorView(message: error, retryAction: { await viewModel.load() })
                } else {
                    recordContent
                }
            }
            .navigationTitle(viewModel.record?.displayName ?? "Record")
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
                if let record = viewModel.record {
                    LastViewedRecordStore.shared.record(
                        id: record.id,
                        kind: quickLogKind(for: record.recordType),
                        displayName: record.displayName
                    )
                }
            }
            .alert("Convert to Customer?", isPresented: $showingConvertConfirm) {
                Button("Convert", role: .none) {
                    Task {
                        if await viewModel.convertToCustomer() {
                            dismiss()
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will convert this lead into a customer. All history will be preserved.")
            }
        }
    }

    private var recordContent: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.xl) {
                // Error banner
                if let error = viewModel.error {
                    ErrorBanner(message: error, onDismiss: { viewModel.error = nil })
                        .padding(.horizontal)
                }

                // Header card
                headerCard

                // Quick actions
                if viewModel.isLead {
                    quickActions
                }

                // Customer 360 — only shown for existing records we can actually
                // attach related entities to.
                if let record = viewModel.record {
                    Customer360Section(
                        customerId: record.id,
                        apiClient: apiClient
                    )
                    .padding(.horizontal)
                }

                // Company Info
                companySection

                // Contact Info
                contactSection

                // Sales Info
                if viewModel.isLead {
                    salesSection
                }

                // Address
                addressSection

                // Notes
                notesSection

                // Activities (leads only)
                if viewModel.isLead {
                    activitiesSection
                }
            }
            .padding(.vertical, AppTheme.Spacing.lg)
        }
    }

    // MARK: - Header Card

    private var headerCard: some View {
        VStack(spacing: AppTheme.Spacing.md) {
            AvatarView(
                initials: viewModel.record?.initials ?? "??",
                size: 64,
                backgroundColor: .printyxPrimary
            )

            VStack(spacing: AppTheme.Spacing.xs) {
                Text(viewModel.companyName)
                    .font(.printyxHeadline)

                if let record = viewModel.record {
                    HStack(spacing: AppTheme.Spacing.sm) {
                        StatusBadge.recordType(record.recordType.rawValue)
                        if !viewModel.interestLevel.isEmpty {
                            StatusBadge.interest(viewModel.interestLevel)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .cardStyle()
        .padding(.horizontal)
    }

    // MARK: - Quick Actions

    private var quickActions: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            if let phone = viewModel.record?.primaryContactPhone, !phone.isEmpty {
                quickActionButton(icon: "phone.fill", label: "Call", color: .green) {
                    if let url = URL(string: "tel:\(phone)") {
                        UIApplication.shared.open(url)
                    }
                }
            }

            if let email = viewModel.record?.primaryContactEmail, !email.isEmpty {
                quickActionButton(icon: "envelope.fill", label: "Email", color: .blue) {
                    if let url = URL(string: "mailto:\(email)") {
                        UIApplication.shared.open(url)
                    }
                }
            }

            quickActionButton(icon: "arrow.right.circle.fill", label: "Convert", color: .green) {
                showingConvertConfirm = true
            }

            quickActionButton(icon: "note.text.badge.plus", label: "Activity", color: .orange) {
                showingActivityForm = true
            }
        }
        .padding(.horizontal)
    }

    private func quickActionButton(icon: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundStyle(color)
                Text(label)
                    .font(.printyxSmall)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppTheme.Spacing.md)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(AppTheme.Radius.md)
        }
    }

    // MARK: - Sections

    private var companySection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Company")
                .font(.printyxHeadline)
                .padding(.horizontal)

            VStack(spacing: AppTheme.Spacing.sm) {
                TextField("Company Name *", text: $viewModel.companyName)
                    .textFieldStyle(.roundedBorder)
                TextField("Website", text: $viewModel.website)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                TextField("Industry", text: $viewModel.industry)
                    .textFieldStyle(.roundedBorder)
                TextField("Phone", text: $viewModel.phone)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.phonePad)
            }
            .padding(.horizontal)
        }
    }

    private var contactSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Primary Contact")
                .font(.printyxHeadline)
                .padding(.horizontal)

            VStack(spacing: AppTheme.Spacing.sm) {
                TextField("Contact Name", text: $viewModel.primaryContactName)
                    .textFieldStyle(.roundedBorder)
                TextField("Title", text: $viewModel.primaryContactTitle)
                    .textFieldStyle(.roundedBorder)
                TextField("Email", text: $viewModel.primaryContactEmail)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                TextField("Phone", text: $viewModel.primaryContactPhone)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.phonePad)
            }
            .padding(.horizontal)
        }
    }

    private var salesSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Sales")
                .font(.printyxHeadline)
                .padding(.horizontal)

            VStack(spacing: AppTheme.Spacing.sm) {
                Picker("Source", selection: $viewModel.source) {
                    Text("Select...").tag("")
                    ForEach(LeadSource.allCases) { source in
                        Text(source.displayName).tag(source.rawValue)
                    }
                }

                Picker("Interest", selection: $viewModel.interestLevel) {
                    Text("Select...").tag("")
                    Text("Hot").tag("hot")
                    Text("Warm").tag("warm")
                    Text("Cold").tag("cold")
                }

                Picker("Rating", selection: $viewModel.customerRating) {
                    Text("Select...").tag("")
                    Text("Hot").tag("Hot")
                    Text("Warm").tag("Warm")
                    Text("Cold").tag("Cold")
                }

                TextField("Estimated Amount", text: $viewModel.estimatedAmount)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.decimalPad)

                HStack {
                    Text("Follow Up")
                        .font(.printyxBody)
                    Spacer()
                    DatePicker("", selection: Binding(
                        get: { viewModel.nextFollowUpDate ?? Date() },
                        set: { viewModel.nextFollowUpDate = $0 }
                    ), displayedComponents: .date)
                    .labelsHidden()
                }
            }
            .padding(.horizontal)
        }
    }

    private var addressSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Address")
                .font(.printyxHeadline)
                .padding(.horizontal)

            VStack(spacing: AppTheme.Spacing.sm) {
                TextField("Address", text: $viewModel.addressLine1)
                    .textFieldStyle(.roundedBorder)
                HStack(spacing: AppTheme.Spacing.sm) {
                    TextField("City", text: $viewModel.city)
                        .textFieldStyle(.roundedBorder)
                    TextField("State", text: $viewModel.state)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 80)
                    TextField("ZIP", text: $viewModel.postalCode)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.numberPad)
                        .frame(width: 80)
                }
            }
            .padding(.horizontal)
        }
    }

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            Text("Notes")
                .font(.printyxHeadline)
                .padding(.horizontal)

            TextField("Notes", text: $viewModel.notes, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(3...8)
                .padding(.horizontal)
        }
    }

    private var activitiesSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
            HStack {
                Text("Activities")
                    .font(.printyxHeadline)
                Spacer()
                Button {
                    showingActivityForm.toggle()
                } label: {
                    Image(systemName: "plus.circle")
                        .foregroundStyle(Color.printyxPrimary)
                }
            }
            .padding(.horizontal)

            if showingActivityForm {
                VStack(spacing: AppTheme.Spacing.sm) {
                    Picker("Type", selection: $viewModel.activityType) {
                        Text("Note").tag("note")
                        Text("Call").tag("call")
                        Text("Email").tag("email")
                        Text("Meeting").tag("meeting")
                    }
                    .pickerStyle(.segmented)

                    TextField("Subject", text: $viewModel.activitySubject)
                        .textFieldStyle(.roundedBorder)

                    TextField("Description", text: $viewModel.activityDescription, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(2...4)

                    Button {
                        Task { await viewModel.addActivity() }
                    } label: {
                        Text("Add Activity")
                            .font(.printyxSubheadline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, AppTheme.Spacing.md)
                            .background(Color.printyxPrimary)
                            .cornerRadius(AppTheme.Radius.md)
                    }
                }
                .padding(.horizontal)
            }

            // Activity Timeline
            ForEach(viewModel.activities) { activity in
                HStack(alignment: .top, spacing: AppTheme.Spacing.md) {
                    Image(systemName: activity.icon)
                        .font(.system(size: 16))
                        .foregroundStyle(Color.printyxPrimary)
                        .frame(width: 24)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(activity.subject ?? "Activity")
                            .font(.printyxSubheadline)
                        if let desc = activity.description {
                            Text(desc)
                                .font(.printyxCaption)
                                .foregroundStyle(.secondary)
                        }
                        if let date = activity.activityDate ?? activity.createdAt {
                            Text(date.relativeDescription)
                                .font(.printyxSmall)
                                .foregroundStyle(.tertiary)
                        }
                    }

                    Spacer()
                }
                .padding(.horizontal)
            }
        }
    }
}

// MARK: - Quick-log helpers

private func quickLogKind(for recordType: RecordType) -> QuickLogRecordKind {
    switch recordType {
    case .lead: .lead
    case .prospect: .prospect
    case .customer, .formerCustomer: .customer
    }
}
