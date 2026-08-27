/**
 * QUALITY-002: routes/gps-tracking-routes.ts called six storage methods that
 * do not exist and passed the wrong arity to two more. Every one of those
 * endpoints threw a TypeError on the first request — storage is a concrete
 * object, so `storage.getActiveTechnicianLocations(...)` is "not a function",
 * not a 404.
 *
 * This asserts the route file only names methods the storage layer actually
 * has. It parses source rather than importing storage, because importing it
 * opens a database pool.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const ROUTES = fs.readFileSync('server/routes/gps-tracking-routes.ts', 'utf8');
const STORAGE = fs.readFileSync('server/storage.ts', 'utf8');

const called = [...new Set([...ROUTES.matchAll(/\bstorage\.(\w+)\s*\(/g)].map((m) => m[1]))].sort();

describe('gps-tracking routes call storage methods that exist', () => {
  it('finds the call sites at all', () => {
    expect(called.length).toBeGreaterThan(20);
  });

  it.each(called)('storage implements %s', (method) => {
    expect(STORAGE).toMatch(new RegExp(`^  async ${method}\\(`, 'm'));
  });

  // The six that did not exist. Named individually so a regression points at
  // the specific one rather than at a list.
  it.each([
    'getActiveTechnicianLocations',
    'getTechnicianLocationsByStatus',
    'updateEtaArrival',
    'checkGeofence',
  ])('%s is gone from the route file', (phantom) => {
    expect(ROUTES).not.toContain(`storage.${phantom}(`);
  });

  // getTicketActivityTimeline and getLatestEtaForTicketAnyTechnician were added
  // because the route paths carry a ticket and no technician, so the existing
  // technician-scoped methods could not serve them.
  it.each(['getTicketActivityTimeline', 'getLatestEtaForTicketAnyTechnician'])(
    'storage declares %s in its interface, not only on the class',
    (method) => {
      expect(STORAGE).toMatch(new RegExp(`^  ${method}\\(|^  ${method}: `, 'm'));
    },
  );
});
