-- ═══════════════════════════════════════════════════════════════════
-- Migration 027 · OPERATING BRAIN — đầu não điều hành cho Founder/Chairman/CEO
-- ═══════════════════════════════════════════════════════════════════
-- Chairman 2026-06-22: "đây chính là đầu não của doanh nghiệp dành cho nhà
-- sáng lập, chủ tịch và CEO" — cần tầng nối CHIẾN LƯỢC ↔ VẬN HÀNH:
--   BMC → MASTERPLAN nhiều năm → PHÒNG BAN → VỊ TRÍ + NĂNG LỰC → SOP → KPI
--
--   1. masterplan_years      — bản đồ tài chính/nhân sự/vốn từng năm tới IPO
--   2. org_units             — phòng ban (12 chuẩn, khớp 108 agent legion)
--   3. org_positions         — từng GHẾ trong tổ chức (level, báo cáo ai, ai ngồi)
--   4. position_capabilities — NĂNG LỰC BẮT BUỘC của từng ghế (seed chuẩn MBA)
--   5. position_kpis         — KPI mà ghế đó chịu trách nhiệm (nối kpi_metrics)
--   6. sop_processes         — quy trình vận hành có bước, chủ sở hữu, SLA
--   7. plan_vs_actual()      — HÀM đối chiếu masterplan ↔ P&L thực
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · masterplan_years — bản đồ nhiều năm (financial roadmap) ─────
CREATE TABLE IF NOT EXISTS masterplan_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  year int NOT NULL CHECK (year BETWEEN 2020 AND 2060),
  phase int CHECK (phase BETWEEN 1 AND 10),          -- khớp journey_phase_specs
  revenue_target numeric,
  gross_margin_target_pct numeric,
  ebitda_target numeric,
  headcount_target int,
  funding_target numeric,
  funding_round_code text,                            -- seed/series_a/…
  valuation_target numeric,
  key_milestone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, year)
);
CREATE INDEX IF NOT EXISTS idx_masterplan_tenant_year ON masterplan_years (tenant_id, year);
ALTER TABLE masterplan_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON masterplan_years;
CREATE POLICY super_admin_bypass ON masterplan_years FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON masterplan_years;
CREATE POLICY tenant_isolation ON masterplan_years FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON masterplan_years TO authenticated;
GRANT ALL ON masterplan_years TO service_role;
DROP TRIGGER IF EXISTS trg_masterplan_updated ON masterplan_years;
CREATE TRIGGER trg_masterplan_updated BEFORE UPDATE ON masterplan_years
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2 · org_units — 12 phòng ban chuẩn (global reference, public read) ─
CREATE TABLE IF NOT EXISTS org_units (
  unit_code text PRIMARY KEY,
  name_vi text NOT NULL,
  mission_vi text NOT NULL,
  owns_metrics text[] NOT NULL DEFAULT '{}',   -- KPI phòng ban này sở hữu
  agent_department text,                        -- nối 108 agent legion
  display_order int
);
ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_units_public_read ON org_units;
CREATE POLICY org_units_public_read ON org_units FOR SELECT USING (true);
GRANT SELECT ON org_units TO authenticated;
GRANT ALL ON org_units TO service_role;

INSERT INTO org_units (unit_code, name_vi, mission_vi, owns_metrics, agent_department, display_order) VALUES
 ('exec','Ban điều hành','Chốt chiến lược, phân bổ vốn, chịu trách nhiệm kết quả toàn công ty trước HĐQT/cổ đông.',
   ARRAY['readiness_score','rule_of_40','runway_months','valuation'],'strategy',1),
 ('finance','Tài chính — Kế toán','Giữ mạch máu tiền: P&L chuẩn audit, dòng tiền, ngân sách, thuế, quan hệ ngân hàng.',
   ARRAY['revenue_monthly','gross_margin_pct','ebitda','net_burn','runway_months','ccc_days'],'finance',2),
 ('sales','Kinh doanh','Biến sản phẩm thành doanh thu: pipeline kỷ luật, dự báo chuẩn, mở rộng khách hiện hữu.',
   ARRAY['arr','net_new_arr','magic_number','pipeline_value','win_rate'],'sales',3),
 ('marketing','Marketing — Thương hiệu','Tạo nhu cầu hiệu quả và dựng câu chuyện equity-story cho nhà đầu tư.',
   ARRAY['cac','ltv_cac_ratio','mql_count','brand_traffic'],'marketing',4),
 ('product','Sản phẩm','Ship đúng north-star, đo adoption, giết feature không ai dùng.',
   ARRAY['activation_rate','nrr_pct','nps','feature_adoption'],'product',5),
 ('tech','Công nghệ','Uptime, tốc độ, bảo mật, nợ kỹ thuật kiểm soát — sạch khi tech due-diligence.',
   ARRAY['uptime','p95_latency','deploy_frequency','incident_count'],'tech',6),
 ('operations','Vận hành','SOP hoá mọi quy trình lặp lại, đo SLA, giảm chi phí đơn vị theo quy mô.',
   ARRAY['sla_ontime_rate','unit_cost','cycle_time','sop_coverage'],'operations',7),
 ('hr','Nhân sự — Tổ chức','Đúng người đúng ghế, ESOP minh bạch, giữ nhân sự chủ chốt.',
   ARRAY['headcount','attrition_rate','esop_pool_used','time_to_hire'],'hr',8),
 ('legal','Pháp chế — Tuân thủ','Giấy phép, hợp đồng, IP, compliance đủ chuẩn để không chết ở due-diligence.',
   ARRAY['license_valid_count','compliance_score','contract_backlog'],'legal',9),
 ('governance','Quản trị công ty','Board, nghị quyết, uỷ ban, kiểm soát nội bộ chuẩn công ty niêm yết.',
   ARRAY['board_meetings','resolutions','internal_control_score'],'governance',10),
 ('ir','Quan hệ nhà đầu tư','Giữ dòng vốn và niềm tin: pipeline nhà đầu tư, data room, update định kỳ.',
   ARRAY['investor_pipeline_count','dataroom_readiness','round_progress'],'investor_relations',11),
 ('security','An ninh — Rủi ro','Bảo mật dữ liệu, quản trị rủi ro, không sự cố rò rỉ trước/khi niêm yết.',
   ARRAY['open_vulns','mfa_coverage','access_review_age'],'security',12)
ON CONFLICT (unit_code) DO UPDATE SET name_vi=EXCLUDED.name_vi, mission_vi=EXCLUDED.mission_vi,
  owns_metrics=EXCLUDED.owns_metrics, agent_department=EXCLUDED.agent_department;

-- ── 3 · position_templates — THƯ VIỆN GHẾ CHUẨN + NĂNG LỰC (global) ──
-- Đây là tri thức MBA về org design: mỗi ghế cần năng lực gì, quyết định gì,
-- chịu trách nhiệm KPI nào. Tenant clone về org_positions rồi tuỳ biến.
CREATE TABLE IF NOT EXISTS position_templates (
  template_code text PRIMARY KEY,
  unit_code text REFERENCES org_units(unit_code) NOT NULL,
  title_vi text NOT NULL,
  level text NOT NULL CHECK (level IN ('c_level','director','manager','lead','ic')),
  reports_to_code text,
  mission_vi text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{name,category,level}]
  decision_rights text[] NOT NULL DEFAULT '{}',      -- quyền quyết định
  owns_metrics text[] NOT NULL DEFAULT '{}',
  min_phase int DEFAULT 1,                           -- cần từ bước mấy của hành trình
  display_order int
);
ALTER TABLE position_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS position_templates_public_read ON position_templates;
CREATE POLICY position_templates_public_read ON position_templates FOR SELECT USING (true);
GRANT SELECT ON position_templates TO authenticated;
GRANT ALL ON position_templates TO service_role;

INSERT INTO position_templates (template_code, unit_code, title_vi, level, reports_to_code, mission_vi, capabilities, decision_rights, owns_metrics, min_phase, display_order) VALUES
 ('chairman','exec','Chủ tịch HĐQT','c_level',NULL,
  'Người giữ tầm nhìn dài hạn và lợi ích cổ đông; chốt chiến lược lớn, cơ cấu vốn, bổ nhiệm CEO.',
  '[{"name":"Tư duy chiến lược dài hạn (10 năm)","category":"strategy","level":"expert"},
    {"name":"Quản trị công ty & trách nhiệm uỷ thác","category":"governance","level":"expert"},
    {"name":"Cấu trúc vốn & pha loãng","category":"finance","level":"advanced"},
    {"name":"Quan hệ nhà đầu tư tổ chức","category":"finance","level":"advanced"},
    {"name":"Đánh giá & bổ nhiệm nhân sự cấp cao","category":"people","level":"expert"}]'::jsonb,
  ARRAY['Phê duyệt chiến lược & masterplan','Chốt vòng gọi vốn và định giá','Bổ nhiệm/miễn nhiệm CEO','Phê duyệt M&A','Quyết định niêm yết'],
  ARRAY['valuation','readiness_score','rule_of_40'],1,1),
 ('ceo','exec','Tổng giám đốc (CEO)','c_level','chairman',
  'Biến chiến lược thành kết quả: điều hành hằng ngày, phân bổ nguồn lực, chịu trách nhiệm P&L toàn công ty.',
  '[{"name":"Điều hành theo OKR & nhịp kinh doanh","category":"operations","level":"expert"},
    {"name":"Đọc & ra quyết định trên báo cáo tài chính","category":"finance","level":"advanced"},
    {"name":"Xây đội ngũ C-level","category":"people","level":"expert"},
    {"name":"Gọi vốn & kể chuyện tăng trưởng","category":"finance","level":"advanced"},
    {"name":"Phân bổ vốn theo ROI","category":"strategy","level":"expert"}]'::jsonb,
  ARRAY['Phê duyệt ngân sách năm','Bổ nhiệm cấp giám đốc','Chốt giá & mô hình kinh doanh','Phê duyệt tuyển dụng cấp quản lý'],
  ARRAY['revenue_monthly','rule_of_40','runway_months','nrr_pct'],1,2),
 ('cfo','finance','Giám đốc tài chính (CFO)','c_level','ceo',
  'Giữ tiền và sự thật của con số: P&L chuẩn audit, dòng tiền, ngân sách, sẵn sàng due-diligence.',
  '[{"name":"Lập & bảo vệ mô hình tài chính 3 báo cáo","category":"finance","level":"expert"},
    {"name":"Quản trị dòng tiền & vốn lưu động (CCC)","category":"finance","level":"expert"},
    {"name":"Chuẩn mực kế toán & kiểm toán (VAS/IFRS)","category":"finance","level":"advanced"},
    {"name":"Định giá & cấu trúc thương vụ","category":"finance","level":"advanced"},
    {"name":"Kiểm soát nội bộ & SOX mindset","category":"governance","level":"advanced"}]'::jsonb,
  ARRAY['Phê duyệt chi vượt ngân sách','Chốt chính sách kế toán','Chọn kiểm toán độc lập','Quản lý quan hệ ngân hàng'],
  ARRAY['gross_margin_pct','ebitda','net_burn','runway_months','ccc_days','burn_multiple'],3,3),
 ('coo','operations','Giám đốc vận hành (COO)','c_level','ceo',
  'Làm cho cỗ máy chạy trơn và rẻ dần theo quy mô: SOP, SLA, chất lượng, chi phí đơn vị.',
  '[{"name":"Thiết kế quy trình & SOP hoá","category":"operations","level":"expert"},
    {"name":"Quản trị chuỗi cung ứng/nhà cung cấp","category":"operations","level":"advanced"},
    {"name":"Quản lý chất lượng & SLA","category":"operations","level":"advanced"},
    {"name":"Phân tích chi phí đơn vị","category":"finance","level":"advanced"}]'::jsonb,
  ARRAY['Phê duyệt SOP','Chọn nhà cung cấp lớn','Quyết định năng lực sản xuất/phục vụ'],
  ARRAY['unit_cost','sla_ontime_rate','cycle_time','sop_coverage'],4,4),
 ('cro','sales','Giám đốc kinh doanh (CRO/CSO)','c_level','ceo',
  'Sở hữu con số doanh thu: pipeline, dự báo, mở rộng khách hiện hữu, hiệu suất đội bán.',
  '[{"name":"Xây & quản trị pipeline nhiều giai đoạn","category":"sales","level":"expert"},
    {"name":"Dự báo doanh thu chính xác ±10%","category":"sales","level":"expert"},
    {"name":"Định giá & đàm phán hợp đồng lớn","category":"sales","level":"advanced"},
    {"name":"Xây đội bán & chính sách hoa hồng","category":"people","level":"advanced"}]'::jsonb,
  ARRAY['Phê duyệt chiết khấu ngoài khung','Chốt hợp đồng chiến lược','Thiết kế lãnh thổ & hạn ngạch'],
  ARRAY['arr','net_new_arr','win_rate','magic_number','pipeline_value'],3,5),
 ('cmo','marketing','Giám đốc marketing (CMO)','c_level','ceo',
  'Tạo nhu cầu có lãi và dựng thương hiệu đủ mạnh để nhà đầu tư tin câu chuyện.',
  '[{"name":"Kinh tế kênh & tối ưu CAC","category":"marketing","level":"expert"},
    {"name":"Định vị thương hiệu & thông điệp","category":"marketing","level":"advanced"},
    {"name":"Phân tích funnel & attribution","category":"data","level":"advanced"},
    {"name":"Equity story & PR nhà đầu tư","category":"marketing","level":"advanced"}]'::jsonb,
  ARRAY['Phân bổ ngân sách kênh','Phê duyệt nhận diện thương hiệu','Chốt thông điệp ra thị trường'],
  ARRAY['cac','ltv_cac_ratio','mql_count','brand_traffic'],3,6),
 ('cpo','product','Giám đốc sản phẩm (CPO)','c_level','ceo',
  'Bảo vệ north-star: ưu tiên đúng, ship đúng, giết feature vô ích.',
  '[{"name":"Khám phá nhu cầu & phỏng vấn khách","category":"product","level":"expert"},
    {"name":"Ưu tiên theo RICE/giá trị-nỗ lực","category":"product","level":"expert"},
    {"name":"Phân tích dữ liệu sử dụng & cohort","category":"data","level":"advanced"},
    {"name":"Thiết kế trải nghiệm & vòng phản hồi","category":"product","level":"advanced"}]'::jsonb,
  ARRAY['Chốt roadmap sản phẩm','Quyết định ngừng feature','Định nghĩa north-star metric'],
  ARRAY['activation_rate','nrr_pct','nps','feature_adoption'],3,7),
 ('cto','tech','Giám đốc công nghệ (CTO)','c_level','ceo',
  'Nền tảng kỹ thuật ổn định, an toàn, mở rộng được — sạch khi tech due-diligence.',
  '[{"name":"Kiến trúc hệ thống mở rộng","category":"tech","level":"expert"},
    {"name":"Bảo mật & tuân thủ dữ liệu","category":"security","level":"advanced"},
    {"name":"Quản trị nợ kỹ thuật & CI/CD","category":"tech","level":"expert"},
    {"name":"Xây đội kỹ sư & chuẩn code","category":"people","level":"advanced"}]'::jsonb,
  ARRAY['Chọn kiến trúc & công nghệ lõi','Phê duyệt chi hạ tầng','Quyết định build vs buy'],
  ARRAY['uptime','p95_latency','deploy_frequency','incident_count'],3,8),
 ('chro','hr','Giám đốc nhân sự (CHRO)','c_level','ceo',
  'Đúng người đúng ghế, ESOP minh bạch, văn hoá hiệu suất, giữ người chủ chốt.',
  '[{"name":"Thiết kế tổ chức & khung năng lực","category":"people","level":"expert"},
    {"name":"Chính sách lương thưởng & ESOP","category":"people","level":"advanced"},
    {"name":"Tuyển dụng cấp cao","category":"people","level":"advanced"},
    {"name":"Luật lao động & quan hệ lao động","category":"legal","level":"advanced"}]'::jsonb,
  ARRAY['Phê duyệt khung lương','Thiết kế ESOP','Chốt cơ cấu tổ chức'],
  ARRAY['headcount','attrition_rate','esop_pool_used','time_to_hire'],4,9),
 ('clo','legal','Giám đốc pháp chế (CLO)','c_level','ceo',
  'Giữ công ty sạch pháp lý: giấy phép, hợp đồng, IP, tuân thủ — không rủi ro đỏ khi DD.',
  '[{"name":"Soạn & rà soát hợp đồng thương mại","category":"legal","level":"expert"},
    {"name":"Sở hữu trí tuệ & bảo hộ nhãn hiệu","category":"legal","level":"advanced"},
    {"name":"Tuân thủ ngành & bảo vệ dữ liệu (NĐ13)","category":"legal","level":"advanced"},
    {"name":"Hồ sơ chào bán & quy định niêm yết","category":"legal","level":"advanced"}]'::jsonb,
  ARRAY['Phê duyệt hợp đồng mẫu','Chốt phương án xử lý tranh chấp','Quyết định đăng ký IP'],
  ARRAY['license_valid_count','compliance_score'],4,10),
 ('head_ir','ir','Trưởng bộ phận IR','director','cfo',
  'Giữ dòng vốn: pipeline nhà đầu tư, data room luôn sẵn sàng, nhịp update đều đặn.',
  '[{"name":"Quản trị pipeline nhà đầu tư","category":"finance","level":"advanced"},
    {"name":"Chuẩn bị data room & DD","category":"finance","level":"advanced"},
    {"name":"Soạn investor update & báo cáo quý","category":"communication","level":"advanced"}]'::jsonb,
  ARRAY['Cấp quyền truy cập data room','Chốt lịch roadshow'],
  ARRAY['investor_pipeline_count','dataroom_readiness'],6,11),
 ('fin_manager','finance','Trưởng phòng kế toán','manager','cfo',
  'Đóng sổ đúng hạn, số liệu chính xác, hồ sơ đủ để kiểm toán không có ngoại trừ.',
  '[{"name":"Đóng sổ tháng đúng hạn","category":"finance","level":"advanced"},
    {"name":"Kế toán thuế & quyết toán","category":"finance","level":"advanced"},
    {"name":"Đối chiếu công nợ & quản lý AR/AP","category":"finance","level":"advanced"}]'::jsonb,
  ARRAY['Duyệt bút toán','Đề xuất trích lập dự phòng'],
  ARRAY['dso_days','dpo_days','ccc_days'],3,12)
ON CONFLICT (template_code) DO UPDATE SET title_vi=EXCLUDED.title_vi, mission_vi=EXCLUDED.mission_vi,
  capabilities=EXCLUDED.capabilities, decision_rights=EXCLUDED.decision_rights, owns_metrics=EXCLUDED.owns_metrics;

-- ── 4 · org_positions — ghế THẬT của tenant (clone từ template) ─────
CREATE TABLE IF NOT EXISTS org_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  template_code text REFERENCES position_templates(template_code),
  unit_code text REFERENCES org_units(unit_code) NOT NULL,
  title_vi text NOT NULL,
  level text NOT NULL CHECK (level IN ('c_level','director','manager','lead','ic')),
  reports_to uuid REFERENCES org_positions(id) ON DELETE SET NULL,
  holder_id uuid REFERENCES auth.users(id),
  holder_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('filled','open','planned','frozen')),
  target_hire_date date,
  capabilities jsonb DEFAULT '[]'::jsonb,
  decision_rights text[] DEFAULT '{}',
  owns_metrics text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_pos_tenant ON org_positions (tenant_id, unit_code);
ALTER TABLE org_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON org_positions;
CREATE POLICY super_admin_bypass ON org_positions FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON org_positions;
CREATE POLICY tenant_isolation ON org_positions FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON org_positions TO authenticated;
GRANT ALL ON org_positions TO service_role;
DROP TRIGGER IF EXISTS trg_org_pos_updated ON org_positions;
CREATE TRIGGER trg_org_pos_updated BEFORE UPDATE ON org_positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5 · sop_processes — quy trình vận hành có bước + chủ sở hữu ─────
CREATE TABLE IF NOT EXISTS sop_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  unit_code text REFERENCES org_units(unit_code),
  code text,
  title_vi text NOT NULL,
  purpose_vi text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{no,action,owner,sla_hours}]
  owner_position_id uuid REFERENCES org_positions(id) ON DELETE SET NULL,
  frequency text CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly','on_demand')),
  sla_hours int,
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','deprecated')),
  version int DEFAULT 1,
  last_reviewed_at date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_tenant_unit ON sop_processes (tenant_id, unit_code);
ALTER TABLE sop_processes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON sop_processes;
CREATE POLICY super_admin_bypass ON sop_processes FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON sop_processes;
CREATE POLICY tenant_isolation ON sop_processes FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON sop_processes TO authenticated;
GRANT ALL ON sop_processes TO service_role;
DROP TRIGGER IF EXISTS trg_sop_updated ON sop_processes;
CREATE TRIGGER trg_sop_updated BEFORE UPDATE ON sop_processes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 6 · plan_vs_actual — HÀM đối chiếu MASTERPLAN ↔ THỰC TẾ ─────────
CREATE OR REPLACE FUNCTION plan_vs_actual(p_tenant uuid, p_year int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_year int := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  mp masterplan_years%ROWTYPE;
  v_rev_actual numeric; v_gm_actual numeric; v_ebitda_actual numeric;
  v_months int; v_headcount int; v_raised numeric;
  v_gaps jsonb := '[]'::jsonb;
  v_pace numeric;
BEGIN
  SELECT * INTO mp FROM masterplan_years WHERE tenant_id = p_tenant AND year = v_year;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error',
      format('Chưa có masterplan cho năm %s — lập kế hoạch năm trước đã', v_year));
  END IF;

  -- Thực tế luỹ kế từ P&L trong năm
  SELECT COALESCE(sum(revenue),0),
         CASE WHEN sum(revenue) > 0 THEN round((sum(revenue)-sum(cogs))/sum(revenue)*100,1) ELSE NULL END,
         COALESCE(sum(revenue - cogs - opex_sales - opex_rnd - opex_ga + other_income),0),
         count(*)
    INTO v_rev_actual, v_gm_actual, v_ebitda_actual, v_months
    FROM financial_statements
   WHERE tenant_id = p_tenant AND EXTRACT(YEAR FROM period) = v_year;

  SELECT count(*) INTO v_headcount FROM org_positions
   WHERE tenant_id = p_tenant AND status = 'filled';

  SELECT COALESCE(sum(actual_raise_usd),0) INTO v_raised FROM fundraise_rounds
   WHERE tenant_id = p_tenant AND EXTRACT(YEAR FROM COALESCE(actual_close_date, target_close_date)) = v_year;

  -- Nhịp doanh thu: đạt bao nhiêu % so với tiến độ tháng đã trôi qua
  IF mp.revenue_target IS NOT NULL AND mp.revenue_target > 0 AND v_months > 0 THEN
    v_pace := round(v_rev_actual / (mp.revenue_target * v_months / 12) * 100, 0);
    IF v_pace < 80 THEN
      v_gaps := v_gaps || jsonb_build_object('metric','revenue','severity',
        CASE WHEN v_pace < 60 THEN 'critical' ELSE 'warn' END,
        'message', format('Doanh thu mới đạt %s%% nhịp kế hoạch (%s/%s sau %s tháng)',
          v_pace, round(v_rev_actual), round(mp.revenue_target), v_months));
    END IF;
  END IF;

  IF mp.gross_margin_target_pct IS NOT NULL AND v_gm_actual IS NOT NULL
     AND v_gm_actual < mp.gross_margin_target_pct - 5 THEN
    v_gaps := v_gaps || jsonb_build_object('metric','gross_margin','severity','warn',
      'message', format('Biên gộp %s%% thấp hơn kế hoạch %s%%', v_gm_actual, mp.gross_margin_target_pct));
  END IF;

  IF mp.headcount_target IS NOT NULL AND v_headcount < mp.headcount_target * 0.7 THEN
    v_gaps := v_gaps || jsonb_build_object('metric','headcount','severity','info',
      'message', format('Nhân sự %s/%s ghế kế hoạch — thiếu người có thể chặn tăng trưởng',
        v_headcount, mp.headcount_target));
  END IF;

  IF mp.funding_target IS NOT NULL AND mp.funding_target > 0 AND v_raised < mp.funding_target * 0.5 THEN
    v_gaps := v_gaps || jsonb_build_object('metric','funding','severity','warn',
      'message', format('Gọi vốn %s/%s kế hoạch năm %s', round(v_raised), round(mp.funding_target), v_year));
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'year', v_year, 'phase', mp.phase,
    'plan', jsonb_build_object('revenue', mp.revenue_target, 'gross_margin_pct', mp.gross_margin_target_pct,
      'ebitda', mp.ebitda_target, 'headcount', mp.headcount_target, 'funding', mp.funding_target,
      'valuation', mp.valuation_target, 'milestone', mp.key_milestone),
    'actual', jsonb_build_object('revenue', v_rev_actual, 'gross_margin_pct', v_gm_actual,
      'ebitda', v_ebitda_actual, 'headcount', v_headcount, 'funding', v_raised, 'months_recorded', v_months),
    'revenue_pace_pct', v_pace,
    'gaps', v_gaps);
END;
$$;
GRANT EXECUTE ON FUNCTION plan_vs_actual(uuid, int) TO authenticated, service_role;

GRANT SELECT ON public.masterplan_years TO service_role;
GRANT SELECT ON public.org_positions TO service_role;
GRANT SELECT ON public.sop_processes TO service_role;
