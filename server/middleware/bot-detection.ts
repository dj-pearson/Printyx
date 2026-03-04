/**
 * Bot Detection Middleware (SEC-014)
 *
 * Analyzes request characteristics to detect automated tools and bots.
 * Calculates a bot score (0-100) based on:
 *   - Known security tool User-Agent match: +80
 *   - Headless browser indicators: +60
 *   - Missing Accept-Language header: +20
 *   - Missing Accept header: +15
 *   - Missing Accept-Encoding header: +10
 *
 * Legitimate crawlers (Google, Bing, etc.) are allowlisted.
 * Default mode is 'log' -- requests are never blocked, only logged.
 */

import type { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '../lib/logger';
import {
  KNOWN_TOOL_SIGNATURES,
  LEGITIMATE_CRAWLERS,
  HEADLESS_INDICATORS,
} from '../config/bot-signatures';

const log = createModuleLogger('bot-detection');

export interface BotDetectionOptions {
  /** Response mode: 'log' only logs detections, 'block' would reject (not implemented). Default: 'log' */
  mode?: 'log';
  /** Bot score threshold for logging. Default: 30 */
  logThreshold?: number;
}

const DEFAULT_OPTIONS: Required<BotDetectionOptions> = {
  mode: 'log',
  logThreshold: 30,
};

/**
 * Check whether the request comes from a legitimate crawler that should be allowlisted.
 */
function isLegitimateCrawler(userAgent: string): boolean {
  return LEGITIMATE_CRAWLERS.some((crawler) => crawler.uaPattern.test(userAgent));
}

/**
 * Calculate a bot score for the given request.
 * Returns a number between 0 and 100. Higher means more likely to be a bot/tool.
 */
export function getBotScore(req: Request): number {
  const userAgent = req.headers['user-agent'] || '';

  // Allowlist legitimate crawlers -- they get score 0
  if (userAgent && isLegitimateCrawler(userAgent)) {
    return 0;
  }

  let score = 0;

  // Check for known security tool signatures (+80)
  if (userAgent) {
    for (const tool of KNOWN_TOOL_SIGNATURES) {
      if (tool.pattern.test(userAgent)) {
        score += 80;
        break;
      }
    }
  }

  // Check for headless browser indicators (+60)
  if (userAgent) {
    for (const pattern of HEADLESS_INDICATORS) {
      if (pattern.test(userAgent)) {
        score += 60;
        break;
      }
    }
  }

  // Missing Accept-Language header (+20)
  if (!req.headers['accept-language']) {
    score += 20;
  }

  // Missing Accept header (+15)
  if (!req.headers['accept']) {
    score += 15;
  }

  // Missing Accept-Encoding header (+10)
  if (!req.headers['accept-encoding']) {
    score += 10;
  }

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Returns the name of the matched security tool, or null if none matched.
 */
function getMatchedToolName(userAgent: string): string | null {
  for (const tool of KNOWN_TOOL_SIGNATURES) {
    if (tool.pattern.test(userAgent)) {
      return tool.name;
    }
  }
  return null;
}

/**
 * Bot detection middleware.
 * Calculates a bot score for each request and logs suspicious activity.
 * Does not block requests by default (log-only mode).
 */
export function botDetection(options: BotDetectionOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    const score = getBotScore(req);

    if (score >= opts.logThreshold) {
      const userAgent = req.headers['user-agent'] || '';
      const toolName = getMatchedToolName(userAgent);

      log.warn({
        event: 'bot_detected',
        score,
        tool: toolName,
        userAgent,
        ip: req.ip,
        method: req.method,
        path: req.path,
        missingHeaders: {
          acceptLanguage: !req.headers['accept-language'],
          accept: !req.headers['accept'],
          acceptEncoding: !req.headers['accept-encoding'],
        },
      }, `Bot detection: score ${score}${toolName ? ` (${toolName})` : ''}`);
    }

    next();
  };
}
