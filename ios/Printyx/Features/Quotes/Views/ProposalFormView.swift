import SwiftUI

/// Form for creating a new proposal.
struct ProposalFormView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var totalAmount = ""
    @State private var validUntil = Date().addingTimeInterval(30 * 24 * 60 * 60)
    @State private var notes = ""
    @State private var terms = ""
    @State private var isSaving = false
    @State private var error: String?

    var quoteService: QuoteService?
    var onCreated: ((Proposal) -> Void)?

    var body: some View {
        NavigationStack {
            Form {
                if let error {
                    Section {
                        ErrorBanner(message: error, onDismiss: { self.error = nil })
                    }
                }

                Section("Proposal") {
                    TextField("Title *", text: $title)
                    TextField("Total Amount", text: $totalAmount)
                        .keyboardType(.decimalPad)
                    DatePicker("Valid Until", selection: $validUntil, displayedComponents: .date)
                }

                Section("Terms") {
                    TextField("Terms & Conditions", text: $terms, axis: .vertical)
                        .lineLimit(3...8)
                }

                Section("Notes") {
                    TextField("Internal notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("New Proposal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await create() }
                    } label: {
                        if isSaving { ProgressView() }
                        else { Text("Create").fontWeight(.semibold) }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private func create() async {
        guard let quoteService else { return }
        isSaving = true
        error = nil

        let request = CreateProposalRequest(
            title: title.trimmingCharacters(in: .whitespaces),
            totalAmount: Double(totalAmount),
            validUntil: validUntil,
            notes: notes.isEmpty ? nil : notes,
            terms: terms.isEmpty ? nil : terms
        )

        do {
            let proposal = try await quoteService.createProposal(request)
            onCreated?(proposal)
            dismiss()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isSaving = false
    }
}

/// Form for creating a new quote.
struct QuoteFormView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var totalAmount = ""
    @State private var validUntil = Date().addingTimeInterval(30 * 24 * 60 * 60)
    @State private var notes = ""
    @State private var terms = ""
    @State private var lineItems: [EditableLineItem] = [EditableLineItem()]
    @State private var isSaving = false
    @State private var error: String?

    struct EditableLineItem: Identifiable {
        let id = UUID()
        var description = ""
        var quantity = "1"
        var unitPrice = ""
    }

    var quoteService: QuoteService?
    var onCreated: ((Quote) -> Void)?

    var body: some View {
        NavigationStack {
            Form {
                if let error {
                    Section {
                        ErrorBanner(message: error, onDismiss: { self.error = nil })
                    }
                }

                Section("Quote") {
                    TextField("Title *", text: $title)
                    DatePicker("Valid Until", selection: $validUntil, displayedComponents: .date)
                }

                Section("Line Items") {
                    ForEach($lineItems) { $item in
                        VStack(spacing: AppTheme.Spacing.sm) {
                            TextField("Description", text: $item.description)
                            HStack {
                                TextField("Qty", text: $item.quantity)
                                    .keyboardType(.numberPad)
                                    .frame(width: 60)
                                TextField("Unit Price", text: $item.unitPrice)
                                    .keyboardType(.decimalPad)
                                Spacer()
                                let total = (Double(item.quantity) ?? 0) * (Double(item.unitPrice) ?? 0)
                                Text("$\(Int(total))")
                                    .font(.printyxCaption)
                                    .fontWeight(.bold)
                            }
                        }
                    }
                    .onDelete { offsets in
                        lineItems.remove(atOffsets: offsets)
                    }

                    Button {
                        lineItems.append(EditableLineItem())
                    } label: {
                        Label("Add Line Item", systemImage: "plus.circle")
                    }

                    HStack {
                        Text("Total")
                            .font(.printyxSubheadline)
                        Spacer()
                        Text("$\(calculatedTotal)")
                            .font(.printyxHeadline)
                            .foregroundStyle(Color.printyxPrimary)
                    }
                }

                Section("Terms") {
                    TextField("Terms", text: $terms, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("Notes") {
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("New Quote")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await create() }
                    } label: {
                        if isSaving { ProgressView() }
                        else { Text("Create").fontWeight(.semibold) }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private var calculatedTotal: Int {
        lineItems.reduce(0) { sum, item in
            sum + Int((Double(item.quantity) ?? 0) * (Double(item.unitPrice) ?? 0))
        }
    }

    private func create() async {
        guard let quoteService else { return }
        isSaving = true
        error = nil

        let items = lineItems.compactMap { item -> CreateLineItemRequest? in
            guard !item.description.isEmpty, let qty = Int(item.quantity), let price = Double(item.unitPrice) else { return nil }
            return CreateLineItemRequest(description: item.description, quantity: qty, unitPrice: price)
        }

        let request = CreateQuoteRequest(
            title: title.trimmingCharacters(in: .whitespaces),
            totalAmount: Double(calculatedTotal),
            validUntil: validUntil,
            terms: terms.isEmpty ? nil : terms,
            notes: notes.isEmpty ? nil : notes,
            lineItems: items.isEmpty ? nil : items
        )

        do {
            let quote = try await quoteService.createQuote(request)
            onCreated?(quote)
            dismiss()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
        isSaving = false
    }
}
