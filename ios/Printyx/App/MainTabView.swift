import SwiftUI

/// Main tab bar navigation with Tasks, CRM, Opportunities, Quotes, and Settings.
struct MainTabView: View {
    let apiClient: APIClient
    @ObservedObject var authManager: AuthManager
    @State private var selectedTab = 0

    // Services (lazily initialized)
    private var taskService: TaskService { TaskService(apiClient: apiClient) }
    private var crmService: CRMService { CRMService(apiClient: apiClient) }
    private var opportunityService: OpportunityService { OpportunityService(apiClient: apiClient) }
    private var quoteService: QuoteService { QuoteService(apiClient: apiClient) }

    var body: some View {
        TabView(selection: $selectedTab) {
            // Tasks
            TaskListView(taskService: taskService)
                .tabItem {
                    Label("Tasks", systemImage: "checklist")
                }
                .tag(0)

            // CRM
            CRMListView(crmService: crmService)
                .tabItem {
                    Label("CRM", systemImage: "person.2")
                }
                .tag(1)

            // Opportunities
            OpportunityListView(opportunityService: opportunityService)
                .tabItem {
                    Label("Pipeline", systemImage: "chart.line.uptrend.xyaxis")
                }
                .tag(2)

            // Quotes & Proposals
            QuoteListView(quoteService: quoteService)
                .tabItem {
                    Label("Quotes", systemImage: "doc.text")
                }
                .tag(3)

            // Settings
            SettingsView(authManager: authManager)
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
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
