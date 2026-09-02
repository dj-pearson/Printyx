-- WF-V-05: one service-ticket status and priority vocabulary, enforced.
--
-- There were four vocabularies and no constraint enforced any of them, so a
-- filter could not match. shared/schema.ts's comment said `in-progress` with a
-- hyphen; ServiceHub offered `new` and `emergency`, which nothing writes;
-- MobileServiceDispatch typed `en-route` and `on-site`; the demo seeder writes
-- underscores; and the stats endpoint had to count BOTH spellings (WF-V-01)
-- because picking one silently zeroed a card.
--
-- UNDERSCORES ARE CANONICAL, because the seeder, the mobile check-in and every
-- current writer use them - so the hyphen spellings are the ones with (probably)
-- no rows behind them. Choosing the other way would mean rewriting live data to
-- match a comment.
--
-- THE BACKFILL RUNS FIRST, and only maps spellings this repository is known to
-- produce. Anything else is left alone deliberately: a value nobody can account
-- for is evidence about the data, and rewriting it would destroy that evidence.

UPDATE service_tickets SET status = 'in_progress' WHERE status IN ('in-progress', 'inprogress');
--> statement-breakpoint
UPDATE service_tickets SET status = 'en_route' WHERE status IN ('en-route', 'enroute');
--> statement-breakpoint
UPDATE service_tickets SET status = 'on_site' WHERE status IN ('on-site', 'onsite');
--> statement-breakpoint
UPDATE service_tickets SET status = 'on_hold' WHERE status IN ('on-hold', 'onhold');
--> statement-breakpoint
UPDATE service_tickets SET status = 'open' WHERE status IN ('new', 'pending', 'unassigned');
--> statement-breakpoint
UPDATE service_tickets SET status = 'completed' WHERE status IN ('resolved', 'closed', 'complete');
--> statement-breakpoint
UPDATE service_tickets SET status = 'cancelled' WHERE status IN ('canceled', 'voided');
--> statement-breakpoint
UPDATE service_tickets SET priority = 'urgent' WHERE priority IN ('critical', 'emergency', 'p1');
--> statement-breakpoint
UPDATE service_tickets SET priority = 'medium' WHERE priority IN ('normal', 'standard');
--> statement-breakpoint
UPDATE service_tickets SET priority = 'low' WHERE priority = 'routine';
--> statement-breakpoint

-- NOT VALID IS THE POINT, NOT A SHORTCUT.
--
-- The AC asks for the constraint "after a data audit", and this environment has
-- no production database to audit. NOT VALID enforces every INSERT and UPDATE
-- from here on - which is what stops a fifth spelling appearing - while leaving
-- rows the backfill above did not recognise in place rather than failing the
-- migration on data nobody has looked at. An operator who has run the audit
-- finishes the job with, per table and constraint:
--
--   SELECT DISTINCT status FROM service_tickets
--     WHERE status NOT IN ('open','assigned','scheduled','en_route','on_site',
--                          'in_progress','on_hold','completed','cancelled');
--   ALTER TABLE service_tickets VALIDATE CONSTRAINT service_tickets_status_check;
--
-- Validating is a lock-light scan; it does not rewrite the table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_tickets_status_check'
      AND conrelid = 'service_tickets'::regclass
  ) THEN
    ALTER TABLE service_tickets
      ADD CONSTRAINT service_tickets_status_check
      CHECK (status IN ('open','assigned','scheduled','en_route','on_site',
                        'in_progress','on_hold','completed','cancelled'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_tickets_priority_check'
      AND conrelid = 'service_tickets'::regclass
  ) THEN
    ALTER TABLE service_tickets
      ADD CONSTRAINT service_tickets_priority_check
      CHECK (priority IN ('low','medium','high','urgent'))
      NOT VALID;
  END IF;
END $$;
