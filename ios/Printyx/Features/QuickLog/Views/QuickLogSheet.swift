import SwiftUI

/// Bottom-sheet UI for the quick-log FAB. Four big tap targets, an optional
/// "more details" expansion, and a header telling the rep which record the
/// activity will be attached to.
struct QuickLogSheet: View {
    @ObservedObject var viewModel: QuickLogViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppTheme.Spacing.lg) {
                    linkedRecordHeader
                    typeGrid
                    detailToggleButton

                    if viewModel.showDetailFields {
                        detailFields
                    }

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.printyxCaption)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                    }

                    Spacer(minLength: AppTheme.Spacing.lg)
                }
                .padding(AppTheme.Spacing.lg)
            }
            .navigationTitle("Log Activity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
            .disabled(viewModel.isSubmitting)
            .overlay {
                if viewModel.isSubmitting {
                    Color.black.opacity(0.05)
                        .ignoresSafeArea()
                    ProgressView("Logging…")
                        .padding()
                        .background(Color(.systemBackground))
                        .cornerRadius(AppTheme.Radius.md)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Sections

    private var linkedRecordHeader: some View {
        Group {
            if let record = viewModel.linkedRecord {
                HStack(spacing: AppTheme.Spacing.sm) {
                    Image(systemName: "link")
                        .foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Logging to")
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                        Text(record.displayName)
                            .font(.printyxSubheadline)
                            .lineLimit(1)
                    }
                    Spacer()
                }
                .padding(AppTheme.Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(AppTheme.Radius.md)
            } else {
                HStack(spacing: AppTheme.Spacing.sm) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Text("Open a customer or lead first, then come back to log.")
                        .font(.printyxCaption)
                        .foregroundStyle(.secondary)
                }
                .padding(AppTheme.Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.08))
                .cornerRadius(AppTheme.Radius.md)
            }
        }
    }

    private var typeGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: AppTheme.Spacing.md),
                      GridItem(.flexible(), spacing: AppTheme.Spacing.md)],
            spacing: AppTheme.Spacing.md
        ) {
            ForEach(QuickLogType.allCases) { type in
                Button {
                    Task {
                        let ok = await viewModel.quickCommit(type: type)
                        if ok {
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                            dismiss()
                        } else {
                            UINotificationFeedbackGenerator().notificationOccurred(.error)
                        }
                    }
                } label: {
                    VStack(spacing: AppTheme.Spacing.sm) {
                        Image(systemName: type.icon)
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(Color.printyxPrimary)
                            .frame(width: 56, height: 56)
                            .background(Color.printyxPrimary.opacity(0.12))
                            .clipShape(Circle())

                        Text(type.displayName)
                            .font(.printyxSubheadline)
                    }
                    .frame(maxWidth: .infinity, minHeight: 110)
                    .padding(AppTheme.Spacing.md)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(AppTheme.Radius.md)
                }
                .buttonStyle(.plain)
                .disabled(viewModel.linkedRecord == nil || viewModel.isSubmitting)
                .accessibilityLabel("Log \(type.displayName)")
                .accessibilityHint("Immediately records a \(type.displayName.lowercased()) on the current record.")
            }
        }
    }

    private var detailToggleButton: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                viewModel.showDetailFields.toggle()
            }
        } label: {
            HStack {
                Image(systemName: viewModel.showDetailFields ? "chevron.up" : "chevron.down")
                Text(viewModel.showDetailFields ? "Hide details" : "Add details (optional)")
                    .font(.printyxCaption)
            }
            .foregroundStyle(.secondary)
        }
    }

    private var detailFields: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            Text("Details")
                .font(.printyxSmall)
                .foregroundStyle(.secondary)

            TextField("Subject", text: $viewModel.subject)
                .textFieldStyle(.roundedBorder)

            TextField("Description", text: $viewModel.description, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...6)

            Picker("Outcome", selection: Binding(
                get: { viewModel.outcome },
                set: { viewModel.outcome = $0 }
            )) {
                Text("None").tag(QuickLogOutcome?.none)
                ForEach(QuickLogOutcome.allCases) { outcome in
                    Text(outcome.displayName).tag(QuickLogOutcome?.some(outcome))
                }
            }
            .pickerStyle(.menu)
        }
    }
}
