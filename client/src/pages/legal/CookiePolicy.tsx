/**
 * Cookie Policy — standalone ePrivacy/GDPR cookie disclosure.
 *
 * Complements the consent manager (client/src/lib/cookie-consent.ts): the
 * category names and purposes here MUST stay in sync with COOKIE_CATEGORIES.
 */

import { useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cookie } from 'lucide-react';
import { openCookieSettings } from '@/lib/cookie-consent';

export default function CookiePolicy() {
  useEffect(() => {
    document.title = 'Cookie Policy | Printyx';
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 dark:bg-gray-900">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Cookie className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cookie Policy</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Last Updated: July 23, 2026</p>
        </div>

        <Card>
          <CardContent className="space-y-8 p-8 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <section>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                1. What are cookies?
              </h2>
              <p>
                Cookies are small text files placed on your device when you visit a website. Similar
                technologies (local storage, pixels, and SDKs) work in comparable ways. We use the
                term &quot;cookies&quot; in this policy to refer to all of these technologies.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                2. How we use cookies
              </h2>
              <p>
                We use cookies to operate and secure the platform, to remember your preferences, and
                — only with your consent — to understand usage and support marketing. Non-essential
                cookies are not set until you agree to them. You can change your choices at any time
                using{' '}
                <button type="button" onClick={openCookieSettings} className="underline">
                  Cookie Settings
                </button>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
                3. Categories of cookies we use
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Strictly necessary (always active)
                  </h3>
                  <p>
                    Required for the site to function — authentication, security, load balancing,
                    and remembering your cookie choices. These do not require consent and cannot be
                    switched off.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Analytics</h3>
                  <p>
                    Help us understand how the site is used (aggregated usage and performance
                    measurement) so we can improve it. Set only with your consent.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Preferences</h3>
                  <p>
                    Remember choices you make (such as language or region) to give you a more
                    personalized experience. Set only with your consent.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Marketing</h3>
                  <p>
                    Used to measure and deliver marketing that is more relevant to you, including
                    across other sites. Set only with your consent, and treated as
                    &quot;sharing&quot; under the CPRA — see our{' '}
                    <Link href="/do-not-sell" className="underline">
                      Do Not Sell or Share
                    </Link>{' '}
                    page.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                4. Managing cookies
              </h2>
              <p>
                You can manage non-essential cookies through{' '}
                <button type="button" onClick={openCookieSettings} className="underline">
                  Cookie Settings
                </button>
                . Most browsers also let you block or delete cookies through their settings.
                Blocking strictly-necessary cookies may cause parts of the site to stop working. We
                honor the Global Privacy Control (GPC) signal as an opt-out of the sale/sharing of
                personal information.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                5. Third parties
              </h2>
              <p>
                Some cookies may be set by third parties that provide services to us. The providers
                that may process personal information on our behalf are listed on our{' '}
                <Link href="/subprocessors" className="underline">
                  Subprocessors
                </Link>{' '}
                page.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                6. Changes and contact
              </h2>
              <p>
                We may update this Cookie Policy from time to time. For questions, contact{' '}
                <a href="mailto:privacy@printyx.net" className="underline">
                  privacy@printyx.net
                </a>
                . For more about how we handle personal information, see our{' '}
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
