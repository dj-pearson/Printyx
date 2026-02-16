import SwiftUI

/// Detail and edit view for a single opportunity.
struct OpportunityDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var opportunity: Opportunity?
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var error: String?

    // Editable fields
    @State private var companyName = ""
    @State private var contactName = ""
    @State private var contactEmail = ""
    @State private var estimatedAmount = ""
    @State private var probability = ""
    @State private var closeDate = Date()
    @State private var salesStage: DealStage = .new
    @State private var source = ""
    @State private var priority = "medium"
    @State private var notes = ""

    private let opportunityService: OpportunityService
    private let opportunityId: String

    init(opportunityService: OpportunityService, opportunityId: String) {
        self.opportunityService = opportunityService
        self.opportunityId = opportunityId
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    LoadingView()
                } else if let error, opportunity == nil {
                    ErrorView(message: error) { await load() }
                } else {
                    content
                }
            }
            .navigationTitle("Opportunity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving { ProgressView() }
                        else { Text("Save").fontWeight(.semibold) }
                    }
                    .disabled(isSaving)
                }
            }
            .task { await load() }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.xl) {
                if let error {
                    ErrorBanner(message: error, onDismiss: { self.error = nil })
                        .padding(.horizontal)
                }

                // Stage selector
                stageSelector

                // Info fields
                VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
                    Text("Details")
                        .font(.printyxHeadline)
                        .padding(.horizontal)

                    VStack(spacing: AppTheme.Spacing.sm) {
                        TextField("Company Name *", text: $companyName)
                            .textFieldStyle(.roundedBorder)
                        TextField("Contact Name", text: $contactName)
                            .textFieldStyle(.roundedBorder)
                        TextField("Contact Email", text: $contactEmail)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                    }
                    .padding(.horizontal)
                }

                // Deal info
                VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
                    Text("Deal Info")
                        .font(.printyxHeadline)
                        .padding(.horizontal)

                    VStack(spacing: AppTheme.Spacing.sm) {
                        HStack {
                            Text("Amount")
                                .font(.printyxBody)
                            Spacer()
                            TextField("$0", text: $estimatedAmount)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 120)
                                .textFieldStyle(.roundedBorder)
                        }

                        HStack {
                            Text("Probability")
                                .font(.printyxBody)
                            Spacer()
                            TextField("50", text: $probability)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 60)
                                .textFieldStyle(.roundedBorder)
                            Text("%")
                                .font(.printyxBody)
                                .foregroundStyle(.secondary)
                        }

                        DatePicker("Close Date", selection: $closeDate, displayedComponents: .date)

                        Picker("Priority", selection: $priority) {
                            Text("Low").tag("low")
                            Text("Medium").tag("medium")
                            Text("High").tag("high")
                            Text("Urgent").tag("urgent")
                        }

                        Picker("Source", selection: $source) {
                            Text("Select...").tag("")
                            ForEach(LeadSource.allCases) { s in
                                Text(s.displayName).tag(s.rawValue)
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // Notes
                VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
                    Text("Notes")
                        .font(.printyxHeadline)
                        .padding(.horizontal)

                    TextField("Notes", text: $notes, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...8)
                        .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
    }

    // MARK: - Stage Selector

    private var stageSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppTheme.Spacing.sm) {
                ForEach(DealStage.allCases) { stage in
                    Button {
                        salesStage = stage
                    } label: {
                        VStack(spacing: 2) {
                            Circle()
                                .fill(Color(hex: stage.color))
                                .frame(width: salesStage == stage ? 12 : 8, height: salesStage == stage ? 12 : 8)
                            Text(stage.displayName)
                                .font(.system(size: 10, weight: salesStage == stage ? .bold : .regular))
                        }
                        .padding(.horizontal, AppTheme.Spacing.sm)
                        .padding(.vertical, AppTheme.Spacing.sm)
                        .background(salesStage == stage ? Color(hex: stage.color).opacity(0.12) : .clear)
                        .cornerRadius(AppTheme.Radius.sm)
                    }
                    .foregroundStyle(salesStage == stage ? Color(hex: stage.color) : .secondary)
                }
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Data Operations

    private func load() async {
        isLoading = true
        do {
            let opp = try await opportunityService.fetchOpportunity(id: opportunityId)
            self.opportunity = opp
            companyName = opp.companyName ?? ""
            contactName = opp.primaryContactName ?? ""
            contactEmail = opp.primaryContactEmail ?? ""
            estimatedAmount = opp.estimatedAmount.map { "\($0)" } ?? ""
            probability = opp.probability.map { "\($0)" } ?? "50"
            closeDate = opp.closeDate ?? Date()
            salesStage = DealStage(rawValue: opp.salesStage ?? "new") ?? .new
            source = opp.source ?? ""
            priority = opp.priority ?? "medium"
            notes = opp.notes ?? ""
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func save() async {
        guard !companyName.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Company name is required"
            return
        }
        isSaving = true

        let request = UpdateOpportunityRequest(
            companyName: companyName,
            primaryContactName: contactName.isEmpty ? nil : contactName,
            primaryContactEmail: contactEmail.isEmpty ? nil : contactEmail,
            estimatedAmount: Double(estimatedAmount),
            probability: Int(probability),
            closeDate: closeDate,
            salesStage: salesStage.rawValue,
            source: source.isEmpty ? nil : source,
            priority: priority,
            notes: notes.isEmpty ? nil : notes
        )

        do {
            self.opportunity = try await opportunityService.updateOpportunity(id: opportunityId, request)
            dismiss()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isSaving = false
    }
}
