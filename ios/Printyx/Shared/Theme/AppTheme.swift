import SwiftUI

/// Centralized design tokens for the Printyx iOS app.
enum AppTheme {

    // MARK: - Spacing

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
    }

    // MARK: - Corner Radius

    enum Radius {
        static let sm: CGFloat = 6
        static let md: CGFloat = 10
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let full: CGFloat = 999
    }

    // MARK: - Shadows

    /// Shadow design tokens. Apply with `View.cardShadow()` (see ViewExtensions).
    /// Previously `Shadow.small(_:)` returned an `EmptyView()` and silently
    /// dropped the shadow at every call site — these tokens replace it.
    enum Shadow {
        static let smallColor = Color.black.opacity(0.06)
        static let smallRadius: CGFloat = 8
        static let smallX: CGFloat = 0
        static let smallY: CGFloat = 2
    }

    // MARK: - Icon Sizes

    enum IconSize {
        static let sm: CGFloat = 16
        static let md: CGFloat = 20
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
    }

    // MARK: - Touch Targets

    static let minTouchTarget: CGFloat = 44
}

// MARK: - Typography Styles
//
// Prefer `.system(TextStyle, design:)` over fixed-point sizes so custom fonts
// scale with the user's Dynamic Type setting. The fixed-size overloads remain
// available for tight HIG elements (tab bar icons, micro labels).

extension Font {
    static let printyxTitle = Font.system(.largeTitle, design: .rounded).weight(.bold)
    static let printyxHeadline = Font.system(.title3, design: .rounded).weight(.semibold)
    static let printyxSubheadline = Font.system(.headline)
    static let printyxBody = Font.system(.body)
    static let printyxCaption = Font.system(.subheadline)
    static let printyxSmall = Font.system(.footnote).weight(.medium)
}
