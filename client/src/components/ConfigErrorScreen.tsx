import { useEffect, useState } from 'react';
import { pingSupabaseHealth } from '@/lib/config';

/**
 * Shown at boot when required runtime configuration is missing (PA-009).
 * Replaces the previous behaviour where a missing/stale VITE_SUPABASE_ANON_KEY
 * crashed @supabase/supabase-js at import time and left a blank white page.
 * On mount it also pings GoTrue /auth/v1/health to distinguish a missing key
 * from a rotated/stale one (401).
 */
export default function ConfigErrorScreen({ errors }: { errors: string[] }) {
  const [health, setHealth] = useState<string | null>(null);

  /*
   * SEO-012: keep this page out of the index, and do it here rather than
   * relying on the head.
   *
   * main.tsx renders this INSTEAD of <App/>, so SEOProvider never mounts and
   * nothing else writes a robots tag. The static head in client/index.html says
   * `index, follow` whenever the site is open (the COMING_SOON build plugin
   * only forces noindex while it is closed), and its title and og:description
   * describe the homepage. A build that shipped without VITE_SUPABASE_ANON_KEY
   * would therefore serve every URL on the site as this error screen, presented
   * to crawlers as the Printyx homepage and marked indexable - an outage
   * entering the index under the site's best keywords, exactly when nobody is
   * looking at search results.
   *
   * Cloudflare Pages serves a static 200 for every path, so there is no status
   * code to signal this with. The meta tag is the only lever.
   */
  useEffect(() => {
    document.title = 'Printyx is temporarily unavailable';
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');
    // The head's og:* still describe the homepage; a scraper that does not run
    // JS will use them, and that is the honest limit of a client-side fix.
    document.querySelector('link[rel="canonical"]')?.remove();
  }, []);

  useEffect(() => {
    let active = true;
    pingSupabaseHealth().then((r) => {
      if (!active) return;
      if (r.hint) setHealth(r.hint);
      else if (r.ok)
        setHealth('GoTrue is reachable — the anon key just needs to be provided at build time.');
      else setHealth(`GoTrue health check returned status ${r.status}.`);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        padding: '24px',
        background: '#0b0f19',
        color: '#e5e7eb',
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>⚠️ Application not configured</h1>
        <p style={{ marginBottom: 16, lineHeight: 1.5 }}>
          Printyx can’t start because a required setting is missing. This is a deployment/build
          configuration problem, not a bug in the page.
        </p>
        <ul style={{ marginBottom: 16, lineHeight: 1.6 }}>
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
        {health && (
          <p
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              background: '#111827',
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {health}
          </p>
        )}
        <p style={{ fontSize: 13, color: '#9ca3af' }}>
          Set the missing environment variable(s) at build time and redeploy. See{' '}
          <code>.env.example</code> for the anon-key source and rotation steps.
        </p>
      </div>
    </div>
  );
}
