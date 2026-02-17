import SwiftUI

/// Login screen with email/password authentication.
struct LoginView: View {
    @ObservedObject var authManager: AuthManager
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @FocusState private var focusedField: Field?

    enum Field {
        case email, password
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.xxl) {
                Spacer(minLength: 60)

                // Logo
                VStack(spacing: AppTheme.Spacing.md) {
                    Image(systemName: "printer.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.printyxPrimary)

                    Text("Printyx")
                        .font(.printyxTitle)
                        .foregroundStyle(Color.printyxPrimary)

                    Text("Sign in to your account")
                        .font(.printyxBody)
                        .foregroundStyle(.secondary)
                }

                // Error
                if let error = authManager.error {
                    ErrorBanner(message: error, onDismiss: { authManager.error = nil })
                }

                // Form
                VStack(spacing: AppTheme.Spacing.lg) {
                    // Email
                    VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                        Text("Email")
                            .font(.printyxCaption)
                            .foregroundStyle(.secondary)

                        HStack {
                            Image(systemName: "envelope")
                                .foregroundStyle(.secondary)
                            TextField("you@company.com", text: $email)
                                .focused($focusedField, equals: .email)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.emailAddress)
                                .autocorrectionDisabled()
                                .submitLabel(.next)
                                .onSubmit { focusedField = .password }
                        }
                        .padding(AppTheme.Spacing.md)
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(AppTheme.Radius.md)
                    }

                    // Password
                    VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                        Text("Password")
                            .font(.printyxCaption)
                            .foregroundStyle(.secondary)

                        HStack {
                            Image(systemName: "lock")
                                .foregroundStyle(.secondary)
                            if showPassword {
                                TextField("Password", text: $password)
                                    .focused($focusedField, equals: .password)
                            } else {
                                SecureField("Password", text: $password)
                                    .focused($focusedField, equals: .password)
                            }
                            Button {
                                showPassword.toggle()
                            } label: {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(AppTheme.Spacing.md)
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(AppTheme.Radius.md)
                        .submitLabel(.go)
                        .onSubmit { login() }
                    }
                }

                // Sign In Button
                Button(action: login) {
                    Group {
                        if authManager.isLoading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Sign In")
                                .font(.printyxSubheadline)
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppTheme.Spacing.md + 2)
                    .foregroundStyle(.white)
                    .background(isFormValid ? Color.printyxPrimary : Color.printyxPrimary.opacity(0.5))
                    .cornerRadius(AppTheme.Radius.md)
                }
                .disabled(!isFormValid || authManager.isLoading)

                // Version
                Text("v\(AppConfig.fullVersion)")
                    .font(.printyxSmall)
                    .foregroundStyle(.tertiary)

                Spacer(minLength: 40)
            }
            .padding(.horizontal, AppTheme.Spacing.xl)
        }
        .background(Color(.systemBackground))
        .onTapGesture { focusedField = nil }
    }

    private var isFormValid: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty &&
        !password.isEmpty
    }

    private func login() {
        guard isFormValid else { return }
        focusedField = nil
        Task {
            await authManager.login(email: email, password: password)
        }
    }
}
