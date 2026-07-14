-- CRMX-013: ranked, typo-tolerant global search via pg_trgm.
--
-- Returns a unified, relevance-ranked result set across CRM entities, replacing
-- the edge function's unranked ILIKE scans. Ranking is trigram similarity()
-- (0..1); typo tolerance comes from the `%` trigram-match operator, with an
-- ILIKE fallback in each WHERE so short/substring queries still hit.
--
-- Fault-tolerant: each entity is scanned inside its own BEGIN/EXCEPTION block,
-- so a missing table or column (the raw-SQL/drift tables such as service_tickets
-- and invoices, which are not in the Drizzle schema) is skipped rather than
-- failing the whole search. Tenant-scoped by explicit parameter.
--
-- Idempotent (CREATE OR REPLACE). Requires pg_trgm — see migration
-- drizzle/migrations/0026_search_trgm_indexes.sql (extension + GIN indexes).
-- Apply this file the same way as the other drizzle/functions/*.sql (psql \i or
-- the Supabase SQL editor).

CREATE OR REPLACE FUNCTION public.global_search(
  p_tenant_id varchar,
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  entity_type text,
  entity_id varchar,
  title text,
  subtitle text,
  metadata text,
  rank real
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  q text := coalesce(trim(p_query), '');
  lim int := greatest(1, least(coalesce(p_limit, 20), 50));
BEGIN
  IF length(q) < 2 THEN
    RETURN;
  END IF;

  -- customers / leads (business_records)
  BEGIN
    RETURN QUERY
    SELECT 'customer'::text,
           br.id,
           br.company_name::text,
           coalesce(br.primary_contact_name, br.primary_contact_email)::text,
           br.record_type::text,
           GREATEST(
             similarity(coalesce(br.company_name, ''), q),
             similarity(coalesce(br.primary_contact_name, ''), q),
             similarity(coalesce(br.primary_contact_email, ''), q)
           )::real
    FROM business_records br
    WHERE br.tenant_id = p_tenant_id
      AND (br.company_name % q
           OR br.primary_contact_name % q
           OR br.primary_contact_email % q
           OR br.company_name ILIKE '%' || q || '%')
    ORDER BY 6 DESC
    LIMIT lim;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- contacts (company_contacts — canonical per CRMX-002)
  BEGIN
    RETURN QUERY
    SELECT 'contact'::text,
           c.id,
           nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')::text,
           c.email::text,
           c.title::text,
           GREATEST(
             similarity(coalesce(c.first_name, ''), q),
             similarity(coalesce(c.last_name, ''), q),
             similarity(coalesce(c.email, ''), q),
             word_similarity(q, coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
           )::real
    FROM company_contacts c
    WHERE c.tenant_id = p_tenant_id
      AND (c.first_name % q
           OR c.last_name % q
           OR c.email % q
           OR (coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) ILIKE '%' || q || '%')
    ORDER BY 6 DESC
    LIMIT lim;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- deals
  BEGIN
    RETURN QUERY
    SELECT 'deal'::text,
           d.id,
           d.title::text,
           coalesce(d.company_name, d.primary_contact_name)::text,
           d.status::text,
           GREATEST(
             similarity(coalesce(d.title, ''), q),
             similarity(coalesce(d.company_name, ''), q)
           )::real
    FROM deals d
    WHERE d.tenant_id = p_tenant_id
      AND (d.title % q
           OR d.company_name % q
           OR d.title ILIKE '%' || q || '%')
    ORDER BY 6 DESC
    LIMIT lim;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- quotes (proposals)
  BEGIN
    RETURN QUERY
    SELECT 'quote'::text,
           p.id,
           p.title::text,
           p.proposal_number::text,
           p.status::text,
           GREATEST(
             similarity(coalesce(p.title, ''), q),
             similarity(coalesce(p.proposal_number, ''), q)
           )::real
    FROM proposals p
    WHERE p.tenant_id = p_tenant_id
      AND (p.title % q
           OR p.proposal_number % q
           OR p.title ILIKE '%' || q || '%'
           OR p.proposal_number ILIKE '%' || q || '%')
    ORDER BY 6 DESC
    LIMIT lim;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- service tickets (raw-SQL/drift table; guarded)
  BEGIN
    RETURN QUERY
    SELECT 'service'::text,
           t.id,
           t.title::text,
           t.ticket_number::text,
           t.status::text,
           GREATEST(
             similarity(coalesce(t.title, ''), q),
             similarity(coalesce(t.ticket_number, ''), q),
             similarity(coalesce(t.description, ''), q)
           )::real
    FROM service_tickets t
    WHERE t.tenant_id = p_tenant_id
      AND (t.title % q
           OR t.ticket_number % q
           OR t.title ILIKE '%' || q || '%'
           OR t.description ILIKE '%' || q || '%')
    ORDER BY 6 DESC
    LIMIT lim;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- products (product_models)
  BEGIN
    RETURN QUERY
    SELECT 'product'::text,
           pm.id,
           pm.product_name::text,
           coalesce(pm.manufacturer, pm.product_code)::text,
           pm.category::text,
           GREATEST(
             similarity(coalesce(pm.product_name, ''), q),
             similarity(coalesce(pm.product_code, ''), q),
             similarity(coalesce(pm.manufacturer, ''), q)
           )::real
    FROM product_models pm
    WHERE pm.tenant_id = p_tenant_id
      AND (pm.product_name % q
           OR pm.product_code % q
           OR pm.product_name ILIKE '%' || q || '%')
    ORDER BY 6 DESC
    LIMIT lim;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- invoices (raw-SQL/drift table; guarded)
  BEGIN
    RETURN QUERY
    SELECT 'invoice'::text,
           i.id,
           i.invoice_number::text,
           i.invoice_status::text,
           NULL::text,
           similarity(coalesce(i.invoice_number, ''), q)::real
    FROM invoices i
    WHERE i.tenant_id = p_tenant_id
      AND (i.invoice_number % q
           OR i.invoice_number ILIKE '%' || q || '%')
    ORDER BY 6 DESC
    LIMIT lim;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

END;
$$;
