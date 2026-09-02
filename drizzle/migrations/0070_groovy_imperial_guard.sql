-- The contract knows where it came from (WF-C-09).
--
-- contracts carried a customer, a contract number, rates and a status, and
-- nothing about the sale that produced it; deals carried no contract either. The
-- spine from deal to installed unit broke at its first link, so nothing could
-- answer "which contract did this deal become" or the reverse - which is also
-- what WF-P-04's Needs Ordering queue has to ask.
--
-- All four columns on contracts are nullable, and so is deals.contract_id: a
-- contract keyed in by hand has no proposal, a cash sale has no lease, and a deal
-- that closes lost never gets a contract. acquisition_type (cash | lease |
-- finance) is declared here and left empty; WF-C-05 is the story that captures how
-- a deal is paid, and defaulting it would be inventing the commercial terms.
--
-- START AND END DATE BECOME NULLABLE, which is the substantive half of this
-- change. createContractFromProposal wrote today's date plus a 36-month term
-- nobody had agreed to. The end date is the worse of the two: contracts.tsx drives
-- its "expiring soon" badge off it and supabase/functions/contract-renewal builds
-- its whole queue by filtering on it, so an invented term produced invented
-- renewals. A contract's term starts when the equipment is accepted (WF-L-08). A
-- null end_date does not match those filters, which is the right answer for a
-- contract whose term is not yet agreed.
--
-- Existing rows keep whatever dates they have; this only stops NEW ones being
-- invented.
--
-- Idempotent and table-guarded, in the 0064-0069 idiom.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contracts'
  ) THEN
    ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "deal_id" varchar,
      ADD COLUMN IF NOT EXISTS "proposal_id" varchar,
      ADD COLUMN IF NOT EXISTS "lease_id" varchar,
      ADD COLUMN IF NOT EXISTS "acquisition_type" varchar;
    ALTER TABLE "contracts" ALTER COLUMN "start_date" DROP NOT NULL;
    ALTER TABLE "contracts" ALTER COLUMN "end_date" DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'deals'
  ) THEN
    ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "contract_id" varchar;
  END IF;
END $$;--> statement-breakpoint

DO $$
DECLARE
  link record;
BEGIN
  FOR link IN
    SELECT * FROM (VALUES
      ('contracts', 'deal_id',     'deals',     'contracts_deal_id_fkey'),
      ('contracts', 'proposal_id', 'proposals', 'contracts_proposal_id_fkey'),
      ('contracts', 'lease_id',    'leases',    'contracts_lease_id_fkey'),
      ('deals',     'contract_id', 'contracts', 'deals_contract_id_fkey')
    ) AS t(src, col, target, constraint_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = link.target
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = link.src AND column_name = link.col
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = link.src
        AND constraint_name = link.constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I("id") ON DELETE SET NULL',
        link.src, link.constraint_name, link.col, link.target
      );
    END IF;
  END LOOP;
END $$;--> statement-breakpoint

-- GET /api/contracts?dealId= and the reverse lookup from a deal.
CREATE INDEX IF NOT EXISTS "contracts_tenant_deal_idx"
  ON "contracts" USING btree ("tenant_id", "deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_tenant_proposal_idx"
  ON "contracts" USING btree ("tenant_id", "proposal_id");
