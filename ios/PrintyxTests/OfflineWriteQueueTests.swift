import XCTest
@testable import Printyx

@MainActor
final class OfflineWriteQueueTests: XCTestCase {

    func testEnqueueIncrementsPendingCount() async throws {
        let queue = OfflineWriteQueue.shared
        // Drain anything a previous test left behind.
        queue.configure { _ in /* no-op */ }
        await queue.flush()
        let before = queue.pendingCount

        let write = QueuedWrite(
            id: UUID(),
            method: "POST",
            path: "/api/leads/abc/activities",
            bodyJSON: Data("{}".utf8),
            tenantId: "t",
            createdAt: Date(),
            attempts: 0,
            lastError: nil
        )
        queue.enqueue(write)

        XCTAssertEqual(queue.pendingCount, before + 1)
    }

    func testSuccessfulReplayClearsQueue() async throws {
        let queue = OfflineWriteQueue.shared
        await queue.flush() // start clean

        queue.configure { _ in
            // Simulate a successful server response — do nothing, no throw.
        }

        queue.enqueue(QueuedWrite(
            id: UUID(),
            method: "POST",
            path: "/api/tasks",
            bodyJSON: nil,
            tenantId: "t",
            createdAt: Date(),
            attempts: 0,
            lastError: nil
        ))
        XCTAssertGreaterThan(queue.pendingCount, 0)

        await queue.flush()
        XCTAssertEqual(queue.pendingCount, 0)
    }

    func testFailedReplayIncrementsAttempts() async throws {
        let queue = OfflineWriteQueue.shared
        await queue.flush()

        queue.configure { _ in
            throw APIError.networkError(URLError(.notConnectedToInternet))
        }

        queue.enqueue(QueuedWrite(
            id: UUID(),
            method: "POST",
            path: "/api/tasks",
            bodyJSON: nil,
            tenantId: "t",
            createdAt: Date(),
            attempts: 0,
            lastError: nil
        ))

        await queue.flush()
        // Item stays until it hits 5 failed attempts.
        XCTAssertEqual(queue.pendingCount, 1)
    }
}
