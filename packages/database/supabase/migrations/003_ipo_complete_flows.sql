-- ═══════════════════════════════════════════════════════════════════
-- Migration 003 · Zeniipo Complete IPO Data Flow · v1.0
-- Adds 12 tables + 4 RPC functions for IPO-specific flows:
--   1. Phase gate transitions (10-phase journey)
--   2. Fundraise pipeline + rounds + cap table snapshots
--   3. DD access + audit trail
--   4. IPO readiness scorecard
--   5. External stakeholder portal
--   6. Academy membership gate
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- FLOW 1 · PHASE GATE TRANSITIONS
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE phase_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  journey_id uuid REFERENCES ipo_journeys(id) ON DELETE CASCADE NOT NULL,
  phase_num int NOT NULL CHECK (phase_num BETWEEN 1 AND 10),
  gate_code text NOT NULL,
  criterion_name_vi text NOT NULL,
  criterion_name_en text NOT NULL,
  criterion_category text CHECK (criterion_category IN ('product','traction','team','capital','legal','ops','governance')),
  required_evidence text,
  weight numeric DEFAULT 1.0,
  current_value numeric DEFAULT 0,
  target_value numeric NOT NULL,
  status text DEFAULT 'locked' CHECK (status IN ('locked','in_progress','passing','passed','blocking')),
  pass_score numeric GENERATED ALWAYS AS (
    CASE WHEN target_value > 0 THEN LEAST(100, (current_value / target_value) * 100) ELSE 0 END
  ) STORED,
  evidence_file_id uuid,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  target_date date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(journey_id, phase_num, gate_code)
);

-- Standard 80%+ criteria pass → promote phase rule
CREATE OR REPLACE FUNCTION check_phase_ready(p_journey_id uuid, p_phase_num int)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_total_gates int;
  v_passed_gates int;
  v_weighted_score numeric;
  v_total_weight numeric;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'passed'),
         sum(pass_score * weight), sum(weight)
  INTO v_total_gates, v_passed_gates, v_weighted_score, v_total_weight
  FROM phase_gates
  WHERE journey_id = p_journey_id AND phase_num = p_phase_num;

  RETURN jsonb_build_object(
    'phase', p_phase_num,
    'total_gates', v_total_gates,
    'passed_gates', v_passed_gates,
    'weighted_score', COALESCE(v_weighted_score / NULLIF(v_total_weight, 0), 0),
    'ready_to_promote', COALESCE(v_weighted_score / NULLIF(v_total_weight, 0), 0) >= 80,
    'missing_gates', (SELECT jsonb_agg(jsonb_build_object('code', gate_code, 'name', criterion_name_vi, 'score', pass_score))
                      FROM phase_gates WHERE journey_id = p_journey_id AND phase_num = p_phase_num AND status != 'passed')
  );
END $$;

CREATE OR REPLACE FUNCTION promote_phase(p_journey_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_current int;
  v_ready jsonb;
BEGIN
  IF NOT public.is_chr_or_ceo() THEN RAISE EXCEPTION 'Only CHR/CEO can promote phase'; END IF;

  SELECT current_phase INTO v_current FROM ipo_journeys WHERE id = p_journey_id;
  v_ready := check_phase_ready(p_journey_id, v_current);

  IF NOT (v_ready->>'ready_to_promote')::boolean THEN
    RAISE EXCEPTION 'Phase % not ready: %', v_current, v_ready;
  END IF;

  UPDATE ipo_journeys SET current_phase = v_current + 1, updated_at = now() WHERE id = p_journey_id;
  INSERT INTO events (tenant_id, actor_id, event_type, payload, cascade_status)
  SELECT tenant_id, auth.uid(), 'phase_promoted',
         jsonb_build_object('from', v_current, 'to', v_current + 1, 'journey_id', p_journey_id),
         'completed'
  FROM ipo_journeys WHERE id = p_journey_id;

  RETURN jsonb_build_object('success', true, 'new_phase', v_current + 1);
END $$;

-- ─────────────────────────────────────────────────────────────────
-- FLOW 2 · FUNDRAISE PIPELINE + CAP TABLE SYNC
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE fundraise_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  journey_id uuid REFERENCES ipo_journeys(id) ON DELETE CASCADE NOT NULL,
  round_code text NOT NULL CHECK (round_code IN ('pre_seed','seed','angel','series_a','series_b','series_c','series_d','bridge','pre_ipo','ipo')),
  round_name text NOT NULL,
  target_raise_usd numeric NOT NULL,
  actual_raise_usd numeric DEFAULT 0,
  pre_money_usd numeric,
  post_money_usd numeric,
  esop_pre_carve_pct numeric,
  lead_investor text,
  target_close_date date,
  actual_close_date date,
  status text DEFAULT 'planning' CHECK (status IN ('planning','outreach','negotiating','term_sheet','due_diligence','signed','wired','closed','failed')),
  terms_summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE investor_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  round_id uuid REFERENCES fundraise_rounds(id) ON DELETE CASCADE NOT NULL,
  investor_name text NOT NULL,
  investor_type text CHECK (investor_type IN ('angel','vc','strategic','family_office','sovereign','crowd')),
  firm_name text,
  contact_name text,
  contact_email text,
  contact_linkedin text,
  stage text DEFAULT 'outreach' CHECK (stage IN ('outreach','intro','meeting','pitch','follow_up','term_sheet','due_diligence','signed','wired','closed','passed','ghosted')),
  priority text CHECK (priority IN ('p1','p2','p3')) DEFAULT 'p2',
  target_check_usd numeric,
  committed_usd numeric DEFAULT 0,
  probability_pct numeric CHECK (probability_pct BETWEEN 0 AND 100),
  last_activity_at timestamptz DEFAULT now(),
  next_action text,
  next_action_date date,
  champion_user_id uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE cap_table_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  journey_id uuid REFERENCES ipo_journeys(id) ON DELETE CASCADE NOT NULL,
  round_id uuid REFERENCES fundraise_rounds(id),
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  snapshot_type text CHECK (snapshot_type IN ('pre_round','post_round','monthly','yearly','adhoc')),
  holders jsonb NOT NULL,
  total_shares bigint NOT NULL,
  fully_diluted_shares bigint,
  valuation_usd numeric,
  share_price_usd numeric,
  created_at timestamptz DEFAULT now()
);

-- Auto-snapshot cap table when round closes (trigger)
CREATE OR REPLACE FUNCTION trigger_round_closed_cap_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    INSERT INTO events (tenant_id, actor_id, event_type, payload, cascade_status)
    VALUES (NEW.tenant_id, auth.uid(), 'round_closed',
            jsonb_build_object('round_id', NEW.id, 'post_money', NEW.post_money_usd),
            'pending');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_round_closed AFTER UPDATE ON fundraise_rounds
  FOR EACH ROW EXECUTE FUNCTION trigger_round_closed_cap_snapshot();

-- ─────────────────────────────────────────────────────────────────
-- FLOW 3 · DATA ROOM + DD AUDIT TRAIL
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE dd_investor_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  round_id uuid REFERENCES fundraise_rounds(id) ON DELETE CASCADE NOT NULL,
  investor_id uuid REFERENCES investor_pipeline(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invitee_name text,
  nda_signed_at timestamptz,
  nda_doc_url text,
  access_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  access_granted_at timestamptz DEFAULT now(),
  access_expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  folder_scope text[] DEFAULT '{}',
  can_download boolean DEFAULT false,
  watermark_pattern text,
  revoked_at timestamptz,
  revoke_reason text,
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE dd_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_access_id uuid REFERENCES dd_investor_access(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES data_room_docs(id),
  action text NOT NULL CHECK (action IN ('view','download','print','screenshot_attempt','search')),
  ip_address inet,
  user_agent text,
  duration_seconds int,
  page_number int,
  zeni_chain_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_dd_logs_investor ON dd_access_logs(investor_access_id);
CREATE INDEX idx_dd_logs_doc ON dd_access_logs(document_id);
CREATE INDEX idx_dd_logs_ts ON dd_access_logs(created_at DESC);

CREATE TABLE dd_qa_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  round_id uuid REFERENCES fundraise_rounds(id),
  investor_access_id uuid REFERENCES dd_investor_access(id),
  document_id uuid REFERENCES data_room_docs(id),
  question text NOT NULL,
  question_asked_at timestamptz DEFAULT now(),
  answer text,
  answered_by uuid REFERENCES auth.users(id),
  answered_at timestamptz,
  status text DEFAULT 'open' CHECK (status IN ('open','answered','closed'))
);

-- ─────────────────────────────────────────────────────────────────
-- FLOW 4 · IPO READINESS SCORECARD
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE ipo_readiness_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  journey_id uuid REFERENCES ipo_journeys(id) ON DELETE CASCADE NOT NULL,
  criterion_code text NOT NULL,
  category text CHECK (category IN ('audit','financial','legal','governance','operations','disclosure','team','risk')),
  name_vi text NOT NULL,
  name_en text NOT NULL,
  description_vi text,
  description_en text,
  weight numeric DEFAULT 1.0,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','ready','verified','blocked')),
  score_pct numeric DEFAULT 0 CHECK (score_pct BETWEEN 0 AND 100),
  evidence_file_id uuid REFERENCES data_room_docs(id),
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  target_date date,
  notes text,
  UNIQUE(journey_id, criterion_code)
);

-- Separate template table (no tenant isolation, seed data)
CREATE TABLE ipo_readiness_criteria_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_code text UNIQUE NOT NULL,
  category text,
  name_vi text,
  name_en text,
  weight numeric
);

-- Seed 20 standard IPO readiness criteria
INSERT INTO ipo_readiness_criteria_template (criterion_code, category, name_vi, name_en, weight) VALUES
  ('big4_audit', 'audit', 'Big 4 audit 2 năm liên tiếp', 'Big 4 audit 2 consecutive years', 2.0),
  ('sox_compliance', 'audit', 'SOX/SGX internal control', 'SOX/SGX internal control', 2.0),
  ('ifrs_reporting', 'financial', 'IFRS financial reporting', 'IFRS financial reporting', 1.5),
  ('clean_financials', 'financial', 'Financials 3Y clean · no restate', 'Financials 3Y clean · no restate', 2.0),
  ('revenue_recognition', 'financial', 'Revenue recognition ASC606/IFRS15', 'Revenue recognition ASC606/IFRS15', 1.5),
  ('board_composition', 'governance', 'Board ≥3 independent directors', 'Board ≥3 independent directors', 1.5),
  ('audit_committee', 'governance', 'Audit committee established', 'Audit committee established', 1.0),
  ('governance_manual', 'governance', 'Governance manual signed', 'Governance manual signed', 1.0),
  ('legal_entity_clean', 'legal', 'Legal entity structure clean', 'Legal entity structure clean', 1.5),
  ('ip_portfolio', 'legal', 'IP portfolio audit complete', 'IP portfolio audit complete', 1.0),
  ('litigation_disclosure', 'legal', 'Litigation disclosure complete', 'Litigation disclosure complete', 1.0),
  ('insider_trading_policy', 'governance', 'Insider trading policy signed', 'Insider trading policy signed', 0.5),
  ('esg_disclosure', 'disclosure', 'ESG disclosure framework (TCFD/GRI)', 'ESG disclosure framework', 1.0),
  ('risk_management', 'risk', 'Risk management framework · ERM', 'Risk management framework', 1.0),
  ('md_a_draft', 'disclosure', 'MD&A draft prepared', 'MD&A draft prepared', 1.0),
  ('prospectus_draft', 'disclosure', 'Prospectus draft S-1/SGX F-listing', 'Prospectus draft', 2.0),
  ('underwriter_engaged', 'operations', 'Lead underwriter engaged', 'Lead underwriter engaged', 1.5),
  ('cfo_public_ready', 'team', 'CFO public-company ready', 'CFO public-company ready', 1.5),
  ('erp_production', 'operations', 'ERP system production-grade', 'ERP system production-grade', 1.0),
  ('insurance_d_o', 'risk', 'D&O insurance secured', 'D&O insurance secured', 0.5);

CREATE TABLE readiness_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  journey_id uuid REFERENCES ipo_journeys(id) ON DELETE CASCADE NOT NULL,
  total_score numeric,
  breakdown_by_category jsonb,
  captured_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION compute_readiness_score(p_journey_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_score numeric;
  v_breakdown jsonb;
BEGIN
  SELECT sum(score_pct * weight) / NULLIF(sum(weight), 0)
  INTO v_score
  FROM ipo_readiness_criteria WHERE journey_id = p_journey_id;

  SELECT jsonb_object_agg(category, jsonb_build_object(
    'score', sum(score_pct * weight) / NULLIF(sum(weight), 0),
    'criteria_count', count(*)
  ))
  INTO v_breakdown
  FROM ipo_readiness_criteria WHERE journey_id = p_journey_id
  GROUP BY category;

  INSERT INTO readiness_score_history (tenant_id, journey_id, total_score, breakdown_by_category)
  SELECT tenant_id, p_journey_id, v_score, v_breakdown FROM ipo_journeys WHERE id = p_journey_id;

  RETURN jsonb_build_object('total_score', v_score, 'breakdown', v_breakdown, 'grade',
    CASE WHEN v_score >= 90 THEN 'A+'
         WHEN v_score >= 80 THEN 'A'
         WHEN v_score >= 70 THEN 'B'
         WHEN v_score >= 60 THEN 'C'
         ELSE 'F' END);
END $$;

-- ─────────────────────────────────────────────────────────────────
-- FLOW 5 · EXTERNAL STAKEHOLDER PORTAL
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE external_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('lawyer','auditor','underwriter','investor','board_member','advisor','banker','consultant')),
  firm_name text,
  scope_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  access_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  session_duration_hours int DEFAULT 4,
  expires_at timestamptz,
  invited_by uuid REFERENCES auth.users(id),
  last_accessed_at timestamptz,
  status text DEFAULT 'invited' CHECK (status IN ('invited','active','expired','revoked')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE external_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id uuid REFERENCES external_stakeholders(id) ON DELETE CASCADE NOT NULL,
  module_accessed text,
  action text,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- FLOW 6 · ACADEMY MEMBERSHIP GATE
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE membership_tiers (
  tier_code text PRIMARY KEY,
  name_vi text NOT NULL,
  name_en text NOT NULL,
  price_usd_month numeric NOT NULL,
  price_vnd_month numeric,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  academy_access boolean DEFAULT false,
  handbook_access_phases int[] DEFAULT '{}',
  training_drills_access boolean DEFAULT false,
  max_journey_count int DEFAULT 1,
  max_seats int DEFAULT 1,
  priority_support boolean DEFAULT false,
  display_order int
);

-- Seed 4 tiers
INSERT INTO membership_tiers (tier_code, name_vi, name_en, price_usd_month, price_vnd_month, academy_access, handbook_access_phases, training_drills_access, max_journey_count, max_seats, display_order) VALUES
  ('free',       'Trải nghiệm',      'Free Trial',    0,      0,         false, '{1}',                  false, 1, 1,  0),
  ('explorer',   'Explorer',         'Explorer',      49,     1200000,   true,  '{1,2}',                false, 1, 3,  1),
  ('pro',        'Pro',              'Pro',           499,    12000000,  true,  '{1,2,3,4,5}',          true,  3, 10, 2),
  ('elite',      'Elite',            'Elite',         1999,   48000000,  true,  '{1,2,3,4,5,6,7,8}',    true,  10, 30, 3),
  ('enterprise', 'Enterprise',       'Enterprise',    4999,   120000000, true,  '{1,2,3,4,5,6,7,8,9,10}', true, 999, 999, 4);

CREATE TABLE academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('phase_content','training_drill')),
  content_id uuid NOT NULL,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','mastered')),
  progress_pct numeric DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  started_at timestamptz,
  completed_at timestamptz,
  cert_level text CHECK (cert_level IN ('bronze','silver','gold')),
  time_spent_minutes int DEFAULT 0,
  UNIQUE(user_id, content_type, content_id)
);

-- Training drills catalog (16 drills × 8 roles = 128 possible combinations)
CREATE TABLE training_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_code text UNIQUE NOT NULL,
  title_vi text NOT NULL,
  title_en text NOT NULL,
  description_vi text,
  description_en text,
  target_role text NOT NULL CHECK (target_role IN ('chr','ceo','cfo','coo','cto','cmo','clo','emp','all')),
  difficulty text CHECK (difficulty IN ('bronze','silver','gold')),
  estimated_minutes int,
  scenario jsonb NOT NULL,
  steps jsonb NOT NULL,
  success_criteria jsonb NOT NULL,
  min_tier text DEFAULT 'pro' CHECK (min_tier IN ('explorer','pro','elite','enterprise')),
  display_order int
);

-- Check academy access helper
CREATE OR REPLACE FUNCTION has_academy_access(p_content_type text, p_content_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_tier text;
  v_tier_config record;
  v_phase_num int;
  v_drill_min_tier text;
BEGIN
  SELECT plan INTO v_tier FROM subscriptions WHERE tenant_id = public.current_tenant_id() AND status = 'active';
  v_tier := COALESCE(v_tier, 'free');

  SELECT * INTO v_tier_config FROM membership_tiers WHERE tier_code = v_tier;
  IF NOT v_tier_config.academy_access AND p_content_type != 'phase_content' THEN RETURN false; END IF;

  IF p_content_type = 'phase_content' THEN
    SELECT phase_num INTO v_phase_num FROM phase_content WHERE id = p_content_id;
    RETURN v_phase_num = ANY(v_tier_config.handbook_access_phases);
  ELSIF p_content_type = 'training_drill' THEN
    IF NOT v_tier_config.training_drills_access THEN RETURN false; END IF;
    SELECT min_tier INTO v_drill_min_tier FROM training_drills WHERE id = p_content_id;
    RETURN CASE v_drill_min_tier
      WHEN 'explorer' THEN v_tier IN ('explorer','pro','elite','enterprise')
      WHEN 'pro' THEN v_tier IN ('pro','elite','enterprise')
      WHEN 'elite' THEN v_tier IN ('elite','enterprise')
      WHEN 'enterprise' THEN v_tier = 'enterprise'
      ELSE false
    END;
  END IF;
  RETURN false;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- ENABLE RLS + POLICIES FOR ALL NEW TABLES
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE phase_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundraise_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE cap_table_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_investor_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_qa_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_readiness_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_iso" ON phase_gates FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_iso" ON fundraise_rounds FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_iso" ON investor_pipeline FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_iso" ON cap_table_snapshots FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_iso" ON dd_investor_access FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_iso" ON dd_access_logs FOR ALL USING (
  investor_access_id IN (SELECT id FROM dd_investor_access WHERE tenant_id = public.current_tenant_id())
);
CREATE POLICY "tenant_iso" ON dd_qa_threads FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_iso" ON ipo_readiness_criteria FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_iso" ON readiness_score_history FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_iso" ON external_stakeholders FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_iso" ON external_access_logs FOR ALL USING (
  stakeholder_id IN (SELECT id FROM external_stakeholders WHERE tenant_id = public.current_tenant_id())
);
CREATE POLICY "academy_user_scope" ON academy_progress FOR ALL USING (user_id = auth.uid());

-- Public read for tiers + drill catalog + template criteria
CREATE POLICY "public_read" ON membership_tiers FOR SELECT USING (true);
CREATE POLICY "public_read" ON training_drills FOR SELECT USING (true);
ALTER TABLE training_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_phase_gates_journey ON phase_gates(journey_id);
CREATE INDEX idx_rounds_journey ON fundraise_rounds(journey_id);
CREATE INDEX idx_pipeline_round ON investor_pipeline(round_id);
CREATE INDEX idx_pipeline_stage ON investor_pipeline(stage);
CREATE INDEX idx_cap_snapshots_journey ON cap_table_snapshots(journey_id, snapshot_date DESC);
CREATE INDEX idx_dd_access_round ON dd_investor_access(round_id);
CREATE INDEX idx_readiness_journey ON ipo_readiness_criteria(journey_id);
CREATE INDEX idx_academy_user ON academy_progress(user_id);

COMMENT ON SCHEMA public IS 'Zeniipo · Complete IPO data flows · v1.0 · April 2026';
