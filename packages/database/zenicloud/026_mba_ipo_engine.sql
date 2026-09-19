-- ═══════════════════════════════════════════════════════════════════
-- Migration 026 · MBA / IPO ENGINE — tri thức ngành mã hoá thành hàm
-- ═══════════════════════════════════════════════════════════════════
-- Chairman spec 2026-06-22: "tập hợp toàn bộ dữ liệu ngành MBA + IPO +
-- tài chính doanh nghiệp để build đúng luồng nền tảng hành trình IPO".
--
-- Nội dung:
--   1. ipo_benchmarks        — THƯ VIỆN CHUẨN NGÀNH (seed 24 chuẩn, theo stage)
--   2. unit_economics_inputs — input vận hành theo tháng (khách/churn/mở rộng)
--   3. derive_unit_economics()— CAC · LTV · LTV:CAC · Payback · NRR · GRR ·
--                               Rule of 40 · Burn Multiple · Magic Number ·
--                               Quick Ratio · ARR · Net-new-ARR
--   4. grade_vs_benchmark()  — chấm điểm doanh nghiệp so chuẩn IPO theo stage
--   5. valuation_runs + run_valuation() — Comparables · DCF · VC Method
--   6. board_resolutions + compliance_items — quản trị & tuân thủ IPO
-- Idiom: RLS is_chairman_super()/current_tenant_id() (018) · grants (013).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · ipo_benchmarks — THƯ VIỆN TRI THỨC (global, public read) ────
CREATE TABLE IF NOT EXISTS ipo_benchmarks (
  metric_code text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('seed','series_a','series_b','growth','pre_ipo')),
  name_vi text NOT NULL,
  good_min numeric,          -- ngưỡng TỐT (metric càng cao càng tốt)
  good_max numeric,          -- ngưỡng TỐT (metric càng thấp càng tốt)
  category text NOT NULL,    -- unit_economics | efficiency | growth | profitability | governance
  source_note text,          -- xuất xứ chuẩn (sách/quỹ/banker)
  PRIMARY KEY (metric_code, stage)
);
ALTER TABLE ipo_benchmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS benchmarks_public_read ON ipo_benchmarks;
CREATE POLICY benchmarks_public_read ON ipo_benchmarks FOR SELECT USING (true);
GRANT SELECT ON ipo_benchmarks TO authenticated;
GRANT ALL ON ipo_benchmarks TO service_role;

INSERT INTO ipo_benchmarks (metric_code, stage, name_vi, good_min, good_max, category, source_note) VALUES
 -- Unit economics (chuẩn kinh điển VC/MBA)
 ('ltv_cac_ratio','seed','LTV:CAC', 3, NULL, 'unit_economics','Chuẩn VC kinh điển: ≥3× mới scale được'),
 ('ltv_cac_ratio','series_a','LTV:CAC', 3, NULL, 'unit_economics','≥3×; <1 = đốt tiền mua khách lỗ'),
 ('ltv_cac_ratio','series_b','LTV:CAC', 3.5, NULL, 'unit_economics','Scale phải chứng minh hiệu quả tăng'),
 ('ltv_cac_ratio','growth','LTV:CAC', 4, NULL, 'unit_economics','Growth stage đòi hỏi >4×'),
 ('ltv_cac_ratio','pre_ipo','LTV:CAC', 4, NULL, 'unit_economics','Banker soi kỹ chất lượng tăng trưởng'),
 ('cac_payback_months','seed','CAC Payback', NULL, 18, 'unit_economics','≤18 tháng (early cho phép dài hơn)'),
 ('cac_payback_months','series_a','CAC Payback', NULL, 15, 'unit_economics','≤15 tháng'),
 ('cac_payback_months','series_b','CAC Payback', NULL, 12, 'unit_economics','≤12 tháng — chuẩn SaaS tốt'),
 ('cac_payback_months','growth','CAC Payback', NULL, 12, 'unit_economics','≤12 tháng'),
 ('cac_payback_months','pre_ipo','CAC Payback', NULL, 12, 'unit_economics','≤12 tháng để IPO thuyết phục'),
 ('gross_margin_pct','series_a','Gross margin', 60, NULL, 'profitability','SaaS ≥70%; dịch vụ ≥40%; F&B 55-65%'),
 ('gross_margin_pct','series_b','Gross margin', 65, NULL, 'profitability','Biên phải mở rộng theo quy mô'),
 ('gross_margin_pct','pre_ipo','Gross margin', 70, NULL, 'profitability','Chuẩn công ty đại chúng công nghệ'),
 -- Retention (quyết định định giá)
 ('nrr_pct','series_a','Net Revenue Retention', 100, NULL, 'growth','≥100% = tăng trưởng âm-churn'),
 ('nrr_pct','series_b','Net Revenue Retention', 110, NULL, 'growth','≥110% chuẩn SaaS tốt'),
 ('nrr_pct','pre_ipo','Net Revenue Retention', 120, NULL, 'growth','Top-quartile IPO SaaS ~120%+'),
 ('grr_pct','series_b','Gross Revenue Retention', 85, NULL, 'growth','≥85% (enterprise ≥90%)'),
 ('grr_pct','pre_ipo','Gross Revenue Retention', 90, NULL, 'growth','≥90% để IPO'),
 -- Hiệu quả vốn (banker + quỹ dùng để chấm)
 ('rule_of_40','series_b','Rule of 40', 40, NULL, 'efficiency','Tăng trưởng% + biên EBITDA% ≥40'),
 ('rule_of_40','growth','Rule of 40', 40, NULL, 'efficiency','Chuẩn vàng công ty phần mềm'),
 ('rule_of_40','pre_ipo','Rule of 40', 40, NULL, 'efficiency','Điều kiện gần như bắt buộc khi IPO tech'),
 ('burn_multiple','series_a','Burn Multiple', NULL, 2, 'efficiency','Bessemer: <1 xuất sắc · 1-1.5 tốt · >2 xấu'),
 ('burn_multiple','series_b','Burn Multiple', NULL, 1.5, 'efficiency','Đốt bao nhiêu để ra 1$ ARR mới'),
 ('burn_multiple','pre_ipo','Burn Multiple', NULL, 1, 'efficiency','Pre-IPO phải đốt hiệu quả'),
 ('magic_number','series_b','Magic Number', 0.75, NULL, 'efficiency','≥0.75 = đạp ga bán hàng được'),
 ('quick_ratio','series_a','Quick Ratio', 4, NULL, 'growth','(New+Expansion)/(Churn+Contraction) ≥4'),
 ('runway_months','seed','Runway', 12, NULL, 'efficiency','≥12 tháng để không gọi vốn thế yếu'),
 ('runway_months','series_a','Runway', 18, NULL, 'efficiency','≥18 tháng chuẩn an toàn'),
 ('runway_months','series_b','Runway', 18, NULL, 'efficiency','≥18 tháng'),
 ('ccc_days','growth','Cash Conversion Cycle', NULL, 45, 'efficiency','Càng thấp càng khoẻ; âm = tuyệt vời'),
 ('readiness_score','pre_ipo','IPO Readiness', 85, NULL, 'governance','≥85/100 mới nộp hồ sơ')
ON CONFLICT (metric_code, stage) DO UPDATE SET name_vi=EXCLUDED.name_vi,
  good_min=EXCLUDED.good_min, good_max=EXCLUDED.good_max, source_note=EXCLUDED.source_note;

-- ── 2 · unit_economics_inputs (input vận hành theo tháng) ───────────
CREATE TABLE IF NOT EXISTS unit_economics_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  period date NOT NULL,                       -- ngày đầu tháng, khớp financial_statements
  new_customers int NOT NULL DEFAULT 0,
  churned_customers int NOT NULL DEFAULT 0,
  active_customers int NOT NULL DEFAULT 0,
  starting_mrr numeric NOT NULL DEFAULT 0,    -- MRR đầu kỳ
  new_mrr numeric NOT NULL DEFAULT 0,         -- từ khách mới
  expansion_mrr numeric NOT NULL DEFAULT 0,   -- upsell/cross-sell
  contraction_mrr numeric NOT NULL DEFAULT 0, -- downgrade
  churned_mrr numeric NOT NULL DEFAULT 0,     -- mất hẳn
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, period)
);
CREATE INDEX IF NOT EXISTS idx_ue_tenant_period ON unit_economics_inputs (tenant_id, period DESC);
ALTER TABLE unit_economics_inputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON unit_economics_inputs;
CREATE POLICY super_admin_bypass ON unit_economics_inputs FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON unit_economics_inputs;
CREATE POLICY tenant_isolation ON unit_economics_inputs FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON unit_economics_inputs TO authenticated;
GRANT ALL ON unit_economics_inputs TO service_role;
DROP TRIGGER IF EXISTS trg_ue_updated ON unit_economics_inputs;
CREATE TRIGGER trg_ue_updated BEFORE UPDATE ON unit_economics_inputs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3 · derive_unit_economics — TOÀN BỘ CÔNG THỨC MBA ───────────────
CREATE OR REPLACE FUNCTION derive_unit_economics(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  ue   unit_economics_inputs%ROWTYPE;
  fs   financial_statements%ROWTYPE;   -- cùng kỳ với ue
  fs_p financial_statements%ROWTYPE;   -- kỳ trước
  ue_q3 numeric;                        -- S&M 3 tháng trước (magic number)
  v_arpu numeric; v_gm_pct numeric; v_cac numeric; v_ltv numeric;
  v_ltv_cac numeric; v_payback numeric; v_logo_churn numeric;
  v_nrr numeric; v_grr numeric; v_quick numeric;
  v_arr numeric; v_arr_prev numeric; v_net_new_arr numeric;
  v_growth_yoy numeric; v_ebitda numeric; v_ebitda_margin numeric;
  v_rule40 numeric; v_burn numeric; v_burn_multiple numeric; v_magic numeric;
  v_period text;
BEGIN
  SELECT * INTO ue FROM unit_economics_inputs
   WHERE tenant_id = p_tenant ORDER BY period DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Chưa có dữ liệu unit economics — nhập số khách + MRR tháng trước đã');
  END IF;
  v_period := to_char(ue.period, 'YYYY-MM');

  SELECT * INTO fs FROM financial_statements
   WHERE tenant_id = p_tenant AND period = ue.period;
  SELECT * INTO fs_p FROM financial_statements
   WHERE tenant_id = p_tenant AND period < ue.period ORDER BY period DESC LIMIT 1;

  -- Biên gộp lấy từ P&L (nguồn sự thật) — không nhập tay lần 2.
  v_gm_pct := CASE WHEN fs.revenue > 0 THEN (fs.revenue - fs.cogs) / fs.revenue * 100 ELSE NULL END;
  v_arpu   := CASE WHEN ue.active_customers > 0
                   THEN (ue.starting_mrr + ue.new_mrr + ue.expansion_mrr - ue.contraction_mrr - ue.churned_mrr) / ue.active_customers
                   ELSE NULL END;

  -- CAC = chi phí S&M kỳ này / số khách mới
  v_cac := CASE WHEN ue.new_customers > 0 AND fs.opex_sales IS NOT NULL
                THEN round(fs.opex_sales / ue.new_customers, 2) ELSE NULL END;

  -- Logo churn tháng = churned / (active đầu kỳ ≈ active - new + churned)
  v_logo_churn := CASE
    WHEN (ue.active_customers - ue.new_customers + ue.churned_customers) > 0
    THEN ue.churned_customers::numeric / (ue.active_customers - ue.new_customers + ue.churned_customers) * 100
    ELSE NULL END;

  -- LTV = ARPU × GM% ÷ churn tháng  (công thức kinh điển, quy về tháng)
  v_ltv := CASE WHEN v_arpu IS NOT NULL AND v_gm_pct IS NOT NULL
                     AND v_logo_churn IS NOT NULL AND v_logo_churn > 0
                THEN round(v_arpu * (v_gm_pct/100) / (v_logo_churn/100), 2) ELSE NULL END;

  v_ltv_cac := CASE WHEN v_ltv IS NOT NULL AND v_cac IS NOT NULL AND v_cac > 0
                    THEN round(v_ltv / v_cac, 2) ELSE NULL END;

  -- CAC payback (tháng) = CAC / (ARPU × GM%)
  v_payback := CASE WHEN v_cac IS NOT NULL AND v_arpu IS NOT NULL AND v_gm_pct IS NOT NULL
                         AND v_arpu * v_gm_pct > 0
                    THEN round(v_cac / (v_arpu * v_gm_pct/100), 1) ELSE NULL END;

  -- NRR / GRR (chuẩn SaaS — quyết định bội số định giá)
  v_nrr := CASE WHEN ue.starting_mrr > 0
                THEN round((ue.starting_mrr + ue.expansion_mrr - ue.contraction_mrr - ue.churned_mrr) / ue.starting_mrr * 100, 1)
                ELSE NULL END;
  v_grr := CASE WHEN ue.starting_mrr > 0
                THEN round((ue.starting_mrr - ue.contraction_mrr - ue.churned_mrr) / ue.starting_mrr * 100, 1)
                ELSE NULL END;
  v_quick := CASE WHEN (ue.churned_mrr + ue.contraction_mrr) > 0
                  THEN round((ue.new_mrr + ue.expansion_mrr) / (ue.churned_mrr + ue.contraction_mrr), 2)
                  ELSE NULL END;

  -- ARR + net-new-ARR + tăng trưởng
  v_arr := (ue.starting_mrr + ue.new_mrr + ue.expansion_mrr - ue.contraction_mrr - ue.churned_mrr) * 12;
  v_arr_prev := ue.starting_mrr * 12;
  v_net_new_arr := v_arr - v_arr_prev;
  v_growth_yoy := CASE WHEN v_arr_prev > 0 THEN round((v_arr - v_arr_prev) / v_arr_prev * 100, 1) ELSE NULL END;

  -- EBITDA margin + Rule of 40 (tăng trưởng% + biên EBITDA%)
  v_ebitda := CASE WHEN fs.id IS NOT NULL
                   THEN fs.revenue - fs.cogs - fs.opex_sales - fs.opex_rnd - fs.opex_ga + fs.other_income
                   ELSE NULL END;
  v_ebitda_margin := CASE WHEN fs.revenue > 0 THEN round(v_ebitda / fs.revenue * 100, 1) ELSE NULL END;
  v_rule40 := CASE WHEN v_growth_yoy IS NOT NULL AND v_ebitda_margin IS NOT NULL
                   THEN round(v_growth_yoy + v_ebitda_margin, 1) ELSE NULL END;

  -- Burn multiple = net burn / net new ARR (Bessemer)
  v_burn := CASE WHEN v_ebitda IS NOT NULL THEN -(v_ebitda - COALESCE(fs.capex,0)) ELSE NULL END;
  v_burn_multiple := CASE WHEN v_burn IS NOT NULL AND v_burn > 0 AND v_net_new_arr > 0
                          THEN round(v_burn * 12 / v_net_new_arr, 2) ELSE NULL END;

  -- Magic number = (Δrevenue × 4) / S&M kỳ trước
  SELECT opex_sales INTO ue_q3 FROM financial_statements
   WHERE tenant_id = p_tenant AND period < ue.period ORDER BY period DESC LIMIT 1;
  v_magic := CASE WHEN ue_q3 IS NOT NULL AND ue_q3 > 0 AND fs_p.id IS NOT NULL
                  THEN round((fs.revenue - fs_p.revenue) * 4 / ue_q3, 2) ELSE NULL END;

  DELETE FROM kpi_metrics
   WHERE tenant_id = p_tenant AND period = v_period
     AND metric_code IN ('arpu','cac','ltv','ltv_cac_ratio','cac_payback_months','logo_churn_pct',
                         'nrr_pct','grr_pct','quick_ratio','arr','net_new_arr','growth_yoy_pct',
                         'ebitda_margin_pct','rule_of_40','burn_multiple','magic_number');

  INSERT INTO kpi_metrics (tenant_id, metric_code, name, category, value, unit, period, trend)
  SELECT p_tenant, m.code, m.nm, 'unit_economics', m.val, m.unit, v_period, 'flat'
  FROM (VALUES
    ('arpu','ARPU', v_arpu, 'USD/khách'),
    ('cac','CAC — chi phí có khách', v_cac, 'USD'),
    ('ltv','LTV — giá trị vòng đời', v_ltv, 'USD'),
    ('ltv_cac_ratio','LTV:CAC', v_ltv_cac, 'x'),
    ('cac_payback_months','CAC Payback', v_payback, 'tháng'),
    ('logo_churn_pct','Logo churn', v_logo_churn, '%/tháng'),
    ('nrr_pct','Net Revenue Retention', v_nrr, '%'),
    ('grr_pct','Gross Revenue Retention', v_grr, '%'),
    ('quick_ratio','Quick Ratio', v_quick, 'x'),
    ('arr','ARR', v_arr, 'USD'),
    ('net_new_arr','Net new ARR', v_net_new_arr, 'USD'),
    ('growth_yoy_pct','Tăng trưởng ARR', v_growth_yoy, '%'),
    ('ebitda_margin_pct','Biên EBITDA', v_ebitda_margin, '%'),
    ('rule_of_40','Rule of 40', v_rule40, 'điểm'),
    ('burn_multiple','Burn Multiple', v_burn_multiple, 'x'),
    ('magic_number','Magic Number', v_magic, 'x')
  ) AS m(code, nm, val, unit)
  WHERE m.val IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true, 'period', v_period,
    'arpu', v_arpu, 'cac', v_cac, 'ltv', v_ltv, 'ltv_cac_ratio', v_ltv_cac,
    'cac_payback_months', v_payback, 'logo_churn_pct', round(v_logo_churn,2),
    'nrr_pct', v_nrr, 'grr_pct', v_grr, 'quick_ratio', v_quick,
    'arr', v_arr, 'net_new_arr', v_net_new_arr, 'growth_yoy_pct', v_growth_yoy,
    'ebitda_margin_pct', v_ebitda_margin, 'rule_of_40', v_rule40,
    'burn_multiple', v_burn_multiple, 'magic_number', v_magic,
    'gross_margin_pct', round(v_gm_pct,1)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION derive_unit_economics(uuid) TO authenticated, service_role;

-- ── 4 · grade_vs_benchmark — chấm doanh nghiệp so CHUẨN NGÀNH ───────
CREATE OR REPLACE FUNCTION grade_vs_benchmark(p_tenant uuid, p_stage text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  rec record;
  v_items jsonb := '[]'::jsonb;
  v_pass int := 0; v_total int := 0;
  v_actual numeric; v_ok boolean;
BEGIN
  FOR rec IN
    SELECT b.metric_code, b.name_vi, b.good_min, b.good_max, b.category, b.source_note
      FROM ipo_benchmarks b WHERE b.stage = p_stage ORDER BY b.category, b.metric_code
  LOOP
    SELECT k.value INTO v_actual FROM kpi_metrics k
     WHERE k.tenant_id = p_tenant AND k.metric_code = rec.metric_code
     ORDER BY k.captured_at DESC LIMIT 1;

    IF v_actual IS NULL THEN
      v_items := v_items || jsonb_build_object(
        'metric_code', rec.metric_code, 'name', rec.name_vi, 'category', rec.category,
        'actual', NULL, 'status', 'missing',
        'target', COALESCE('≥'||rec.good_min::text, '≤'||rec.good_max::text),
        'note', rec.source_note);
    ELSE
      v_ok := (rec.good_min IS NULL OR v_actual >= rec.good_min)
          AND (rec.good_max IS NULL OR v_actual <= rec.good_max);
      v_total := v_total + 1;
      IF v_ok THEN v_pass := v_pass + 1; END IF;
      v_items := v_items || jsonb_build_object(
        'metric_code', rec.metric_code, 'name', rec.name_vi, 'category', rec.category,
        'actual', v_actual, 'status', CASE WHEN v_ok THEN 'pass' ELSE 'fail' END,
        'target', COALESCE('≥'||rec.good_min::text, '≤'||rec.good_max::text),
        'note', rec.source_note);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'stage', p_stage,
    'passed', v_pass, 'measured', v_total,
    'score_pct', CASE WHEN v_total > 0 THEN round(v_pass::numeric / v_total * 100, 0) ELSE 0 END,
    'items', v_items);
END;
$$;
GRANT EXECUTE ON FUNCTION grade_vs_benchmark(uuid, text) TO authenticated, service_role;

-- ── 5 · valuation_runs + run_valuation (3 phương pháp chuẩn) ────────
CREATE TABLE IF NOT EXISTS valuation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  method text NOT NULL CHECK (method IN ('comparables','dcf','vc_method')),
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  enterprise_value_usd numeric,
  equity_value_usd numeric,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_valuation_tenant ON valuation_runs (tenant_id, created_at DESC);
ALTER TABLE valuation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON valuation_runs;
CREATE POLICY super_admin_bypass ON valuation_runs FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON valuation_runs;
CREATE POLICY tenant_isolation ON valuation_runs FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON valuation_runs TO authenticated;
GRANT ALL ON valuation_runs TO service_role;

-- ── 6 · board_resolutions (quản trị chuẩn niêm yết) ─────────────────
CREATE TABLE IF NOT EXISTS board_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  resolution_no text,
  title text NOT NULL,
  body text,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  resolution_type text DEFAULT 'other' CHECK (resolution_type IN
    ('funding','esop','appointment','budget','m_and_a','policy','audit','ipo','other')),
  status text DEFAULT 'draft' CHECK (status IN ('draft','voted','approved','rejected','executed')),
  votes_for int DEFAULT 0,
  votes_against int DEFAULT 0,
  votes_abstain int DEFAULT 0,
  signed_by jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_res_tenant ON board_resolutions (tenant_id, meeting_date DESC);
ALTER TABLE board_resolutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON board_resolutions;
CREATE POLICY super_admin_bypass ON board_resolutions FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON board_resolutions;
CREATE POLICY tenant_isolation ON board_resolutions FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON board_resolutions TO authenticated;
GRANT ALL ON board_resolutions TO service_role;
DROP TRIGGER IF EXISTS trg_board_res_updated ON board_resolutions;
CREATE TRIGGER trg_board_res_updated BEFORE UPDATE ON board_resolutions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 7 · compliance_items (giấy phép · hợp đồng · IP · filing) ───────
CREATE TABLE IF NOT EXISTS compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  item_type text NOT NULL CHECK (item_type IN
    ('license','contract','ip','tax','labor','filing','insurance','policy','other')),
  title text NOT NULL,
  authority text,
  reference_no text,
  issued_date date,
  expiry_date date,
  status text DEFAULT 'active' CHECK (status IN ('active','expiring','expired','pending','revoked')),
  owner_id uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_tenant_expiry
  ON compliance_items (tenant_id, expiry_date);
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON compliance_items;
CREATE POLICY super_admin_bypass ON compliance_items FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON compliance_items;
CREATE POLICY tenant_isolation ON compliance_items FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_items TO authenticated;
GRANT ALL ON compliance_items TO service_role;
DROP TRIGGER IF EXISTS trg_compliance_updated ON compliance_items;
CREATE TRIGGER trg_compliance_updated BEFORE UPDATE ON compliance_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- service_role grants cho agent engine đọc dữ liệu mới
GRANT SELECT ON public.unit_economics_inputs TO service_role;
GRANT SELECT ON public.financial_statements TO service_role;
GRANT SELECT ON public.canvas_blocks TO service_role;
GRANT SELECT ON public.board_resolutions TO service_role;
GRANT SELECT ON public.compliance_items TO service_role;
