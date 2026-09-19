-- ═══════════════════════════════════════════════════════════════════
-- Migration 025 · BUSINESS SPINE — dữ liệu khớp 100% từ Idea → IPO
-- ═══════════════════════════════════════════════════════════════════
-- Chairman spec 2026-06-22: "toàn bộ dữ liệu phải khớp nét 100%, các
-- luồng hàm connect tự động từ vòng nhập idea đến bảng tài chính".
--   1. canvas_blocks         — Business Model Canvas (9 khối, bước 1)
--   2. financial_statements  — P&L + cashflow THẬT theo tháng (nguồn sự thật)
--   3. finance_assumptions   — driver các hàm (target GM, runway floor…)
--   4. journey_phase_specs   — 10 bước Idea→IPO (khớp ipo_journeys.current_phase 1-10)
--   5. derive_finance_kpis() — HÀM khớp: statements → KPI (GM/burn/runway/DSO/DIO/DPO/CCC)
-- Idiom: RLS is_chairman_super() + current_tenant_id() (018), grants 013.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · canvas_blocks (BMC 9 khối) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS canvas_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  block_key text NOT NULL CHECK (block_key IN (
    'customer_segments','value_propositions','channels','customer_relationships',
    'revenue_streams','key_resources','key_activities','key_partnerships','cost_structure')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, block_key)
);
ALTER TABLE canvas_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON canvas_blocks;
CREATE POLICY super_admin_bypass ON canvas_blocks FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON canvas_blocks;
CREATE POLICY tenant_isolation ON canvas_blocks FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON canvas_blocks TO authenticated;
GRANT ALL ON canvas_blocks TO service_role;
DROP TRIGGER IF EXISTS trg_canvas_updated ON canvas_blocks;
CREATE TRIGGER trg_canvas_updated BEFORE UPDATE ON canvas_blocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2 · financial_statements (P&L + cashflow tháng — nguồn sự thật) ─
CREATE TABLE IF NOT EXISTS financial_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  period date NOT NULL,                       -- ngày đầu tháng (2026-06-01)
  -- P&L
  revenue numeric NOT NULL DEFAULT 0,
  cogs numeric NOT NULL DEFAULT 0,
  opex_sales numeric NOT NULL DEFAULT 0,      -- S&M
  opex_rnd numeric NOT NULL DEFAULT 0,        -- R&D
  opex_ga numeric NOT NULL DEFAULT 0,         -- G&A
  other_income numeric NOT NULL DEFAULT 0,
  -- Cash & working capital (cho CCC)
  capex numeric NOT NULL DEFAULT 0,
  cash_balance numeric,                       -- số dư cuối tháng
  accounts_receivable numeric DEFAULT 0,      -- AR → DSO
  inventory numeric DEFAULT 0,                -- → DIO
  accounts_payable numeric DEFAULT 0,         -- AP → DPO
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, period)
);
CREATE INDEX IF NOT EXISTS idx_finstat_tenant_period
  ON financial_statements (tenant_id, period DESC);
ALTER TABLE financial_statements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON financial_statements;
CREATE POLICY super_admin_bypass ON financial_statements FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON financial_statements;
CREATE POLICY tenant_isolation ON financial_statements FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON financial_statements TO authenticated;
GRANT ALL ON financial_statements TO service_role;
DROP TRIGGER IF EXISTS trg_finstat_updated ON financial_statements;
CREATE TRIGGER trg_finstat_updated BEFORE UPDATE ON financial_statements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3 · finance_assumptions (driver của các hàm) ────────────────────
CREATE TABLE IF NOT EXISTS finance_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  key text NOT NULL,                          -- runway_floor_months, raise_buffer_months, target_gm_pct…
  value numeric NOT NULL,
  note text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, key)
);
ALTER TABLE finance_assumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON finance_assumptions;
CREATE POLICY super_admin_bypass ON finance_assumptions FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON finance_assumptions;
CREATE POLICY tenant_isolation ON finance_assumptions FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON finance_assumptions TO authenticated;
GRANT ALL ON finance_assumptions TO service_role;

-- ── 4 · journey_phase_specs — 10 BƯỚC Idea → IPO (global, public read) ─
CREATE TABLE IF NOT EXISTS journey_phase_specs (
  phase int PRIMARY KEY CHECK (phase BETWEEN 1 AND 10),
  title text NOT NULL,
  mission text NOT NULL,
  key_metrics text[] NOT NULL DEFAULT '{}',
  gates jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{key,label}] — điều kiện lên bước sau
  dashboard_focus text
);
ALTER TABLE journey_phase_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS phase_specs_public_read ON journey_phase_specs;
CREATE POLICY phase_specs_public_read ON journey_phase_specs FOR SELECT USING (true);
GRANT SELECT ON journey_phase_specs TO authenticated;
GRANT ALL ON journey_phase_specs TO service_role;

INSERT INTO journey_phase_specs (phase, title, mission, key_metrics, gates, dashboard_focus) VALUES
 (1,'Idea & Canvas','Đóng khung mô hình kinh doanh — 9 khối BMC + phán quyết Council 9.',
   ARRAY['canvas_completeness','council_score'],
   '[{"key":"canvas_5_blocks","label":"BMC ≥ 5/9 khối có nội dung"},{"key":"council_run","label":"Đã chạy Council 9 thẩm định"}]'::jsonb,
   'Business Model Canvas + Council verdict'),
 (2,'Validation','Chứng minh thị trường: TAM/SAM/SOM + tín hiệu khách thật.',
   ARRAY['tam','sam','som','customer_signals'],
   '[{"key":"market_sized","label":"Có TAM/SAM/SOM trong Market Data"},{"key":"signals","label":"≥3 tín hiệu Market Intel"}]'::jsonb,
   'Market Data + Market Intel'),
 (3,'MVP & Unit Economics','Sản phẩm đầu + kinh tế đơn vị dương hướng.',
   ARRAY['revenue_monthly','cac','ltv','activation'],
   '[{"key":"first_revenue","label":"Có doanh thu trong P&L"},{"key":"finstat_3m","label":"≥3 tháng số liệu tài chính"}]'::jsonb,
   'P&L + CLV:CAC'),
 (4,'PMF & Growth','Product-market fit đo được: tăng trưởng + giữ chân.',
   ARRAY['growth_mom_pct','retention','nps'],
   '[{"key":"growth_positive","label":"Tăng trưởng MoM > 0"},{"key":"okr_active","label":"OKR đang vận hành"}]'::jsonb,
   'Growth + North Star + OKR'),
 (5,'Scale & Systems','Scale có kỷ luật: SOP, OKR, org chart, agent tự động.',
   ARRAY['sop_coverage','okr_health','headcount'],
   '[{"key":"sops","label":"Có SOP/playbook"},{"key":"agents_on","label":"Supagent engine bật"}]'::jsonb,
   'Operations + 108 Agents'),
 (6,'Funding & Finance Discipline','P&L chuẩn audit + CCC khoẻ + chiến lược vốn khớp hàm burn/runway.',
   ARRAY['gross_margin_pct','net_burn','runway_months','ccc_days'],
   '[{"key":"gm_positive","label":"Gross margin > 0"},{"key":"runway_9m","label":"Runway ≥ 9 tháng HOẶC round đang mở đủ bù"},{"key":"round_linked","label":"Round gọi vốn khớp nhu cầu tiền (hàm)"}]'::jsonb,
   'P&L + Cashflow + Fundraise'),
 (7,'Institutional & Governance','Quản trị chuẩn niêm yết: board, nghị quyết, kiểm soát nội bộ.',
   ARRAY['board_meetings','resolutions','compliance_score'],
   '[{"key":"board","label":"Có board members"},{"key":"gov_docs","label":"Có governance docs"}]'::jsonb,
   'Governance + Board + Audit'),
 (8,'Pre-IPO Readiness','DD sẵn sàng: data room đầy, readiness score cao, PCAOB/SOX mindset.',
   ARRAY['readiness_score','dataroom_docs','audit_findings'],
   '[{"key":"dataroom","label":"Data room có cấu trúc + tài liệu"},{"key":"readiness_70","label":"Readiness score ≥ 70"}]'::jsonb,
   'IPO Readiness + Data Room'),
 (9,'IPO Execution','S-1/prospectus, roadshow, định giá, bảo lãnh phát hành.',
   ARRAY['readiness_score','valuation_range','book_coverage'],
   '[{"key":"readiness_85","label":"Readiness ≥ 85"},{"key":"valuation","label":"Có valuation + comparables"}]'::jsonb,
   'IPO Execution + Valuation'),
 (10,'IPO & Beyond','Ring-bell + vận hành công ty đại chúng: IR, báo cáo quý, tuân thủ.',
   ARRAY['stock_performance','ir_cadence','quarterly_reporting'],
   '[{"key":"listed","label":"Đã niêm yết"}]'::jsonb,
   'Investor Relations + Public Ops')
ON CONFLICT (phase) DO UPDATE SET title=EXCLUDED.title, mission=EXCLUDED.mission,
  key_metrics=EXCLUDED.key_metrics, gates=EXCLUDED.gates, dashboard_focus=EXCLUDED.dashboard_focus;

-- ── 5 · HÀM KHỚP DỮ LIỆU: statements → KPI (chạy trong session user, RLS áp) ─
CREATE OR REPLACE FUNCTION derive_finance_kpis(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  cur  financial_statements%ROWTYPE;   -- tháng mới nhất
  prev financial_statements%ROWTYPE;   -- tháng liền trước
  v_burn_avg numeric;                  -- avg net burn 3 tháng (dương = đốt tiền)
  v_gross numeric; v_gm_pct numeric; v_ebitda numeric; v_net_burn numeric;
  v_runway numeric; v_growth numeric;
  v_dso numeric; v_dio numeric; v_dpo numeric; v_ccc numeric;
  v_period text;
  v_out jsonb;
BEGIN
  SELECT * INTO cur FROM financial_statements
   WHERE tenant_id = p_tenant ORDER BY period DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Chưa có tháng tài chính nào — nhập P&L trước');
  END IF;
  SELECT * INTO prev FROM financial_statements
   WHERE tenant_id = p_tenant AND period < cur.period ORDER BY period DESC LIMIT 1;

  v_period := to_char(cur.period, 'YYYY-MM');
  v_gross  := cur.revenue - cur.cogs;
  v_gm_pct := CASE WHEN cur.revenue > 0 THEN round(v_gross / cur.revenue * 100, 1) ELSE 0 END;
  v_ebitda := v_gross - cur.opex_sales - cur.opex_rnd - cur.opex_ga + cur.other_income;
  v_net_burn := -(v_ebitda - cur.capex);   -- dương = đốt tiền/tháng

  SELECT avg(-((s.revenue - s.cogs - s.opex_sales - s.opex_rnd - s.opex_ga + s.other_income) - s.capex))
    INTO v_burn_avg
    FROM (SELECT * FROM financial_statements WHERE tenant_id = p_tenant ORDER BY period DESC LIMIT 3) s;
  v_burn_avg := COALESCE(v_burn_avg, v_net_burn);

  v_runway := CASE WHEN v_burn_avg > 0 AND cur.cash_balance IS NOT NULL
                   THEN round(cur.cash_balance / v_burn_avg, 1) ELSE NULL END;
  v_growth := CASE WHEN prev.revenue IS NOT NULL AND prev.revenue > 0
                   THEN round((cur.revenue - prev.revenue) / prev.revenue * 100, 1) ELSE NULL END;

  -- CCC = DSO + DIO − DPO (chuẩn 30 ngày/tháng)
  v_dso := CASE WHEN cur.revenue > 0 THEN round(COALESCE(cur.accounts_receivable,0) / cur.revenue * 30, 1) ELSE 0 END;
  v_dio := CASE WHEN cur.cogs > 0 THEN round(COALESCE(cur.inventory,0) / cur.cogs * 30, 1) ELSE 0 END;
  v_dpo := CASE WHEN cur.cogs > 0 THEN round(COALESCE(cur.accounts_payable,0) / cur.cogs * 30, 1) ELSE 0 END;
  v_ccc := v_dso + v_dio - v_dpo;

  -- Xoá bản derive cũ của kỳ này rồi ghi mới (idempotent, không spam)
  DELETE FROM kpi_metrics
   WHERE tenant_id = p_tenant AND period = v_period
     AND metric_code IN ('revenue_monthly','growth_mom_pct','gross_margin_pct','ebitda',
                         'net_burn','cash_balance','runway_months','dso_days','dio_days','dpo_days','ccc_days');

  INSERT INTO kpi_metrics (tenant_id, metric_code, name, category, value, unit, period, trend)
  SELECT p_tenant, m.code, m.name, 'finance_derived', m.val, m.unit, v_period, m.trend
  FROM (VALUES
    ('revenue_monthly','Doanh thu tháng', cur.revenue, 'USD',
       CASE WHEN v_growth IS NULL THEN 'flat' WHEN v_growth > 0 THEN 'up' WHEN v_growth < 0 THEN 'down' ELSE 'flat' END),
    ('growth_mom_pct','Tăng trưởng MoM', v_growth, '%',
       CASE WHEN v_growth IS NULL THEN 'flat' WHEN v_growth > 0 THEN 'up' ELSE 'down' END),
    ('gross_margin_pct','Gross margin', v_gm_pct, '%',
       CASE WHEN prev.revenue IS NULL THEN 'flat'
            WHEN v_gm_pct >= CASE WHEN prev.revenue > 0 THEN (prev.revenue - prev.cogs)/prev.revenue*100 ELSE 0 END THEN 'up' ELSE 'down' END),
    ('ebitda','EBITDA', v_ebitda, 'USD', CASE WHEN v_ebitda >= 0 THEN 'up' ELSE 'down' END),
    ('net_burn','Net burn', v_net_burn, 'USD/tháng', CASE WHEN v_net_burn <= 0 THEN 'up' ELSE 'down' END),
    ('cash_balance','Cash balance', cur.cash_balance, 'USD', 'flat'),
    ('runway_months','Runway', v_runway, 'tháng',
       CASE WHEN v_runway IS NULL THEN 'flat' WHEN v_runway >= 12 THEN 'up' WHEN v_runway < 6 THEN 'down' ELSE 'flat' END),
    ('dso_days','DSO', v_dso, 'ngày', 'flat'),
    ('dio_days','DIO', v_dio, 'ngày', 'flat'),
    ('dpo_days','DPO', v_dpo, 'ngày', 'flat'),
    ('ccc_days','Cash Conversion Cycle', v_ccc, 'ngày', CASE WHEN v_ccc <= 0 THEN 'up' WHEN v_ccc > 60 THEN 'down' ELSE 'flat' END)
  ) AS m(code, name, val, unit, trend)
  WHERE m.val IS NOT NULL;

  v_out := jsonb_build_object(
    'ok', true, 'period', v_period,
    'revenue', cur.revenue, 'gross_profit', v_gross, 'gross_margin_pct', v_gm_pct,
    'ebitda', v_ebitda, 'net_burn', v_net_burn, 'burn_avg_3m', round(v_burn_avg, 0),
    'cash_balance', cur.cash_balance, 'runway_months', v_runway, 'growth_mom_pct', v_growth,
    'dso', v_dso, 'dio', v_dio, 'dpo', v_dpo, 'ccc_days', v_ccc
  );
  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION derive_finance_kpis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION derive_finance_kpis(uuid) TO service_role;
