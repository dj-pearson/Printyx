/**
 * Quote/proposal tables — re-exported. THE DECLARATIONS LIVE IN `shared/schema.ts`.
 *
 * This file used to declare all seven itself, and every one of them described a
 * table that has not existed since migration 0002:
 *
 *   proposals            15 columns it does not have, 11 it does, missing
 *   proposal_line_items   5 phantom, 7 missing
 *   proposal_templates   10 phantom, 5 missing
 *   proposal_approvals    7 phantom, 3 missing
 *   proposal_analytics    3 phantom, 2 missing
 *   proposal_comments     2 phantom, 1 missing
 *   equipment_packages    3 phantom, 3 missing
 *
 * 0002 reshaped these tables and this file was never updated, so it froze the
 * world as it looked before that migration. Measured against a real PostgreSQL
 * with the chain replayed, not read off the files: `schema.ts` matches the
 * database exactly for all seven.
 *
 * WHAT IT COST, STATED PRECISELY, because the obvious answer is wrong.
 * `check:phantom-cols` has NOT been blind to these since AUDIT-035: it resolves
 * an ambiguous table against `shared/drizzle-schema.ts`, which already skipped
 * every one of these by name ("SKIPPED: defined in schema.ts"). So the guard
 * was checking against `schema.ts` and was right to.
 *
 * What this file cost was the next reader: seven exported tables, importable,
 * compiling, and wrong about every column. Nothing imported them yet, which is
 * the only reason that was free.
 *
 * WF-C-04's rule was "one table in the database; both declarations carry it".
 * That advice cannot work and this file is the proof: the two had drifted 15
 * columns apart while the comment saying to keep them in step sat in the middle
 * of one of them. One declaration, or nobody can tell you which is true.
 */

export {
  proposalTemplates,
  equipmentPackages,
  proposals,
  proposalLineItems,
  proposalComments,
  proposalAnalytics,
  proposalApprovals,
  insertProposalTemplateSchema,
  insertEquipmentPackageSchema,
  insertProposalSchema,
  insertProposalLineItemSchema,
  insertProposalCommentSchema,
  insertProposalAnalyticsSchema,
  insertProposalApprovalSchema,
} from './schema';

export type {
  ProposalTemplate,
  InsertProposalTemplate,
  EquipmentPackage,
  InsertEquipmentPackage,
  Proposal,
  InsertProposal,
  ProposalLineItem,
  InsertProposalLineItem,
  ProposalComment,
  InsertProposalComment,
  ProposalAnalytics,
  InsertProposalAnalytics,
  ProposalApproval,
  InsertProposalApproval,
} from './schema';
