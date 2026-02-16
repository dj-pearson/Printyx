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

    enum Shadow {
        static func small(_ color: Color = .black.opacity(0.06)) -> some View {
            EmptyView()
        }
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

extension Font {
    static let printyxTitle = Font.system(size: 28, weight: .bold, design: .rounded)
    static let printyxHeadline = Font.system(size: 20, weight: .semibold, design: .rounded)
    static let printyxSubheadline = Font.system(size: 16, weight: .medium)
    static let printyxBody = Font.system(size: 15, weight: .regular)
    static let printyxCaption = Font.system(size: 13, weight: .regular)
    static let printyxSmall = Font.system(size: 11, weight: .medium)
}
