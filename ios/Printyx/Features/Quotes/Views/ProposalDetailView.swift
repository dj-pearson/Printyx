import SwiftUI

/// Detail and edit view for a single proposal.
struct ProposalDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var proposal: Proposal?
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var error: String?

    @State private var title = ""
    @State private var totalAmount = ""
    @State private var validUntil = Date().addingTimeInterval(30 * 24 * 60 * 60)
    @State private var notes = ""
    @State private var terms = ""

    private let quoteService: QuoteService
    private let proposalId: String

    init(quoteService: QuoteService, proposalId: String) {
        self.quoteService = quoteService
        self.proposalId = proposalId
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    LoadingView()
                } else if let error, proposal == nil {
                    ErrorView(message: error) { await load() }
                } else {
                    content
                }
            }
            .navigationTitle("Proposal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            Task { await save() }
                        } label: {
                            Label("Save", systemImage: "square.and.arrow.down")
                        }
                        if proposal?.status == .draft {
                            Button {
                                Task { await send() }
                            } label: {
                                Label("Send to Customer", systemImage: "paperplane")
                            }
                        }
                        if proposal?.status == .sent {
                            Button {
                                Task { await markAccepted() }
                            } label: {
                                Label("Mark Accepted", systemImage: "checkmark.seal")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .task { await load() }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.xl) {
                if let error {
                    ErrorBanner(message: error, onDismiss: { self.error = nil })
                        .padding(.horizontal)
                }

                // Status header
                if let status = proposal?.status {
                    HStack(spacing: AppTheme.Spacing.md) {
                        Image(systemName: status.icon)
                            .font(.system(size: 24))
                        Text(status.displayName)
                            .font(.printyxHeadline)
                        Spacer()
                        if let amount = proposal?.totalAmount, amount > 0 {
                            Text(formatCurrency(amount))
                                .font(.printyxTitle)
                                .foregroundStyle(Color.printyxPrimary)
                        }
                    }
                    .padding()
                    .cardStyle()
                    .padding(.horizontal)
                }

                // Fields
                VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
                    Text("Details")
                        .font(.printyxHeadline)
                        .padding(.horizontal)

                    VStack(spacing: AppTheme.Spacing.sm) {
                        TextField("Proposal Title *", text: $title)
                            .textFieldStyle(.roundedBorder)

                        HStack {
                            Text("Amount")
                                .font(.printyxBody)
                            Spacer()
                            TextField("$0", text: $totalAmount)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 120)
                                .textFieldStyle(.roundedBorder)
                        }

                        DatePicker("Valid Until", selection: $validUntil, displayedComponents: .date)
                    }
                    .padding(.horizontal)
                }

                VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
                    Text("Terms & Conditions")
                        .font(.printyxHeadline)
                        .padding(.horizontal)

                    TextField("Terms", text: $terms, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...8)
                        .padding(.horizontal)
                }

                VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
                    Text("Notes")
                        .font(.printyxHeadline)
                        .padding(.horizontal)

                    TextField("Internal notes", text: $notes, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...6)
                        .padding(.horizontal)
                }

                // Timeline
                if let proposal {
                    VStack(alignment: .leading, spacing: AppTheme.Spacing.md) {
                        Text("Timeline")
                            .font(.printyxHeadline)
                            .padding(.horizontal)

                        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
                            if let created = proposal.createdAt {
                                timelineItem(icon: "plus.circle", label: "Created", date: created)
                            }
                            if let sent = proposal.sentDate {
                                timelineItem(icon: "paperplane", label: "Sent", date: sent)
                            }
                            if let accepted = proposal.acceptedDate {
                                timelineItem(icon: "checkmark.seal", label: "Accepted", date: accepted)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
    }

    private func timelineItem(icon: String, label: String, date: Date) -> some View {
        HStack(spacing: AppTheme.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Color.printyxPrimary)
                .frame(width: 20)
            Text(label)
                .font(.printyxCaption)
            Spacer()
            Text(date.fullFormatted)
                .font(.printyxSmall)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Actions

    private func load() async {
        isLoading = true
        do {
            let p = try await quoteService.fetchProposal(id: proposalId)
            self.proposal = p
            title = p.title ?? ""
            totalAmount = p.totalAmount.map { "\($0)" } ?? ""
            validUntil = p.validUntil ?? Date().addingTimeInterval(30 * 24 * 60 * 60)
            notes = p.notes ?? ""
            terms = p.terms ?? ""
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func save() async {
        guard !title.trimmingCharacters(in: .whitespaces).isEmpty else {
            error = "Title is required"
            return
        }
        isSaving = true

        let request = UpdateProposalRequest(
            title: title,
            totalAmount: Double(totalAmount),
            validUntil: validUntil,
            notes: notes.isEmpty ? nil : notes,
            terms: terms.isEmpty ? nil : terms
        )

        do {
            self.proposal = try await quoteService.updateProposal(id: proposalId, request)
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isSaving = false
    }

    private func send() async {
        do {
            try await quoteService.sendProposal(id: proposalId)
            proposal?.status = .sent
            proposal?.sentDate = Date()
        } catch {
            self.error = "Failed to send proposal"
        }
    }

    private func markAccepted() async {
        do {
            self.proposal = try await quoteService.updateProposalStatus(id: proposalId, status: "accepted")
        } catch {
            self.error = "Failed to update status"
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value))"
    }
}
