/**
 * Subprocessor list (GDPR Art. 28(4)) - the third parties that receive customer
 * or personal data from Printyx.
 *
 * NOTE FOR MAINTAINERS: this list is checked by scripts/check-subprocessors.mjs,
 * which cross-references it against the third-party hosts actually called from
 * server/ and supabase/functions/ and the *_API_KEY environment variables in
 * use. A vendor that appears in code but not here fails the build. That guard
 * exists because this page listed four providers while the platform was sending
 * data to roughly a dozen, including customer voice recordings to OpenAI.
 *
 * Adding a row is not the fix on its own. A new subprocessor also needs customer
 * notice under the DPA before it starts processing.
 */

import { useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';

interface Subprocessor {
  name: string;
  purpose: string;
  /** What actually leaves our systems for this provider. */
  dataCategories: string;
  location: string;
}

/**
 * Always in the data path. Every customer's data may reach these providers as
 * part of delivering the platform.
 */
const CORE_SUBPROCESSORS: Subprocessor[] = [
  {
    name: 'Supabase',
    purpose: 'Application hosting, managed PostgreSQL database, authentication, and file storage',
    dataCategories: 'All customer and platform data, including uploaded files',
    location: 'United States',
  },
  {
    name: 'Google Cloud Platform',
    purpose: 'Encrypted database backup storage',
    dataCategories: 'Full database backups',
    location: 'United States',
  },
  {
    name: 'Stripe',
    purpose: 'Subscription billing and payment processing',
    dataCategories: 'Billing contact details, payment method, transaction history',
    location: 'United States',
  },
  {
    name: 'Twilio SendGrid',
    purpose: 'Transactional and marketing email delivery',
    dataCategories: 'Recipient name and email address, message content',
    location: 'United States',
  },
  {
    name: 'Sentry',
    purpose:
      'Application error reporting (strictly necessary), plus performance tracing and session replay where analytics cookies are allowed',
    dataCategories:
      'Error details and technical context; replay masks text, form inputs and media before it leaves the browser',
    location: 'United States',
  },
  {
    name: 'OpenAI',
    purpose:
      'Speech-to-text for recorded service calls and meetings, and text embeddings for knowledge search',
    dataCategories:
      'Audio recordings of service calls and meetings, and the text of knowledge-base content submitted for indexing',
    location: 'United States',
  },
  {
    name: 'Anthropic',
    purpose:
      'AI assistance for imported data cleanup, quarterly business review narratives, and in-product assistants',
    dataCategories:
      'The contents of imported files, and the fleet, usage and service data summarized in a business review',
    location: 'United States',
  },
];

/**
 * Reached only when a customer connects them. These act under the customer's
 * direction rather than ours, so they are not Printyx subprocessors, but they
 * are listed because a customer evaluating where their data can go deserves the
 * whole picture rather than the half we are strictly obliged to publish.
 */
const CUSTOMER_ENABLED: Subprocessor[] = [
  {
    name: 'Apollo.io',
    purpose: 'Contact enrichment',
    dataCategories: 'Business contact details submitted for lookup, and the records returned',
    location: 'United States',
  },
  {
    name: 'ZoomInfo',
    purpose: 'Company and contact enrichment',
    dataCategories: 'Company identifiers submitted for lookup, and the records returned',
    location: 'United States',
  },
  {
    name: 'Twilio',
    purpose: 'SMS and voice messaging',
    dataCategories: 'Recipient phone number and message content',
    location: 'United States',
  },
  {
    name: 'Microsoft',
    purpose: 'Single sign-on and calendar synchronization',
    dataCategories: 'Account identity, profile fields, calendar events',
    location: 'United States',
  },
  {
    name: 'Google',
    purpose: 'Single sign-on, calendar synchronization, and address lookup for lead geocoding',
    dataCategories: 'Account identity, profile fields, calendar events, submitted addresses',
    location: 'United States',
  },
  {
    name: 'Apple',
    purpose: 'Sign in with Apple',
    dataCategories: 'Account identity and the email address Apple relays',
    location: 'United States',
  },
  {
    name: 'Intuit QuickBooks',
    purpose: 'Accounting synchronization',
    dataCategories: 'Customer records, invoices, payments',
    location: 'United States',
  },
  {
    name: 'Salesforce',
    purpose: 'CRM synchronization',
    dataCategories: 'Accounts, contacts, and opportunity records',
    location: 'United States',
  },
  {
    name: 'Mailchimp',
    purpose: 'Marketing email campaigns',
    dataCategories: 'Recipient name and email address, campaign engagement',
    location: 'United States',
  },
  {
    name: 'ECI e-automate',
    purpose: 'Dealer ERP synchronization',
    dataCategories: 'Equipment, contract, and service records',
    location: 'United States',
  },
  {
    name: 'PrintFleet',
    purpose: 'Device monitoring and meter collection',
    dataCategories: 'Device identifiers, meter readings, device status',
    location: 'United States',
  },
  {
    name: 'DataForSEO',
    purpose: 'Keyword and search-ranking data for the content marketing tools',
    dataCategories: 'Search terms and domains submitted for analysis. No customer personal data.',
    location: 'United States',
  },
];

function SubprocessorTable({ rows }: { rows: Subprocessor[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b">
            <th scope="col" className="py-2 pr-4 font-semibold text-gray-900 dark:text-white">
              Provider
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold text-gray-900 dark:text-white">
              Purpose
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold text-gray-900 dark:text-white">
              Data involved
            </th>
            <th scope="col" className="py-2 font-semibold text-gray-900 dark:text-white">
              Primary location
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sp) => (
            <tr key={sp.name} className="border-b align-top">
              <td className="py-3 pr-4 font-medium">{sp.name}</td>
              <td className="py-3 pr-4">{sp.purpose}</td>
              <td className="py-3 pr-4">{sp.dataCategories}</td>
              <td className="py-3">{sp.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
          <p className="mt-2 text-gray-600 dark:text-gray-400">Last Updated: August 18, 2026</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Providers always in the data path</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>
              Printyx engages the providers below to process personal data on behalf of our
              customers in order to deliver the platform. Each is bound by contractual
              data-protection obligations consistent with our{' '}
              <Link href="/dpa" className="underline">
                Data Processing Agreement
              </Link>
              . Where personal data is transferred internationally, we rely on appropriate
              safeguards such as the EU Standard Contractual Clauses.
            </p>

            <SubprocessorTable rows={CORE_SUBPROCESSORS} />

            <p>
              Two of these warrant a specific note. Recorded service calls and meetings are sent to
              OpenAI to be transcribed, which means the audio of those conversations leaves our
              systems. Imported files and the underlying data behind a quarterly business review are
              sent to Anthropic to be summarized. Both are described further in our{' '}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Providers you can connect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>
              These are reached only if you connect them. They act under your direction rather than
              ours, so they are not Printyx subprocessors and are governed by their own terms with
              you. We list them anyway, because if you are working out where your data can end up,
              the answer should not stop at the providers we are strictly obliged to publish.
            </p>

            <SubprocessorTable rows={CUSTOMER_ENABLED} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="space-y-4 pt-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>
              We will provide notice of new subprocessors as described in our Data Processing
              Agreement, before they begin processing. To be added to the notification list, or for
              any question about this page, contact{' '}
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
