import Foundation

/// View model for viewing and editing a single business record (lead/customer).
@MainActor
final class CRMDetailViewModel: ObservableObject {

    @Published var record: BusinessRecord?
    @Published var activities: [LeadActivity] = []
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var error: String?
    @Published var successMessage: String?

    // Editable fields
    @Published var companyName = ""
    @Published var primaryContactName = ""
    @Published var primaryContactEmail = ""
    @Published var primaryContactPhone = ""
    @Published var primaryContactTitle = ""
    @Published var phone = ""
    @Published var website = ""
    @Published var industry = ""
    @Published var source = ""
    @Published var interestLevel = ""
    @Published var estimatedAmount = ""
    @Published var notes = ""
    @Published var addressLine1 = ""
    @Published var city = ""
    @Published var state = ""
    @Published var postalCode = ""
    @Published var priority = ""
    @Published var customerRating = ""
    @Published var nextFollowUpDate: Date?

    // Activity creation
    @Published var activityType = "note"
    @Published var activitySubject = ""
    @Published var activityDescription = ""

    private let crmService: CRMService
    private let recordId: String
    var isLead: Bool { record?.recordType == .lead || record?.recordType == .prospect }

    init(crmService: CRMService, recordId: String) {
        self.crmService = crmService
        self.recordId = recordId
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        error = nil

        do {
            let fetched = try await crmService.fetchCustomer(id: recordId)
            self.record = fetched
            populateFields(from: fetched)

            // Load activities for leads
            if fetched.recordType == .lead || fetched.recordType == .prospect {
                self.activities = try await crmService.fetchLeadActivities(leadId: recordId)
            }
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    private func populateFields(from record: BusinessRecord) {
        companyName = record.companyName ?? ""
        primaryContactName = record.primaryContactName ?? ""
        primaryContactEmail = record.primaryContactEmail ?? ""
        primaryContactPhone = record.primaryContactPhone ?? ""
        primaryContactTitle = record.primaryContactTitle ?? ""
        phone = record.phone ?? ""
        website = record.website ?? ""
        industry = record.industry ?? ""
        source = record.source ?? ""
        interestLevel = record.interestLevel ?? ""
        estimatedAmount = record.estimatedAmount.map { "\($0)" } ?? ""
        notes = record.notes ?? ""
        addressLine1 = record.addressLine1 ?? ""
        city = record.city ?? ""
        state = record.state ?? ""
        postalCode = record.postalCode ?? ""
        priority = record.priority ?? ""
        customerRating = record.customerRating ?? ""
        nextFollowUpDate = record.nextFollowUpDate
    }

    // MARK: - Save

    func save() async -> Bool {
        guard !companyName.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Company name is required"
            return false
        }

        isSaving = true
        error = nil

        let request = UpdateBusinessRecordRequest(
            companyName: companyName,
            primaryContactName: primaryContactName.isEmpty ? nil : primaryContactName,
            primaryContactEmail: primaryContactEmail.isEmpty ? nil : primaryContactEmail,
            primaryContactPhone: primaryContactPhone.isEmpty ? nil : primaryContactPhone,
            primaryContactTitle: primaryContactTitle.isEmpty ? nil : primaryContactTitle,
            phone: phone.isEmpty ? nil : phone,
            website: website.isEmpty ? nil : website,
            industry: industry.isEmpty ? nil : industry,
            source: source.isEmpty ? nil : source,
            interestLevel: interestLevel.isEmpty ? nil : interestLevel,
            estimatedAmount: Double(estimatedAmount),
            notes: notes.isEmpty ? nil : notes,
            addressLine1: addressLine1.isEmpty ? nil : addressLine1,
            city: city.isEmpty ? nil : city,
            state: state.isEmpty ? nil : state,
            postalCode: postalCode.isEmpty ? nil : postalCode,
            nextFollowUpDate: nextFollowUpDate,
            priority: priority.isEmpty ? nil : priority,
            customerRating: customerRating.isEmpty ? nil : customerRating
        )

        do {
            self.record = try await crmService.updateCustomer(id: recordId, request)
            successMessage = "Record updated"
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

    // MARK: - Convert Lead

    func convertToCustomer() async -> Bool {
        do {
            self.record = try await crmService.convertLead(id: recordId)
            successMessage = "Lead converted to customer"
            return true
        } catch {
            self.error = "Failed to convert lead"
            return false
        }
    }

    // MARK: - Activities

    func addActivity() async {
        guard !activitySubject.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Activity subject is required"
            return
        }

        let request = CreateActivityRequest(
            type: activityType,
            subject: activitySubject,
            description: activityDescription.isEmpty ? nil : activityDescription
        )

        do {
            let activity = try await crmService.createLeadActivity(leadId: recordId, request)
            activities.insert(activity, at: 0)
            activitySubject = ""
            activityDescription = ""
        } catch {
            self.error = "Failed to add activity"
        }
    }
}
