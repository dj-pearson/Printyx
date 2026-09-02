-- WF-L-09: onboarding_equipment.equipment_id becomes a real reference.
--
-- The column was nullable, unconstrained, and set only when a caller already had
-- an id to pass - and no caller did. Nothing stopped it holding a string that is
-- not an equipment row, and nothing linked a device to the equipment table at
-- all, so an onboarded machine never reached meter billing, service or toner
-- replenishment.
--
-- Orphaned ids are cleared before the constraint is added: an id that resolves to
-- no row is already meaningless, and failing the migration on it would leave the
-- column unconstrained on exactly the databases that need it most.
--
-- ON DELETE SET NULL rather than CASCADE: deleting a machine must not delete the
-- record of the install that put it there.

UPDATE onboarding_equipment oe
SET equipment_id = NULL
WHERE oe.equipment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM equipment e WHERE e.id = oe.equipment_id);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'onboarding_equipment_equipment_id_fkey'
      AND conrelid = 'onboarding_equipment'::regclass
  ) THEN
    ALTER TABLE onboarding_equipment
      ADD CONSTRAINT onboarding_equipment_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS onboarding_equipment_equipment_id_idx
  ON onboarding_equipment (equipment_id);
