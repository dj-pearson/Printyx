/**
 * LAUNCH-011: the disaster-recovery scripts, exercised rather than read.
 *
 * Four of that story's seven criteria were marked "NEEDS OPS TESTING" and
 * nobody had run them. This container has PostgreSQL 16, so they are runnable
 * (the COP-M07 recipe), and running them found three defects in the one code
 * path whose whole purpose is to be correct the day everything else is not.
 *
 *  1. THE FORECASTING BACKUP WAS A COPY OF THE MAIN DATABASE. db-backup.sh
 *     called `run_backup "$DB_NAME" "printyx-forecast-backup"` with no
 *     `--schema` filter, so `npm run db:backup` produced TWO 228K archives, both
 *     with the same 683 tables, one of them named as the forecasting backup -
 *     and logged "Forecasting database backup successful". The CronJob has
 *     always passed `--schema=forecasting` and the runbook has always called it
 *     the "Forecasting schema", so the hand-run script and the nightly job wrote
 *     DIFFERENT ARTIFACTS UNDER THE SAME NAME into the same GCS folder.
 *  2. LOCAL RETENTION DELETED WEEKLY AND MONTHLY ARCHIVES AT SEVEN DAYS. The
 *     no-gsutil branch was `find -name '*.sql.gz' -mtime +7 -delete`, which does
 *     not distinguish the tiers - while the script and db-backup-list.sh both
 *     print "Daily 7 days / Weekly 4 weeks / Monthly 12 months". Proven by
 *     aging four files: a 20-day-old weekly and a 100-day-old monthly were both
 *     deleted.
 *  3. THE CRONJOB'S EMPTINESS GUARD COULD NOT FAIL. `pg_dump | gzip || echo`
 *     swallows the status even under `set -o pipefail`, and gzip of EMPTY input
 *     is a 20-byte file - so `[ -s ]` calls it non-empty and uploads it.
 *
 * ONE CLAIM WAS OVERSTATED AND CORRECTED BEFORE IT SHIPPED: the first draft
 * added `set -o pipefail` to db-backup.sh's dump with a comment saying failure
 * detection depended on it. It does not - line 23 already sets it globally, and
 * pointing the script at a database that does not exist gives exit 1, "backup
 * FAILED" and no file left behind. Proving a claim against the thing itself is
 * what separates it from the two above.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const stripComments = (s: string) => s.replace(/^\s*#.*$/gm, '');

const BACKUP = read('scripts/db-backup.sh');
const RESTORE = read('scripts/db-restore.sh');
const LIST = read('scripts/db-backup-list.sh');
const CRONJOB = read('k8s/base/cronjob-backup.yaml');

describe('the forecasting backup is the forecasting schema, not the whole database', () => {
  it('passes a schema filter to pg_dump', () => {
    const code = stripComments(BACKUP);
    expect(code).toMatch(/dump_args\+=\(--schema="\$schema"\)/);
    expect(code).toMatch(
      /run_backup "\$DB_NAME" "printyx-forecast-backup" "\$\{BACKUP_FORECAST_SCHEMA:-forecasting\}"/,
    );
  });

  it('does not call the forecast backup with the bare main database', () => {
    // The exact line that produced two identical archives.
    expect(stripComments(BACKUP)).not.toMatch(
      /run_backup "\$DB_NAME" "printyx-forecast-backup"\s*;/,
    );
  });

  it('agrees with the CronJob, which always dumped the schema', () => {
    expect(CRONJOB).toContain('--schema=forecasting');
    // Both name the same artifact, so they must mean the same thing by it.
    expect(CRONJOB).toContain('printyx-forecast-backup-');
    expect(stripComments(BACKUP)).toContain('printyx-forecast-backup');
  });
});

describe('local retention honours the three tiers it advertises', () => {
  const code = stripComments(BACKUP);

  it('no longer deletes every archive at seven days', () => {
    expect(code).not.toMatch(/find "\$BACKUP_LOCAL_DIR" -name "\*\.sql\.gz" -mtime \+7 -delete/);
  });

  it('keeps a first-of-month archive for a year and a Sunday one for four weeks', () => {
    expect(code).toMatch(/keep_days=365/);
    expect(code).toMatch(/keep_days=28/);
    expect(code).toMatch(/keep_days=7/);
    // The tier comes from the date IN THE FILENAME, which is what the GCS
    // branch keys on too - not from a weekly/ and monthly/ copy of each file.
    expect(code).toMatch(/dom=\$\(date -u -d "\$file_date" \+%d\)/);
    expect(code).toMatch(/dow=\$\(date -u -d "\$file_date" \+%u\)/);
  });

  it('KEEPS an archive it cannot date rather than deleting it', () => {
    // An archive nobody can tier is not one anybody should silently destroy.
    const prune = code.slice(code.indexOf('prune_local_backups()'));
    const undated = prune.slice(
      prune.indexOf('if [ -z "$file_date" ]'),
      prune.indexOf('age_days='),
    );
    expect(undated).toContain('kept=$((kept + 1))');
    expect(undated).not.toContain('rm -f');
  });

  it('is what BOTH retention paths call, so the GCS branch cannot drift', () => {
    const calls = [...code.matchAll(/prune_local_backups/g)];
    // definition + the no-gsutil branch + the tail of the GCS branch
    expect(calls.length).toBe(3);
  });

  it('the policy the list command prints is the one implemented', () => {
    expect(LIST).toMatch(/Daily:\s+7 days/);
    expect(LIST).toMatch(/Weekly:\s+4 weeks/);
    expect(LIST).toMatch(/Monthly: 12 months/);
  });
});

describe('the CronJob cannot upload an empty archive and call it a backup', () => {
  it('captures pg_dump status instead of swallowing it with || echo', () => {
    expect(CRONJOB).toContain('FORECAST_RC=0');
    expect(CRONJOB).toMatch(/\| gzip -9 > "\/tmp\/\$\{FORECAST_FILE\}" \|\| FORECAST_RC=\$\?/);
    expect(CRONJOB).not.toContain('|| echo "Forecasting schema backup skipped');
  });

  it('uses a byte floor, because an empty gzip is 20 bytes and passes [ -s ]', () => {
    expect(CRONJOB).toMatch(/FORECAST_BYTES.*-lt 100/s);
    expect(CRONJOB).not.toMatch(
      /\[ -f "\/tmp\/\$\{FORECAST_FILE\}" \] && \[ -s "\/tmp\/\$\{FORECAST_FILE\}" \]/,
    );
  });
});

describe('the parts that were already right stay right', () => {
  it('db-backup.sh fails a pipeline whose pg_dump failed', () => {
    // Verified by running it against a database that does not exist: exit 1,
    // "Main database backup FAILED", no file left behind. This assertion is the
    // reason the redundant in-line `set -o pipefail` was removed rather than
    // kept "just in case" - it would have implied the global one is not enough.
    expect(BACKUP).toMatch(/^set -euo pipefail$/m);
  });

  it('restore still requires an interactive confirmation, twice for production', () => {
    expect(RESTORE).toContain('read -p "Are you sure you want to restore this backup?');
    expect(RESTORE).toContain('This appears to be the PRODUCTION database!');
    expect(RESTORE).toMatch(/RESTORE_TARGET_DB/);
  });

  it('backup degrades to local when gsutil is absent rather than failing', () => {
    expect(BACKUP).toContain('gsutil not found - backups will only be saved locally');
  });
});
