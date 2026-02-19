import SwiftUI

/// Sales hub tab combining Pipeline, Quotes/Proposals, and Contracts with a segmented selector.
struct SalesHubView: View {
    let opportunityService: OpportunityService
    let quoteService: QuoteService
    let contractService: ContractService
    @State private var selectedSegment: SalesSegment = .pipeline

    enum SalesSegment: String, CaseIterable, Identifiable {
        case pipeline = "Pipeline"
        case quotes = "Quotes"
        case contracts = "Contracts"

        var id: String { rawValue }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Segment control
            Picker("Section", selection: $selectedSegment) {
                ForEach(SalesSegment.allCases) { segment in
                    Text(segment.rawValue).tag(segment)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, AppTheme.Spacing.lg)
            .padding(.vertical, AppTheme.Spacing.sm)

            // Content
            switch selectedSegment {
            case .pipeline:
                OpportunityListView(opportunityService: opportunityService)
            case .quotes:
                QuoteListView(quoteService: quoteService)
            case .contracts:
                ContractListView(contractService: contractService)
            }
        }
    }
}
