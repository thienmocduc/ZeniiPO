-- ═══════════════════════════════════════════════════════════════════
-- Migration 018 · Financial Model (spec Part I.2 — Monte Carlo + runway)
-- ═══════════════════════════════════════════════════════════════════
-- Stores model assumptions + the cached last Monte Carlo result so dashboards
-- read instantly. Simulation runs in the Node API route (lib/finance).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  journey_id uuid REFERENCES ipo_journeys(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Base case',
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,                 -- cached MonteCarloResult
  sensitivity jsonb,            -- cached sensitivity grid
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finmodel_tenant ON financial_models(tenant_id, created_at DESC);
ALTER TABLE financial_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_bypass ON financial_models;
CREATE POLICY super_admin_bypass ON financial_models FOR ALL USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON financial_models;
CREATE POLICY tenant_isolation ON financial_models FOR ALL USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON financial_models TO authenticated;
GRANT ALL ON financial_models TO service_role;

CREATE TRIGGER trg_finmodel_updated BEFORE UPDATE ON financial_models
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
