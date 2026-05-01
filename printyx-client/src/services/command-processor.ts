// Executes commands the platform sends down through the heartbeat
// response. Each command is one-shot — the processor runs it, then
// posts an ack with status='done' or status='failed' so the operator
// sees the outcome in the UI.

import { PrintyxAPIClient } from '../api/printyx-client';
import { ConfigManager } from '../config/config-manager';
import { getLogger } from '../utils/logger';

export interface CommandHandlers {
  /** Force a metrics collection + submission cycle now. */
  forceSubmit(): Promise<{ devicesCollected: number; devicesSubmitted: number }>;
  /** Re-run network discovery now. */
  rescan(): Promise<{ discovered: number }>;
  /** Re-fetch /config and apply any changes (polling, ranges, devices). */
  reloadConfig(): Promise<{ changed: string[] }>;
}

export class CommandProcessor {
  private logger = getLogger();
  private inFlight = new Set<string>(); // dedupe if a command appears twice

  constructor(
    private apiClient: PrintyxAPIClient,
    private configManager: ConfigManager,
    private handlers: CommandHandlers,
  ) {}

  /**
   * Process a batch of commands. Runs sequentially — these are operator
   * actions where ordering tends to matter (rotate-key after a force-submit
   * is intentional). Errors in one command don't block the next.
   */
  async processBatch(
    commands: Array<{ id: string; command: string; payload?: Record<string, unknown> }>,
  ): Promise<void> {
    if (!commands || commands.length === 0) return;

    this.logger.info(`Processing ${commands.length} command(s) from heartbeat`);
    for (const cmd of commands) {
      if (this.inFlight.has(cmd.id)) continue;
      this.inFlight.add(cmd.id);
      try {
        await this.runOne(cmd);
      } finally {
        this.inFlight.delete(cmd.id);
      }
    }
  }

  private async runOne(cmd: {
    id: string;
    command: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const start = Date.now();
    this.logger.info(`Command '${cmd.command}' (${cmd.id}) starting`);

    try {
      let result: Record<string, unknown> = {};
      switch (cmd.command) {
        case 'force-submit':
          result = await this.handlers.forceSubmit();
          break;
        case 'rescan':
          result = await this.handlers.rescan();
          break;
        case 'reload-config':
          result = await this.handlers.reloadConfig();
          break;
        case 'rotate-key':
          // Server-side rotation is initiated separately; here we just
          // log that we received the signal so the operator sees it.
          // After this the next poll will use the new key once they
          // updated config.json out-of-band.
          result = { note: 'rotate-key received; agent continues with current key until restart' };
          break;
        default:
          throw new Error(`Unsupported command: ${cmd.command}`);
      }

      const durationMs = Date.now() - start;
      this.logger.info(`Command '${cmd.command}' done in ${durationMs}ms`);
      await this.apiClient.ackCommand(cmd.id, {
        status: 'done',
        result: { ...result, durationMs },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Command '${cmd.command}' failed: ${message}`);
      try {
        await this.apiClient.ackCommand(cmd.id, {
          status: 'failed',
          errorMessage: message,
        });
      } catch (ackError) {
        // If the ack itself fails the platform will eventually expire the
        // command (heartbeat sweep). Don't crash the processor.
        this.logger.warn(`Could not ack failed command ${cmd.id}`, { ackError });
      }
    }
  }
}
