import { describe, it, expect } from 'vitest';
import {
  collectRequiredPartNumbers,
  buildAvailablePartSet,
  computeTicketPartsResults,
  type DispatchTicketLike,
} from '../../lib/service-dispatch-parts';

const tickets: DispatchTicketLike[] = [
  { id: 't1', ticketNumber: 'SVC-1', title: 'Fuser swap', requiredParts: ['FUSER-A', 'ROLLER-B'] },
  { id: 't2', ticketNumber: 'SVC-2', title: 'No parts', requiredParts: [] },
  { id: 't3', ticketNumber: 'SVC-3', title: 'Toner', requiredParts: ['TONER-C', 'FUSER-A'] },
  { id: 't4', ticketNumber: 'SVC-4', title: 'Null parts', requiredParts: null },
];

describe('service-dispatch parts batching (CR-025)', () => {
  it('collects distinct, non-empty part numbers across tickets', () => {
    const parts = collectRequiredPartNumbers(tickets);
    expect(parts.sort()).toEqual(['FUSER-A', 'ROLLER-B', 'TONER-C']);
  });

  it('marks a part available only when an inventory row has quantity > 0', () => {
    const available = buildAvailablePartSet([
      { partNumber: 'FUSER-A', quantityAvailable: 5 },
      { partNumber: 'ROLLER-B', quantityAvailable: 0 },
      { partNumber: 'TONER-C', quantityAvailable: '3' }, // decimal comes back as string
      { partNumber: null, quantityAvailable: 9 },
    ]);
    expect(available.has('FUSER-A')).toBe(true);
    expect(available.has('ROLLER-B')).toBe(false);
    expect(available.has('TONER-C')).toBe(true);
  });

  it('produces per-ticket results identical to the old nested-loop logic', () => {
    const available = buildAvailablePartSet([
      { partNumber: 'FUSER-A', quantityAvailable: 5 },
      { partNumber: 'ROLLER-B', quantityAvailable: 0 },
      { partNumber: 'TONER-C', quantityAvailable: 3 },
    ]);
    const results = computeTicketPartsResults(tickets, available);

    expect(results).toEqual([
      {
        ticketId: 't1',
        ticketNumber: 'SVC-1',
        title: 'Fuser swap',
        partsAvailable: false,
        missingPartsCount: 1,
        totalPartsRequired: 2,
        message: '1 part(s) missing',
      },
      {
        ticketId: 't2',
        ticketNumber: 'SVC-2',
        title: 'No parts',
        partsAvailable: true,
        missingPartsCount: 0,
        message: 'No parts required',
      },
      {
        ticketId: 't3',
        ticketNumber: 'SVC-3',
        title: 'Toner',
        partsAvailable: true,
        missingPartsCount: 0,
        totalPartsRequired: 2,
        message: 'All parts available',
      },
      {
        ticketId: 't4',
        ticketNumber: 'SVC-4',
        title: 'Null parts',
        partsAvailable: true,
        missingPartsCount: 0,
        message: 'No parts required',
      },
    ]);
  });

  it('treats an empty required-parts set as zero inventory queries', () => {
    const noParts = collectRequiredPartNumbers([
      { id: 'x', ticketNumber: null, title: null, requiredParts: [] },
    ]);
    expect(noParts).toEqual([]);
  });
});
