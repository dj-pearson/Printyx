# Records of Processing Activities (RoPA) — GDPR Article 30

**Controller:** Printyx LLC
**Data Protection Officer:** dpo@printyx.net
**Last reviewed:** 2026-07-23

This register documents Printyx's processing activities as required by GDPR
Article 30. It has two parts: activities where Printyx acts as **controller**
(Art. 30(1)) and activities carried out on behalf of customers where Printyx
acts as **processor** (Art. 30(2)).

> Maintenance: update this register whenever a processing purpose, data
> category, recipient, retention period, or subprocessor changes. Keep it
> consistent with the Privacy Policy, Cookie Policy, DPA, and Subprocessors
> page. This is an internal compliance record; it is not published as-is.

---

## Part A — Printyx as Controller (Art. 30(1))

### A1. Account and user management

- **Purpose:** create and manage user accounts, authentication, and access control.
- **Legal basis:** contract (Art. 6(1)(b)); legitimate interests for security.
- **Data subjects:** platform users (customer personnel, platform staff).
- **Personal data:** name, email, phone, job title, hashed credentials, role, login/activity logs.
- **Recipients:** hosting/auth provider (Supabase).
- **International transfers:** United States; safeguards via SCCs where applicable.
- **Retention:** life of account + up to 30 days post-termination, then deleted/anonymized.
- **Security:** encryption in transit/at rest, RBAC, MFA, tenant isolation, audit logging.

### A2. Billing and payments

- **Purpose:** manage subscriptions, invoicing, and payment collection.
- **Legal basis:** contract; legal obligation (tax/accounting).
- **Data subjects:** customer billing contacts.
- **Personal data:** billing name, address, email, payment method metadata (no full card data — handled by the processor).
- **Recipients:** payment processor (Stripe).
- **International transfers:** United States; SCCs where applicable.
- **Retention:** invoices/financial records up to 7 years.
- **Security:** as A1; card data handled by PCI-compliant processor.

### A3. Support and communications

- **Purpose:** respond to support requests and send service/administrative communications.
- **Legal basis:** contract; legitimate interests.
- **Data subjects:** users who contact support.
- **Personal data:** name, email, contents of communications.
- **Recipients:** email delivery provider (Twilio SendGrid).
- **International transfers:** United States; SCCs where applicable.
- **Retention:** up to 3 years after the interaction.

### A4. Marketing and analytics

- **Purpose:** measure site usage and send marketing communications.
- **Legal basis:** consent (Art. 6(1)(a)); GPC honored as opt-out.
- **Data subjects:** website visitors, prospects, users who opt in.
- **Personal data:** email, usage/analytics data, cookie identifiers.
- **Recipients:** email delivery provider; analytics tooling (when enabled).
- **Retention:** per consent and the durations in the Cookie Policy; unsubscribe honored on request.

### A5. Security, fraud prevention, and audit logging

- **Purpose:** protect the platform and maintain security/audit records.
- **Legal basis:** legitimate interests; legal obligation.
- **Data subjects:** all users.
- **Personal data:** IP address, device/user-agent, access and data-access logs.
- **Retention:** security/audit logs up to 7 years.

---

## Part B — Printyx as Processor (Art. 30(2))

Carried out on behalf of customers (controllers) under the
[Data Processing Agreement](../client/src/pages/legal/DataProcessingAgreement.tsx).

### B1. Hosting and processing of customer business records

- **Controller:** the customer.
- **Processing on behalf of the controller:** hosting, storage, and processing of CRM, service, and billing records to deliver the platform.
- **Categories of data subjects:** the customer's personnel, customers, and business contacts.
- **Categories of personal data:** names, email addresses, phone numbers, business addresses, job titles, and other data the controller inputs.
- **Subprocessors:** see the [Subprocessors](../client/src/pages/legal/Subprocessors.tsx) page (hosting/DB/auth, backups, payments, email).
- **International transfers:** United States; SCCs / UK Addendum where applicable.
- **Retention:** for the term of the customer agreement plus the deletion/return period in the DPA.
- **Security (Art. 32):** encryption in transit/at rest, RBAC + multi-tenant isolation, least-privilege admin access, logging/monitoring, backups, vulnerability management.

### B2. Data-subject-rights assistance

- **Processing on behalf of the controller:** enabling export (portability) and erasure (anonymization) of data subjects at the controller's or data subject's request via self-service tooling and admin workflows.
- **Retention:** request records retained for compliance evidence; erased subjects anonymized in live systems (backups age out per schedule).

---

## Change log

| Date       | Change                                  | By  |
| ---------- | --------------------------------------- | --- |
| 2026-07-23 | Initial RoPA created (CRMX compliance). | —   |
