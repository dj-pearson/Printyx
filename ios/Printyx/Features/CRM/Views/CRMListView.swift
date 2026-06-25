import SwiftUI

/// Main CRM list with segmented control (All / Leads / Prospects / Customers).
struct CRMListView: View {
    @EnvironmentObject private var apiClient: APIClient
    @EnvironmentObject private var router: AppRouter
    @StateObject private var viewModel: CRMListViewModel
    @State private var showingCreateRecord = false
    @State private var showingSearch = false
    /// Record awaiting delete confirmation (IOS-033). A mis-swipe must not
    /// permanently delete a customer without an explicit confirm.
    @State private var recordPendingDelete: BusinessRecord?

    init(crmService: CRMService) {
        _viewModel = StateObject(wrappedValue: CRMListViewModel(crmService: crmService))
    }

    var body: some View {
        NavigationStack(path: router.pathBinding(for: .crm)) {
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
                GlobalSearchToolbarButton(isPresented: $showingSearch)

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCreateRecord = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.printyxPrimary)
                    }
                    .accessibilityLabel("Add record")
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
                    .accessibilityLabel("Sort")
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $showingCreateRecord) {
                CRMFormView(crmService: CRMService(apiClient: apiClient)) { _ in
                    Task { await viewModel.refresh() }
                }
            }
            .sheet(isPresented: $showingSearch) {
                UniversalSearchSheet(apiClient: apiClient)
            }
            .navigationDestination(for: AppRoute.self) { route in
                switch route {
                case .businessRecord(let id):
                    CRMDetailView(
                        crmService: CRMService(apiClient: apiClient),
                        recordId: id
                    )
                    .environmentObject(apiClient)
                default:
                    // Routes handled by other tabs shouldn't land here, but
                    // if one does we render a harmless fallback.
                    Text("Unknown route")
                }
            }
            .task {
                if viewModel.records.isEmpty {
                    await viewModel.loadInitial()
                }
            }
            .onChange(of: viewModel.selectedSegment) { _, _ in
                Task { await viewModel.refresh() }
            }
            .confirmationDialog(
                "Delete this record?",
                isPresented: Binding(
                    get: { recordPendingDelete != nil },
                    set: { if !$0 { recordPendingDelete = nil } }
                ),
                presenting: recordPendingDelete
            ) { record in
                Button("Delete", role: .destructive) {
                    Task { await viewModel.deleteRecord(record) }
                    recordPendingDelete = nil
                }
                Button("Cancel", role: .cancel) { recordPendingDelete = nil }
            } message: { record in
                Text("\(record.displayName) will be permanently deleted. This can't be undone.")
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
                            .onTapGesture { router.push(.businessRecord(id: record.id)) }
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
                        .onTapGesture { router.push(.businessRecord(id: record.id)) }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                recordPendingDelete = record
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
                        // Pagination: trigger the next page on the last row.
                        // Previously the CRM list was capped at the first page
                        // because nothing ever called loadMore().
                        .onAppear {
                            if record.id == viewModel.filteredRecords.last?.id {
                                Task { await viewModel.loadMore() }
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
