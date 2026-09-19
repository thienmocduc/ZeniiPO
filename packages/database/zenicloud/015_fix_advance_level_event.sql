-- ═══════════════════════════════════════════════════════════════════
-- Migration 015 · Fix advance_level event insert (actor_id NOT NULL)
-- ═══════════════════════════════════════════════════════════════════
-- Bug: advance_level inserted into events without actor_id; events.actor_id
-- is NOT NULL, so when a gate passed the event insert raised and rolled back
-- the ENTIRE advance_level txn — silently undoing the unlock + the last
-- deliverable. Fix: set actor_id := auth.uid() (advance is always user-driven).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.advance_level(
  p_tenant_id uuid, p_level_num int, p_action text,
  p_score int DEFAULT NULL, p_deliverable jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_prog tenant_level_progress%ROWTYPE;
  v_gate jsonb;
  v_next int;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_chairman_super()
     AND p_tenant_id NOT IN (SELECT id FROM public.list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO v_prog FROM tenant_level_progress WHERE tenant_id=p_tenant_id AND level_num=p_level_num FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Level % not initialised for tenant', p_level_num; END IF;

  CASE p_action
    WHEN 'start_learning' THEN
      UPDATE tenant_level_progress SET state='learning' WHERE id=v_prog.id AND state='locked';
    WHEN 'submit_assessment' THEN
      UPDATE tenant_level_progress SET assessment_score=p_score,
        state = CASE WHEN p_score >= (SELECT pass_mark FROM journey_levels WHERE level_num=p_level_num) THEN 'assessed' ELSE 'learning' END
      WHERE id=v_prog.id;
    WHEN 'add_deliverable' THEN
      UPDATE tenant_level_progress
        SET deliverables_done = deliverables_done || jsonb_build_array(p_deliverable),
            state = CASE WHEN state IN ('assessed','applying') THEN 'applying' ELSE state END
      WHERE id=v_prog.id;
    ELSE RAISE EXCEPTION 'Unknown action %', p_action;
  END CASE;

  v_gate := public.evaluate_level_gate(p_tenant_id, p_level_num);
  IF (v_gate->>'can_unlock')::boolean THEN
    UPDATE tenant_level_progress SET state='unlocked', unlocked_at=now() WHERE tenant_id=p_tenant_id AND level_num=p_level_num;
    v_next := p_level_num + 1;
    IF v_next <= 7 THEN
      UPDATE tenant_level_progress SET state='learning' WHERE tenant_id=p_tenant_id AND level_num=v_next AND state='locked';
    END IF;
    -- actor_id is NOT NULL on events; advance_level is always user-driven.
    INSERT INTO events (tenant_id, actor_id, event_type, payload, cascade_status)
    VALUES (p_tenant_id, v_actor, 'level_unlocked', jsonb_build_object('level',p_level_num,'next',v_next), 'completed');
  END IF;

  RETURN public.evaluate_level_gate(p_tenant_id, p_level_num);
END $fn$;
REVOKE ALL ON FUNCTION public.advance_level(uuid, int, text, int, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_level(uuid, int, text, int, jsonb) TO authenticated, service_role;
