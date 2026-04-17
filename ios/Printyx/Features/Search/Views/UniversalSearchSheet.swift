import SwiftUI

/// Tab-agnostic search sheet. Tapping a result dismisses the sheet and
/// routes through AppRouter so the hit lands on its correct tab and stack.
struct UniversalSearchSheet: View {
    @EnvironmentObject private var router: AppRouter
    @StateObject private var viewModel: GlobalSearchViewModel
    @Environment(\.dismiss) private var dismiss

    init(apiClient: APIClient) {
        _viewModel = StateObject(
            wrappedValue: GlobalSearchViewModel(
                dashboardService: DashboardService(apiClient: apiClient)
            )
        )
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SearchBar(
                    text: $viewModel.searchText,
                    placeholder: "Search customers, tickets, quotes, equipment…"
                )
                .padding(.horizontal, AppTheme.Spacing.lg)
                .padding(.vertical, AppTheme.Spacing.sm)

                contentBody
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private var contentBody: some View {
        if viewModel.isSearching && viewModel.results.isEmpty {
            LoadingView(message: "Searching…")
        } else if let error = viewModel.errorMessage, viewModel.results.isEmpty {
            ErrorView(message: error, retryAction: {
                // Re-trigger by toggling the text property.
                let t = viewModel.searchText
                viewModel.searchText = ""
                viewModel.searchText = t
            })
        } else if viewModel.results.isEmpty && !viewModel.searchText.isEmpty {
            EmptyStateView(
                icon: "magnifyingglass",
                title: "No Results",
                message: "Try a different search term."
            )
        } else if viewModel.searchText.isEmpty {
            EmptyStateView(
                icon: "sparkle.magnifyingglass",
                title: "Search Everything",
                message: "Find customers, leads, tickets, quotes, equipment, and more."
            )
        } else {
            resultsList
        }
    }

    private var resultsList: some View {
        List {
            ForEach(viewModel.results) { result in
                Button {
                    guard let route = viewModel.route(for: result) else { return }
                    dismiss()
                    // Small delay so the sheet finishes dismissing before the
                    // nav stack animates the push — otherwise on iOS 17 the
                    // push is sometimes swallowed.
                    Task { @MainActor in
                        try? await Task.sleep(nanoseconds: 120_000_000)
                        router.push(route)
                    }
                } label: {
                    HStack(spacing: AppTheme.Spacing.md) {
                        Image(systemName: result.icon)
                            .font(.system(size: 16))
                            .foregroundStyle(Color.printyxPrimary)
                            .frame(width: 28)

                        VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                            Text(result.title ?? "")
                                .font(.printyxSubheadline)
                                .foregroundStyle(Color.primary)
                                .lineLimit(1)
                            HStack(spacing: AppTheme.Spacing.sm) {
                                if let type = result.type {
                                    StatusBadge(type.capitalized, color: .printyxPrimary)
                                }
                                if let subtitle = result.subtitle {
                                    Text(subtitle)
                                        .font(.printyxSmall)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(result.title ?? "Result") — \(result.type ?? "")")
            }
        }
        .listStyle(.insetGrouped)
    }
}

/// Reusable magnifying-glass toolbar button that opens `UniversalSearchSheet`.
/// Every tab root should include one so global search is always one tap away.
struct GlobalSearchToolbarButton: ToolbarContent {
    @Binding var isPresented: Bool

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                isPresented = true
            } label: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 18, weight: .semibold))
            }
            .accessibilityLabel("Search")
        }
    }
}
