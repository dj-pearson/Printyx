/**
 * Google Indexing API Service
 *
 * Uses the Google Indexing API to notify Google when URLs are updated or removed.
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON environment variable containing the
 * service account JSON key.
 *
 * @see https://developers.google.com/search/apis/indexing-api/v3/prereqs
 */

import { google } from 'googleapis';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('google-indexing-service');

type IndexingAction = 'URL_UPDATED' | 'URL_DELETED';

interface IndexingResult {
  url: string;
  type: IndexingAction;
  success: boolean;
  notifyTime?: string;
  error?: string;
}

interface BatchIndexingResult {
  total: number;
  successful: number;
  failed: number;
  results: IndexingResult[];
}

function getAuthClient() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON contains invalid JSON');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });

  return auth;
}

/**
 * Submit a single URL to the Google Indexing API.
 */
async function submitUrl(url: string, type: IndexingAction = 'URL_UPDATED'): Promise<IndexingResult> {
  try {
    const auth = getAuthClient();
    const indexing = google.indexing({ version: 'v3', auth });

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type,
      },
    });

    log.info(`Successfully submitted ${type} for ${url}`);

    return {
      url,
      type,
      success: true,
      notifyTime: response.data.urlNotificationMetadata?.latestUpdate?.notifyTime ?? undefined,
    };
  } catch (err: any) {
    const message = err?.message || 'Unknown error';
    log.error(`Failed to submit ${type} for ${url}: ${message}`);
    return {
      url,
      type,
      success: false,
      error: message,
    };
  }
}

/**
 * Submit multiple URLs to the Google Indexing API.
 * Google recommends batching but the API has a quota of ~200 requests/day.
 */
async function submitUrls(urls: string[], type: IndexingAction = 'URL_UPDATED'): Promise<BatchIndexingResult> {
  const results: IndexingResult[] = [];

  // Process sequentially to respect rate limits
  for (const url of urls) {
    const result = await submitUrl(url, type);
    results.push(result);
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  log.info(`Batch indexing complete: ${successful} succeeded, ${failed} failed out of ${urls.length} URLs`);

  return {
    total: urls.length,
    successful,
    failed,
    results,
  };
}

/**
 * Get the notification status for a URL from the Indexing API.
 */
async function getUrlStatus(url: string) {
  try {
    const auth = getAuthClient();
    const indexing = google.indexing({ version: 'v3', auth });

    const response = await indexing.urlNotifications.getMetadata({
      url,
    });

    return {
      url,
      success: true,
      latestUpdate: response.data.latestUpdate,
      latestRemove: response.data.latestRemove,
    };
  } catch (err: any) {
    const message = err?.message || 'Unknown error';
    log.error(`Failed to get status for ${url}: ${message}`);
    return {
      url,
      success: false,
      error: message,
    };
  }
}

export const googleIndexingService = {
  submitUrl,
  submitUrls,
  getUrlStatus,
};
