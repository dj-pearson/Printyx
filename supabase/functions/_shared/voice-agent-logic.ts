// Pure decision logic for the after-hours voice agent (US-SUPER-013 / PROD-012).
//
// KEEP IN SYNC with server/routes-voice-agent.ts. These functions decide the
// priority of an inbound service call, what gets redacted from the stored
// transcript, what the call cost, and whether the agent should have answered at
// all — and the intake pipeline CREATES A SERVICE TICKET from that priority.
// A drift between backends would open tickets at the wrong urgency, or page the
// on-call technician when it should not.
//
// Locked by server/tests/unit/voice-agent-logic-parity.test.ts, which runs every
// case through both copies.

export type VoiceCallPriority = 'P1' | 'P2' | 'P3';

export interface IntakeSummary {
  detectedIssue: string;
  machineRef: string | null;
  callbackNumber: string | null;
  language: string;
}

export interface BusinessHours {
  tz?: string;
  days?: Record<string, { open?: string; close?: string } | null>;
}

export const TWILIO_RATE_PER_MIN = 0.013;
export const AI_RATE_PER_MIN = 0.1;

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Keyword priority classifier.
 *   P1: down / critical / emergency / not working / no power
 *   P2: broken / won't print / severe jam
 *   P3: slow / error / intermittent / quality (default)
 */
export function classifyPriority(text: string): VoiceCallPriority {
  const t = (text ?? '').toLowerCase();
  const p1 = ['down', 'critical', 'emergency', 'not working', 'no power'];
  const p2 = ['broken', "won't print", 'wont print', 'severe jam', 'bad jam', 'jammed badly'];
  if (p1.some((k) => t.includes(k))) return 'P1';
  if (p2.some((k) => t.includes(k))) return 'P2';
  // P3 keywords (slow/error/intermittent/quality) and default both land here.
  return 'P3';
}

/** Mask card-like number sequences (13-16 digit runs → ****). */
export function redactPii(text: string): string {
  if (!text) return text;
  return text.replace(/\b\d[\d ]{11,18}\d\b/g, (m) => {
    const digits = m.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 16 ? '****' : m;
  });
}

/** Per-minute proxy cost estimate. */
export function estimateCost(durationSeconds: number): {
  twilioCost: number;
  aiCost: number;
  totalCost: number;
} {
  const minutes = Math.max(0, durationSeconds) / 60;
  const twilioCost = Math.round(minutes * TWILIO_RATE_PER_MIN * 1e4) / 1e4;
  const aiCost = Math.round(minutes * AI_RATE_PER_MIN * 1e4) / 1e4;
  const totalCost = Math.round((twilioCost + aiCost) * 1e4) / 1e4;
  return { twilioCost, aiCost, totalCost };
}

const PHONE_RE = /(\+?\d[\d().\-\s]{8,}\d)/;

/** Deterministic offline fallback intake extraction. */
export function fallbackSummary(transcript: string): IntakeSummary {
  const text = (transcript ?? '').trim();
  const phoneMatch = text.match(PHONE_RE);
  return {
    detectedIssue: text.slice(0, 2000) || 'Service request (no transcript captured).',
    machineRef: null,
    callbackNumber: phoneMatch ? phoneMatch[1].trim() : null,
    language: 'en',
  };
}

export function parseHHMM(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Best-effort: true when `now` falls inside the configured business hours. If
 * businessHours is unset or malformed, returns false — treat everything as
 * after-hours so the agent answers rather than dropping the call.
 */
export function isWithinBusinessHours(businessHours: unknown, now = new Date()): boolean {
  const bh = (businessHours ?? null) as BusinessHours | null;
  if (!bh || !bh.days || typeof bh.days !== 'object') return false;
  const dayKey = DAY_KEYS[now.getDay()];
  const window = bh.days[dayKey];
  if (!window) return false;
  const open = parseHHMM(window.open);
  const close = parseHHMM(window.close);
  if (open == null || close == null || close <= open) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= open && mins < close;
}

/** voice P1/P2/P3 → service_tickets.priority */
export function ticketPriority(p: VoiceCallPriority): string {
  return p === 'P1' ? 'urgent' : p === 'P2' ? 'high' : 'medium';
}

/** Normalise a phone number to its last 10 digits, or null if too short. */
export function last10Digits(fromNumber?: string | null): string | null {
  if (!fromNumber) return null;
  const norm = fromNumber.replace(/\D/g, '');
  if (norm.length < 7) return null;
  return norm.slice(-10);
}
