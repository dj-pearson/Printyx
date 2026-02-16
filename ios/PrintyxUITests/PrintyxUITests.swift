import XCTest

final class PrintyxUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLoginScreenAppears() throws {
        let app = XCUIApplication()
        app.launch()

        // Verify login screen elements are present
        XCTAssertTrue(app.staticTexts["Printyx"].exists)
        XCTAssertTrue(app.staticTexts["Sign in to your account"].exists)
        XCTAssertTrue(app.buttons["Sign In"].exists)
    }

    func testLoginRequiresCredentials() throws {
        let app = XCUIApplication()
        app.launch()

        // Sign In button should be disabled when fields are empty
        let signInButton = app.buttons["Sign In"]
        XCTAssertFalse(signInButton.isEnabled)
    }
}
