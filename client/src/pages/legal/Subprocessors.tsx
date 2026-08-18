/**
 * Subprocessor list (GDPR Art. 28(4)) — the third parties Printyx uses to
 * process personal data on behalf of its customers.
 *
 * NOTE FOR MAINTAINERS: keep this list accurate. A new subprocessor that
 * processes customer personal data must be added here, and material changes
 * should be notified to customers per the DPA. Customer-initiated integrations
 * (e.g. QuickBooks, Salesforce) that the customer connects and controls are not
 * listed here as our subprocessors.
 */

import { useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';

interface Subprocessor {
  name: string;
  purpose: string;
  location: string;
}

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: 'Supabase',
    purpose: 'Application hosting, managed PostgreSQL database, and authentication',
    location: 'United States',
  },
  {
    name: 'Google Cloud Platform',
    purpose: 'Encrypted database backup storage',
    location: 'United States',
  },
  {
    name: 'Stripe',
    purpose: 'Subscription billing and payment processing',
    location: 'United States',
  },
  {
    name: 'Twilio SendGrid',
    purpose: 'Transactional and marketing email delivery',
    location: 'United States',
  },
  {
    name: 'Sentry',
    purpose:
      'Application error reporting (strictly necessary), plus performance tracing and session replay where analytics cookies are allowed',
    location: 'United States',
  },
];

export default function Subprocessors() {
  useEffect(() => {
    document.title = 'Subprocessors | Printyx';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 dark:bg-gray-900">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Network className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Subprocessors</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Last Updated: July 23, 2026</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Our subprocessors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>
              Printyx engages the third-party providers below to process personal data on behalf of
              our customers in order to deliver the Printyx platform. Each is bound by contractual
              data-protection obligations consistent with our{' '}
              <Link href="/dpa" className="underline">
                Data Processing Agreement
              </Link>
              . Where personal data is transferred internationally, we rely on appropriate
              safeguards such as the EU Standard Contractual Clauses.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b">
                    <th
                      scope="col"
                      className="py-2 pr-4 font-semibold text-gray-900 dark:text-white"
                    >
                      Provider
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-4 font-semibold text-gray-900 dark:text-white"
                    >
                      Purpose
                    </th>
                    <th scope="col" className="py-2 font-semibold text-gray-900 dark:text-white">
                      Primary location
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((sp) => (
                    <tr key={sp.name} className="border-b align-top">
                      <td className="py-3 pr-4 font-medium">{sp.name}</td>
                      <td className="py-3 pr-4">{sp.purpose}</td>
                      <td className="py-3">{sp.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              Customer-initiated integrations that you choose to connect (for example accounting or
              CRM systems) act under your direction and are governed by their own terms; they are
              not Printyx subprocessors.
            </p>

            <p>
              We will provide notice of new subprocessors as described in our Data Processing
              Agreement. To be notified of changes, or for questions, contact{' '}
              <a href="mailto:privacy@printyx.net" className="underline">
                privacy@printyx.net
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
