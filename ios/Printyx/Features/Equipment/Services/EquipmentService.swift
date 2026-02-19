import Foundation

/// Service layer for equipment and meter reading operations.
@MainActor
final class EquipmentService {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - List / Search

    func fetchEquipment(
        customerId: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 25
    ) async throws -> [Equipment] {
        try await apiClient.request(
            .equipment(customerId: customerId, search: search, page: page, limit: limit)
        )
    }

    // MARK: - CRUD

    func fetchEquipmentDetail(id: String) async throws -> Equipment {
        try await apiClient.request(.equipmentDetail(id: id))
    }

    func createEquipment(_ request: CreateEquipmentRequest) async throws -> Equipment {
        try await apiClient.request(.createEquipment(body: request))
    }

    func updateEquipment(id: String, _ request: UpdateEquipmentRequest) async throws -> Equipment {
        try await apiClient.request(.updateEquipment(id: id, body: request))
    }

    // MARK: - Meter Readings

    func fetchMeterReadings(equipmentId: String, page: Int = 1) async throws -> [MeterReading] {
        try await apiClient.request(.meterReadings(equipmentId: equipmentId, page: page))
    }
}
