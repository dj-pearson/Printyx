import XCTest
@testable import Printyx

final class QuickLogTests: XCTestCase {

    func testDefaultSubjectMapping() {
        XCTAssertEqual(QuickLogType.call.defaultSubject, "Phone call")
        XCTAssertEqual(QuickLogType.email.defaultSubject, "Email sent")
        XCTAssertEqual(QuickLogType.meeting.defaultSubject, "Meeting held")
        XCTAssertEqual(QuickLogType.note.defaultSubject, "Note")
    }

    func testRequestWithoutLocationOmitsCoords() {
        let req = QuickLogActivityRequest(
            type: .call,
            subject: "test",
            description: nil,
            outcome: nil,
            location: nil
        )
        XCTAssertNil(req.latitude)
        XCTAssertNil(req.longitude)
        XCTAssertNil(req.horizontalAccuracyMeters)
        XCTAssertEqual(req.type, "call")
        XCTAssertEqual(req.subject, "test")
    }

    func testOutcomeIsOptional() {
        let req = QuickLogActivityRequest(
            type: .meeting,
            subject: "Demo",
            outcome: .bookedDemo
        )
        XCTAssertEqual(req.outcome, "booked_demo")
    }
}
