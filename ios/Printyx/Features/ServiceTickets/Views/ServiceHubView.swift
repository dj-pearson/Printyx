import SwiftUI

/// Service hub tab combining Service Tickets and Equipment with a segmented selector.
struct ServiceHubView: View {
    let ticketService: ServiceTicketService
    let equipmentService: EquipmentService
    @State private var selectedSegment: ServiceSegment = .tickets

    enum ServiceSegment: String, CaseIterable, Identifiable {
        case tickets = "Tickets"
        case equipment = "Equipment"

        var id: String { rawValue }
    }

    var body: some View {
        switch selectedSegment {
        case .tickets:
            ServiceTicketListView(ticketService: ticketService)
                .toolbar {
                    ToolbarItem(placement: .principal) {
                        Picker("Section", selection: $selectedSegment) {
                            ForEach(ServiceSegment.allCases) { segment in
                                Text(segment.rawValue).tag(segment)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 200)
                    }
                }
        case .equipment:
            EquipmentListView(equipmentService: equipmentService)
                .toolbar {
                    ToolbarItem(placement: .principal) {
                        Picker("Section", selection: $selectedSegment) {
                            ForEach(ServiceSegment.allCases) { segment in
                                Text(segment.rawValue).tag(segment)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 200)
                    }
                }
        }
    }
}
