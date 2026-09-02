-- Record on the PROPOSAL that its pricing exception was approved (WF-C-04).
--
-- WHY A COLUMN AND NOT A LOOKUP. The send guardrail in supabase/functions/proposals
-- trusted `body.approved`, which QuoteBuilder set from the SENDER'S OWN isManager
-- flag - client-side authorization, so a rep could send any quote by posting
-- `approved: true`, and a rep whose deal-desk exception had actually been approved
-- still could not send, because approval only moved approval_requests.status.
-- The guardrail now decides from the caller's role level and from this stamp. It is
-- a column rather than a join because the guardrail runs on every send and the
-- alternative is a query into approval_requests filtered on quote_id and status for
-- a row that usually is not there.
--
-- pricing_approval_id points at approval_requests.id. No FK: `proposals` lives in
-- two schema files with different shapes (check:dup-tables), and adding a
-- constraint from the ambiguous side is how a migration comes to fail on one
-- database and not another. The value is written only by the deal-desk function's
-- final-approve branch.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS pricing_approval_id varchar;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS pricing_approved_at timestamp;

-- Partial index: the guardrail asks "is this proposal approved", which is a
-- lookup by id, and the only interesting rows are the stamped ones.
CREATE INDEX IF NOT EXISTS proposals_pricing_approval_idx
  ON proposals (pricing_approval_id)
  WHERE pricing_approval_id IS NOT NULL;
