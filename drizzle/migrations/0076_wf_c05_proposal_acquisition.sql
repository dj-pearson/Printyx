-- WF-C-05: how the deal is paid, recorded on the proposal.
--
-- Acceptance always called createContractFromProposal and never created a lease,
-- whatever the proposal said. `leases` carries proposal_id, business_record_id
-- and contract_id columns that nothing filled, and the only nearby field,
-- payment_terms, was written by nothing and read by nothing. So a leased fleet
-- was indistinguishable from a cash sale the moment the customer clicked Accept.
--
-- All nullable: an existing proposal has no acquisition type and stays valid, and
-- a proposal that does not state one creates the contract and no lease - which is
-- what happens today - rather than a guess at the commercial terms.
--
-- payment_terms is deliberately NOT reused. net_30 is when an invoice falls due,
-- not whether the customer ends up owning the machine.
--
-- IF NOT EXISTS throughout: db:generate emits bare ADD COLUMN, and these land on
-- databases at different points in the chain.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS acquisition_type varchar(20);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS funding_partner varchar;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS finance_term_months integer;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS finance_monthly_payment numeric(10, 2);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS first_payment_date timestamp;
