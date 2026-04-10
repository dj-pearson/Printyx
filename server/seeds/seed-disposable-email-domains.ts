/**
 * Seed Disposable Email Domains
 *
 * Imports the community-maintained disposable email blocklist from
 * https://github.com/disposable-email-domains/disposable-email-domains
 * into the `disposable_email_domains` table.
 *
 * Usage:
 *   npm run seed:disposable-emails              # download & upsert
 *   npm run seed:disposable-emails -- --dry-run # show what would happen
 *   npm run seed:disposable-emails -- --offline # use bundled fallback list
 *
 * The script is idempotent — existing rows are updated to `isBlocked=true`
 * on each run, so you can safely re-run it to pick up upstream changes.
 */

import { bulkAddDomains } from '../services/disposable-email-service';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('seed-disposable-emails');

const SOURCE_URL =
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

/**
 * Small, hand-curated fallback list of the most common disposable providers.
 * Used when the upstream fetch fails or `--offline` is passed. This ensures a
 * fresh install always has baseline coverage even without internet access.
 */
const FALLBACK_DOMAINS = [
  '0-mail.com',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  '33mail.com',
  '7mail.ga',
  'anonymousmail.org',
  'armyspy.com',
  'bigprofessor.so',
  'binkmail.com',
  'bobmail.info',
  'bouncr.com',
  'burnermail.io',
  'byom.de',
  'chacuo.net',
  'cuvox.de',
  'deadaddress.com',
  'despam.it',
  'dispostable.com',
  'dodgeit.com',
  'dodgit.com',
  'drdrb.net',
  'dropmail.me',
  'e4ward.com',
  'einrot.com',
  'emailias.com',
  'emailmiser.com',
  'emailondeck.com',
  'emailsensei.com',
  'emailtemporanea.com',
  'emailto.de',
  'emailwarden.com',
  'ephemail.net',
  'fakeinbox.com',
  'fakemail.fr',
  'fakemailgenerator.com',
  'fast-mail.fr',
  'fleckens.hu',
  'gustr.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'imgof.com',
  'inboxbear.com',
  'incognitomail.com',
  'jetable.org',
  'jourrapide.com',
  'kasmail.com',
  'klassmaster.com',
  'koszmail.pl',
  'kurzepost.de',
  'lackmail.net',
  'lifebyfood.com',
  'lroid.com',
  'mailbidon.com',
  'mailcatch.com',
  'maildrop.cc',
  'mailexpire.com',
  'mailforspam.com',
  'mailimate.com',
  'mailin8r.com',
  'mailinator.com',
  'mailinator.net',
  'mailinator2.com',
  'mailme.lv',
  'mailmetrash.com',
  'mailmoat.com',
  'mailnesia.com',
  'mailnull.com',
  'mailpick.biz',
  'mailrock.biz',
  'mailsac.com',
  'mailshell.com',
  'mailslite.com',
  'mailtemp.info',
  'mailtrash.net',
  'mailzilla.com',
  'moakt.com',
  'mohmal.com',
  'mytemp.email',
  'mytempemail.com',
  'mytrashmail.com',
  'no-spam.ws',
  'noclickemail.com',
  'nomail.xl.cx',
  'nomorespam.kz',
  'nospam.ze.tc',
  'notmailinator.com',
  'nowmymail.com',
  'nwldx.com',
  'objectmail.com',
  'obobbo.com',
  'odaymail.com',
  'onewaymail.com',
  'pokemail.net',
  'privacy.net',
  'proxymail.eu',
  'put2.net',
  'rcpt.at',
  'rhyta.com',
  'rppkn.com',
  'sharklasers.com',
  'shiftmail.com',
  'shitmail.me',
  'sogetthis.com',
  'soodonims.com',
  'spam.la',
  'spam4.me',
  'spamavert.com',
  'spambob.com',
  'spambog.com',
  'spambox.us',
  'spamdecoy.net',
  'spamfree24.com',
  'spamgourmet.com',
  'spamhereplease.com',
  'spamhole.com',
  'spaminator.de',
  'spammotel.com',
  'spamspot.com',
  'superrito.com',
  'teleworm.com',
  'teleworm.us',
  'tempail.com',
  'tempemail.com',
  'tempemail.net',
  'tempinbox.co.uk',
  'tempinbox.com',
  'tempmail.de',
  'tempmail.eu',
  'tempmail.us',
  'tempmail2.com',
  'tempmaildemand.com',
  'tempmailer.com',
  'tempmailer.de',
  'tempomail.fr',
  'tempr.email',
  'thankyou2010.com',
  'thisisnotmyrealemail.com',
  'throwam.com',
  'throwaway.email',
  'throwawaymail.com',
  'tmail.ws',
  'tmailinator.com',
  'tokem.co',
  'trashmail.at',
  'trashmail.com',
  'trashmail.io',
  'trashmail.me',
  'trashmail.net',
  'trashmail.ws',
  'trashymail.com',
  'tyldd.com',
  'uggsrock.com',
  'upliftnow.com',
  'uplipht.com',
  'venompen.com',
  'veryrealemail.com',
  'viditag.com',
  'viewcastmedia.com',
  'viewcastmedia.net',
  'viewcastmedia.org',
  'webmails.com',
  'wegwerfadresse.de',
  'wegwerfemail.de',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'wegwerfmail.org',
  'whyspam.me',
  'willhackforfood.biz',
  'willselfdestruct.com',
  'winemaven.info',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'zetmail.com',
  'zxcv.com',
];

async function fetchUpstreamList(): Promise<string[]> {
  log.info({ url: SOURCE_URL }, 'Fetching upstream disposable domain list');
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Upstream fetch failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const offline = args.has('--offline');

  let domains: string[];

  if (offline) {
    log.info('Using bundled fallback list (--offline)');
    domains = FALLBACK_DOMAINS;
  } else {
    try {
      domains = await fetchUpstreamList();
      log.info({ count: domains.length }, 'Fetched upstream list');
    } catch (err) {
      log.warn({ err }, 'Upstream fetch failed, using fallback list');
      domains = FALLBACK_DOMAINS;
    }
  }

  if (dryRun) {
    log.info({ count: domains.length }, '[dry-run] Would import domains, skipping database write');
    const sample = domains.slice(0, 10).join(', ');
    log.info(`Sample: ${sample}${domains.length > 10 ? ', …' : ''}`);
    return;
  }

  const result = await bulkAddDomains(domains, {
    source: 'seed',
    notes: 'Imported from disposable-email-domains public list',
    addedBy: null,
  });

  log.info(
    `Seed complete: inserted=${result.inserted}, updated=${result.updated}, skipped=${result.skipped}, total=${result.total}`,
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    log.error({ err }, 'Seed failed');
    process.exit(1);
  });
