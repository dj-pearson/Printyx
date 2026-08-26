-- PROP-001: make proposal templates first-class reusable objects.
--
-- Adds a single `template_content` jsonb column that stores the visual-builder
-- section array plus global styling, e.g.
--   { "sections": [ { "id", "type", "title", "content", "styling", "order", "isVisible" } ],
--     "globalStyling": { "primaryColor", "secondaryColor", "accentColor",
--                        "fontFamily", "headerFont", "pageMargins", ... } }
--
-- The legacy per-section text columns (cover_page_template, executive_summary_template,
-- ...) are intentionally kept readable for back-compat. Idempotent + drift-tolerant,
-- matching migration 0014's pattern.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'proposal_templates'
  ) THEN
    ALTER TABLE "proposal_templates"
      ADD COLUMN IF NOT EXISTS "template_content" jsonb;
  END IF;

  -- PA-032: the default-per-type index needs its own guard, not just the table's.
  --
  -- `proposal_templates` is declared TWICE with different shapes —
  -- shared/quote-proposal-schema.ts:18 has `template_type`, shared/schema.ts:6148
  -- has `category` — and it is the schema.ts version the migrations build, so
  -- `template_type` does not exist on a database built from them. This migration
  -- was written against the other one and failed on "column o.template_type does
  -- not exist", which is what kept a fresh database from finishing the chain.
  -- Guarding the column matches this file's own stated drift tolerance. Which of
  -- the two declarations wins is the duplicate-table story, not this one.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'proposal_templates'
      AND column_name = 'template_type'
  ) THEN
    -- Before adding the unique index, demote any pre-existing duplicate defaults
    -- so the index can build. Keep the newest default per (tenant, type).
    UPDATE "proposal_templates" t
       SET "is_default" = false
     WHERE "is_default" = true
       AND EXISTS (
         SELECT 1 FROM "proposal_templates" o
          WHERE o."tenant_id" = t."tenant_id"
            AND o."template_type" = t."template_type"
            AND o."is_default" = true
            AND (o."created_at" > t."created_at"
                 OR (o."created_at" = t."created_at" AND o."id" > t."id"))
       );

    -- Partial unique index: at most one default template per (tenant, type).
    -- Enforced in the edge function too, but this is the backstop.
    CREATE UNIQUE INDEX IF NOT EXISTS "proposal_templates_one_default_per_type"
      ON "proposal_templates" ("tenant_id", "template_type")
      WHERE "is_default" = true;
  END IF;
END $$;
