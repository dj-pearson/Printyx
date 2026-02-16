import SwiftUI

/// A single CRM record row.
struct CRMRowView: View {
    let record: BusinessRecord

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            // Avatar
            AvatarView(
                initials: record.initials,
                size: 44,
                backgroundColor: avatarColor
            )

            // Content
            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                // Company name
                Text(record.displayName)
                    .font(.printyxSubheadline)
                    .lineLimit(1)

                // Contact info
                if let contact = record.primaryContactName {
                    Text(contact)
                        .font(.printyxCaption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                // Meta row
                HStack(spacing: AppTheme.Spacing.sm) {
                    StatusBadge.recordType(record.recordType.rawValue)

                    if let interest = record.interestLevel, !interest.isEmpty {
                        StatusBadge.interest(interest)
                    }

                    if let score = record.leadScore, score > 0 {
                        HStack(spacing: 2) {
                            Image(systemName: "star.fill")
                                .font(.system(size: 9))
                            Text("\(score)")
                                .font(.printyxSmall)
                        }
                        .foregroundStyle(.orange)
                    }
                }
            }

            Spacer()

            // Right side info
            VStack(alignment: .trailing, spacing: AppTheme.Spacing.xs) {
                if let amount = record.estimatedAmount, amount > 0 {
                    Text(formatCurrency(amount))
                        .font(.printyxCaption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.printyxPrimary)
                }

                if let date = record.nextFollowUpDate {
                    HStack(spacing: 2) {
                        Image(systemName: "bell")
                            .font(.system(size: 10))
                        Text(date.shortFormatted)
                            .font(.printyxSmall)
                    }
                    .foregroundStyle(date.isPast ? .red : .secondary)
                } else if let updated = record.updatedAt {
                    Text(updated.relativeDescription)
                        .font(.printyxSmall)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }

    private var avatarColor: Color {
        switch record.recordType {
        case .lead: .stageNew
        case .prospect: .stageQualified
        case .customer: .stageClosedWon
        case .formerCustomer: .statusCancelled
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
