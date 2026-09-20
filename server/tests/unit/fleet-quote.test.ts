// COP-B06: fleet context on a quote, and the one number that must not be faked.
//
// A copier deal is routinely won or lost on buyout exposure. `equipment` has a
// monthly payment and a lease end date and NO buyout column, so remaining term
// times payment is the remaining PAYMENT STREAM - not a buyout, which the
// lessor quotes and which usually includes a residual. These tests exist to
// keep those two apart.
import { describe, it, expect } from 'vitest';

import {
  exposureForMachine,
  fleetContextFromAssessment,
  remainingLeaseMonths,
  remainingPayments,
  rollupExposure,
  type FleetMachine,
} from '@shared/fleet-quote';

const NOW = new Date('2026-09-20T00:00:00.000Z');
const monthsOut = (n: number) => new Date(NOW.getTime() + n * 30.4375 * 86_400_000).toISOString();

const machine = (over: Partial<FleetMachine> = {}): FleetMachine => ({
  equipmentId: 'e1',
  serialNumber: 'S-1',
  modelName: 'bizhub C360',
  monthlyBlack: 8_000,
  monthlyColor: 1_500,
  currentCostPerPage: 0.0182,
  monthlyPayment: 250,
  leaseExpiresDate: monthsOut(18),
  ...over,
});

describe('remainingLeaseMonths — zero is a fact, null is an absence', () => {
  it('counts whole months to the lease end', () => {
    expect(remainingLeaseMonths(monthsOut(18), NOW)).toBe(18);
    expect(remainingLeaseMonths(monthsOut(0.4), NOW)).toBe(1);
  });

  it('is ZERO for a lease that has already run out', () => {
    // The rep can replace that machine today and owes nothing more. That is a
    // measured fact, and it must not read as "unknown".
    expect(remainingLeaseMonths(monthsOut(-3), NOW)).toBe(0);
  });

  it('is NULL when no lease date is recorded, which is a different thing', () => {
    expect(remainingLeaseMonths(null, NOW)).toBeNull();
    expect(remainingLeaseMonths('not a date', NOW)).toBeNull();
  });
});

describe('remainingPayments', () => {
  it('multiplies the payment by the months left', () => {
    expect(remainingPayments(250, 18)).toBe(4_500);
    expect(remainingPayments('250.00', 18)).toBe(4_500);
  });

  it('is null when either side is unknown — never a partial product', () => {
    expect(remainingPayments(null, 18)).toBeNull();
    expect(remainingPayments(250, null)).toBeNull();
  });

  it('is zero for an expired lease with a known payment', () => {
    expect(remainingPayments(250, 0)).toBe(0);
  });
});

describe('exposureForMachine — what a replacement line shows (AC2)', () => {
  it('carries the serial, the term and the stream', () => {
    expect(exposureForMachine(machine(), NOW)).toMatchObject({
      serialNumber: 'S-1',
      remainingMonths: 18,
      monthlyPayment: 250,
      remainingPayments: 4_500,
    });
  });

  it('reports a machine with no payment recorded as unknown, not free', () => {
    const e = exposureForMachine(machine({ monthlyPayment: null }), NOW);
    expect(e.remainingMonths).toBe(18);
    expect(e.remainingPayments).toBeNull();
  });
});

describe('rollupExposure — AC3, the number the deal turns on', () => {
  it('sums what it can derive and NAMES what it could not', () => {
    // A roll-up that silently omits two machines is how a rep walks into a
    // meeting with a number that is wrong in the customer's favour.
    const r = rollupExposure(
      [
        machine({ equipmentId: 'e1', monthlyPayment: 250, leaseExpiresDate: monthsOut(18) }),
        machine({ equipmentId: 'e2', serialNumber: 'S-2', leaseExpiresDate: null }),
        machine({ equipmentId: 'e3', serialNumber: 'S-3', monthlyPayment: null }),
      ],
      null,
      NOW,
    );
    expect(r.derivedRemainingPayments).toBe(4_500);
    expect(r.unknown.map((u) => u.equipmentId)).toEqual(['e2', 'e3']);
    expect(r.unknown[0].reason).toMatch(/lease end date/i);
    expect(r.unknown[1].reason).toMatch(/monthly payment/i);
    expect(r.machinesDisplaced).toBe(3);
  });

  it('PREFERS THE RECORDED BUYOUT, because that is what the lessor quoted', () => {
    const r = rollupExposure([machine()], '11750.00', NOW);
    expect(r.recordedBuyout).toBe(11_750);
    expect(r.authoritative).toBe('recorded');
    // The derived stream is still reported - it is what the payments add up to
    // - but it is not the number to quote.
    expect(r.derivedRemainingPayments).toBe(4_500);
  });

  it('falls back to the derived stream and says that is what it is', () => {
    expect(rollupExposure([machine()], null, NOW).authoritative).toBe('derived');
  });

  it('claims nothing when no machine is displaced', () => {
    const r = rollupExposure([], null, NOW);
    expect(r.authoritative).toBeNull();
    expect(r.derivedRemainingPayments).toBe(0);
    expect(r.machinesDisplaced).toBe(0);
  });

  it('counts an expired lease as zero rather than as unknown', () => {
    const r = rollupExposure([machine({ leaseExpiresDate: monthsOut(-2) })], null, NOW);
    expect(r.unknown).toEqual([]);
    expect(r.derivedRemainingPayments).toBe(0);
  });
});

describe('fleetContextFromAssessment — AC1 and AC4', () => {
  const equipmentById = new Map([
    ['e1', { monthlyPayment: '250.00', leaseExpiresDate: monthsOut(12) }],
  ]);

  it('takes the volumes and cost per page from the SNAPSHOT, not a recomputation', () => {
    // That is what makes the savings story and the quote agree: they cite the
    // same numbers because they are the same numbers.
    const [m] = fleetContextFromAssessment(
      [
        {
          equipmentId: 'e1',
          serialNumber: 'S-1',
          modelName: 'C360',
          monthlyBlack: 8_000,
          monthlyColor: 1_500,
          costPerPage: 0.0182,
        },
      ],
      equipmentById,
    );
    expect(m).toMatchObject({
      monthlyBlack: 8_000,
      monthlyColor: 1_500,
      currentCostPerPage: 0.0182,
      monthlyPayment: 250,
    });
  });

  it('keeps an UNCOSTED machine null rather than zero', () => {
    // A zero here would let the quote claim a saving against a rate nobody
    // measured.
    const [m] = fleetContextFromAssessment(
      [{ equipmentId: 'e1', costPerPage: null, monthlyBlack: null }],
      equipmentById,
    );
    expect(m.currentCostPerPage).toBeNull();
    expect(m.monthlyBlack).toBeNull();
  });

  it('tolerates a machine the equipment lookup does not carry', () => {
    const [m] = fleetContextFromAssessment([{ equipmentId: 'gone' }], equipmentById);
    expect(m.monthlyPayment).toBeNull();
    expect(m.leaseExpiresDate).toBeNull();
  });
});
