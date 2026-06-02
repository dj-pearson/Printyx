// Self-update. On each heartbeat the platform tells the agent which version
// it currently serves. When that's newer than what we're running (and both
// the platform and local config allow it), we download the new bundle, swap
// it in place, and exit cleanly so the service manager (NSSM on Windows,
// systemd on Linux) restarts us on the new code.
//
// Safety:
//   - Only ever acts when running as a single-file bundle (printyx-client.cjs).
//     In a source/dist install we skip — there's no single file to swap.
//   - Sanity-checks the download (size + header) before touching disk.
//   - Backs up the current bundle to .bak; the swap window is microseconds.
//   - Attempts each target version at most once per process lifetime, so a
//     restart loop can't hammer the platform.

import * as fs from 'fs';
import * as path from 'path';
import { PrintyxAPIClient } from '../api/printyx-client';
import { ConfigManager } from '../config/config-manager';
import { getLogger } from '../utils/logger';

export interface UpdateSignal {
  latestVersion: string;
  available: boolean;
  enabled: boolean;
  url: string;
}

export class UpdateManager {
  private logger = getLogger();
  private attempted = new Set<string>();
  private busy = false;

  constructor(
    private apiClient: PrintyxAPIClient,
    private configManager: ConfigManager,
  ) {}

  /** Path of the running bundle, or null if not a single-.cjs install. */
  private bundlePath(): string | null {
    const entry = process.argv[1] || '';
    if (entry.toLowerCase().endsWith('printyx-client.cjs')) return path.resolve(entry);
    return null;
  }

  async maybeUpdate(update?: UpdateSignal): Promise<void> {
    if (!update || !update.available) return;
    if (this.busy || this.attempted.has(update.latestVersion)) return;

    // Local opt-out wins over the platform's "available".
    const cfg = this.configManager.getConfig();
    if (cfg.update?.enabled === false) {
      this.logger.debug('Update available but disabled in local config; skipping.');
      return;
    }

    const target = this.bundlePath();
    if (!target) {
      this.logger.warn(
        'Update available but agent is not running as a single bundle (.cjs); skipping auto-update.',
      );
      return;
    }

    this.busy = true;
    this.attempted.add(update.latestVersion);
    try {
      this.logger.info(
        `Auto-update: downloading agent v${update.latestVersion} from ${update.url}`,
      );
      const buf = await this.apiClient.downloadBundle(update.url);
      if (!this.looksLikeBundle(buf)) {
        throw new Error(`Downloaded bundle failed sanity check (${buf.length} bytes)`);
      }

      const dir = path.dirname(target);
      const tmp = path.join(dir, `printyx-client.cjs.new-${process.pid}`);
      const bak = path.join(dir, 'printyx-client.cjs.bak');

      fs.writeFileSync(tmp, buf);
      fs.copyFileSync(target, bak); // rollback copy
      fs.rmSync(target, { force: true }); // Windows: rename can't clobber
      fs.renameSync(tmp, target);

      this.logger.info(
        `Auto-update: installed v${update.latestVersion}; exiting so the service restarts on new code.`,
      );
      // Clean exit → NSSM/systemd restart policy brings us back on the new file.
      process.exit(0);
    } catch (err) {
      this.logger.error('Auto-update failed; staying on current version', {
        err: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.busy = false;
    }
  }

  private looksLikeBundle(buf: Buffer): boolean {
    if (buf.length < 100 * 1024) return false; // our bundle is ~1.4 MB
    const head = buf.subarray(0, 64).toString('utf-8');
    return head.startsWith('#!') || head.includes('use strict');
  }
}
