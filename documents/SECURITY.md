# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

The Printyx team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contribution.

### How to Report

Please report security vulnerabilities by emailing **security@printyx.net**. Do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.

### What to Include

When reporting a vulnerability, please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce the issue or a proof-of-concept
- The affected component(s) and version(s)
- Any suggested remediation or mitigation steps
- Your name and contact information (for acknowledgment, if desired)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 3 business days.
- **Assessment**: We will investigate and validate the reported vulnerability, providing an initial assessment within 10 business days.
- **Resolution**: We aim to resolve confirmed vulnerabilities within 90 days of the initial report. The timeline may vary depending on complexity and severity.
- **Disclosure**: We follow a coordinated disclosure process. We ask that you do not publicly disclose the vulnerability until we have had the opportunity to address it, up to the 90-day resolution window.
- **Credit**: We are happy to credit researchers who report valid vulnerabilities, unless they prefer to remain anonymous.

## Responsible Disclosure Timeline

| Milestone                  | Target              |
| -------------------------- | ------------------- |
| Acknowledgment of report   | 3 business days     |
| Initial assessment         | 10 business days    |
| Vulnerability resolution   | 90 days             |
| Public disclosure (if any) | After resolution    |

## Scope

The following are in scope for security reports:

- Printyx web application (api.printyx.net)
- Printyx Edge Functions (functions.printyx.net)
- Authentication and authorization mechanisms
- Data exposure or leakage vulnerabilities
- Cross-site scripting (XSS), SQL injection, and other OWASP Top 10 vulnerabilities
- Multi-tenant isolation bypasses

The following are out of scope:

- Third-party services and dependencies (report to the respective maintainers)
- Social engineering attacks
- Denial-of-service (DoS) attacks
- Issues in environments or configurations not supported by Printyx

## Security Measures

Printyx employs the following security practices:

- **Automated dependency auditing** in CI/CD pipeline
- **Static analysis** with eslint-plugin-security for code-level vulnerability detection
- **Secret scanning** to prevent accidental credential commits
- **Row-level security** with tenant isolation on all database queries
- **JWT-based authentication** with Supabase GoTrue
- **RBAC** with granular permission controls
- **TLS encryption** for all data in transit
- **Regular security audits** using `npm run audit:security`

## Security Contact

- **Email**: security@printyx.net
- **Response Time**: 3 business days for initial acknowledgment
