-- ═══════════════════════════════════════════════════════════════════
-- Migration 029 · TẦNG PLAN — theo masterspec BUSINESS BRAIN V1
--   ZIPO-102 (COA VAS) · ZIPO-103 (model lines) · ZIPO-104 (versioning)
--   ZIPO-201 (plan_targets) · ZIPO-101 (BMC version hoá)
-- ═══════════════════════════════════════════════════════════════════
-- Kiến trúc 3 tầng: ZeniIPO = PLAN · ZeniOS = DECISION · ZeniERP = ACTUAL.
-- IPO chỉ sở hữu dữ liệu KẾ HOẠCH; cap-table/data-room/sổ thuộc nhà khác.
--
-- Tuân thủ 8 ràng buộc:
--   #2 mọi dòng tiền map COA VAS + kỳ THÁNG + company_id
--   #3 plan version hoá — IMMUTABLE sau publish (trigger DB chặn)
--   #4 tiền = BIGINT VND, cấm float; tỷ lệ tính runtime, không lưu
--   #7 fail-closed: CHECK chặn số âm ở nơi vô nghĩa
-- ═══════════════════════════════════════════════════════════════════

-- ── ZIPO-102 · plan_coa_lines — NGÔN NGỮ CHUNG (global, public read) ─
CREATE TABLE IF NOT EXISTS plan_coa_lines (
  code text PRIMARY KEY,
  label_vi text NOT NULL,
  statement text NOT NULL CHECK (statement IN ('pnl','cf','bs')),
  -- sign: +1 = tăng lợi nhuận (doanh thu/thu nhập) · -1 = giảm (chi phí)
  sign smallint NOT NULL CHECK (sign IN (1,-1)),
  category text,
  display_order int
);
ALTER TABLE plan_coa_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coa_public_read ON plan_coa_lines;
CREATE POLICY coa_public_read ON plan_coa_lines FOR SELECT USING (true);
GRANT SELECT ON plan_coa_lines TO authenticated;
GRANT ALL ON plan_coa_lines TO service_role;

INSERT INTO plan_coa_lines (code, label_vi, statement, sign, category, display_order) VALUES
 ('5111','Doanh thu bán hàng','pnl', 1,'revenue',10),
 ('5113','Doanh thu cung cấp dịch vụ','pnl', 1,'revenue',20),
 ('521', 'Các khoản giảm trừ doanh thu','pnl',-1,'revenue_deduction',30),
 ('632', 'Giá vốn hàng bán','pnl',-1,'cogs',40),
 ('6411','Chi phí bán hàng — nhân sự','pnl',-1,'opex_sales',50),
 ('6417','Chi phí bán hàng — marketing','pnl',-1,'opex_sales',60),
 ('6421','Chi phí quản lý — nhân sự','pnl',-1,'opex_ga',70),
 ('6427','Chi phí quản lý — thuê văn phòng','pnl',-1,'opex_ga',80),
 ('635', 'Chi phí tài chính','pnl',-1,'financial',90),
 ('515', 'Doanh thu hoạt động tài chính','pnl', 1,'financial',100),
 ('711', 'Thu nhập khác','pnl', 1,'other',110),
 ('811', 'Chi phí khác','pnl',-1,'other',120),
 ('821', 'Chi phí thuế TNDN','pnl',-1,'tax',130)
ON CONFLICT (code) DO UPDATE SET label_vi=EXCLUDED.label_vi, statement=EXCLUDED.statement,
  sign=EXCLUDED.sign, category=EXCLUDED.category, display_order=EXCLUDED.display_order;

-- Thuế suất TNDN theo hiệu lực — KHÔNG hardcode trong engine (spec ZIPO-103)
CREATE TABLE IF NOT EXISTS tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_code text NOT NULL DEFAULT 'cit_vn',
  rate_pct numeric NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
  effective_from date NOT NULL,
  note text,
  UNIQUE(tax_code, effective_from)
);
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_public_read ON tax_rates;
CREATE POLICY tax_public_read ON tax_rates FOR SELECT USING (true);
GRANT SELECT ON tax_rates TO authenticated;
GRANT ALL ON tax_rates TO service_role;
INSERT INTO tax_rates (tax_code, rate_pct, effective_from, note)
VALUES ('cit_vn', 20, '2016-01-01', 'Thuế TNDN phổ thông VN 20% (Luật 32/2013/QH13)')
ON CONFLICT (tax_code, effective_from) DO NOTHING;

-- ── ZIPO-101 · business_models — BMC 9 khối, VERSION HOÁ + IMMUTABLE ─
CREATE TABLE IF NOT EXISTS business_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  blocks jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {block_key: [{text, tag}]}
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, version)
);
CREATE INDEX IF NOT EXISTS idx_bm_tenant ON business_models (tenant_id, version DESC);
ALTER TABLE business_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON business_models;
CREATE POLICY super_admin_bypass ON business_models FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON business_models;
CREATE POLICY tenant_isolation ON business_models FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON business_models TO authenticated;
GRANT ALL ON business_models TO service_role;

-- Ràng buộc #3: bản published là BẤT BIẾN — DB chặn, không tin tầng app.
CREATE OR REPLACE FUNCTION block_update_published_bm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'Bản BMC v% đã publish — bất biến. Sửa = tạo version mới.', OLD.version
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bm_immutable ON business_models;
CREATE TRIGGER trg_bm_immutable BEFORE UPDATE ON business_models
  FOR EACH ROW EXECUTE FUNCTION block_update_published_bm();
DROP TRIGGER IF EXISTS trg_bm_updated ON business_models;
CREATE TRIGGER trg_bm_updated BEFORE UPDATE ON business_models
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION block_delete_published_bm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'Không xoá được bản BMC đã publish (v%).', OLD.version
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_bm_no_delete ON business_models;
CREATE TRIGGER trg_bm_no_delete BEFORE DELETE ON business_models
  FOR EACH ROW EXECUTE FUNCTION block_delete_published_bm();

-- ── ZIPO-104 · plan_versions — bản kế hoạch tài chính ───────────────
CREATE TABLE IF NOT EXISTS plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  version_no int NOT NULL CHECK (version_no >= 1),
  name text,
  business_model_id uuid REFERENCES business_models(id),
  horizon_months int NOT NULL DEFAULT 36 CHECK (horizon_months BETWEEN 12 AND 60),
  start_period date NOT NULL,                        -- ngày 01 của tháng đầu
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_pv_tenant ON plan_versions (tenant_id, version_no DESC);
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON plan_versions;
CREATE POLICY super_admin_bypass ON plan_versions FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON plan_versions;
CREATE POLICY tenant_isolation ON plan_versions FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_versions TO authenticated;
GRANT ALL ON plan_versions TO service_role;

CREATE OR REPLACE FUNCTION block_update_published_plan()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Cho phép chuyển published → archived (vòng đời), chặn mọi sửa nội dung.
  IF OLD.status = 'published' AND NOT (NEW.status = 'archived'
      AND NEW.version_no = OLD.version_no AND NEW.horizon_months = OLD.horizon_months
      AND NEW.start_period = OLD.start_period) THEN
    RAISE EXCEPTION 'Plan v% đã publish — bất biến. Sửa = tạo version mới.', OLD.version_no
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_pv_immutable ON plan_versions;
CREATE TRIGGER trg_pv_immutable BEFORE UPDATE ON plan_versions
  FOR EACH ROW EXECUTE FUNCTION block_update_published_plan();
DROP TRIGGER IF EXISTS trg_pv_updated ON plan_versions;
CREATE TRIGGER trg_pv_updated BEFORE UPDATE ON plan_versions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── plan_assumptions — 3 kịch bản base/bull/bear trong 1 bộ ─────────
CREATE TABLE IF NOT EXISTS plan_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan_version_id uuid REFERENCES plan_versions(id) ON DELETE CASCADE NOT NULL,
  key text NOT NULL,
  label_vi text,
  unit text,                                   -- vnd | pct | count | days
  value_base numeric NOT NULL,
  value_bull numeric,
  value_bear numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plan_version_id, key)
);
CREATE INDEX IF NOT EXISTS idx_pa_version ON plan_assumptions (plan_version_id);
ALTER TABLE plan_assumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON plan_assumptions;
CREATE POLICY super_admin_bypass ON plan_assumptions FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON plan_assumptions;
CREATE POLICY tenant_isolation ON plan_assumptions FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_assumptions TO authenticated;
GRANT ALL ON plan_assumptions TO service_role;

-- ── ZIPO-103 · plan_lines — dòng kế hoạch, BẮT BUỘC map COA ─────────
CREATE TABLE IF NOT EXISTS plan_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan_version_id uuid REFERENCES plan_versions(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES tenants(id),        -- công ty con trong tập đoàn
  -- Ràng buộc #2: KHÔNG có dòng tiền tự do — phải là mã COA hợp lệ
  coa_line text REFERENCES plan_coa_lines(code) NOT NULL,
  label_vi text NOT NULL,
  driver_type text NOT NULL DEFAULT 'manual' CHECK (driver_type IN
    ('manual','price_volume','saas_mrr','pct_of_revenue','headcount','fixed_schedule','cac_driven')),
  driver_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pl_version ON plan_lines (plan_version_id, coa_line);
ALTER TABLE plan_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON plan_lines;
CREATE POLICY super_admin_bypass ON plan_lines FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON plan_lines;
CREATE POLICY tenant_isolation ON plan_lines FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_lines TO authenticated;
GRANT ALL ON plan_lines TO service_role;

-- ── ZIPO-201 · plan_targets — CONTRACT gửi ZeniOS (BIGINT VND) ──────
CREATE TABLE IF NOT EXISTS plan_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  plan_version_id uuid REFERENCES plan_versions(id) ON DELETE CASCADE NOT NULL,
  company_id uuid,
  period date NOT NULL,                          -- luôn ngày 01
  coa_line text REFERENCES plan_coa_lines(code),
  -- Ràng buộc #4: TIỀN = BIGINT VND, cấm float
  amount bigint NOT NULL,
  metric_key text,                               -- chỉ tiêu phi tiền (nếu có)
  scenario text NOT NULL DEFAULT 'base' CHECK (scenario IN ('base','bull','bear')),
  created_at timestamptz DEFAULT now(),
  CHECK (coa_line IS NOT NULL OR metric_key IS NOT NULL),
  CHECK (date_part('day', period) = 1)
);
CREATE INDEX IF NOT EXISTS idx_pt_lookup
  ON plan_targets (tenant_id, plan_version_id, period, coa_line);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pt_row
  ON plan_targets (plan_version_id, company_id, period, coa_line, scenario)
  WHERE coa_line IS NOT NULL;
ALTER TABLE plan_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON plan_targets;
CREATE POLICY super_admin_bypass ON plan_targets FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON plan_targets;
CREATE POLICY tenant_isolation ON plan_targets FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT ON plan_targets TO authenticated;
GRANT ALL ON plan_targets TO service_role;

-- plan_targets sinh lúc publish → bất biến (không UPDATE/DELETE từ app)
CREATE OR REPLACE FUNCTION block_mutate_plan_targets()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'plan_targets bất biến — sinh tự động khi publish plan version.'
    USING ERRCODE = 'restrict_violation';
END;
$$;
DROP TRIGGER IF EXISTS trg_pt_immutable ON plan_targets;
CREATE TRIGGER trg_pt_immutable BEFORE UPDATE OR DELETE ON plan_targets
  FOR EACH ROW EXECUTE FUNCTION block_mutate_plan_targets();

-- ── publish_plan_version — 1 GIAO DỊCH: khoá version + sinh targets ──
-- Nhận mảng targets đã tính sẵn từ engine (pure TS, test được) rồi ghi
-- nguyên tử. Nếu bất kỳ bước nào lỗi → rollback toàn bộ.
CREATE OR REPLACE FUNCTION publish_plan_version(
  p_tenant uuid,
  p_version_id uuid,
  p_targets jsonb,          -- [{company_id,period,coa_line,amount,scenario,metric_key}]
  p_user uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
  v_no int;
  v_count int := 0;
BEGIN
  SELECT status, version_no INTO v_status, v_no
    FROM plan_versions WHERE id = p_version_id AND tenant_id = p_tenant;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Không tìm thấy plan version');
  END IF;
  IF v_status = 'published' THEN
    RETURN jsonb_build_object('ok', false, 'error', format('Plan v%s đã publish rồi', v_no));
  END IF;
  IF p_targets IS NULL OR jsonb_array_length(p_targets) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Không có target nào để publish — chạy engine trước');
  END IF;

  INSERT INTO plan_targets (tenant_id, plan_version_id, company_id, period, coa_line, amount, metric_key, scenario)
  SELECT p_tenant, p_version_id,
         NULLIF(t->>'company_id','')::uuid,
         (t->>'period')::date,
         NULLIF(t->>'coa_line',''),
         (t->>'amount')::bigint,
         NULLIF(t->>'metric_key',''),
         COALESCE(NULLIF(t->>'scenario',''), 'base')
    FROM jsonb_array_elements(p_targets) AS t;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE plan_versions
     SET status = 'published', published_at = now(), published_by = p_user
   WHERE id = p_version_id;

  RETURN jsonb_build_object('ok', true, 'version_no', v_no, 'targets_written', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION publish_plan_version(uuid, uuid, jsonb, uuid) TO authenticated, service_role;

GRANT SELECT ON public.plan_coa_lines TO service_role;
GRANT SELECT ON public.plan_targets TO service_role;
GRANT SELECT ON public.plan_versions TO service_role;
GRANT SELECT ON public.business_models TO service_role;
