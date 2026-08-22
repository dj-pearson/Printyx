/**
 * QUALITY-002 — regression guard: routes-service-dispatch binds to the REAL
 * technicians / service_tickets columns.
 *
 * The file was written against a mock shape: `technicians.name`, `.status`,
 * `.location` (real columns are first_name/last_name, is_active/is_available,
 * current_location) and it updated `serviceTickets.technicianId` (real column
 * is assigned_technician_id). Drizzle's `.set()` DROPS unknown keys silently,
 * so auto-assignment reported success while writing nothing but updated_at.
 *
 * It also filtered pending work by `status = 'pending'`, a value nothing in the
 * app ever writes — service_tickets defaults to 'open' and the ticket edge fn
 * writes `body.status || 'open'` — so the endpoint always saw zero tickets.
 *
 * tsc catches the column half now that the phantoms are gone; the status
 * literal is a VALUE, invisible to the compiler, so it is asserted here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { serviceTickets, technicians } from '../../../shared/schema';

// toSQL() only compiles; it never touches the client.
const qb = drizzle({} as never);
const source = readFileSync(join(__dirname, '../../routes-service-dispatch.ts'), 'utf8');

describe('QUALITY-002: dispatch routes use real technician columns', () => {
  it('assigns via assigned_technician_id, not a dropped technicianId key', () => {
    const { sql } = qb
      .update(serviceTickets)
      .set({ assignedTechnicianId: 'tech-1', status: 'assigned' })
      .where(eq(serviceTickets.id, 'tk-1'))
      .toSQL();

    expect(sql).toContain('"assigned_technician_id"');
    expect(source).not.toMatch(
      /\btechnicianId:\s*(availableTech|assignedTech)\.id,\s*\n\s*status:/,
    );
  });

  it('filters technicians by is_active/is_available — there is no status column', () => {
    const { sql } = qb
      .select()
      .from(technicians)
      .where(
        and(
          eq(technicians.tenantId, 'T1'),
          eq(technicians.isActive, true),
          eq(technicians.isAvailable, true),
        ),
      )
      .toSQL();

    expect(sql).toContain('"is_active"');
    expect(sql).toContain('"is_available"');
    expect(Object.keys(technicians)).not.toContain('status');
    expect(Object.keys(technicians)).not.toContain('location');
    expect(Object.keys(technicians)).not.toContain('name');
  });

  it('queries unassigned work as status=open, the value the app actually writes', () => {
    expect(source).not.toContain("serviceTickets.status, 'pending'");
    expect(source).toContain("eq(serviceTickets.status, 'open')");
    expect(source).not.toContain("stat.status === 'pending'");
  });

  it('never references the phantom technician fields again', () => {
    expect(source).not.toMatch(/technicians\.(name|status|location)\b/);
    expect(source).not.toMatch(/\b(tech|availableTech|assignedTech)\.(name|status|location)\b/);
  });
});
