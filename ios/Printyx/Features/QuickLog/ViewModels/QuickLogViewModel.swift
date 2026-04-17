import Foundation
import CoreLocation
import SwiftUI

/// Drives the quick-log bottom sheet: type selection, optional detail expansion,
/// location capture, and the actual POST. Keeps the view logic simple so the
/// FAB → type-tap → committed-activity path stays at two taps.
@MainActor
final class QuickLogViewModel: ObservableObject {
    @Published var selectedType: QuickLogType?
    @Published var subject: String = ""
    @Published var description: String = ""
    @Published var outcome: QuickLogOutcome?
    @Published var showDetailFields: Bool = false

    @Published private(set) var isSubmitting = false
    @Published private(set) var lastLogged: LeadActivity?
    @Published var errorMessage: String?
    @Published var showingRecordPicker = false

    let store: LastViewedRecordStore
    let service: ActivityQuickLogService
    private let locationProvider: QuickLogLocationProvider

    init(
        service: ActivityQuickLogService,
        store: LastViewedRecordStore = .shared,
        locationProvider: QuickLogLocationProvider? = nil
    ) {
        self.service = service
        self.store = store
        self.locationProvider = locationProvider ?? QuickLogLocationProvider()
    }

    /// The record the activity will be linked to when the user commits.
    /// Returns nil if nothing fresh is available, at which point the UI
    /// should surface a record picker or hide the log button.
    var linkedRecord: LastViewedRecord? {
        store.fresh()
    }

    /// One-tap commit path: user tapped a type button. Immediately fire the
    /// POST with default subject + auto-captured location.
    func quickCommit(type: QuickLogType) async -> Bool {
        guard let record = linkedRecord else {
            errorMessage = "No recent record to log against. Open a customer or lead first."
            return false
        }
        selectedType = type
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        let location = await locationProvider.fetchOnce()
        let finalSubject = subject.trimmingCharacters(in: .whitespaces).isEmpty
            ? type.defaultSubject
            : subject
        let request = QuickLogActivityRequest(
            type: type,
            subject: finalSubject,
            description: description.isEmpty ? nil : description,
            activityDate: Date(),
            outcome: outcome,
            location: location
        )

        do {
            let activity = try await service.logActivity(
                recordId: record.id,
                recordKind: record.kind,
                request: request
            )
            lastLogged = activity
            resetInputs()
            return true
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription ?? "Could not log activity."
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    /// Reset transient inputs so the sheet is clean on next open.
    func resetInputs() {
        subject = ""
        description = ""
        outcome = nil
        showDetailFields = false
        selectedType = nil
    }
}
