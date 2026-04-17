import SwiftUI

/// List view for equipment/devices with search and status indicators.
struct EquipmentListView: View {
    @StateObject private var viewModel: EquipmentListViewModel
    @State private var selectedEquipment: Equipment?

    init(equipmentService: EquipmentService) {
        _viewModel = StateObject(wrappedValue: EquipmentListViewModel(equipmentService: equipmentService))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Stats
                HStack(spacing: AppTheme.Spacing.md) {
                    MetricCard(label: "Active", value: "\(viewModel.activeCount)", icon: "printer", color: .statusActive)
                    MetricCard(label: "Needs Service", value: "\(viewModel.needsServiceCount)", icon: "exclamationmark.triangle", color: .statusPending)
                    MetricCard(label: "Total", value: "\(viewModel.equipment.count)", icon: "square.grid.2x2", color: .printyxPrimary)
                }
                .padding(.horizontal, AppTheme.Spacing.lg)
                .padding(.vertical, AppTheme.Spacing.sm)

                // Search
                SearchBar(text: $viewModel.searchText, placeholder: "Search equipment...")
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.bottom, AppTheme.Spacing.sm)

                // Content
                if viewModel.isLoading && viewModel.equipment.isEmpty {
                    LoadingView(message: "Loading equipment...")
                } else if let error = viewModel.error, viewModel.equipment.isEmpty {
                    ErrorView(message: error, retryAction: { await viewModel.refresh() })
                } else if viewModel.filteredEquipment.isEmpty {
                    EmptyStateView(
                        icon: "printer",
                        title: "No Equipment",
                        message: "Equipment will appear here once added."
                    )
                } else {
                    equipmentList
                }
            }
            .navigationTitle("Equipment")
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(item: $selectedEquipment) { equip in
                EquipmentDetailView(equipment: equip)
            }
            .task {
                if viewModel.equipment.isEmpty {
                    await viewModel.loadInitial()
                }
            }
        }
    }

    private var equipmentList: some View {
        List {
            ForEach(viewModel.filteredEquipment) { equip in
                EquipmentRow(equipment: equip)
                    .contentShape(Rectangle())
                    .onTapGesture { selectedEquipment = equip }
                    .onAppear {
                        if equip.id == viewModel.filteredEquipment.last?.id {
                            Task { await viewModel.loadMore() }
                        }
                    }
            }

            if viewModel.isLoadingMore {
                InlineLoadingView()
            }
        }
        .listStyle(.insetGrouped)
    }
}

// MARK: - Equipment Row

struct EquipmentRow: View {
    let equipment: Equipment

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            AvatarView(initials: equipment.initials, size: 40, backgroundColor: statusColor)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                Text(equipment.displayName)
                    .font(.printyxSubheadline)
                    .lineLimit(1)

                HStack(spacing: AppTheme.Spacing.sm) {
                    if let serial = equipment.serialNumber {
                        Text("S/N: \(serial)")
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                    }
                    if let customer = equipment.customerName {
                        Text(customer)
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: AppTheme.Spacing.xs) {
                if equipment.underContract == true {
                    StatusBadge("Contract", color: .statusCompleted)
                }
                if equipment.needsService {
                    StatusBadge("Service Due", color: .statusOverdue)
                }
                if equipment.totalMonthlyVolume > 0 {
                    Text("\(equipment.totalMonthlyVolume) pg/mo")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }

    private var statusColor: Color {
        switch equipment.status {
        case "active": .statusActive
        case "maintenance": .statusPending
        case "inactive": .statusCancelled
        case "decommissioned": .priorityLow
        default: .printyxPrimary
        }
    }
}

// MARK: - Equipment Detail

struct EquipmentDetailView: View {
    let equipment: Equipment
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Device Info") {
                    LabeledContent("Manufacturer", value: equipment.manufacturer ?? "—")
                    LabeledContent("Model", value: equipment.model ?? "—")
                    LabeledContent("Serial Number", value: equipment.serialNumber ?? "—")
                    LabeledContent("Status", value: equipment.status?.capitalized ?? "—")
                    if let ip = equipment.ipAddress {
                        LabeledContent("IP Address", value: ip)
                    }
                }

                Section("Customer") {
                    LabeledContent("Customer", value: equipment.customerName ?? "—")
                    if let location = equipment.locationName {
                        LabeledContent("Location", value: location)
                    }
                }

                Section("Meter Readings") {
                    LabeledContent("Black & White", value: equipment.currentMeterBlack.map { "\($0)" } ?? "—")
                    LabeledContent("Color", value: equipment.currentMeterColor.map { "\($0)" } ?? "—")
                    LabeledContent("Monthly B&W", value: equipment.monthlyVolumeBlack.map { "\($0) pages" } ?? "—")
                    LabeledContent("Monthly Color", value: equipment.monthlyVolumeColor.map { "\($0) pages" } ?? "—")
                }

                Section("Service") {
                    if let lastService = equipment.lastServiceDate {
                        LabeledContent("Last Service", value: lastService.shortFormatted)
                    }
                    if let nextService = equipment.nextServiceDate {
                        LabeledContent("Next Service", value: nextService.shortFormatted)
                    }
                    if let warranty = equipment.warrantyEndDate {
                        LabeledContent("Warranty Until", value: warranty.shortFormatted)
                    }
                }
            }
            .navigationTitle(equipment.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
