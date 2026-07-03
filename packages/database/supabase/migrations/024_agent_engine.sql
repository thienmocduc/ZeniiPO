-- ═══════════════════════════════════════════════════════════════════
-- Migration 024 · AGENT ENGINE — autonomous ops runtime for 108 Legion
-- ═══════════════════════════════════════════════════════════════════
-- Turns the passive agent catalog into an autonomous operating layer:
--   1. agent_schedules — per-tenant cadence for each agent (cron ticks)
--   2. agent_actions   — structured proposals (approve → execute loop)
--   3. agent_memory    — per-tenant long-term learnings per agent
-- Playbooks (specialty "supagent training") live IN CODE
-- (apps/web/src/lib/agents/playbooks.ts) so they version via git PRs.
-- Idiom follows 018 (is_chairman_super + current_tenant_id) + 013 grants.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · agent_schedules ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  agent_code text NOT NULL REFERENCES agent_catalog(agent_code),
  cadence text NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('daily','weekly','monthly')),
  -- 'propose': actions wait for human approval · 'auto': engine executes
  autonomy text NOT NULL DEFAULT 'propose' CHECK (autonomy IN ('propose','auto')),
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, agent_code)
);

CREATE INDEX IF NOT EXISTS idx_agent_schedules_due
  ON agent_schedules (next_run_at) WHERE enabled;

ALTER TABLE agent_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON agent_schedules;
CREATE POLICY super_admin_bypass ON agent_schedules FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON agent_schedules;
CREATE POLICY tenant_isolation ON agent_schedules FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_schedules TO authenticated;
GRANT ALL ON agent_schedules TO service_role;

CREATE TRIGGER trg_agent_schedules_updated BEFORE UPDATE ON agent_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2 · agent_actions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  agent_code text NOT NULL,
  -- whitelisted types only — executor zod-validates payload per type
  action_type text NOT NULL CHECK (action_type IN ('create_task','upsert_kpi','raise_alert','log_insight')),
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','approved','rejected','executed','failed')),
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_tenant_status
  ON agent_actions (tenant_id, status, created_at DESC);

ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON agent_actions;
CREATE POLICY super_admin_bypass ON agent_actions FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON agent_actions;
CREATE POLICY tenant_isolation ON agent_actions FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_actions TO authenticated;
GRANT ALL ON agent_actions TO service_role;

-- ── 3 · agent_memory ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  agent_code text NOT NULL,
  kind text NOT NULL DEFAULT 'insight' CHECK (kind IN ('insight','alert','learning','summary')),
  title text NOT NULL,
  body text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_tenant_agent
  ON agent_memory (tenant_id, agent_code, created_at DESC);

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON agent_memory;
CREATE POLICY super_admin_bypass ON agent_memory FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON agent_memory;
CREATE POLICY tenant_isolation ON agent_memory FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_memory TO authenticated;
GRANT ALL ON agent_memory TO service_role;

-- ── 4 · service_role grants for the cron engine (013 pattern) ──────
GRANT SELECT ON public.agent_catalog TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.agents TO service_role;
GRANT SELECT, INSERT ON public.agent_runs TO service_role;
GRANT SELECT ON public.ipo_journeys TO service_role;
GRANT SELECT ON public.kpi_metrics TO service_role;
GRANT SELECT, INSERT ON public.tasks TO service_role;
GRANT SELECT ON public.okr_objectives TO service_role;
GRANT SELECT ON public.okr_krs TO service_role;
GRANT SELECT, INSERT ON public.feedback_items TO service_role;
