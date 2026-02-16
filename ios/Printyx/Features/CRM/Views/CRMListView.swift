import SwiftUI

/// Main CRM list with segmented control (All / Leads / Prospects / Customers).
struct CRMListView: View {
    @StateObject private var viewModel: CRMListViewModel
    @State private var showingCreateRecord = false
    @State private var selectedRecord: BusinessRecord?

    init(crmService: CRMService) {
        _viewModel = StateObject(wrappedValue: CRMListViewModel(crmService: crmService))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Segment Control
                Picker("Type", selection: $viewModel.selectedSegment) {
                    ForEach(CRMListViewModel.CRMSegment.allCases) { segment in
                        Text(segment.rawValue).tag(segment)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, AppTheme.Spacing.lg)
                .padding(.vertical, AppTheme.Spacing.sm)

                // Search
                SearchBar(text: $viewModel.searchText, placeholder: "Search records...")
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.bottom, AppTheme.Spacing.sm)

                // Content
                if viewModel.isLoading && viewModel.records.isEmpty {
                    LoadingView(message: "Loading records...")
                } else if let error = viewModel.error, viewModel.records.isEmpty {
                    ErrorView(message: error, retryAction: { await viewModel.refresh() })
                } else if viewModel.filteredRecords.isEmpty {
                    EmptyStateView(
                        icon: "person.crop.circle.badge.plus",
                        title: "No Records",
                        message: viewModel.searchText.isEmpty
                            ? "Add your first lead or customer."
                            : "No records match your search.",
                        actionTitle: "Add Record",
                        action: { showingCreateRecord = true }
                    )
                } else {
                    recordsList
                }
            }
            .navigationTitle("CRM")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCreateRecord = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.printyxPrimary)
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Sort By", selection: $viewModel.sortBy) {
                            ForEach(CRMListViewModel.SortOption.allCases) { option in
                                Text(option.rawValue).tag(option)
                            }
                        }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down.circle")
                            .font(.system(size: 20))
                    }
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $showingCreateRecord) {
                CRMFormView(crmService: nil) { _ in
                    Task { await viewModel.refresh() }
                }
            }
            .sheet(item: $selectedRecord) { record in
                CRMDetailView(crmService: CRMService(apiClient: APIClient()), recordId: record.id)
            }
            .task {
                if viewModel.records.isEmpty {
                    await viewModel.loadInitial()
                }
            }
            .onChange(of: viewModel.selectedSegment) { _, _ in
                Task { await viewModel.refresh() }
            }
        }
    }

    // MARK: - Records List

    private var recordsList: some View {
        List {
            // Follow-up needed
            if !viewModel.needsFollowUp.isEmpty {
                Section {
                    ForEach(viewModel.needsFollowUp) { record in
                        CRMRowView(record: record)
                            .contentShape(Rectangle())
                            .onTapGesture { selectedRecord = record }
                    }
                } header: {
                    Label("Needs Follow Up (\(viewModel.needsFollowUp.count))", systemImage: "bell.badge")
                        .foregroundStyle(.orange)
                        .font(.printyxCaption)
                }
            }

            // All records
            Section {
                ForEach(viewModel.filteredRecords) { record in
                    CRMRowView(record: record)
                        .contentShape(Rectangle())
                        .onTapGesture { selectedRecord = record }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task { await viewModel.deleteRecord(record) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }

                            if record.recordType == .lead {
                                Button {
                                    Task { await viewModel.convertLead(record) }
                                } label: {
                                    Label("Convert", systemImage: "arrow.right.circle")
                                }
                                .tint(.green)
                            }
                        }
                }

                if viewModel.isLoadingMore {
                    InlineLoadingView()
                }
            } header: {
                Text("\(viewModel.filteredRecords.count) Records")
                    .font(.printyxCaption)
            }
        }
        .listStyle(.insetGrouped)
    }
}
