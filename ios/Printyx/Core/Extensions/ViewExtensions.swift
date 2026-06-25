import SwiftUI

// MARK: - Conditional Modifier

extension View {
    @ViewBuilder
    func `if`<Transform: View>(_ condition: Bool, transform: (Self) -> Transform) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - Card Style

struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .cardShadow()
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardModifier())
    }

    /// Standard subtle card shadow built from `AppTheme.Shadow` tokens.
    func cardShadow() -> some View {
        shadow(
            color: AppTheme.Shadow.smallColor,
            radius: AppTheme.Shadow.smallRadius,
            x: AppTheme.Shadow.smallX,
            y: AppTheme.Shadow.smallY
        )
    }
}

// MARK: - Shimmer Loading

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [.clear, Color.white.opacity(0.4), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase)
                .onAppear {
                    withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                        phase = 300
                    }
                }
            )
            .clipped()
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - Pull to Refresh Helper

extension View {
    func onPullToRefresh(action: @escaping () async -> Void) -> some View {
        self.refreshable {
            await action()
        }
    }
}
