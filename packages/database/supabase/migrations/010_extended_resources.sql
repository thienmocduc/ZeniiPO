-- ═══════════════════════════════════════════════════════════════════
-- Migration 010 · Extended resources (6 new tables)
-- Adds tables for pages that don't fit existing schema:
--   comparables · market_data · market_intel · feedback · tokenomics_alloc · nlq_logs
-- All tables: tenant-scoped + RLS isolated + indexed.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. COMPARABLES — peer/comp companies for valuation page
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE comparables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  ticker text,
  exchange text,
  industry text,
  region text,
  revenue_usd numeric,
  ebitda_usd numeric,
  market_cap_usd numeric,
  enterprise_value_usd numeric,
  ev_revenue_multiple numeric,
  ev_ebitda_multiple numeric,
  pe_ratio numeric,
  growth_rate_pct numeric,
  notes text,
  data_source text,
  data_as_of date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_comparables_tenant ON comparables(tenant_id);
CREATE INDEX idx_comparables_industry ON comparables(industry);
ALTER TABLE comparables ENABLE ROW LEVEL SECURITY;
CREATE POLICY super_admin_bypass ON comparables FOR ALL USING (is_chairman_super()) WITH CHECK (is_chairman_super());
CREATE POLICY tenant_isolation ON comparables FOR ALL USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────
-- 2. MARKET_DATA — TAM/SAM/SOM, market sizing, growth signals
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('tam','sam','som','growth_rate','penetration','share','competitor_count','arpu','market_size')),
  region text,
  segment text,
  value_numeric numeric,
  value_unit text,
  currency text DEFAULT 'USD',
  period_start date,
  period_end date,
  source text,
  source_url text,
  confidence text CHECK (confidence IN ('low','medium','high','verified')),
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_market_data_tenant ON market_data(tenant_id);
CREATE INDEX idx_market_data_type ON market_data(tenant_id, metric_type);
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY super_admin_bypass ON market_data FOR ALL USING (is_chairman_super()) WITH CHECK (is_chairman_super());
CREATE POLICY tenant_isolation ON market_data FOR ALL USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────
-- 3. MARKET_INTEL — news, signals, competitor moves, regulatory updates
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE market_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL CHECK (category IN ('competitor','regulation','market_shift','customer_signal','tech_trend','m_and_a','funding_round','exit')),
  severity text CHECK (severity IN ('info','watch','alert','critical')),
  title text NOT NULL,
  body text,
  source_url text,
  published_at timestamptz,
  related_competitor text,
  region text,
  industry text,
  acted_on boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_market_intel_tenant ON market_intel(tenant_id);
CREATE INDEX idx_market_intel_severity ON market_intel(tenant_id, severity, created_at DESC);
ALTER TABLE market_intel ENABLE ROW LEVEL SECURITY;
CREATE POLICY super_admin_bypass ON market_intel FOR ALL USING (is_chairman_super()) WITH CHECK (is_chairman_super());
CREATE POLICY tenant_isolation ON market_intel FOR ALL USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────
-- 4. FEEDBACK — user feedback on platform / specific features
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  submitted_by uuid REFERENCES auth.users(id),
  category text CHECK (category IN ('bug','feature_request','ux','data_quality','performance','other')) DEFAULT 'other',
  severity text CHECK (severity IN ('low','medium','high','critical')) DEFAULT 'medium',
  page_path text,
  title text NOT NULL,
  body text,
  status text DEFAULT 'open' CHECK (status IN ('open','triaged','in_progress','resolved','wontfix','duplicate')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_feedback_tenant ON feedback_items(tenant_id);
CREATE INDEX idx_feedback_status ON feedback_items(tenant_id, status, created_at DESC);
ALTER TABLE feedback_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY super_admin_bypass ON feedback_items FOR ALL USING (is_chairman_super()) WITH CHECK (is_chairman_super());
CREATE POLICY tenant_isolation ON feedback_items FOR ALL USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────
-- 5. TOKENOMICS_ALLOC — token pool allocation (for tenants with token)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE tokenomics_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  token_symbol text NOT NULL,
  pool_name text NOT NULL,
  allocation_pct numeric NOT NULL CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  total_supply numeric,
  vesting_start date,
  vesting_cliff_months int DEFAULT 0,
  vesting_duration_months int DEFAULT 0,
  vested_amount numeric DEFAULT 0,
  notes text,
  contract_address text,
  blockchain text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_tokenomics_tenant ON tokenomics_allocations(tenant_id);
ALTER TABLE tokenomics_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY super_admin_bypass ON tokenomics_allocations FOR ALL USING (is_chairman_super()) WITH CHECK (is_chairman_super());
CREATE POLICY tenant_isolation ON tokenomics_allocations FOR ALL USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────
-- 6. NLQ_LOGS — natural-language query history (Anthropic-powered)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE nlq_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  query_text text NOT NULL,
  query_intent text,
  resolved_sql text,
  result_summary text,
  result_json jsonb,
  agent_model text,
  tokens_input int,
  tokens_output int,
  cost_usd numeric,
  duration_ms int,
  status text DEFAULT 'success' CHECK (status IN ('success','partial','error')),
  error_message text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_nlq_tenant ON nlq_logs(tenant_id, created_at DESC);
CREATE INDEX idx_nlq_user ON nlq_logs(user_id, created_at DESC);
ALTER TABLE nlq_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY super_admin_bypass ON nlq_logs FOR ALL USING (is_chairman_super()) WITH CHECK (is_chairman_super());
CREATE POLICY tenant_isolation ON nlq_logs FOR ALL USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────
-- updated_at triggers (reuse existing fn if defined)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_comparables_updated BEFORE UPDATE ON comparables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tokenomics_updated BEFORE UPDATE ON tokenomics_allocations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
