/**
 * SEC-008: Threat Detection Middleware
 *
 * Hooks into every request to record behavioral signals and applies
 * progressive responses based on the computed threat score:
 *   - Score 50+: artificial latency (100-500ms)
 *   - Score 70+: set x-captcha-required header
 *   - Score 90+: block with 429 and log security event
 *
 * The X-Threat-Score response header is only added when
 * NODE_ENV is "development" or THREAT_DEBUG is set.
 */

import type { Request, Response, NextFunction } from 'express';
import { recordRequest, getThreatScore } from '../services/threat-detection-service';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('threat-detection-middleware');

const isDebugMode =
  process.env.NODE_ENV === 'development' || process.env.THREAT_DEBUG === 'true';

/**
 * Extract the client IP from the request, respecting common proxy headers.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Merge query + body params into a single plain object for tracking.
 */
function extractParams(req: Request): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      params[k] = v;
    }
  }
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) {
      params[k] = v;
    }
  }
  return params;
}

/**
 * Express middleware for behavioral threat detection.
 */
export function threatDetectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ip = getClientIp(req);
  const endpoint = req.path;

  // Check pre-request score and block immediately if already at 90+
  const preCheck = getThreatScore(ip);
  if (preCheck.score >= 90) {
    log.warn(
      { ip, score: preCheck.score, signals: preCheck.signals, endpoint },
      'Request blocked due to high threat score',
    );
    if (isDebugMode) {
      res.setHeader('X-Threat-Score', String(preCheck.score));
    }
    res.status(429).json({
      message: 'Too many suspicious requests. Please try again later.',
      code: 'THREAT_BLOCKED',
    });
    return;
  }

  // Record the request once the response finishes (so we capture status code)
  res.on('finish', () => {
    const params = extractParams(req);
    recordRequest(ip, endpoint, res.statusCode, params);
  });

  // Evaluate current threat level for progressive response
  const { score } = preCheck;

  if (isDebugMode) {
    res.setHeader('X-Threat-Score', String(score));
  }

  // Score 70+: signal captcha requirement
  if (score >= 70) {
    res.setHeader('x-captcha-required', 'true');
  }

  // Score 50+: add artificial latency (100-500ms, scaled linearly 50→100)
  if (score >= 50) {
    const fraction = Math.min((score - 50) / 50, 1);
    const delayMs = Math.round(100 + fraction * 400);
    setTimeout(() => {
      next();
    }, delayMs);
    return;
  }

  next();
}
