-- ═══════════════════════════════════════════════════════════════════
-- Migration 002 · Core Schema · v1.0
-- Based on Agent 4 spec (AGENT_4_BACKEND.md)
-- 12 tables: ipo_journeys, phase_content, okr_objectives, okr_krs,
--   tasks, events, agents, agent_runs, data_room_folders, data_room_docs,
--   subscriptions, kpi_metrics
-- RPC: cascade_chairman_event
-- Storage: data-room (private), avatars (public), pitch-decks (private)
-- RLS + indexes on all tables
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────────

-- IPO Journey tracking
CREATE TABLE ipo_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  current_phase int NOT NULL DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 10),
  valuation_target numeric,
  exit_venue text CHECK (exit_venue IN ('sgx','nasdaq','nyse','hkex','hose')),
  target_year int,
  industry text,
  north_star_metric text,
  strategy text,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','completed','abandoned')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Phase content (seeded from handbook - public read)
CREATE TABLE phase_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_num int NOT NULL CHECK (phase_num BETWEEN 1 AND 10),
  section_code text NOT NULL,
  order_idx int NOT NULL,
  title_vi text NOT NULL,
  title_en text NOT NULL,
  body_vi text,
  body_en text,
  action_steps jsonb DEFAULT '[]'::jsonb,
  tier text CHECK (tier IN ('explorer','pro','elite','enterprise')) DEFAULT 'explorer',
  duration_months int,
  UNIQUE(phase_num, section_code)
);

-- OKR tree (12-tier cascade)
CREATE TABLE okr_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  journey_id uuid REFERENCES ipo_journeys(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES okr_objectives(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('chr','ceo','cfo','coo','cto','cmo','clo','emp')),
  title text NOT NULL,
  description text,
  quarter text,
  owner_id uuid REFERENCES auth.users(id),
  progress numeric DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status text DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE okr_krs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid REFERENCES okr_objectives(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  metric_type text CHECK (metric_type IN ('number','percentage','boolean','milestone')),
  target_value numeric,
  actual_value numeric,
  unit text,
  progress numeric GENERATED ALWAYS AS (
    CASE WHEN target_value > 0 THEN LEAST(100, (actual_value / target_value) * 100) ELSE 0 END
  ) STORED,
  status text DEFAULT 'on_track' CHECK (status IN ('on_track','amber','red','done')),
  due_date date,
  owner_id uuid REFERENCES auth.users(id)
);

-- Tasks
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  kr_id uuid REFERENCES okr_krs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES auth.users(id),
  priority text DEFAULT 't3' CHECK (priority IN ('t1','t2','t3')),
  status text DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done')),
  due_date date,
  completed_at timestamptz,
  agent_generated boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Events (Chairman input → cascade engine)
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES auth.users(id) NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  cascade_status text DEFAULT 'pending' CHECK (cascade_status IN ('pending','processing','completed','failed')),
  cascade_result jsonb,
  chain_hash text,
  created_at timestamptz DEFAULT now()
);

-- AI Agents (108 Legion)
CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  agent_code text NOT NULL,
  name text NOT NULL,
  department text,
  pantheon text,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','training')),
  config jsonb DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  UNIQUE(tenant_id, agent_code)
);

CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  triggered_by uuid REFERENCES auth.users(id),
  input jsonb NOT NULL,
  output jsonb,
  tokens_input int,
  tokens_output int,
  cost_usd numeric,
  duration_ms int,
  status text DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Data Room
CREATE TABLE data_room_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES data_room_folders(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE data_room_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  folder_id uuid REFERENCES data_room_folders(id),
  title text NOT NULL,
  category text,
  storage_path text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Subscriptions (Stripe)
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  plan text NOT NULL CHECK (plan IN ('explorer','pro','elite','enterprise')),
  status text NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- KPIs
CREATE TABLE kpi_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  metric_code text NOT NULL,
  name text NOT NULL,
  category text,
  value numeric,
  unit text,
  period text,
  trend text CHECK (trend IN ('up','down','flat')),
  captured_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- INDEXES (on FKs + hot paths)
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_journeys_tenant ON ipo_journeys(tenant_id);
CREATE INDEX idx_journeys_phase ON ipo_journeys(current_phase);
CREATE INDEX idx_phase_content_phase ON phase_content(phase_num, order_idx);
CREATE INDEX idx_okr_obj_tenant ON okr_objectives(tenant_id);
CREATE INDEX idx_okr_obj_journey ON okr_objectives(journey_id);
CREATE INDEX idx_okr_obj_parent ON okr_objectives(parent_id);
CREATE INDEX idx_okr_obj_owner ON okr_objectives(owner_id);
CREATE INDEX idx_okr_krs_objective ON okr_krs(objective_id);
CREATE INDEX idx_okr_krs_owner ON okr_krs(owner_id);
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_kr ON tasks(kr_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_events_tenant ON events(tenant_id);
CREATE INDEX idx_events_actor ON events(actor_id);
CREATE INDEX idx_events_created ON events(created_at DESC);
CREATE INDEX idx_agents_tenant ON agents(tenant_id);
CREATE INDEX idx_agents_dept ON agents(department);
CREATE INDEX idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_dr_folders_tenant ON data_room_folders(tenant_id);
CREATE INDEX idx_dr_folders_parent ON data_room_folders(parent_id);
CREATE INDEX idx_dr_docs_tenant ON data_room_docs(tenant_id);
CREATE INDEX idx_dr_docs_folder ON data_room_docs(folder_id);
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_kpi_metrics_tenant ON kpi_metrics(tenant_id);
CREATE INDEX idx_kpi_metrics_code ON kpi_metrics(metric_code);

-- ─────────────────────────────────────────────────────────────────
-- RLS ENABLE
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE ipo_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_krs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_room_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_room_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_content ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY "tenant_isolation" ON ipo_journeys FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_isolation" ON okr_objectives FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_isolation" ON okr_krs FOR ALL USING (
  objective_id IN (SELECT id FROM okr_objectives WHERE tenant_id = public.current_tenant_id())
);
CREATE POLICY "tenant_isolation" ON tasks FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_isolation" ON events FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_isolation" ON agents FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_isolation" ON agent_runs FOR ALL USING (
  agent_id IN (SELECT id FROM agents WHERE tenant_id = public.current_tenant_id())
);
CREATE POLICY "tenant_isolation" ON data_room_folders FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_isolation" ON data_room_docs FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_isolation" ON subscriptions FOR ALL USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_isolation" ON kpi_metrics FOR ALL USING (tenant_id = public.current_tenant_id());

-- Phase content: everyone reads (public)
CREATE POLICY "phase_content_public_read" ON phase_content FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────
-- RPC · CASCADE CHAIRMAN EVENT
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cascade_chairman_event(
  p_tenant_id uuid,
  p_valuation numeric,
  p_venue text,
  p_year int,
  p_industry text,
  p_strategy text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_event_id uuid;
  v_journey_id uuid;
BEGIN
  -- Authorization: only CHR/CEO allowed
  IF NOT public.is_chr_or_ceo() THEN
    RAISE EXCEPTION 'Only CHR/CEO can cascade events';
  END IF;

  -- Record event (Tier 1)
  INSERT INTO events (tenant_id, actor_id, event_type, payload)
  VALUES (p_tenant_id, auth.uid(), 'chairman_goal_set', jsonb_build_object(
    'valuation', p_valuation, 'venue', p_venue, 'year', p_year,
    'industry', p_industry, 'strategy', p_strategy
  )) RETURNING id INTO v_event_id;

  -- Create journey
  INSERT INTO ipo_journeys (tenant_id, name, valuation_target, exit_venue, target_year, industry, strategy)
  VALUES (p_tenant_id, 'IPO ' || p_year || ' · ' || upper(p_venue),
          p_valuation, p_venue, p_year, p_industry, p_strategy)
  RETURNING id INTO v_journey_id;

  -- Generate 4 CHR Objectives (Tier 5 start)
  INSERT INTO okr_objectives (tenant_id, journey_id, tier, title)
  VALUES
    (p_tenant_id, v_journey_id, 'chr', 'Đạt valuation ' || p_valuation || ' tại ' || upper(p_venue) || ' năm ' || p_year),
    (p_tenant_id, v_journey_id, 'chr', 'Build unit economics IPO-ready'),
    (p_tenant_id, v_journey_id, 'chr', 'Operational excellence · 108 Agent Legion'),
    (p_tenant_id, v_journey_id, 'chr', 'Governance + Compliance IPO-ready');

  -- Mark event as completed
  UPDATE events SET cascade_status = 'completed',
    cascade_result = jsonb_build_object('journey_id', v_journey_id, 'objectives_created', 4)
  WHERE id = v_event_id;

  RETURN jsonb_build_object('event_id', v_event_id, 'journey_id', v_journey_id, 'status', 'success');
END $$;

-- ─────────────────────────────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES ('data-room', 'data-room', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('pitch-decks', 'pitch-decks', false)
  ON CONFLICT (id) DO NOTHING;

-- Data room RLS: tenant folder isolation (first folder segment = tenant_id)
CREATE POLICY "data_room_tenant_isolation" ON storage.objects
  FOR ALL USING (
    bucket_id = 'data-room' AND
    (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

CREATE POLICY "pitch_decks_tenant_isolation" ON storage.objects
  FOR ALL USING (
    bucket_id = 'pitch-decks' AND
    (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- Avatars are public read, owner-write
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
