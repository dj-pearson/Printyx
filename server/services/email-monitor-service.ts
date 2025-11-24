import { db } from '../db';
import { processedEmails, emailMonitorConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { AIEmailParserService } from './ai-email-parser-service';
import { TicketCreationService } from './ticket-creation-service';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  tlsOptions?: { rejectUnauthorized: boolean };
}

/**
 * Email Monitor Service
 *
 * Monitors email inbox (IMAP) for new service request emails
 * and automatically creates tickets using AI parsing.
 * NOTE: IMAP functionality is disabled - feature coming soon
 */
export class EmailMonitorService {
  private imap: any = null;
  private config: EmailConfig;
  private tenantId: string;
  private isConnected = false;
  private isProcessing = false;

  constructor(config: EmailConfig, tenantId: string) {
    this.config = config;
    this.tenantId = tenantId;
  }

  /**
   * Connect to IMAP server
   * Note: IMAP functionality is disabled - feature coming soon
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }
    console.log('[EmailMonitor] IMAP email monitoring is temporarily disabled');
    this.isConnected = false;
  }

  /**
   * Check inbox for new unread emails
   */
  async checkForNewEmails(): Promise<void> {
    if (this.isProcessing) {
      console.log('[EmailMonitor] Already processing, skipping this check');
      return;
    }

    this.isProcessing = true;

    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.imap) {
        throw new Error('IMAP connection not initialized');
      }

      await this.processInbox();
    } catch (error) {
      console.error('[EmailMonitor] Error checking emails:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process emails in inbox
   */
  private async processInbox(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not connected'));
        return;
      }

      this.imap.openBox('INBOX', false, async (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for unread emails
        this.imap!.search(['UNSEEN'], async (err, results) => {
          if (err) {
            reject(err);
            return;
          }

          if (results.length === 0) {
            console.log('[EmailMonitor] No new emails');
            resolve();
            return;
          }

          console.log(`[EmailMonitor] Found ${results.length} new emails`);

          try {
            // Process emails one by one
            for (const uid of results) {
              await this.processEmail(uid);
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  }

  /**
   * Process a single email by UID
   */
  private async processEmail(uid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not connected'));
        return;
      }

      const fetch = this.imap.fetch(uid, {
        bodies: '',
        struct: true,
      });

      fetch.on('message', (msg) => {
        msg.on('body', async (stream) => {
          try {
            const parsed = await simpleParser(stream);
            await this.handleParsedEmail(parsed);

            // Mark as read after successful processing
            this.imap!.addFlags(uid, ['\\Seen'], (err) => {
              if (err) {
                console.error('[EmailMonitor] Error marking email as read:', err);
              }
            });

            resolve();
          } catch (error) {
            console.error('[EmailMonitor] Error processing email:', error);
            reject(error);
          }
        });
      });

      fetch.once('error', reject);
    });
  }

  /**
   * Handle a parsed email - check if already processed, then create ticket
   */
  private async handleParsedEmail(email: ParsedMail): Promise<void> {
    const emailId = email.messageId || `${Date.now()}-${Math.random()}`;
    const from = email.from?.text || '';
    const subject = email.subject || '(No Subject)';
    const textBody = email.text || '';
    const htmlBody = email.html || '';

    console.log(`[EmailMonitor] Processing email from: ${from}, subject: ${subject}`);

    // Check if already processed (idempotency)
    const existing = await db.query.processedEmails.findFirst({
      where: eq(processedEmails.emailId, emailId),
    });

    if (existing) {
      console.log(`[EmailMonitor] Email ${emailId} already processed, skipping`);
      return;
    }

    const startTime = Date.now();

    try {
      // Extract attachments info
      const attachments = (email.attachments || []).map((att) => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
      }));

      // Pass to AI parser
      const aiParserService = new AIEmailParserService(this.tenantId);
      const parsedData = await aiParserService.parseEmail({
        from,
        subject,
        body: textBody || htmlBody,
        attachments,
      });

      // Create ticket
      const ticketService = new TicketCreationService(this.tenantId);
      const ticket = await ticketService.createTicket(parsedData);

      // Send confirmation email
      const config = await this.getMonitorConfig();
      if (config?.sendConfirmationEmail) {
        await ticketService.sendConfirmationEmail(from, ticket);
      }

      const duration = Date.now() - startTime;

      // Mark as processed
      await db.insert(processedEmails).values({
        tenantId: this.tenantId,
        emailId,
        from,
        to: email.to?.text || '',
        subject,
        body: textBody,
        htmlBody: htmlBody?.toString() || null,
        ticketId: ticket.id,
        parsedData: parsedData as any,
        processingStatus: 'success',
        aiConfidence: (parsedData as any).confidence || 'medium',
        processingDuration: duration,
      });

      // Update stats
      await this.updateStats('success');

      console.log(`[EmailMonitor] ✓ Ticket ${ticket.id} created from email ${emailId} (${duration}ms)`);
    } catch (error) {
      console.error('[EmailMonitor] Error creating ticket from email:', error);

      const duration = Date.now() - startTime;

      // Mark as failed
      await db.insert(processedEmails).values({
        tenantId: this.tenantId,
        emailId,
        from,
        to: email.to?.text || '',
        subject,
        body: textBody,
        htmlBody: htmlBody?.toString() || null,
        ticketId: null,
        parsedData: null,
        processingStatus: 'failed',
        processingError: error instanceof Error ? error.message : String(error),
        processingDuration: duration,
      });

      // Update stats
      await this.updateStats('failed');

      throw error;
    }
  }

  /**
   * Get monitor configuration for this tenant
   */
  private async getMonitorConfig() {
    return await db.query.emailMonitorConfig.findFirst({
      where: eq(emailMonitorConfig.tenantId, this.tenantId),
    });
  }

  /**
   * Update statistics in config
   */
  private async updateStats(status: 'success' | 'failed') {
    const config = await this.getMonitorConfig();
    if (!config) return;

    const updates: any = {
      lastCheckAt: new Date(),
      updatedAt: new Date(),
    };

    if (status === 'success') {
      updates.lastSuccessAt = new Date();
      updates.totalEmailsProcessed = (config.totalEmailsProcessed || 0) + 1;
      updates.totalTicketsCreated = (config.totalTicketsCreated || 0) + 1;
    } else {
      updates.lastErrorAt = new Date();
      updates.lastError = 'Failed to process email';
    }

    await db
      .update(emailMonitorConfig)
      .set(updates)
      .where(eq(emailMonitorConfig.tenantId, this.tenantId));
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    if (this.imap) {
      this.imap.end();
      this.imap = null;
      this.isConnected = false;
      console.log('[EmailMonitor] Disconnected');
    }
  }
}

/**
 * Global email monitor instances (one per tenant)
 */
const emailMonitors = new Map<string, {
  monitor: EmailMonitorService;
  interval: NodeJS.Timeout;
}>();

/**
 * Start email monitoring for a tenant
 */
export async function startEmailMonitor(tenantId: string): Promise<void> {
  // Check if already running
  if (emailMonitors.has(tenantId)) {
    console.log(`[EmailMonitor] Already running for tenant ${tenantId}`);
    return;
  }

  // Get configuration from database
  const config = await db.query.emailMonitorConfig.findFirst({
    where: eq(emailMonitorConfig.tenantId, tenantId),
  });

  if (!config || !config.enabled) {
    console.log(`[EmailMonitor] Monitoring not enabled for tenant ${tenantId}`);
    return;
  }

  if (!config.host || !config.username || !config.encryptedPassword) {
    console.error(`[EmailMonitor] Missing configuration for tenant ${tenantId}`);
    return;
  }

  // Decrypt password (TODO: implement encryption/decryption)
  const password = config.encryptedPassword; // For now, assuming not encrypted

  const emailConfig: EmailConfig = {
    host: config.host,
    port: config.port || 993,
    user: config.username,
    password,
    tls: config.tls !== false,
  };

  const monitor = new EmailMonitorService(emailConfig, tenantId);

  // Poll every N seconds (from config)
  const pollInterval = (config.pollInterval || 60) * 1000; // Convert to milliseconds

  const interval = setInterval(async () => {
    try {
      await monitor.checkForNewEmails();
    } catch (error) {
      console.error(`[EmailMonitor] Error checking emails for tenant ${tenantId}:`, error);
      // Don't stop monitoring on error, just log and continue
    }
  }, pollInterval);

  emailMonitors.set(tenantId, { monitor, interval });

  console.log(`[EmailMonitor] Started monitoring for tenant ${tenantId} (polling every ${pollInterval / 1000}s)`);

  // Do initial check immediately
  try {
    await monitor.checkForNewEmails();
  } catch (error) {
    console.error(`[EmailMonitor] Error in initial check for tenant ${tenantId}:`, error);
  }
}

/**
 * Stop email monitoring for a tenant
 */
export async function stopEmailMonitor(tenantId: string): Promise<void> {
  const instance = emailMonitors.get(tenantId);
  if (!instance) {
    console.log(`[EmailMonitor] No monitor running for tenant ${tenantId}`);
    return;
  }

  clearInterval(instance.interval);
  await instance.monitor.disconnect();
  emailMonitors.delete(tenantId);

  console.log(`[EmailMonitor] Stopped monitoring for tenant ${tenantId}`);
}

/**
 * Start monitoring for all enabled tenants
 */
export async function startAllEmailMonitors(): Promise<void> {
  const configs = await db.query.emailMonitorConfig.findMany({
    where: eq(emailMonitorConfig.enabled, true),
  });

  console.log(`[EmailMonitor] Starting monitors for ${configs.length} tenants`);

  for (const config of configs) {
    try {
      await startEmailMonitor(config.tenantId);
    } catch (error) {
      console.error(`[EmailMonitor] Failed to start monitor for tenant ${config.tenantId}:`, error);
    }
  }
}

/**
 * Stop all email monitors
 */
export async function stopAllEmailMonitors(): Promise<void> {
  const tenantIds = Array.from(emailMonitors.keys());

  console.log(`[EmailMonitor] Stopping ${tenantIds.length} monitors`);

  for (const tenantId of tenantIds) {
    await stopEmailMonitor(tenantId);
  }
}
