-- ═══════════════════════════════════════════════════════════════════
-- Migration 014 · Closed-Loop Journey Engine (7 luân xa · spec Part I.5 + III)
-- ═══════════════════════════════════════════════════════════════════
-- The spine that turns 47 separate dashboards into ONE operating system.
-- State machine per tenant per level:
--   locked → learning → assessed → applying → validated → unlocked
-- Gate logic: { pass_mark, required_deliverables[], kpi_thresholds[] }
-- KPIs flow up; Chairman sees exactly where the company is on 0→IPO.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. journey_levels — catalog of the 7 chakra levels (global, public read)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journey_levels (
  level_num int PRIMARY KEY CHECK (level_num BETWEEN 1 AND 7),
  chakra_vi text NOT NULL,
  name_vi text NOT NULL,
  name_en text NOT NULL,
  subtitle_vi text,
  phase_range text NOT NULL,         -- e.g. 'Phase 1–2'
  module_count int NOT NULL,
  chakra_color text NOT NULL,        -- hex for UI ring
  pass_mark int NOT NULL DEFAULT 6,  -- assessment threshold (e.g. 6/8)
  pass_total int NOT NULL DEFAULT 8,
  required_deliverables jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{code,label,entity}]
  kpi_thresholds jsonb NOT NULL DEFAULT '[]'::jsonb,        -- [{metric,op,value}]
  agents text[] DEFAULT '{}',
  order_idx int NOT NULL
);

INSERT INTO journey_levels (level_num, chakra_vi, name_vi, name_en, subtitle_vi, phase_range, module_count, chakra_color, pass_mark, pass_total, required_deliverables, kpi_thresholds, agents, order_idx) VALUES
(1, 'Gốc · Sống còn', 'Khai Tâm', 'Awaken — Capital Mechanics', 'Hiểu cơ chế vốn', 'Phase 1–2', 6, '#C8453B', 6, 8,
  '[{"code":"cap_table_v0","label":"Cap table v0","entity":"cap_table_snapshots"},{"code":"readiness_baseline","label":"Điểm readiness sơ bộ","entity":"readiness_score_history"}]',
  '[{"metric":"cap_table_valid","op":">=","value":1}]',
  ARRAY['Lesson-tutor','Quiz-grader'], 1),
(2, 'Xương cùng · Kiến tạo', 'Lập Nền', 'Foundation — Clean Structure', 'Dựng cấu trúc sạch', 'Phase 3', 7, '#DD8A3A', 6, 8,
  '[{"code":"cap_table_real","label":"Cap table thật","entity":"cap_table_snapshots"},{"code":"esop_pool","label":"ESOP 10-15%","entity":"cap_table_snapshots"},{"code":"sha_signed","label":"SHA ký","entity":"data_room_docs"}]',
  '[{"metric":"esop_pct","op":">=","value":10},{"metric":"esop_pct","op":"<=","value":15}]',
  ARRAY['General-Counsel','SHA-drafter','Cap-table-checker'], 2),
(3, 'Đám rối dương · Ý chí', 'Vận Hành Theo Vốn', 'Operate by Capital', 'Làm chủ tài chính', 'Phase 4', 7, '#E0B93C', 6, 8,
  '[{"code":"fin_statements","label":"Import P&L/BS/CF","entity":"financial_statements"},{"code":"fin_model","label":"Financial model 3-5y","entity":"financial_models"},{"code":"okr_dashboard","label":"OKR dashboard live","entity":"okr_objectives"}]',
  '[{"metric":"unit_economics","op":">","value":0}]',
  ARRAY['CFO-agent','Model-builder','Runway-radar'], 3),
(4, 'Tim · Mở rộng', 'Nhân Bản', 'Scale — Multiply', 'Mở rộng chuỗi & đội ngũ', 'Phase 5–6', 7, '#3FB286', 6, 8,
  '[{"code":"sop_playbook","label":"Playbook nhân bản","entity":"data_room_docs"},{"code":"cohort_model","label":"Cohort tracker","entity":"financial_models"}]',
  '[{"metric":"outlets_positive_ue","op":">=","value":3}]',
  ARRAY['SOP-writer','Cohort-analyst'], 4),
(5, 'Cổ họng · Tiếng nói', 'Gọi Vốn', 'Fundraise — Tell & Raise', 'Kể chuyện & huy động', 'Phase 7', 7, '#34A6C2', 6, 8,
  '[{"code":"pitch_deck","label":"Pitch deck đạt chuẩn","entity":"data_room_docs"},{"code":"data_room_ready","label":"Data room đủ mục","entity":"data_room_docs"},{"code":"pipeline_active","label":"Pipeline 8 stage","entity":"investor_pipeline"}]',
  '[{"metric":"data_room_completeness","op":">=","value":80}]',
  ARRAY['Pitch-coach','Term-analyzer','DD-packager'], 5),
(6, 'Con mắt thứ ba · Tầm nhìn', 'Tầm Nhìn IPO', 'IPO Vision — Get Ready', 'Sẵn sàng lên sàn', 'Phase 8–9', 7, '#6E72D6', 6, 8,
  '[{"code":"readiness_scorecard","label":"Scorecard 20 tiêu chí","entity":"ipo_readiness_criteria"},{"code":"exchange_decision","label":"Quyết định sàn","entity":"ipo_journeys"}]',
  '[{"metric":"readiness_score","op":">=","value":700}]',
  ARRAY['Readiness-auditor','Gap-planner'], 6),
(7, 'Vương miện · Siêu việt', 'Rung Chuông', 'Ring the Bell', 'Lên sàn & hậu IPO', 'Phase 10', 4, '#A867C9', 6, 8,
  '[{"code":"prospectus","label":"Prospectus workspace","entity":"data_room_docs"},{"code":"ipo_timeline","label":"IPO timeline xanh","entity":"ipo_journeys"}]',
  '[{"metric":"readiness_score","op":">=","value":850}]',
  ARRAY['Prospectus-aide','IR-agent'], 7)
ON CONFLICT (level_num) DO UPDATE SET
  chakra_vi=EXCLUDED.chakra_vi, name_vi=EXCLUDED.name_vi, name_en=EXCLUDED.name_en,
  subtitle_vi=EXCLUDED.subtitle_vi, phase_range=EXCLUDED.phase_range, module_count=EXCLUDED.module_count,
  chakra_color=EXCLUDED.chakra_color, required_deliverables=EXCLUDED.required_deliverables,
  kpi_thresholds=EXCLUDED.kpi_thresholds, agents=EXCLUDED.agents;

ALTER TABLE journey_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS journey_levels_public_read ON journey_levels;
CREATE POLICY journey_levels_public_read ON journey_levels FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────
-- 2. tenant_level_progress — state machine per tenant per level
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_level_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  level_num int REFERENCES journey_levels(level_num) NOT NULL,
  state text NOT NULL DEFAULT 'locked'
    CHECK (state IN ('locked','learning','assessed','applying','validated','unlocked')),
  assessment_score int,
  deliverables_done jsonb NOT NULL DEFAULT '[]'::jsonb,
  kpi_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  certified_at timestamptz,
  unlocked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, level_num)
);
CREATE INDEX IF NOT EXISTS idx_tlp_tenant ON tenant_level_progress(tenant_id, level_num);
ALTER TABLE tenant_level_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON tenant_level_progress;
CREATE POLICY super_admin_bypass ON tenant_level_progress FOR ALL USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON tenant_level_progress;
CREATE POLICY tenant_isolation ON tenant_level_progress FOR ALL USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON tenant_level_progress TO authenticated;
GRANT ALL ON tenant_level_progress TO service_role;

CREATE TRIGGER trg_tlp_updated BEFORE UPDATE ON tenant_level_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 3. RPC: init_tenant_journey — seed 7 levels (L1 learning, rest locked)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.init_tenant_journey(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_count int;
BEGIN
  IF NOT public.is_chairman_super()
     AND p_tenant_id NOT IN (SELECT id FROM public.list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  INSERT INTO tenant_level_progress (tenant_id, level_num, state)
  SELECT p_tenant_id, level_num, CASE WHEN level_num = 1 THEN 'learning' ELSE 'locked' END
  FROM journey_levels
  ON CONFLICT (tenant_id, level_num) DO NOTHING;
  SELECT count(*) INTO v_count FROM tenant_level_progress WHERE tenant_id = p_tenant_id;
  RETURN jsonb_build_object('status','ok','levels',v_count);
END $fn$;
REVOKE ALL ON FUNCTION public.init_tenant_journey(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.init_tenant_journey(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- 4. RPC: evaluate_level_gate — check assessment + deliverables + KPIs
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.evaluate_level_gate(p_tenant_id uuid, p_level_num int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_level journey_levels%ROWTYPE;
  v_prog tenant_level_progress%ROWTYPE;
  v_req jsonb;
  v_done jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_d jsonb;
  v_assessment_ok boolean;
  v_deliverables_ok boolean := true;
  v_can_unlock boolean;
BEGIN
  IF NOT public.is_chairman_super()
     AND p_tenant_id NOT IN (SELECT id FROM public.list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT * INTO v_level FROM journey_levels WHERE level_num = p_level_num;
  IF NOT FOUND THEN RAISE EXCEPTION 'Level % not found', p_level_num; END IF;
  SELECT * INTO v_prog FROM tenant_level_progress WHERE tenant_id = p_tenant_id AND level_num = p_level_num;
  IF NOT FOUND THEN RETURN jsonb_build_object('state','locked','can_unlock',false,'reason','not_started'); END IF;

  -- assessment gate
  v_assessment_ok := COALESCE(v_prog.assessment_score, 0) >= v_level.pass_mark;

  -- deliverables gate: every required code must be in deliverables_done
  v_done := v_prog.deliverables_done;
  FOR v_d IN SELECT * FROM jsonb_array_elements(v_level.required_deliverables) LOOP
    IF NOT (v_done @> jsonb_build_array(jsonb_build_object('code', v_d->>'code'))
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_done) e WHERE e->>'code' = v_d->>'code')) THEN
      v_deliverables_ok := false;
      v_missing := v_missing || jsonb_build_array(v_d);
    END IF;
  END LOOP;

  v_can_unlock := v_assessment_ok AND v_deliverables_ok;

  RETURN jsonb_build_object(
    'level', p_level_num,
    'state', v_prog.state,
    'assessment_score', v_prog.assessment_score,
    'pass_mark', v_level.pass_mark,
    'pass_total', v_level.pass_total,
    'assessment_ok', v_assessment_ok,
    'deliverables_ok', v_deliverables_ok,
    'missing_deliverables', v_missing,
    'kpi_thresholds', v_level.kpi_thresholds,
    'can_unlock', v_can_unlock
  );
END $fn$;
REVOKE ALL ON FUNCTION public.evaluate_level_gate(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_level_gate(uuid, int) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- 5. RPC: advance_level — record progress events + auto-unlock next
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.advance_level(
  p_tenant_id uuid, p_level_num int, p_action text,
  p_score int DEFAULT NULL, p_deliverable jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_prog tenant_level_progress%ROWTYPE;
  v_gate jsonb;
  v_next int;
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

  -- re-evaluate gate; if can_unlock, mark validated → unlocked + open next
  v_gate := public.evaluate_level_gate(p_tenant_id, p_level_num);
  IF (v_gate->>'can_unlock')::boolean THEN
    UPDATE tenant_level_progress SET state='unlocked', unlocked_at=now() WHERE tenant_id=p_tenant_id AND level_num=p_level_num;
    v_next := p_level_num + 1;
    IF v_next <= 7 THEN
      UPDATE tenant_level_progress SET state='learning' WHERE tenant_id=p_tenant_id AND level_num=v_next AND state='locked';
    END IF;
    -- log event
    INSERT INTO events (tenant_id, event_type, payload, cascade_status)
    VALUES (p_tenant_id, 'level_unlocked', jsonb_build_object('level',p_level_num,'next',v_next), 'completed');
  END IF;

  RETURN public.evaluate_level_gate(p_tenant_id, p_level_num);
END $fn$;
REVOKE ALL ON FUNCTION public.advance_level(uuid, int, text, int, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_level(uuid, int, text, int, jsonb) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- 6. RPC: get_journey_state — full 7-level state for dashboard
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_journey_state(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_chairman_super()
     AND p_tenant_id NOT IN (SELECT id FROM public.list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'level', l.level_num, 'chakra', l.chakra_vi, 'name_vi', l.name_vi, 'name_en', l.name_en,
    'subtitle', l.subtitle_vi, 'phase_range', l.phase_range, 'module_count', l.module_count,
    'color', l.chakra_color, 'pass_mark', l.pass_mark, 'pass_total', l.pass_total,
    'agents', l.agents, 'required_deliverables', l.required_deliverables,
    'state', COALESCE(p.state,'locked'), 'assessment_score', p.assessment_score,
    'deliverables_done', COALESCE(p.deliverables_done,'[]'::jsonb),
    'certified_at', p.certified_at, 'unlocked_at', p.unlocked_at
  ) ORDER BY l.level_num)
  INTO v_result
  FROM journey_levels l
  LEFT JOIN tenant_level_progress p ON p.level_num=l.level_num AND p.tenant_id=p_tenant_id;
  RETURN COALESCE(v_result, '[]'::jsonb);
END $fn$;
REVOKE ALL ON FUNCTION public.get_journey_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_journey_state(uuid) TO authenticated, service_role;
