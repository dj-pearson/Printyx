import SwiftUI

/// "More" tab providing access to secondary features: Tasks, Invoices, Contacts, and Settings.
struct MoreView: View {
    let apiClient: APIClient
    @ObservedObject var authManager: AuthManager

    // Services
    private var taskService: TaskService { TaskService(apiClient: apiClient) }
    private var invoiceService: InvoiceService { InvoiceService(apiClient: apiClient) }
    private var contactService: ContactService { ContactService(apiClient: apiClient) }

    var body: some View {
        NavigationStack {
            List {
                // Work
                Section("Work") {
                    NavigationLink {
                        TaskListView(taskService: taskService)
                    } label: {
                        Label("Tasks", systemImage: "checklist")
                    }
                }

                // Financial
                Section("Financial") {
                    NavigationLink {
                        InvoiceListView(invoiceService: invoiceService)
                    } label: {
                        Label("Invoices", systemImage: "doc.richtext")
                    }
                }

                // People
                Section("People") {
                    NavigationLink {
                        ContactListView(contactService: contactService)
                    } label: {
                        Label("Contacts", systemImage: "person.crop.circle")
                    }
                }

                // Account
                Section("Account") {
                    NavigationLink {
                        SettingsView(authManager: authManager)
                    } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                }
            }
            .navigationTitle("More")
        }
    }
}
