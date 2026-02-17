import XCTest

final class PrintyxUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLoginScreenAppears() throws {
        let app = XCUIApplication()
        app.launch()

        // Wait for login screen to load, then verify elements
        let signInButton = app.buttons["Sign In"]
        XCTAssertTrue(signInButton.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Printyx"].exists)
        XCTAssertTrue(app.staticTexts["Sign in to your account"].exists)
    }

    func testLoginRequiresCredentials() throws {
        let app = XCUIApplication()
        app.launch()

        // Wait for Sign In button to appear, then verify it's disabled when fields are empty
        let signInButton = app.buttons["Sign In"]
        XCTAssertTrue(signInButton.waitForExistence(timeout: 10))
        XCTAssertFalse(signInButton.isEnabled)
    }
}
