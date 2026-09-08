import { Logo } from '@/components/ui/logo';
import { usePageSeo } from '@/lib/seoUtils';

/**
 * The holding page the public site serves while the platform is still being
 * built. It replaces every marketing route (see `COMING_SOON` in App.tsx);
 * login, the auth flows and the legal pages stay reachable, so anyone with an
 * account can still get in and the policies we publish stay published.
 *
 * Nothing here is a measurement or a promise with a date on it. There is no
 * launch countdown because no launch date is set, and no signup form because
 * nothing collects the address yet - the contact link is a mailto, which works.
 */
const CONTACT_EMAIL = 'support@printyx.net';

export default function ComingSoon() {
  usePageSeo({
    title: 'Printyx - Coming soon',
    description:
      'Printyx is a dealer management platform for copier and managed print dealers. The product is still being built; the site will be back when it is ready.',
    canonicalUrl: 'https://printyx.net',
    // The whole public surface serves this one page, so every marketing URL
    // would otherwise be indexed as duplicate content.
    noindex: true,
  });

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#1b1a18] flex flex-col">
      <header className="px-6 pt-8 sm:px-10 sm:pt-10">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Logo className="h-8 w-8" aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight">Printyx</span>
        </div>
      </header>

      <div className="flex flex-1 items-center px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-[#6b6862]">Printyx is not open yet</p>

          <h1
            className="mt-5 text-4xl leading-[1.1] sm:text-6xl"
            style={{ fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif' }}
          >
            We took the site down while we finish building.
          </h1>

          <div className="mt-8 max-w-[68ch] space-y-5 text-lg leading-relaxed text-[#33312c]">
            <p>
              Printyx is a dealer management platform for copier and managed print dealers: service
              dispatch, contracts and meter billing, inventory, and the CRM around them. It works
              well enough for the people testing it and not well enough to sell, so the marketing
              site is closed rather than describing something you cannot buy yet.
            </p>
            <p>
              There is no launch date to give you. When there is one, this page will say it instead
              of this paragraph.
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Printyx`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#1b1a18] px-6 text-base font-medium text-[#faf9f7] transition-colors hover:bg-[#33312c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b1a18]"
            >
              Email us
            </a>
            <a
              href="/login"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl px-6 text-base font-medium text-[#33312c] underline underline-offset-4 hover:text-[#1b1a18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b1a18]"
            >
              Sign in to an existing account
            </a>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#e4e1db] px-6 py-8 text-sm text-[#6b6862] sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Printyx</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Legal">
            <a className="hover:text-[#1b1a18] underline underline-offset-4" href="/privacy">
              Privacy
            </a>
            <a className="hover:text-[#1b1a18] underline underline-offset-4" href="/terms">
              Terms
            </a>
            <a className="hover:text-[#1b1a18] underline underline-offset-4" href="/accessibility">
              Accessibility
            </a>
            <a
              className="hover:text-[#1b1a18] underline underline-offset-4"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
