import SwiftUI

/// Full-screen loading indicator.
struct LoadingView: View {
    var message: String = "Loading..."

    var body: some View {
        VStack(spacing: AppTheme.Spacing.lg) {
            ProgressView()
                .scaleEffect(1.2)
            Text(message)
                .font(.printyxCaption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Inline loading indicator for lists.
struct InlineLoadingView: View {
    var body: some View {
        HStack(spacing: AppTheme.Spacing.sm) {
            ProgressView()
            Text("Loading more...")
                .font(.printyxCaption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppTheme.Spacing.md)
    }
}

/// Skeleton loading placeholder for list rows.
struct SkeletonRow: View {
    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            RoundedRectangle(cornerRadius: AppTheme.Radius.sm)
                .fill(Color(.systemGray5))
                .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray5))
                    .frame(height: 14)
                    .frame(maxWidth: 200)

                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray6))
                    .frame(height: 12)
                    .frame(maxWidth: 140)
            }
        }
        .padding(.vertical, AppTheme.Spacing.sm)
        .shimmer()
    }
}
