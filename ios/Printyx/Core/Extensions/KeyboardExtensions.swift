import SwiftUI
import UIKit

extension View {
    /// Standard keyboard handling for scrolling edit/detail forms (IOS-046):
    ///  - interactive swipe-to-dismiss of the keyboard while scrolling, and
    ///  - a "Done" button in the keyboard accessory toolbar, which is the only
    ///    way to dismiss `.decimalPad` / `.numberPad` keyboards (they have no
    ///    return key).
    ///
    /// Apply alongside the view's existing `.toolbar { ... }` — SwiftUI merges
    /// multiple toolbar modifiers, and the `.keyboard` placement does not
    /// conflict with navigation-bar items.
    func formKeyboardDismissal() -> some View {
        self
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        UIApplication.shared.sendAction(
                            #selector(UIResponder.resignFirstResponder),
                            to: nil,
                            from: nil,
                            for: nil
                        )
                    }
                }
            }
    }
}
