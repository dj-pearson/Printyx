/**
 * Customer-portal service classification (PROD-011) — port of the pure logic in
 * server/routes-portal-service.ts.
 *
 * Split from index.ts so it can run in CI: index.ts imports _shared/supabase.ts,
 * which pulls @supabase/supabase-js from esm.sh at RUNTIME and cannot be loaded
 * by Node. Everything here is pure.
 *
 * This classifier decides what a customer's plain-English problem description
 * means, what priority it gets, and which parts a technician should bring. The
 * AI path is best-effort; the RULE path is the floor, and it must always produce
 * something usable — a customer who describes a grinding noise must never get an
 * empty playbook because a model call failed.
 */

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type SuggestedPriority = (typeof PRIORITIES)[number];

export interface RecommendedPart {
  partNumber: string;
  name: string;
  reason: string;
}

export interface Playbook {
  key: string;
  title: string;
  steps: string[];
}

export interface Classification {
  category: string;
  suggestedPriority: SuggestedPriority;
  recommendedParts: RecommendedPart[];
  playbook: Playbook;
  confidence: number;
  source: 'ai' | 'fallback';
}

interface FallbackRule {
  category: string;
  priority: SuggestedPriority;
  match: RegExp;
  playbook: Playbook;
  parts: RecommendedPart[];
}

/**
 * Ordered rules — FIRST match wins, so the order is behavior, not decoration.
 * mechanical_noise leads because grinding is the most urgent symptom and its
 * words ("noise", "grinding") rarely appear in the other categories; supplies
 * sits below print_quality because "low" and "empty" also show up in quality
 * complaints.
 */
const FALLBACK_RULES: FallbackRule[] = [
  {
    category: 'mechanical_noise',
    priority: 'high',
    match: /grind|grinding|noise|rattl|clunk|squeal/i,
    playbook: {
      key: 'mechanical_noise',
      title: 'Mechanical noise / grinding',
      steps: [
        'Power the device off and inspect for visible debris or loose paper fragments.',
        'Check the fuser and drive gears for wear.',
        'Dispatch a technician — grinding usually indicates a failing gear or roller.',
      ],
    },
    parts: [
      {
        partNumber: 'GEAR-DRV-01',
        name: 'Main drive gear',
        reason: 'Common source of grinding noise.',
      },
      {
        partNumber: 'ROLL-FUS-02',
        name: 'Fuser roller',
        reason: 'Worn rollers cause rattling under load.',
      },
    ],
  },
  {
    category: 'paper_jam',
    priority: 'medium',
    match: /jam|stuck|paper/i,
    playbook: {
      key: 'paper_jam',
      title: 'Recurring paper jam',
      steps: [
        'Open all trays and clear any jammed sheets along the paper path.',
        'Verify paper type and tray guides match the loaded media.',
        'If jams recur, replace the pickup/feed rollers.',
      ],
    },
    parts: [
      {
        partNumber: 'ROLL-PICK-01',
        name: 'Pickup roller kit',
        reason: 'Worn pickup rollers misfeed paper.',
      },
      { partNumber: 'SEP-PAD-01', name: 'Separation pad', reason: 'Prevents multi-sheet pulls.' },
    ],
  },
  {
    category: 'print_quality',
    priority: 'medium',
    match: /streak|line|smear|faded|quality|spot|ghost|blurry/i,
    playbook: {
      key: 'print_quality',
      title: 'Print quality defect',
      steps: [
        'Run the built-in cleaning / calibration cycle.',
        'Inspect the drum unit and imaging components for scratches.',
        'Replace the drum or transfer belt if defects persist.',
      ],
    },
    parts: [
      {
        partNumber: 'DRUM-IMG-01',
        name: 'Imaging drum unit',
        reason: 'Streaks/lines trace to a worn drum.',
      },
      {
        partNumber: 'BELT-TRN-01',
        name: 'Transfer belt',
        reason: 'Smearing/ghosting comes from the belt.',
      },
    ],
  },
  {
    category: 'supplies',
    priority: 'low',
    match: /toner|ink|supply|supplies|empty|cartridge|low/i,
    playbook: {
      key: 'supplies',
      title: 'Supplies / consumables',
      steps: [
        'Confirm which consumable is depleted from the device panel.',
        'Ship or schedule the matching toner/ink cartridge.',
        'No on-site visit required unless install assistance is requested.',
      ],
    },
    parts: [
      {
        partNumber: 'TONER-BLK-01',
        name: 'Black toner cartridge',
        reason: 'Most common depleted supply.',
      },
    ],
  },
  {
    category: 'connectivity',
    priority: 'high',
    match: /error code|offline|network|connect|connection|ip address|scan to|wifi|wi-fi/i,
    playbook: {
      key: 'connectivity',
      title: 'Connectivity / offline',
      steps: [
        'Verify the device shows a valid IP address and the cable/Wi-Fi link is up.',
        'Power-cycle the device and the network switch port.',
        'Re-add the print queue / check firewall rules if it stays offline.',
      ],
    },
    parts: [
      {
        partNumber: 'NIC-ETH-01',
        name: 'Network interface card',
        reason: 'Persistent offline can be a failed NIC.',
      },
    ],
  },
];

export const GENERAL_PLAYBOOK: Playbook = {
  key: 'general',
  title: 'General service request',
  steps: [
    'Capture the full problem description and any error messages.',
    'Triage with the customer to confirm severity and impact.',
    'Dispatch a technician for on-site diagnosis.',
  ],
};

/** Rule-based classification. Always returns a usable result. */
export function fallbackClassify(text: string): Classification {
  for (const rule of FALLBACK_RULES) {
    if (rule.match.test(text)) {
      return {
        category: rule.category,
        suggestedPriority: rule.priority,
        recommendedParts: rule.parts,
        playbook: rule.playbook,
        confidence: 0.4,
        source: 'fallback',
      };
    }
  }
  return {
    category: 'general',
    suggestedPriority: 'medium',
    recommendedParts: [],
    playbook: GENERAL_PLAYBOOK,
    confidence: 0.3,
    source: 'fallback',
  };
}

export function coercePriority(v: unknown): SuggestedPriority {
  const s = String(v ?? '').toLowerCase();
  return (PRIORITIES as readonly string[]).includes(s) ? (s as SuggestedPriority) : 'medium';
}

/** Accepts either camelCase or snake_case part numbers; caps the list at 5. */
export function coerceParts(v: unknown): RecommendedPart[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p) => p && typeof p === 'object')
    .map((p: Record<string, unknown>) => ({
      partNumber: String(p.partNumber ?? p.part_number ?? ''),
      name: String(p.name ?? ''),
      reason: String(p.reason ?? ''),
    }))
    .filter((p) => p.name || p.partNumber)
    .slice(0, 5);
}

export function coercePlaybook(v: unknown, fallback: Playbook): Playbook {
  if (!v || typeof v !== 'object') return fallback;
  const p = v as Record<string, unknown>;
  const steps = Array.isArray(p.steps)
    ? p.steps.map((s: unknown) => String(s)).filter(Boolean)
    : [];
  return {
    key: String(p.key ?? fallback.key),
    title: String(p.title ?? fallback.title),
    // An empty steps array is useless to a technician — keep the rule playbook.
    steps: steps.length > 0 ? steps : fallback.steps,
  };
}

export function buildClassifyPrompt(text: string): string {
  return (
    `You are a copier/MFP service dispatcher. A customer described a problem with their ` +
    `machine in plain English. Classify it and recommend a dispatch.\n\n` +
    `Customer text: """${text}"""\n\n` +
    `Return ONLY JSON (no prose) with this exact shape:\n` +
    `{\n` +
    `  "category": string (snake_case, e.g. "paper_jam" | "print_quality" | "mechanical_noise" | "supplies" | "connectivity" | "general"),\n` +
    `  "suggestedPriority": one of "low" | "medium" | "high" | "urgent",\n` +
    `  "recommendedParts": [{ "partNumber": string, "name": string, "reason": string }],\n` +
    `  "playbook": { "key": string, "title": string, "steps": string[] },\n` +
    `  "confidence": number between 0 and 1\n` +
    `}`
  );
}

/**
 * Merge a model reply over the rule-based result, or return null when it is
 * unusable so the caller falls back.
 *
 * Every field is coerced rather than trusted: this output drives a dispatch
 * priority and a parts list, so a model returning "priority": "catastrophic" or
 * a string where an array belongs must degrade to the rule value instead of
 * reaching the technician.
 */
export function parseAiClassification(
  text: string,
  fallback: Classification,
): Classification | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const category =
      typeof parsed.category === 'string' && parsed.category.trim()
        ? parsed.category.trim()
        : fallback.category;
    const conf = Number(parsed.confidence);
    return {
      category,
      suggestedPriority: coercePriority(parsed.suggestedPriority),
      recommendedParts: coerceParts(parsed.recommendedParts),
      playbook: coercePlaybook(parsed.playbook, fallback.playbook),
      // A model that omits or garbles confidence is assumed reasonably sure —
      // matching Express, which defaults to 0.7 rather than to the rule's 0.4.
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.7,
      source: 'ai',
    };
  } catch {
    return null;
  }
}

/** Map the classifier's priority onto the serviceRequestPriorityEnum. */
export function toRequestPriority(p: SuggestedPriority): 'low' | 'normal' | 'high' | 'urgent' {
  switch (p) {
    case 'high':
      return 'high';
    case 'urgent':
      return 'urgent';
    case 'low':
      return 'low';
    case 'medium':
    default:
      // The enum has no 'medium' — 'normal' is its middle value.
      return 'normal';
  }
}

/**
 * Postgres error codes that mean "this relation/column/enum isn't deployed here".
 * Dispatch degrades to skipped on these rather than failing the whole request,
 * so a customer still gets their classification on a partially-migrated tenant.
 */
export function isMissingTableOrTypeError(err: unknown): boolean {
  const e = (err ?? {}) as { code?: string; message?: string };
  const code = e.code;
  const msg = String(e.message ?? '').toLowerCase();
  return (
    code === '42P01' || // undefined_table
    code === '42703' || // undefined_column
    code === '42704' || // undefined_object (e.g. enum)
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('invalid input value for enum')
  );
}

// ---------------------------------------------------------------------------
// Uber-style timeline
// ---------------------------------------------------------------------------

export type StepStatus = 'done' | 'current' | 'pending';

export const TIMELINE_STEPS: Array<{ key: string; label: string }> = [
  { key: 'queued', label: 'Queued' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'en_route', label: 'En route' },
  { key: 'on_site', label: 'On site' },
  { key: 'resolved', label: 'Resolved' },
];

/**
 * Furthest timeline step a request status has reached. -1 means cancelled, which
 * the caller renders as no active step rather than as step 0.
 */
export function statusToStepIndex(status: string | null | undefined): number {
  switch (status) {
    case 'submitted':
    case 'acknowledged':
    case 'on_hold':
      return 0; // queued
    case 'assigned':
      return 1; // dispatched
    case 'in_progress':
      // There is no separate en_route signal, so in_progress is treated as the
      // furthest point it could have reached.
      return 3; // on_site
    case 'completed':
      return 4; // resolved
    case 'cancelled':
      return -1;
    default:
      return 0;
  }
}

/**
 * Build the customer-facing step list.
 *
 * Two details matter and are easy to get wrong:
 *  - A COMPLETED request marks its reached step 'done', not 'current'. Otherwise
 *    the final "Resolved" step renders as still-in-progress forever.
 *  - A CANCELLED request has every step 'pending' — no step is highlighted,
 *    because the work stopped rather than progressed.
 *
 * `reachedAt` maps step index -> ISO timestamp of the FIRST time that step was
 * reached, taken from the status history.
 */
export function buildTimeline(
  status: string | null | undefined,
  reachedAt: Record<number, string> = {},
): Array<{ key: string; label: string; status: StepStatus; at: string | null }> {
  const cancelled = status === 'cancelled';
  const reachedIdx = statusToStepIndex(status);

  return TIMELINE_STEPS.map((step, i) => {
    let stepStatus: StepStatus;
    if (cancelled) {
      stepStatus = 'pending';
    } else if (i < reachedIdx) {
      stepStatus = 'done';
    } else if (i === reachedIdx) {
      stepStatus = status === 'completed' ? 'done' : 'current';
    } else {
      stepStatus = 'pending';
    }
    return { key: step.key, label: step.label, status: stepStatus, at: reachedAt[i] ?? null };
  });
}

/** step index -> first timestamp that step was reached, from status history. */
export function reachedAtFromHistory(
  history: Array<{ newStatus?: string | null; createdAt?: string | null }>,
): Record<number, string> {
  const reachedAt: Record<number, string> = {};
  for (const h of history) {
    const idx = statusToStepIndex(h.newStatus);
    if (idx >= 0 && reachedAt[idx] == null && h.createdAt) {
      reachedAt[idx] = new Date(h.createdAt).toISOString();
    }
  }
  return reachedAt;
}
