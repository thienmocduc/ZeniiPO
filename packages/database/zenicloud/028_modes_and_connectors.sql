-- ═══════════════════════════════════════════════════════════════════
-- Migration 028 · 4 CHẾ ĐỘ VẬN HÀNH + ĐẤU NỐI DỮ LIỆU NGOÀI
-- ═══════════════════════════════════════════════════════════════════
-- Chairman 2026-06-22: nền tảng phải phục vụ 4 loại người dùng —
--   ① startup 0→IPO   ② doanh nghiệp ĐANG TỐT cần TÁI CẤU TRÚC chuẩn IPO
--   ③ GIẢ LẬP công ty lớn để tập điều hành mà đạt thành tích thật
--   ④ VẬN HÀNH THẬT với dữ liệu đấu nối từ Google / Larksuite / MISA /
--     zenidigital.io — Zeni-iPO điều hành theo cơ chế vốn IPO + minh bạch thị trường.
--
--   1. tenant_operating_profile — chế độ + hồ sơ doanh nghiệp + nguồn dữ liệu
--   2. data_connectors          — kết nối workspace ngoài (token băm, không lưu thô)
--   3. connector_mappings       — ánh xạ cột nguồn → bảng chuẩn Zeni
--   4. sync_runs                — nhật ký từng lần nạp (minh bạch, audit được)
--   5. restructure_diagnostics  — chấm 8 trụ doanh nghiệp hiện hữu vs chuẩn IPO
--   6. simulation_scenarios     — kịch bản giả lập điều hành
--   7. diagnose_restructure()   — HÀM chấm tự động từ dữ liệu thật
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · tenant_operating_profile ───────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_operating_profile (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'startup' CHECK (mode IN
    ('startup','restructure','simulation','live_ops')),
  data_source text NOT NULL DEFAULT 'manual' CHECK (data_source IN
    ('manual','connected','simulated','hybrid')),
  company_stage text CHECK (company_stage IN
    ('idea','pre_revenue','early_revenue','growth','mature','pre_ipo','listed')),
  industry text,
  established_year int,
  baseline_revenue numeric,          -- doanh thu hiện tại (mode tái cấu trúc)
  baseline_employees int,
  baseline_captured_at timestamptz,
  -- Giả lập: quy mô công ty muốn tập điều hành
  sim_target_revenue numeric,
  sim_target_employees int,
  transparency_level text DEFAULT 'internal' CHECK (transparency_level IN
    ('internal','investor','public')),   -- cơ chế thị trường minh bạch
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tenant_operating_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON tenant_operating_profile;
CREATE POLICY super_admin_bypass ON tenant_operating_profile FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON tenant_operating_profile;
CREATE POLICY tenant_isolation ON tenant_operating_profile FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_operating_profile TO authenticated;
GRANT ALL ON tenant_operating_profile TO service_role;
DROP TRIGGER IF EXISTS trg_top_updated ON tenant_operating_profile;
CREATE TRIGGER trg_top_updated BEFORE UPDATE ON tenant_operating_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2 · data_connectors — workspace ngoài ──────────────────────────
-- BẢO MẬT: chỉ lưu HASH của ingest token (sha256 hex). Token thô hiện 1 lần
-- lúc tạo rồi không bao giờ đọc lại được — kể cả chairman_super.
CREATE TABLE IF NOT EXISTS data_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN
    ('google_sheets','google_workspace','larksuite','misa','zenidigital','zeni_cloud','csv_upload','webhook','api')),
  name text NOT NULL,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound','bidirectional')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','error','pending_setup')),
  token_hash text,                       -- sha256 của ingest token (KHÔNG lưu token thô)
  token_hint text,                       -- 6 ký tự cuối để nhận diện
  config jsonb NOT NULL DEFAULT '{}'::jsonb,   -- workspace id, sheet id… (KHÔNG chứa secret)
  last_sync_at timestamptz,
  last_sync_status text,
  total_rows_ingested bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_connectors_tenant ON data_connectors (tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_connectors_token ON data_connectors (token_hash) WHERE token_hash IS NOT NULL;
ALTER TABLE data_connectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON data_connectors;
CREATE POLICY super_admin_bypass ON data_connectors FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON data_connectors;
CREATE POLICY tenant_isolation ON data_connectors FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON data_connectors TO authenticated;
GRANT ALL ON data_connectors TO service_role;
DROP TRIGGER IF EXISTS trg_connectors_updated ON data_connectors;
CREATE TRIGGER trg_connectors_updated BEFORE UPDATE ON data_connectors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3 · connector_mappings — ánh xạ cột nguồn → bảng chuẩn Zeni ─────
CREATE TABLE IF NOT EXISTS connector_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  connector_id uuid REFERENCES data_connectors(id) ON DELETE CASCADE NOT NULL,
  source_object text NOT NULL,           -- tên sheet / bảng / endpoint nguồn
  target_table text NOT NULL CHECK (target_table IN
    ('financial_statements','unit_economics_inputs','kpi_metrics','tasks',
     'investor_pipeline','compliance_items','market_data','comparables')),
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {"cot_nguon":"cot_dich"}
  dedupe_keys text[] DEFAULT '{}',                -- cột khoá để upsert
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mappings_connector ON connector_mappings (connector_id);
ALTER TABLE connector_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON connector_mappings;
CREATE POLICY super_admin_bypass ON connector_mappings FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON connector_mappings;
CREATE POLICY tenant_isolation ON connector_mappings FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON connector_mappings TO authenticated;
GRANT ALL ON connector_mappings TO service_role;

-- ── 4 · sync_runs — nhật ký nạp dữ liệu (minh bạch + audit) ─────────
CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  connector_id uuid REFERENCES data_connectors(id) ON DELETE CASCADE,
  target_table text,
  rows_received int DEFAULT 0,
  rows_written int DEFAULT 0,
  rows_rejected int DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
  errors jsonb DEFAULT '[]'::jsonb,
  source_ip text,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_syncruns_tenant ON sync_runs (tenant_id, started_at DESC);
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON sync_runs;
CREATE POLICY super_admin_bypass ON sync_runs FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON sync_runs;
CREATE POLICY tenant_isolation ON sync_runs FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON sync_runs TO authenticated;
GRANT ALL ON sync_runs TO service_role;

-- ── 5 · restructure_diagnostics — chấm 8 trụ vs chuẩn IPO ──────────
CREATE TABLE IF NOT EXISTS restructure_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  pillars jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{key,name,score,max,findings[],actions[]}]
  overall_score numeric,
  readiness_gap jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_restructure_tenant ON restructure_diagnostics (tenant_id, created_at DESC);
ALTER TABLE restructure_diagnostics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON restructure_diagnostics;
CREATE POLICY super_admin_bypass ON restructure_diagnostics FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON restructure_diagnostics;
CREATE POLICY tenant_isolation ON restructure_diagnostics FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON restructure_diagnostics TO authenticated;
GRANT ALL ON restructure_diagnostics TO service_role;

-- ── 6 · simulation_scenarios — giả lập điều hành ───────────────────
CREATE TABLE IF NOT EXISTS simulation_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  base_revenue numeric NOT NULL DEFAULT 0,
  base_customers int DEFAULT 0,
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,  -- growth/churn/gm/hiring/funding
  months int NOT NULL DEFAULT 24 CHECK (months BETWEEN 1 AND 120),
  result jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'draft' CHECK (status IN ('draft','running','done','archived')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sim_tenant ON simulation_scenarios (tenant_id, created_at DESC);
ALTER TABLE simulation_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON simulation_scenarios;
CREATE POLICY super_admin_bypass ON simulation_scenarios FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON simulation_scenarios;
CREATE POLICY tenant_isolation ON simulation_scenarios FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON simulation_scenarios TO authenticated;
GRANT ALL ON simulation_scenarios TO service_role;

-- ── 7 · diagnose_restructure — CHẤM 8 TRỤ TỪ DỮ LIỆU THẬT ──────────
-- Doanh nghiệp đang tốt nộp dữ liệu vào → hàm này chỉ ra CHÍNH XÁC thiếu gì
-- so chuẩn công ty niêm yết, theo 8 trụ. Không hỏi bảng câu hỏi — chấm bằng
-- dữ liệu đã có trong hệ thống.
CREATE OR REPLACE FUNCTION diagnose_restructure(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_fin_months int; v_has_gm boolean; v_ue_months int;
  v_board int; v_res int; v_comp int; v_comp_expired int;
  v_sops int; v_positions int; v_filled int;
  v_dataroom int; v_investors int; v_kpis int; v_okrs int;
  v_canvas int; v_readiness numeric; v_connectors int;
  v_pillars jsonb := '[]'::jsonb; v_total numeric := 0;
  v_p jsonb;
BEGIN
  SELECT count(*) INTO v_fin_months FROM financial_statements WHERE tenant_id = p_tenant;
  SELECT EXISTS(SELECT 1 FROM financial_statements WHERE tenant_id = p_tenant AND revenue > 0 AND cogs > 0)
    INTO v_has_gm;
  SELECT count(*) INTO v_ue_months FROM unit_economics_inputs WHERE tenant_id = p_tenant;
  SELECT count(*) INTO v_board FROM user_profiles WHERE tenant_id = p_tenant AND role IN ('chr','ceo','board','investor');
  SELECT count(*) INTO v_res FROM board_resolutions WHERE tenant_id = p_tenant;
  SELECT count(*) INTO v_comp FROM compliance_items WHERE tenant_id = p_tenant;
  SELECT count(*) INTO v_comp_expired FROM compliance_items
    WHERE tenant_id = p_tenant AND expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE;
  SELECT count(*) INTO v_sops FROM sop_processes WHERE tenant_id = p_tenant;
  SELECT count(*), count(*) FILTER (WHERE status = 'filled') INTO v_positions, v_filled
    FROM org_positions WHERE tenant_id = p_tenant;
  SELECT count(*) INTO v_dataroom FROM data_room_docs WHERE tenant_id = p_tenant;
  SELECT count(*) INTO v_investors FROM investor_pipeline WHERE tenant_id = p_tenant;
  SELECT count(*) INTO v_kpis FROM kpi_metrics WHERE tenant_id = p_tenant;
  SELECT count(*) INTO v_okrs FROM okr_objectives WHERE tenant_id = p_tenant;
  SELECT count(*) INTO v_canvas FROM canvas_blocks
    WHERE tenant_id = p_tenant AND jsonb_array_length(items) > 0;
  SELECT count(*) INTO v_connectors FROM data_connectors WHERE tenant_id = p_tenant AND status = 'active';
  SELECT total_score INTO v_readiness FROM readiness_score_history
    WHERE tenant_id = p_tenant ORDER BY created_at DESC LIMIT 1;

  -- Trụ 1 · Tài chính chuẩn audit
  v_p := jsonb_build_object('key','finance','name','Tài chính chuẩn audit',
    'score', LEAST(20, v_fin_months * 1.5 + CASE WHEN v_has_gm THEN 5 ELSE 0 END)::numeric, 'max', 20,
    'findings', CASE WHEN v_fin_months = 0 THEN '["Chưa có báo cáo tài chính theo tháng trong hệ thống"]'::jsonb
                     WHEN v_fin_months < 12 THEN format('["Mới có %s tháng số liệu — cần tối thiểu 12-36 tháng cho DD"]', v_fin_months)::jsonb
                     ELSE '["Đủ chuỗi số liệu tài chính"]'::jsonb END,
    'actions', CASE WHEN v_fin_months < 12
                    THEN '["Nạp P&L 24-36 tháng gần nhất (nhập tay hoặc đấu nối MISA/Google Sheets)","Chuẩn hoá cách ghi nhận doanh thu & giá vốn"]'::jsonb
                    ELSE '["Duy trì đóng sổ đúng hạn hằng tháng"]'::jsonb END);
  v_pillars := v_pillars || v_p; v_total := v_total + (v_p->>'score')::numeric;

  -- Trụ 2 · Kinh tế đơn vị & tăng trưởng
  v_p := jsonb_build_object('key','unit_economics','name','Kinh tế đơn vị & tăng trưởng',
    'score', LEAST(15, v_ue_months * 2)::numeric, 'max', 15,
    'findings', CASE WHEN v_ue_months = 0 THEN '["Chưa đo CAC/LTV/NRR — nhà đầu tư sẽ hỏi đầu tiên"]'::jsonb
                     ELSE format('["Có %s tháng dữ liệu khách hàng"]', v_ue_months)::jsonb END,
    'actions', CASE WHEN v_ue_months < 6
                    THEN '["Nạp số khách + MRR movement 6-12 tháng","Chạy chấm chuẩn LTV:CAC · NRR · Rule of 40"]'::jsonb
                    ELSE '["Theo dõi NRR hằng tháng, mục tiêu ≥110%"]'::jsonb END);
  v_pillars := v_pillars || v_p; v_total := v_total + (v_p->>'score')::numeric;

  -- Trụ 3 · Quản trị công ty
  v_p := jsonb_build_object('key','governance','name','Quản trị công ty',
    'score', LEAST(15, v_board * 2 + LEAST(9, v_res * 3))::numeric, 'max', 15,
    'findings', CASE WHEN v_res = 0 THEN '["Chưa có nghị quyết HĐQT nào được lưu — rủi ro đỏ khi DD"]'::jsonb
                     ELSE format('["%s thành viên HĐQT/điều hành · %s nghị quyết"]', v_board, v_res)::jsonb END,
    'actions', CASE WHEN v_res < 3
                    THEN '["Lập HĐQT + quy chế hoạt động","Số hoá nghị quyết các quyết định lớn 2-3 năm gần nhất","Thành lập uỷ ban kiểm toán"]'::jsonb
                    ELSE '["Duy trì nhịp họp + biên bản ký đủ"]'::jsonb END);
  v_pillars := v_pillars || v_p; v_total := v_total + (v_p->>'score')::numeric;

  -- Trụ 4 · Pháp lý & tuân thủ
  v_p := jsonb_build_object('key','legal','name','Pháp lý & tuân thủ',
    'score', GREATEST(0, LEAST(15, v_comp * 2 - v_comp_expired * 3))::numeric, 'max', 15,
    'findings', CASE WHEN v_comp = 0 THEN '["Chưa có sổ đăng ký giấy phép/hợp đồng/IP"]'::jsonb
                     WHEN v_comp_expired > 0 THEN format('["%s hồ sơ ĐÃ HẾT HẠN — phải xử lý trước khi DD"]', v_comp_expired)::jsonb
                     ELSE format('["%s hồ sơ pháp lý còn hiệu lực"]', v_comp)::jsonb END,
    'actions', CASE WHEN v_comp_expired > 0 THEN '["Gia hạn ngay hồ sơ hết hạn","Lập lịch nhắc gia hạn 60 ngày"]'::jsonb
                    WHEN v_comp = 0 THEN '["Kiểm kê toàn bộ giấy phép/hợp đồng/IP đưa vào sổ","Đăng ký bảo hộ nhãn hiệu"]'::jsonb
                    ELSE '["Rà soát định kỳ hằng quý"]'::jsonb END);
  v_pillars := v_pillars || v_p; v_total := v_total + (v_p->>'score')::numeric;

  -- Trụ 5 · Tổ chức & nhân sự
  v_p := jsonb_build_object('key','org','name','Tổ chức & nhân sự',
    'score', LEAST(10, v_positions + v_filled)::numeric, 'max', 10,
    'findings', CASE WHEN v_positions = 0 THEN '["Chưa có sơ đồ tổ chức chính thức"]'::jsonb
                     ELSE format('["%s ghế, %s ghế có người"]', v_positions, v_filled)::jsonb END,
    'actions', CASE WHEN v_positions < 5
                    THEN '["Lập sơ đồ tổ chức + khung năng lực từng vị trí","Xác định ghế C-level còn thiếu theo giai đoạn"]'::jsonb
                    ELSE '["Xây lộ trình kế nhiệm cho vị trí then chốt"]'::jsonb END);
  v_pillars := v_pillars || v_p; v_total := v_total + (v_p->>'score')::numeric;

  -- Trụ 6 · Vận hành & quy trình
  v_p := jsonb_build_object('key','operations','name','Vận hành & quy trình',
    'score', LEAST(10, v_sops * 1.5 + LEAST(4, v_okrs))::numeric, 'max', 10,
    'findings', CASE WHEN v_sops = 0 THEN '["Chưa SOP hoá — công ty phụ thuộc con người, khó scale"]'::jsonb
                     ELSE format('["%s quy trình đã chuẩn hoá"]', v_sops)::jsonb END,
    'actions', CASE WHEN v_sops < 5
                    THEN '["Chuẩn hoá SOP cho quy trình lặp >3 lần/tháng","Thiết lập OKR theo tầng"]'::jsonb
                    ELSE '["Rà soát & cập nhật SOP định kỳ"]'::jsonb END);
  v_pillars := v_pillars || v_p; v_total := v_total + (v_p->>'score')::numeric;

  -- Trụ 7 · Dữ liệu & minh bạch
  v_p := jsonb_build_object('key','data','name','Dữ liệu & minh bạch',
    'score', LEAST(10, LEAST(5, v_kpis * 0.2) + LEAST(3, v_connectors * 3) + LEAST(2, v_canvas * 0.3))::numeric, 'max', 10,
    'findings', CASE WHEN v_connectors = 0 AND v_kpis = 0 THEN '["Dữ liệu chưa tập trung — mỗi phòng một bảng tính riêng"]'::jsonb
                     WHEN v_connectors > 0 THEN format('["%s kết nối dữ liệu đang hoạt động · %s KPI"]', v_connectors, v_kpis)::jsonb
                     ELSE format('["%s KPI đang theo dõi, chưa đấu nối hệ thống ngoài"]', v_kpis)::jsonb END,
    'actions', CASE WHEN v_connectors = 0
                    THEN '["Đấu nối Google Sheets/MISA/Larksuite để số liệu tự chảy về","Chốt bộ KPI chuẩn cho từng phòng ban"]'::jsonb
                    ELSE '["Mở rộng nguồn dữ liệu + đặt lịch đồng bộ"]'::jsonb END);
  v_pillars := v_pillars || v_p; v_total := v_total + (v_p->>'score')::numeric;

  -- Trụ 8 · Sẵn sàng gọi vốn / niêm yết
  v_p := jsonb_build_object('key','capital','name','Sẵn sàng gọi vốn & niêm yết',
    'score', LEAST(5, LEAST(2, v_dataroom * 0.5) + LEAST(2, v_investors * 0.5) + COALESCE(v_readiness,0)/100)::numeric, 'max', 5,
    'findings', CASE WHEN v_dataroom = 0 THEN '["Data room trống — không thể mở DD"]'::jsonb
                     ELSE format('["%s tài liệu data room · %s nhà đầu tư trong pipeline"]', v_dataroom, v_investors)::jsonb END,
    'actions', CASE WHEN v_dataroom < 10
                    THEN '["Dựng cấu trúc data room chuẩn DD","Chuẩn bị bộ tài liệu tài chính - pháp lý - thương mại"]'::jsonb
                    ELSE '["Cập nhật data room trước mỗi vòng"]'::jsonb END);
  v_pillars := v_pillars || v_p; v_total := v_total + (v_p->>'score')::numeric;

  RETURN jsonb_build_object(
    'ok', true,
    'overall_score', round(v_total, 1),
    'max_score', 100,
    'grade', CASE WHEN v_total >= 85 THEN 'Sẵn sàng niêm yết'
                  WHEN v_total >= 65 THEN 'Gần chuẩn — cần vá vài trụ'
                  WHEN v_total >= 40 THEN 'Đang vận hành tốt nhưng chưa chuẩn IPO'
                  ELSE 'Cần tái cấu trúc nền tảng' END,
    'pillars', v_pillars);
END;
$$;
GRANT EXECUTE ON FUNCTION diagnose_restructure(uuid) TO authenticated, service_role;

GRANT SELECT ON public.tenant_operating_profile TO service_role;
GRANT SELECT ON public.data_connectors TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.sync_runs TO service_role;
