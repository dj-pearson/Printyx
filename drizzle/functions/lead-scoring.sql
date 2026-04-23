-- =============================================================================
-- Lead Scoring — analytics + latest-per-lead SQL functions
-- =============================================================================
-- Three functions that supabase-js can't express cleanly:
--
--   public.lead_scoring_leaderboard(tenant, limit)
--     Latest lead_score_calculations row per lead, for a tenant, ordered by
--     total_score desc. Uses DISTINCT ON.
--
--   public.lead_scoring_by_grade(tenant, grade, limit)
--     Latest lead_score_calculations row per lead filtered to a grade.
--
--   public.lead_scoring_analytics(tenant)
--     Score distribution by grade + tier + total leads scored.
--
-- All SECURITY INVOKER, tenant-scoped via explicit parameter.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.lead_scoring_leaderboard(
  p_tenant_id text,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'totalScore')::int DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id',                calc.id,
        'leadId',            calc.lead_id,
        'totalScore',        calc.total_score,
        'leadGrade',         calc.lead_grade,
        'leadTier',          calc.lead_tier,
        'recommendedAction', calc.recommended_action,
        'calculatedAt',      calc.calculated_at,
        'lead', jsonb_build_object(
          'id',           br.id,
          'companyName',  br.company_name,
          'status',       br.status,
          'ownerId',      br.owner_id
        )
      ) AS row
      FROM (
        SELECT DISTINCT ON (lead_id) *
          FROM public.lead_score_calculations
         WHERE tenant_id = p_tenant_id
         ORDER BY lead_id, calculated_at DESC
      ) calc
      LEFT JOIN public.business_records br
             ON br.id = calc.lead_id
            AND br.tenant_id = p_tenant_id
      ORDER BY calc.total_score DESC
      LIMIT GREATEST(p_limit, 0)
    ) t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.lead_scoring_leaderboard(text, integer) IS
  'Top-scored leads for a tenant (latest calc per lead) joined with business_records for display.';

GRANT EXECUTE ON FUNCTION public.lead_scoring_leaderboard(text, integer)
  TO authenticated, service_role;

-- ─── By grade ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lead_scoring_by_grade(
  p_tenant_id text,
  p_grade     text,
  p_limit     integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'totalScore')::int DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id',                calc.id,
        'leadId',            calc.lead_id,
        'totalScore',        calc.total_score,
        'leadGrade',         calc.lead_grade,
        'leadTier',          calc.lead_tier,
        'recommendedAction', calc.recommended_action,
        'calculatedAt',      calc.calculated_at,
        'lead', jsonb_build_object(
          'id',           br.id,
          'companyName',  br.company_name,
          'status',       br.status,
          'ownerId',      br.owner_id
        )
      ) AS row
      FROM (
        SELECT DISTINCT ON (lead_id) *
          FROM public.lead_score_calculations
         WHERE tenant_id = p_tenant_id
         ORDER BY lead_id, calculated_at DESC
      ) calc
      LEFT JOIN public.business_records br
             ON br.id = calc.lead_id
            AND br.tenant_id = p_tenant_id
      WHERE calc.lead_grade = p_grade
      ORDER BY calc.total_score DESC
      LIMIT GREATEST(p_limit, 0)
    ) t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.lead_scoring_by_grade(text, text, integer) IS
  'Latest score per lead filtered to a grade, joined with business_records.';

GRANT EXECUTE ON FUNCTION public.lead_scoring_by_grade(text, text, integer)
  TO authenticated, service_role;

-- ─── Scoring analytics ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lead_scoring_analytics(
  p_tenant_id text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_grade_dist jsonb;
  v_tier_dist jsonb;
  v_totals jsonb;
BEGIN
  WITH latest AS (
    SELECT DISTINCT ON (lead_id) *
      FROM public.lead_score_calculations
     WHERE tenant_id = p_tenant_id
     ORDER BY lead_id, calculated_at DESC
  )
  SELECT COALESCE(jsonb_object_agg(lead_grade, n), '{}'::jsonb)
    INTO v_grade_dist
    FROM (
      SELECT lead_grade, COUNT(*) AS n
        FROM latest
       WHERE lead_grade IS NOT NULL
       GROUP BY lead_grade
    ) g;

  WITH latest AS (
    SELECT DISTINCT ON (lead_id) *
      FROM public.lead_score_calculations
     WHERE tenant_id = p_tenant_id
     ORDER BY lead_id, calculated_at DESC
  )
  SELECT COALESCE(jsonb_object_agg(lead_tier, n), '{}'::jsonb)
    INTO v_tier_dist
    FROM (
      SELECT lead_tier, COUNT(*) AS n
        FROM latest
       WHERE lead_tier IS NOT NULL
       GROUP BY lead_tier
    ) t;

  WITH latest AS (
    SELECT DISTINCT ON (lead_id) total_score
      FROM public.lead_score_calculations
     WHERE tenant_id = p_tenant_id
     ORDER BY lead_id, calculated_at DESC
  )
  SELECT jsonb_build_object(
           'totalLeadsScored', COUNT(*),
           'avgScore',         COALESCE(ROUND(AVG(total_score)::numeric, 1), 0),
           'maxScore',         COALESCE(MAX(total_score), 0),
           'minScore',         COALESCE(MIN(total_score), 0)
         )
    INTO v_totals
    FROM latest;

  RETURN jsonb_build_object(
    'totals',            v_totals,
    'gradeDistribution', v_grade_dist,
    'tierDistribution',  v_tier_dist
  );
END;
$$;

COMMENT ON FUNCTION public.lead_scoring_analytics(text) IS
  'Tenant-scoped score/grade/tier distribution for the lead-scoring dashboard.';

GRANT EXECUTE ON FUNCTION public.lead_scoring_analytics(text)
  TO authenticated, service_role;
