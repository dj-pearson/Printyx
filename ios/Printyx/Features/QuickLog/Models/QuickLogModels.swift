import Foundation
import CoreLocation

/// Activity types supported by the quick-log flow.
/// Matches the backend `LeadActivity.type` values.
enum QuickLogType: String, CaseIterable, Identifiable {
    case call
    case email
    case meeting
    case note

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .call: "Call"
        case .email: "Email"
        case .meeting: "Meeting"
        case .note: "Note"
        }
    }

    var icon: String {
        switch self {
        case .call: "phone.fill"
        case .email: "envelope.fill"
        case .meeting: "person.2.fill"
        case .note: "note.text"
        }
    }

    /// Default subject applied when the rep taps the type without typing one.
    var defaultSubject: String {
        switch self {
        case .call: "Phone call"
        case .email: "Email sent"
        case .meeting: "Meeting held"
        case .note: "Note"
        }
    }
}

/// Outcome options for a logged activity (call or meeting).
enum QuickLogOutcome: String, CaseIterable, Identifiable {
    case answered
    case voicemail
    case noAnswer = "no_answer"
    case bookedDemo = "booked_demo"
    case declined
    case followUp = "follow_up"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .answered: "Answered"
        case .voicemail: "Voicemail"
        case .noAnswer: "No answer"
        case .bookedDemo: "Booked demo"
        case .declined: "Declined"
        case .followUp: "Follow up"
        }
    }
}

/// Which record type the activity is linked to. The quick-log API endpoint differs
/// for leads vs. business-records; today we only route leads through the existing
/// `createLeadActivity` endpoint and surface the others via the same route.
enum QuickLogRecordKind: String, Codable {
    case lead
    case customer
    case prospect
    case opportunity
    case ticket
}

/// Lightweight record snapshot persisted so the FAB can auto-link the next
/// logged activity to whatever the rep most recently viewed.
struct LastViewedRecord: Codable, Equatable {
    let id: String
    let kind: QuickLogRecordKind
    let displayName: String
    let viewedAt: Date
}

/// Request body sent to `/api/leads/:id/activities`. Mirrors the web payload
/// with an optional location block and an optional outcome tag.
struct QuickLogActivityRequest: Encodable {
    let type: String
    let subject: String
    var description: String?
    var activityDate: Date?
    var outcome: String?
    var latitude: Double?
    var longitude: Double?
    var horizontalAccuracyMeters: Double?

    init(
        type: QuickLogType,
        subject: String,
        description: String? = nil,
        activityDate: Date? = nil,
        outcome: QuickLogOutcome? = nil,
        location: CLLocation? = nil
    ) {
        self.type = type.rawValue
        self.subject = subject
        self.description = description
        self.activityDate = activityDate ?? Date()
        self.outcome = outcome?.rawValue
        self.latitude = location?.coordinate.latitude
        self.longitude = location?.coordinate.longitude
        self.horizontalAccuracyMeters = location?.horizontalAccuracy
    }
}
