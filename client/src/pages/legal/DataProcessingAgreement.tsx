/**
 * Data Processing Agreement (GDPR Art. 28).
 *
 * Standard processor terms that apply where Printyx processes personal data on
 * behalf of a customer (the controller). Intended to be reviewed by counsel and
 * executed as part of, or incorporated by reference into, the customer contract.
 */

import { useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCheck } from 'lucide-react';

export default function DataProcessingAgreement() {
  useEffect(() => {
    document.title = 'Data Processing Agreement | Printyx';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 dark:bg-gray-900">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <FileCheck className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Data Processing Agreement
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Last Updated: July 23, 2026</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Processing Agreement (&quot;DPA&quot;)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>
              This DPA forms part of the agreement between the customer (&quot;Controller&quot;) and
              Printyx LLC (&quot;Processor&quot;, &quot;we&quot;) for the provision of the Printyx
              platform (the &quot;Services&quot;). It applies where and to the extent Printyx
              processes Personal Data on the Controller&apos;s behalf. Capitalized terms not defined
              here have the meaning given in the GDPR and applicable data-protection laws.
            </p>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                1. Roles and scope
              </h2>
              <p>
                As between the parties, the Controller determines the purposes and means of
                processing Personal Data and Printyx acts as Processor. Printyx processes Personal
                Data only to provide the Services and on the Controller&apos;s documented
                instructions (including as set out in the agreement and this DPA), unless required
                to do otherwise by law, in which case Printyx will inform the Controller unless
                legally prohibited.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                2. Details of processing
              </h2>
              <ul className="list-disc space-y-1 pl-6">
                <li>
                  <strong>Subject matter:</strong> provision of the Printyx platform to the
                  Controller.
                </li>
                <li>
                  <strong>Duration:</strong> the term of the agreement, plus the deletion/return
                  period in Section 8.
                </li>
                <li>
                  <strong>Nature and purpose:</strong> hosting, storage, and processing of business
                  records to deliver CRM, service, billing, and related functionality.
                </li>
                <li>
                  <strong>Types of Personal Data:</strong> contact and account details (names, email
                  addresses, phone numbers, business addresses, job titles), and other data the
                  Controller chooses to input.
                </li>
                <li>
                  <strong>Categories of data subjects:</strong> the Controller&apos;s personnel,
                  customers, and business contacts.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                3. Processor obligations
              </h2>
              <p>Printyx will:</p>
              <ul className="list-disc space-y-1 pl-6">
                <li>
                  process Personal Data only on the Controller&apos;s documented instructions;
                </li>
                <li>
                  ensure persons authorized to process Personal Data are subject to confidentiality
                  obligations;
                </li>
                <li>implement the security measures described in Section 4;</li>
                <li>respect the conditions for engaging subprocessors in Section 5;</li>
                <li>
                  assist the Controller, taking into account the nature of processing, with data
                  subject requests and with its obligations under Articles 32–36 GDPR; and
                </li>
                <li>
                  make available information necessary to demonstrate compliance as set out in
                  Section 9.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                4. Security (Art. 32)
              </h2>
              <p>
                Printyx implements appropriate technical and organizational measures to protect
                Personal Data, including encryption in transit and at rest, role-based access
                controls and multi-tenant data isolation, least-privilege administrative access,
                logging and monitoring, regular backups, and vulnerability management. Measures are
                reviewed and updated as appropriate.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                5. Subprocessors
              </h2>
              <p>
                The Controller provides a general authorization for Printyx to engage subprocessors
                to support the Services. Printyx maintains a current list of subprocessors on its{' '}
                <Link href="/subprocessors" className="underline">
                  Subprocessors
                </Link>{' '}
                page and will give notice of intended changes so the Controller has an opportunity
                to object on reasonable data-protection grounds. Printyx imposes data-protection
                obligations on each subprocessor that are no less protective than this DPA and
                remains responsible for its subprocessors&apos; performance.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                6. Data subject rights
              </h2>
              <p>
                Taking into account the nature of the processing, Printyx will assist the Controller
                by appropriate technical and organizational measures, insofar as possible, to
                respond to requests to exercise data subject rights (access, rectification, erasure,
                restriction, portability, and objection). The Services include self-service data
                export and erasure tooling to facilitate this.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                7. Personal data breach
              </h2>
              <p>
                Printyx will notify the Controller without undue delay after becoming aware of a
                Personal Data breach affecting the Controller&apos;s Personal Data, and will provide
                information reasonably available to assist the Controller in meeting its breach
                notification obligations.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                8. Deletion and return
              </h2>
              <p>
                On termination of the Services, and at the Controller&apos;s choice, Printyx will
                delete or return the Personal Data and delete existing copies, unless retention is
                required by law. The Controller may export its data before the end of the applicable
                retention period. Backups are deleted in the ordinary course under our backup
                retention schedule.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                9. Audits
              </h2>
              <p>
                Printyx will make available to the Controller information necessary to demonstrate
                compliance with Article 28 GDPR and allow for and contribute to audits, including
                inspections, conducted by the Controller or an auditor it mandates, subject to
                reasonable confidentiality, security, and scheduling requirements. Printyx may
                satisfy audit requests by providing third-party certifications or reports where
                available.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                10. International transfers
              </h2>
              <p>
                Where Printyx transfers Personal Data outside the EEA, the UK, or Switzerland, it
                implements an appropriate transfer mechanism, such as the EU Standard Contractual
                Clauses (and the UK Addendum where applicable), which are incorporated by reference
                into this DPA.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                11. General
              </h2>
              <p>
                This DPA is incorporated into and forms part of the agreement. In the event of a
                conflict between this DPA and the agreement on data-protection matters, this DPA
                controls. All other terms of the agreement, including limitations of liability,
                remain in effect. This DPA is governed by the law specified in the agreement.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                12. Contact
              </h2>
              <p>
                To request a countersigned copy of this DPA or for data-protection questions,
                contact{' '}
                <a href="mailto:dpo@printyx.net" className="underline">
                  dpo@printyx.net
                </a>
                . See also our{' '}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
