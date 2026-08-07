/**
 * PROD-011 — pure logic behind the technician-sessions edge function.
 *
 * Tests the module the handler delegates to (supabase/functions/technician-sessions/sessions.ts);
 * index.ts itself imports @supabase/supabase-js from esm.sh and cannot be loaded
 * under Node.
 */

import { describe, it, expect } from 'vitest';
import {
  STEP_TICKET_STATUS,
  WORKFLOW_STEP_NAMES,
  completedStepNames,
  isKnownStepName,
  parseArrivalTime,
  parseGpsLocation,
  ticketStatusForStep,
  toCamelSession,
  toCamelWorkflowStep,
  type WorkflowStepRow,
} from '../../../supabase/functions/technician-sessions/sessions';

describe('ticketStatusForStep', () => {
  it('maps every guided step to the status the Express handler used', () => {
    expect(ticketStatusForStep('initial_assessment')).toBe('in-progress');
    expect(ticketStatusForStep('diagnosis')).toBe('in-progress');
    expect(ticketStatusForStep('customer_approval')).toBe('customer_approval');
    expect(ticketStatusForStep('work_execution')).toBe('in-progress');
    expect(ticketStatusForStep('testing')).toBe('testing');
    expect(ticketStatusForStep('completion')).toBe('completed');
  });

  it('completing the final step resolves the ticket, not just advances it', () => {
    // The whole point of the last step: if this regressed to 'in-progress',
    // finished visits would sit open forever and never reach billing.
    expect(ticketStatusForStep('completion')).toBe('completed');
  });

  it('falls back to in-progress for an unknown or missing step', () => {
    expect(ticketStatusForStep('nonsense')).toBe('in-progress');
    expect(ticketStatusForStep(null)).toBe('in-progress');
    expect(ticketStatusForStep(undefined)).toBe('in-progress');
    expect(ticketStatusForStep('')).toBe('in-progress');
  });

  it('does not know check_in — check-in is its own endpoint and sets on_site', () => {
    expect('check_in' in STEP_TICKET_STATUS).toBe(false);
    expect(isKnownStepName('check_in')).toBe(false);
  });
});

describe('isKnownStepName', () => {
  it('accepts exactly the six guided steps', () => {
    expect(WORKFLOW_STEP_NAMES).toHaveLength(6);
    for (const name of WORKFLOW_STEP_NAMES) {
      expect(isKnownStepName(name)).toBe(true);
    }
  });

  it('rejects anything that is not one of them', () => {
    // A typo must not park a service ticket in a status nothing maps out of.
    expect(isKnownStepName('Diagnosis')).toBe(false);
    expect(isKnownStepName('')).toBe(false);
    expect(isKnownStepName(null)).toBe(false);
    expect(isKnownStepName(undefined)).toBe(false);
    expect(isKnownStepName(42)).toBe(false);
    expect(isKnownStepName({ stepName: 'diagnosis' })).toBe(false);
  });

  it('rejects inherited Object properties', () => {
    // `stepName in STEP_TICKET_STATUS` would say true for 'toString' if the map
    // were consulted carelessly.
    expect(isKnownStepName('toString')).toBe(false);
    expect(isKnownStepName('constructor')).toBe(false);
  });
});

describe('toCamelSession', () => {
  const row = {
    id: 'sess-1',
    tenant_id: 'tenant-1',
    service_ticket_id: 'ticket-1',
    technician_id: 'tech-1',
    expected_latitude: '40.7128000',
    expected_longitude: '-74.0060000',
    actual_latitude: '40.7130000',
    actual_longitude: '-74.0061000',
    location_verified: true,
    distance_from_expected: '22.50',
    check_in_timestamp: '2026-08-07T14:00:00.000Z',
    check_in_address: null,
    check_in_notes: 'Front desk sent me up',
    workflow_step: 'diagnosis',
    initial_assessment: 'Paper path jam',
    diagnosis_notes: 'Worn pickup roller',
    customer_approval_needed: true,
    customer_approval_received: false,
    work_performed: null,
    parts_used_ids: ['part-a'],
    parts_requested_ids: [],
    issue_resolved: false,
    follow_up_required: false,
    follow_up_reason: null,
    check_out_timestamp: null,
    total_duration_minutes: 95,
    billable_hours: '1.50',
    customer_present: true,
    customer_signature: null,
    customer_satisfaction_rating: 4,
    customer_feedback: null,
    created_at: '2026-08-07T13:59:00.000Z',
    updated_at: '2026-08-07T15:00:00.000Z',
  };

  it('maps total_duration_minutes onto totalDuration', () => {
    // The column is total_duration_minutes but the page reads session.totalDuration
    // to price the billing entry. A wrong key here bills every visit at 1 hour.
    expect(toCamelSession(row).totalDuration).toBe(95);
  });

  it('returns the keys the page reads', () => {
    const session = toCamelSession(row);
    expect(session.id).toBe('sess-1');
    expect(session.serviceTicketId).toBe('ticket-1');
    expect(session.technicianId).toBe('tech-1');
    expect(session.workflowStep).toBe('diagnosis');
    expect(session.checkInNotes).toBe('Front desk sent me up');
    expect(session.checkOutTimestamp).toBeNull();
    expect(session.customerSatisfactionRating).toBe(4);
  });

  it('emits no snake_case keys at all', () => {
    // Returning raw rows is the EDGE-005a defect: the page spreads camelCase
    // reads straight off the response and renders blank.
    for (const key of Object.keys(toCamelSession(row))) {
      expect(key).not.toContain('_');
    }
  });

  it('passes jsonb columns through untouched', () => {
    const session = toCamelSession({ ...row, parts_used_ids: [{ part_number: 'A-1' }] });
    // Never key-convert a jsonb column — the inner keys are data, not columns.
    expect(session.partsUsedIds).toEqual([{ part_number: 'A-1' }]);
  });

  it('nulls every absent column rather than leaving it undefined', () => {
    const session = toCamelSession({ id: 'sess-2' });
    expect(session.id).toBe('sess-2');
    expect(session.totalDuration).toBeNull();
    expect(session.workflowStep).toBeNull();
    expect(session.tenantId).toBeNull();
  });

  it('keeps false distinct from null on the booleans', () => {
    const session = toCamelSession({ ...row, location_verified: false, customer_present: false });
    expect(session.locationVerified).toBe(false);
    expect(session.customerPresent).toBe(false);
  });
});

describe('toCamelWorkflowStep', () => {
  const row = {
    id: 'step-1',
    tenant_id: 'tenant-1',
    session_id: 'sess-1',
    step_name: 'diagnosis',
    step_started: '2026-08-07T14:10:00.000Z',
    step_completed: '2026-08-07T14:35:00.000Z',
    step_data: { root_cause: 'roller', partsNeeded: [] },
    notes: 'Ordered roller',
    created_at: '2026-08-07T14:10:00.000Z',
  };

  it('maps step_name and step_completed, which drive the progress list', () => {
    const step = toCamelWorkflowStep(row);
    expect(step.stepName).toBe('diagnosis');
    expect(step.stepCompleted).toBe('2026-08-07T14:35:00.000Z');
    expect(step.stepStarted).toBe('2026-08-07T14:10:00.000Z');
  });

  it('leaves step_data jsonb keys alone', () => {
    expect(toCamelWorkflowStep(row).stepData).toEqual({ root_cause: 'roller', partsNeeded: [] });
  });

  it('reports an unfinished step as null, not undefined', () => {
    expect(toCamelWorkflowStep({ ...row, step_completed: null }).stepCompleted).toBeNull();
  });

  it('emits no snake_case keys', () => {
    for (const key of Object.keys(toCamelWorkflowStep(row))) {
      expect(key).not.toContain('_');
    }
  });
});

describe('completedStepNames', () => {
  const steps: WorkflowStepRow[] = [
    {
      id: '1',
      tenantId: 't',
      sessionId: 's',
      stepName: 'initial_assessment',
      stepStarted: '2026-08-07T14:00:00.000Z',
      stepCompleted: '2026-08-07T14:05:00.000Z',
      stepData: null,
      notes: null,
      createdAt: null,
    },
    {
      id: '2',
      tenantId: 't',
      sessionId: 's',
      stepName: 'diagnosis',
      stepStarted: '2026-08-07T14:05:00.000Z',
      stepCompleted: null,
      stepData: null,
      notes: null,
      createdAt: null,
    },
  ];

  it('counts only steps that carry a completion timestamp', () => {
    expect(completedStepNames(steps)).toEqual(['initial_assessment']);
  });

  it('drops a row with no step name instead of emitting a hole', () => {
    const nameless = { ...steps[0], stepName: null };
    expect(completedStepNames([nameless])).toEqual([]);
  });

  it('is empty for a fresh session', () => {
    expect(completedStepNames([])).toEqual([]);
  });
});

describe('parseGpsLocation', () => {
  it('splits a coordinate pair into the decimal columns', () => {
    expect(parseGpsLocation('40.7128, -74.0060')).toEqual({
      latitude: '40.7128',
      longitude: '-74.0060',
      address: null,
    });
  });

  it('accepts a pair with no space and integer degrees', () => {
    expect(parseGpsLocation('40,-74')).toEqual({
      latitude: '40',
      longitude: '-74',
      address: null,
    });
  });

  it('keeps free text verbatim instead of discarding it', () => {
    // A technician who typed a street address should not lose it.
    expect(parseGpsLocation('  1 Main St, Suite 4  ')).toEqual({
      latitude: null,
      longitude: null,
      address: '1 Main St, Suite 4',
    });
  });

  it('treats out-of-range degrees as text, not coordinates', () => {
    expect(parseGpsLocation('200, 45')).toEqual({
      latitude: null,
      longitude: null,
      address: '200, 45',
    });
    expect(parseGpsLocation('45, 200')).toEqual({
      latitude: null,
      longitude: null,
      address: '45, 200',
    });
  });

  it('accepts the exact boundaries', () => {
    expect(parseGpsLocation('90, 180').latitude).toBe('90');
    expect(parseGpsLocation('-90, -180').longitude).toBe('-180');
  });

  it('returns all nulls for empty, blank and non-string input', () => {
    for (const input of ['', '   ', null, undefined, 42, {}]) {
      expect(parseGpsLocation(input)).toEqual({ latitude: null, longitude: null, address: null });
    }
  });
});

describe('parseArrivalTime', () => {
  it('normalises the datetime-local value to an ISO string', () => {
    expect(parseArrivalTime('2026-08-07T14:00:00Z')).toBe('2026-08-07T14:00:00.000Z');
  });

  it('returns null for unparseable input so the column default applies', () => {
    expect(parseArrivalTime('not a time')).toBeNull();
    expect(parseArrivalTime('')).toBeNull();
    expect(parseArrivalTime('   ')).toBeNull();
    expect(parseArrivalTime(null)).toBeNull();
    expect(parseArrivalTime(undefined)).toBeNull();
    expect(parseArrivalTime(1754575200000)).toBeNull();
  });
});
