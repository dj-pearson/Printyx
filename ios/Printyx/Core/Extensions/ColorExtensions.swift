import SwiftUI

extension Color {
    // MARK: - Brand Colors
    static let printyxPrimary = Color(hex: "6366F1")     // Indigo
    static let printyxSecondary = Color(hex: "8B5CF6")   // Violet
    static let printyxAccent = Color(hex: "06B6D4")      // Cyan

    // MARK: - Status Colors
    static let statusNew = Color(hex: "3B82F6")          // Blue
    static let statusActive = Color(hex: "10B981")       // Emerald
    static let statusPending = Color(hex: "F59E0B")      // Amber
    static let statusCompleted = Color(hex: "22C55E")    // Green
    static let statusCancelled = Color(hex: "6B7280")    // Gray
    static let statusOverdue = Color(hex: "EF4444")      // Red

    // MARK: - Priority Colors
    static let priorityLow = Color(hex: "6B7280")        // Gray
    static let priorityMedium = Color(hex: "3B82F6")     // Blue
    static let priorityHigh = Color(hex: "F59E0B")       // Amber
    static let priorityUrgent = Color(hex: "EF4444")     // Red

    // MARK: - CRM Stage Colors
    static let stageNew = Color(hex: "3B82F6")
    static let stageContacted = Color(hex: "8B5CF6")
    static let stageQualified = Color(hex: "06B6D4")
    static let stageProposal = Color(hex: "F59E0B")
    static let stageNegotiation = Color(hex: "F97316")
    static let stageClosedWon = Color(hex: "22C55E")
    static let stageClosedLost = Color(hex: "EF4444")

    // MARK: - Hex Initializer
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
