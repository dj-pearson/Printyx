/**
 * "Do Not Sell or Share My Personal Information" — CCPA / CPRA.
 *
 * Printyx does not sell personal information. Under CPRA, "sharing" also covers
 * disclosing personal information for cross-context behavioral advertising. This
 * page gives visitors a clear, one-click way to opt out of that sharing (the
 * analytics and marketing cookie categories) and reflects any Global Privacy
 * Control signal the browser is sending.
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldOff, CheckCircle2 } from 'lucide-react';
import {
  getConsent,
  getGpcSignal,
  openCookieSettings,
  setConsent,
  type CookieCategory,
} from '@/lib/cookie-consent';

export default function DoNotSell() {
  const [optedOut, setOptedOut] = useState(false);
  const gpc = getGpcSignal();

  useEffect(() => {
    document.title = 'Do Not Sell or Share My Personal Information | Printyx';
  }, []);

  const optOut = () => {
    const existing = getConsent();
    const categories: Record<CookieCategory, boolean> = {
      essential: true,
      // Preserve a non-advertising preference choice if one was made.
      preferences: existing?.categories.preferences ?? false,
      // Opt out of "sale"/"sharing" categories.
      analytics: false,
      marketing: false,
    };
    setConsent(categories, gpc ? 'gpc' : 'custom');
    setOptedOut(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 dark:bg-gray-900">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ShieldOff className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Do Not Sell or Share My Personal Information
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your CCPA / CPRA choices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <p>
              Printyx does <strong>not</strong> sell your personal information for money. Under the
              California Privacy Rights Act (CPRA), &quot;sharing&quot; also includes disclosing
              personal information for cross-context behavioral advertising. You can opt out of that
              sharing below. This applies to analytics and marketing cookies on this device and
              browser.
            </p>

            {gpc && (
              <p className="rounded-md bg-green-50 p-3 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                We detected a Global Privacy Control (GPC) signal from your browser and are already
                treating it as an opt-out of sale/sharing.
              </p>
            )}

            {optedOut ? (
              <div
                className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                role="status"
              >
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span>
                  You have opted out of the sale and sharing of your personal information on this
                  browser.
                </span>
              </div>
            ) : (
              <Button onClick={optOut}>Opt out of sale and sharing</Button>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              You can review all cookie categories at any time in{' '}
              <button type="button" onClick={openCookieSettings} className="underline">
                Cookie Settings
              </button>
              . To exercise other privacy rights (access, deletion, correction), see our{' '}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
