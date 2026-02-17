import SwiftUI

/// Form for creating a new opportunity.
struct OpportunityFormView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var companyName = ""
    @State private var contactName = ""
    @State private var contactEmail = ""
    @State private var estimatedAmount = ""
    @State private var probability = "50"
    @State private var closeDate = Date().addingTimeInterval(30 * 24 * 60 * 60) // 30 days
    @State private var salesStage: DealStage = .new
    @State private var source: LeadSource = .website
    @State private var priority = "medium"
    @State private var notes = ""
    @State private var isSaving = false
    @State private var error: String?

    var opportunityService: OpportunityService?
    var onCreated: ((Opportunity) -> Void)?

    var body: some View {
        NavigationStack {
            Form {
                if let error {
                    Section {
                        ErrorBanner(message: error, onDismiss: { self.error = nil })
                    }
                }

                Section("Company") {
                    TextField("Company Name *", text: $companyName)
                    TextField("Contact Name", text: $contactName)
                    TextField("Contact Email", text: $contactEmail)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                }

                Section("Deal") {
                    TextField("Estimated Amount", text: $estimatedAmount)
                        .keyboardType(.decimalPad)

                    HStack {
                        Text("Probability")
                        Spacer()
                        TextField("50", text: $probability)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 50)
                        Text("%")
                    }

                    DatePicker("Expected Close", selection: $closeDate, displayedComponents: .date)

                    Picker("Stage", selection: $salesStage) {
                        ForEach(DealStage.allCases) { stage in
                            Text(stage.displayName).tag(stage)
                        }
                    }

                    Picker("Source", selection: $source) {
                        ForEach(LeadSource.allCases) { s in
                            Text(s.displayName).tag(s)
                        }
                    }

                    Picker("Priority", selection: $priority) {
                        Text("Low").tag("low")
                        Text("Medium").tag("medium")
                        Text("High").tag("high")
                        Text("Urgent").tag("urgent")
                    }
                }

                Section("Notes") {
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("New Opportunity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await create() }
                    } label: {
                        if isSaving { ProgressView() }
                        else { Text("Create").fontWeight(.semibold) }
                    }
                    .disabled(companyName.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private func create() async {
        guard let opportunityService else { return }
        isSaving = true
        error = nil

        let request = CreateOpportunityRequest(
            companyName: companyName.trimmingCharacters(in: .whitespaces),
            primaryContactName: contactName.isEmpty ? nil : contactName,
            primaryContactEmail: contactEmail.isEmpty ? nil : contactEmail,
            estimatedAmount: Double(estimatedAmount),
            probability: Int(probability),
            closeDate: closeDate,
            salesStage: salesStage.rawValue,
            source: source.rawValue,
            priority: priority,
            notes: notes.isEmpty ? nil : notes
        )

        do {
            let opp = try await opportunityService.createOpportunity(request)
            onCreated?(opp)
            dismiss()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isSaving = false
    }
}
