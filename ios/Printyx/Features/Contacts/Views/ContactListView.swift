import SwiftUI

/// List view for standalone contacts with search and company grouping.
struct ContactListView: View {
    @StateObject private var viewModel: ContactListViewModel
    @State private var showingCreate = false
    @State private var selectedContact: Contact?

    init(contactService: ContactService) {
        _viewModel = StateObject(wrappedValue: ContactListViewModel(contactService: contactService))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search
                SearchBar(text: $viewModel.searchText, placeholder: "Search contacts...")
                    .padding(.horizontal, AppTheme.Spacing.lg)
                    .padding(.vertical, AppTheme.Spacing.sm)

                // Content
                if viewModel.isLoading && viewModel.contacts.isEmpty {
                    LoadingView(message: "Loading contacts...")
                } else if let error = viewModel.error, viewModel.contacts.isEmpty {
                    ErrorView(message: error, retryAction: { await viewModel.refresh() })
                } else if viewModel.filteredContacts.isEmpty {
                    EmptyStateView(
                        icon: "person.crop.circle",
                        title: "No Contacts",
                        message: "Add contacts to manage your relationships.",
                        actionTitle: "Add Contact",
                        action: { showingCreate = true }
                    )
                } else {
                    contactList
                }
            }
            .navigationTitle("Contacts")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCreate = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.printyxPrimary)
                    }
                    .accessibilityLabel("Add contact")
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $showingCreate) {
                ContactFormView { _ in
                    Task { await viewModel.refresh() }
                }
            }
            .sheet(item: $selectedContact) { contact in
                ContactDetailView(contact: contact)
            }
            .task {
                if viewModel.contacts.isEmpty {
                    await viewModel.loadInitial()
                }
            }
        }
    }

    private var contactList: some View {
        List {
            ForEach(viewModel.filteredContacts) { contact in
                ContactRow(contact: contact)
                    .contentShape(Rectangle())
                    .onTapGesture { selectedContact = contact }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task { await viewModel.deleteContact(contact) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }

                        if let phone = contact.phone ?? contact.mobilePhone, let url = URL(string: "tel:\(phone)") {
                            Button {
                                UIApplication.shared.open(url)
                            } label: {
                                Label("Call", systemImage: "phone")
                            }
                            .tint(.green)
                        }
                    }
            }
        }
        .listStyle(.insetGrouped)
    }
}

// MARK: - Contact Row

struct ContactRow: View {
    let contact: Contact

    var body: some View {
        HStack(spacing: AppTheme.Spacing.md) {
            AvatarView(initials: contact.initials, size: 40, backgroundColor: .printyxPrimary)

            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                Text(contact.displayName)
                    .font(.printyxSubheadline)
                    .lineLimit(1)

                HStack(spacing: AppTheme.Spacing.sm) {
                    if let title = contact.title {
                        Text(title)
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    if let company = contact.companyName {
                        Text(company)
                            .font(.printyxSmall)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: AppTheme.Spacing.xs) {
                if let role = contact.role {
                    Image(systemName: contact.roleIcon)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                if let email = contact.email {
                    Text(email)
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, AppTheme.Spacing.xs)
    }
}

// MARK: - Placeholder Views

struct ContactFormView: View {
    var onSave: ((Contact) -> Void)?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Text("Add Contact")
                .font(.printyxHeadline)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .navigationTitle("New Contact")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel") { dismiss() }
                    }
                }
        }
    }
}

struct ContactDetailView: View {
    let contact: Contact
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Contact Info") {
                    LabeledContent("Name", value: contact.displayName)
                    if let title = contact.title {
                        LabeledContent("Title", value: title)
                    }
                    if let dept = contact.department {
                        LabeledContent("Department", value: dept)
                    }
                    if let role = contact.role {
                        LabeledContent("Role", value: role.capitalized)
                    }
                }

                Section("Contact Methods") {
                    if let email = contact.email {
                        HStack {
                            LabeledContent("Email", value: email)
                            Spacer()
                            if let url = URL(string: "mailto:\(email)") {
                                Link(destination: url) {
                                    Image(systemName: "envelope.fill")
                                        .foregroundStyle(Color.printyxPrimary)
                                }
                            }
                        }
                    }
                    if let phone = contact.phone {
                        HStack {
                            LabeledContent("Phone", value: phone)
                            Spacer()
                            if let url = URL(string: "tel:\(phone)") {
                                Link(destination: url) {
                                    Image(systemName: "phone.fill")
                                        .foregroundStyle(.green)
                                }
                            }
                        }
                    }
                    if let mobile = contact.mobilePhone {
                        LabeledContent("Mobile", value: mobile)
                    }
                }

                if let company = contact.companyName {
                    Section("Company") {
                        LabeledContent("Company", value: company)
                    }
                }

                if let notes = contact.notes {
                    Section("Notes") {
                        Text(notes)
                            .font(.printyxBody)
                    }
                }
            }
            .navigationTitle(contact.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
