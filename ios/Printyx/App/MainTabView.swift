import SwiftUI

/// Main tab bar navigation: Home, CRM, Service, Sales, More.
struct MainTabView: View {
    let apiClient: APIClient
    @ObservedObject var authManager: AuthManager
    @State private var selectedTab = 0

    // Services (lazily initialized)
    private var dashboardService: DashboardService { DashboardService(apiClient: apiClient) }
    private var crmService: CRMService { CRMService(apiClient: apiClient) }
    private var ticketService: ServiceTicketService { ServiceTicketService(apiClient: apiClient) }
    private var equipmentService: EquipmentService { EquipmentService(apiClient: apiClient) }
    private var opportunityService: OpportunityService { OpportunityService(apiClient: apiClient) }
    private var quoteService: QuoteService { QuoteService(apiClient: apiClient) }
    private var contractService: ContractService { ContractService(apiClient: apiClient) }

    var body: some View {
        TabView(selection: $selectedTab) {
            // Home Dashboard
            HomeView(dashboardService: dashboardService, authManager: authManager)
                .tabItem {
                    Label("Home", systemImage: "house")
                }
                .tag(0)

            // CRM
            CRMListView(crmService: crmService)
                .tabItem {
                    Label("CRM", systemImage: "person.2")
                }
                .tag(1)

            // Service (Tickets + Equipment)
            ServiceHubView(ticketService: ticketService, equipmentService: equipmentService)
                .tabItem {
                    Label("Service", systemImage: "wrench.and.screwdriver")
                }
                .tag(2)

            // Sales (Pipeline + Quotes + Contracts)
            SalesHubView(
                opportunityService: opportunityService,
                quoteService: quoteService,
                contractService: contractService
            )
                .tabItem {
                    Label("Sales", systemImage: "chart.line.uptrend.xyaxis")
                }
                .tag(3)

            // More (Tasks, Invoices, Contacts, Settings)
            MoreView(apiClient: apiClient, authManager: authManager)
                .tabItem {
                    Label("More", systemImage: "ellipsis")
                }
                .tag(4)
        }
        .tint(Color.printyxPrimary)
    }
}

// MARK: - Settings View

struct SettingsView: View {
    @ObservedObject var authManager: AuthManager
    @State private var showingLogoutConfirm = false

    var body: some View {
        NavigationStack {
            List {
                // User Info
                if let user = authManager.currentUser {
                    Section {
                        HStack(spacing: AppTheme.Spacing.md) {
                            AvatarView(initials: user.initials, size: 52)

                            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                                Text(user.displayName)
                                    .font(.printyxSubheadline)
                                Text(user.email)
                                    .font(.printyxCaption)
                                    .foregroundStyle(.secondary)
                                if user.isPlatformAdmin {
                                    StatusBadge("Admin", color: .printyxPrimary)
                                }
                            }
                        }
                        .padding(.vertical, AppTheme.Spacing.sm)
                    }
                }

                // App Settings
                Section("Preferences") {
                    NavigationLink {
                        Text("Notifications") // Placeholder
                    } label: {
                        Label("Notifications", systemImage: "bell")
                    }

                    NavigationLink {
                        Text("Appearance") // Placeholder
                    } label: {
                        Label("Appearance", systemImage: "paintbrush")
                    }
                }

                // About
                Section("About") {
                    HStack {
                        Label("Version", systemImage: "info.circle")
                        Spacer()
                        Text(AppConfig.fullVersion)
                            .font(.printyxCaption)
                            .foregroundStyle(.secondary)
                    }

                    HStack {
                        Label("Environment", systemImage: "server.rack")
                        Spacer()
                        Text(AppConfig.isDebug ? "Development" : "Production")
                            .font(.printyxCaption)
                            .foregroundStyle(.secondary)
                    }
                }

                // Logout
                Section {
                    Button(role: .destructive) {
                        showingLogoutConfirm = true
                    } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Settings")
            .alert("Sign Out?", isPresented: $showingLogoutConfirm) {
                Button("Sign Out", role: .destructive) {
                    authManager.logout()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You will need to sign in again to access your data.")
            }
        }
    }
}
