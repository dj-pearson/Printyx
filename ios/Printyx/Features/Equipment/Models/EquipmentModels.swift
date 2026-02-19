import Foundation

// MARK: - Equipment

struct Equipment: Identifiable, Codable, Equatable {
    let id: String
    let tenantId: String?

    var name: String?
    var manufacturer: String?
    var model: String?
    var serialNumber: String?
    var assetTag: String?
    var type: String?               // printer, copier, mfp, scanner, plotter
    var status: String?             // active, inactive, maintenance, decommissioned

    // Customer & Location
    var customerId: String?
    var customerName: String?
    var locationId: String?
    var locationName: String?
    var floor: String?
    var department: String?

    // Details
    var installDate: Date?
    var warrantyEndDate: Date?
    var leaseEndDate: Date?
    var ipAddress: String?
    var macAddress: String?
    var firmwareVersion: String?

    // Counters
    var currentMeterBlack: Int?
    var currentMeterColor: Int?
    var monthlyVolumeBlack: Int?
    var monthlyVolumeColor: Int?

    // Contract
    var contractId: String?
    var contractNumber: String?
    var underContract: Bool?

    // Metadata
    var notes: String?
    var lastServiceDate: Date?
    var nextServiceDate: Date?
    var createdAt: Date?
    var updatedAt: Date?

    // MARK: - Computed

    var displayName: String {
        if let manufacturer, let model {
            return "\(manufacturer) \(model)"
        }
        return name ?? serialNumber ?? "Equipment"
    }

    var isWarrantyActive: Bool {
        guard let warrantyEndDate else { return false }
        return !warrantyEndDate.isPast
    }

    var needsService: Bool {
        guard let nextServiceDate else { return false }
        return nextServiceDate.isPast || nextServiceDate.isToday
    }

    var totalMonthlyVolume: Int {
        (monthlyVolumeBlack ?? 0) + (monthlyVolumeColor ?? 0)
    }

    var initials: String {
        let name = manufacturer ?? ""
        return String(name.prefix(2)).uppercased()
    }
}

// MARK: - Meter Reading

struct MeterReading: Identifiable, Codable {
    let id: String
    let equipmentId: String?
    var meterBlack: Int?
    var meterColor: Int?
    var meterTotal: Int?
    var readingDate: Date?
    var source: String?             // auto, manual, snmp
    var createdAt: Date?
}

// MARK: - DTOs

struct CreateEquipmentRequest: Encodable {
    var name: String?
    var manufacturer: String?
    var model: String?
    var serialNumber: String?
    var customerId: String?
    var type: String?
    var installDate: Date?
    var notes: String?
}

struct UpdateEquipmentRequest: Encodable {
    var name: String?
    var status: String?
    var ipAddress: String?
    var notes: String?
    var locationId: String?
}
