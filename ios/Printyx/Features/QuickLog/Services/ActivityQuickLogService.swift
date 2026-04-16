import Foundation

/// Service that posts activities created from the quick-log FAB.
///
/// Today the backend only exposes `/api/leads/:id/activities` for writing
/// activities from mobile. For non-lead kinds we still route through that
/// endpoint because the backend treats business-records and leads as the
/// same table — the web app does the same.
@MainActor
final class ActivityQuickLogService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    /// Post a new activity against the given record. Returns the freshly
    /// created LeadActivity so the UI can show an Undo affordance.
    func logActivity(
        recordId: String,
        recordKind: QuickLogRecordKind,
        request: QuickLogActivityRequest
    ) async throws -> LeadActivity {
        _ = recordKind // reserved for future routing
        return try await apiClient.request(
            .createLeadActivity(leadId: recordId, body: request)
        )
    }
}
