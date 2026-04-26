-- ═══════════════════════════════════════════════════════════════════
-- Migration 009 · Fix compute_readiness_score
-- ═══════════════════════════════════════════════════════════════════
-- Issue: RPC was SECURITY INVOKER → caller user has no INSERT right on
--   readiness_score_history (RLS blocks) → RPC silently fails (returns null).
-- Fix: SECURITY DEFINER + explicit tenant ownership check inside RPC,
--   so a user can only score journeys owned by a tenant they belong to.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.compute_readiness_score(p_journey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid;
  v_score numeric;
  v_breakdown jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.ipo_journeys WHERE id = p_journey_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Journey % not found', p_journey_id;
  END IF;
  IF NOT public.is_chairman_super()
     AND v_tenant_id NOT IN (SELECT id FROM public.list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Access denied: journey does not belong to caller tenant';
  END IF;

  SELECT COALESCE(sum(score_pct * weight) / NULLIF(sum(weight), 0), 0)
  INTO v_score
  FROM public.ipo_readiness_criteria WHERE journey_id = p_journey_id;

  SELECT COALESCE(jsonb_object_agg(category, jsonb_build_object(
    'score', cat_score,
    'criteria_count', cat_count
  )), '{}'::jsonb)
  INTO v_breakdown
  FROM (
    SELECT category,
           sum(score_pct * weight) / NULLIF(sum(weight), 0) AS cat_score,
           count(*) AS cat_count
    FROM public.ipo_readiness_criteria
    WHERE journey_id = p_journey_id
    GROUP BY category
  ) cat;

  INSERT INTO public.readiness_score_history (tenant_id, journey_id, total_score, breakdown_by_category)
  VALUES (v_tenant_id, p_journey_id, v_score, v_breakdown);

  RETURN jsonb_build_object(
    'total_score', v_score,
    'breakdown', v_breakdown,
    'grade',
      CASE WHEN v_score >= 90 THEN 'A+'
           WHEN v_score >= 80 THEN 'A'
           WHEN v_score >= 70 THEN 'B'
           WHEN v_score >= 60 THEN 'C'
           ELSE 'F' END
  );
END $function$;

REVOKE ALL ON FUNCTION public.compute_readiness_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_readiness_score(uuid) TO authenticated;
