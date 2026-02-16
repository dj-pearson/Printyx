import SwiftUI

/// Form for creating a new lead or customer.
struct CRMFormView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var recordType: RecordType = .lead
    @State private var companyName = ""
    @State private var contactName = ""
    @State private var contactEmail = ""
    @State private var contactPhone = ""
    @State private var contactTitle = ""
    @State private var phone = ""
    @State private var website = ""
    @State private var industry = ""
    @State private var source: LeadSource = .website
    @State private var interestLevel = "warm"
    @State private var estimatedAmount = ""
    @State private var notes = ""
    @State private var isSaving = false
    @State private var error: String?

    var crmService: CRMService?
    var onCreated: ((BusinessRecord) -> Void)?

    var body: some View {
        NavigationStack {
            Form {
                if let error {
                    Section {
                        ErrorBanner(message: error, onDismiss: { self.error = nil })
                    }
                }

                Section("Record Type") {
                    Picker("Type", selection: $recordType) {
                        Text("Lead").tag(RecordType.lead)
                        Text("Prospect").tag(RecordType.prospect)
                        Text("Customer").tag(RecordType.customer)
                    }
                    .pickerStyle(.segmented)
                }

                Section("Company") {
                    TextField("Company Name *", text: $companyName)
                    TextField("Phone", text: $phone)
                        .keyboardType(.phonePad)
                    TextField("Website", text: $website)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                    TextField("Industry", text: $industry)
                }

                Section("Primary Contact") {
                    TextField("Name", text: $contactName)
                    TextField("Title", text: $contactTitle)
                    TextField("Email", text: $contactEmail)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    TextField("Phone", text: $contactPhone)
                        .keyboardType(.phonePad)
                }

                if recordType == .lead || recordType == .prospect {
                    Section("Lead Info") {
                        Picker("Source", selection: $source) {
                            ForEach(LeadSource.allCases) { s in
                                Text(s.displayName).tag(s)
                            }
                        }

                        Picker("Interest", selection: $interestLevel) {
                            Text("Hot").tag("hot")
                            Text("Warm").tag("warm")
                            Text("Cold").tag("cold")
                        }

                        TextField("Estimated Amount", text: $estimatedAmount)
                            .keyboardType(.decimalPad)
                    }
                }

                Section("Notes") {
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("New Record")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await createRecord() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Create")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(companyName.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private func createRecord() async {
        guard let crmService else { return }
        isSaving = true
        error = nil

        let request = CreateBusinessRecordRequest(
            companyName: companyName.trimmingCharacters(in: .whitespaces),
            recordType: recordType.rawValue,
            primaryContactName: contactName.isEmpty ? nil : contactName,
            primaryContactEmail: contactEmail.isEmpty ? nil : contactEmail,
            primaryContactPhone: contactPhone.isEmpty ? nil : contactPhone,
            primaryContactTitle: contactTitle.isEmpty ? nil : contactTitle,
            phone: phone.isEmpty ? nil : phone,
            website: website.isEmpty ? nil : website,
            industry: industry.isEmpty ? nil : industry,
            source: source.rawValue,
            interestLevel: interestLevel,
            estimatedAmount: Double(estimatedAmount),
            notes: notes.isEmpty ? nil : notes
        )

        do {
            let record = try await crmService.createLead(request)
            onCreated?(record)
            dismiss()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isSaving = false
    }
}
