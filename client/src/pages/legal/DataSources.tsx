/**
 * Article 14 notice (LEGAL-008).
 *
 * GDPR Art. 14 covers personal data NOT obtained from the data subject. If a
 * contact record was bought from Apollo or ZoomInfo, that person never gave us
 * their details and does not know we hold them. They are owed this information
 * within a month of acquisition.
 *
 * Deliberately reachable without an account. The people this page is for do not
 * have one, and have no reason to want one; a notice behind a login is not a
 * notice.
 */

import { useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database } from 'lucide-react';

export default function DataSources() {
  useEffect(() => {
    document.title = 'Where your data came from | Printyx';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 dark:bg-gray-900">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Database className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Where your data came from
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Last Updated: August 18, 2026</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>If you never gave us your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p>
              You may be reading this because a company that uses Printyx holds a contact record
              about you, and you do not recall giving anyone your details. That is a fair question
              to ask, and this page answers it.
            </p>

            <div>
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                Who holds your data
              </h2>
              <p>
                The Printyx customer whose salesperson contacted you is the controller of that
                record: they decided to collect it and what to do with it. Printyx operates the
                software they use, and processes the data on their instructions. If you want a
                record corrected or removed, the fastest route is usually to reply to whoever
                contacted you. We can also route the request, see below.
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                Where it came from
              </h2>
              <p>
                Business contact details in the platform come from one of three places: the customer
                entered them, you supplied them yourself (a form, an email, a conversation), or they
                were obtained from a business-data provider. The providers in use are{' '}
                <span className="font-medium">Apollo.io</span> and{' '}
                <span className="font-medium">ZoomInfo</span>, which compile business contact
                information from public and commercial sources. Both are listed on our{' '}
                <Link href="/subprocessors" className="underline">
                  Subprocessors
                </Link>{' '}
                page.
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                What is typically held
              </h2>
              <p>
                Name, job title, employer, business email address, business phone number, and
                sometimes a LinkedIn profile URL and details about your employer such as industry
                and size. Business contact details, in other words, not personal ones.
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                Why, and on what basis
              </h2>
              <p>
                To contact you about products and services relevant to your role. Where GDPR
                applies, the basis is the customer&apos;s legitimate interest in business
                development, balanced against your interests, which is a balance you are entitled to
                challenge. Where it does not, the applicable local marketing rules govern.
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                How long it is kept
              </h2>
              <p>
                For as long as the customer maintains the relationship, and no more than 30 days
                after their subscription ends, other than records held longer for the legal reasons
                set out in our{' '}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                Your rights, and how to use them
              </h2>
              <p className="mb-2">
                You can ask for a copy of what is held, ask for it to be corrected, object to it
                being used to contact you, and ask for it to be deleted. You do not need an account
                and there is no charge.
              </p>
              <p>
                Email{' '}
                <a href="mailto:privacy@printyx.net" className="underline">
                  privacy@printyx.net
                </a>{' '}
                from the address you were contacted on, or naming it. We will action it and pass it
                to the relevant customer. An objection or deletion request also adds your address to
                a suppression list, so the same record is not simply re-acquired from a provider the
                next time data is refreshed. That suppression outlives the deleted record, which is
                the only way deletion means anything here.
              </p>
              <p className="mt-2">
                If you are in the EU or UK and are unhappy with how a request was handled, you can
                complain to your national data protection authority.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
