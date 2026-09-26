-- ============================================================================
-- 046 — PHÂN RÃ MỤC TIÊU: từ chủ tịch xuống HĐQT và C-level
--
-- VẤN ĐỀ. Xương sống đã có đủ (`okr_objectives.tier` · `parent_id` ·
-- `okr_krs.objective_id` · `tasks.kr_id`) nhưng chưa bao giờ chảy. Đo ngày
-- 26/09/2026 trên production: 5 mục tiêu — cả 5 đều tầng `chr`, 0 mục tiêu có
-- cha, 0 Key Result, 0 việc được giao. `cascade_chairman_event` dựng 4 mục
-- tiêu chủ tịch rồi DỪNG: không sinh KR, không sinh việc, không xuống vai nào.
--
-- ── KHUNG PHÂN RÃ LẤY TỪ ĐÂU ──────────────────────────────────────────────
-- KHÔNG tự đặt ra. Toàn bộ khung đã nằm sẵn trong `position_templates` (027):
--   · `reports_to_code`  → cây báo cáo: chairman → ceo → 8 C-level → quản lý
--   · `owns_metrics`     → vai nào sở hữu chỉ số nào (45 cặp đã khai)
--   · `min_phase`        → giai đoạn nào mới có vai đó
--   · `mission_vi`       → câu sứ mệnh, dùng làm tiêu đề mục tiêu
-- Hàm này chỉ ĐỌC và NỐI những thứ đó lại, không thêm tri thức mới.
--
-- ── CHỈ TIÊU (target) LẤY TỪ ĐÂU ──────────────────────────────────────────
-- Chỉ từ `ipo_benchmarks` (026) và `ipo_benchmarks_by_industry` (033) — hai
-- bảng có cột `source_note` bắt buộc dẫn nguồn. Đo được 13/45 chỉ số có ngưỡng
-- chuẩn; **32 chỉ số còn lại để TRỐNG** cho người phụ trách tự đặt. Thà để
-- trống còn hơn điền một con số không có xuất xứ: đó đúng là loại số mà bên
-- thẩm định hỏi đầu tiên và doanh nghiệp không trả lời được.
-- Cột `nguon_chi_tieu` giữ ranh giới đó, không cho lẫn.
--
-- ── CHẠY LẠI ĐƯỢC ─────────────────────────────────────────────────────────
-- Hai chỉ mục duy nhất `(journey_id, position_code)` và `(objective_id,
-- metric_code)` khiến gọi hàm nhiều lần không sinh bản sao. Gọi lại sau khi
-- doanh nghiệp lên giai đoạn mới sẽ BỔ SUNG các vai vừa đủ điều kiện, giữ
-- nguyên phần đã có và phần người dùng đã sửa.
-- ============================================================================

-- ── 1 · MỞ RỘNG DANH SÁCH VAI ─────────────────────────────────────────────
-- `position_templates` có 3 vai C-level mà `tier` chưa nhận: cro (kinh doanh),
-- cpo (sản phẩm), chro (nhân sự). Thiếu chúng thì 3 trong 8 C-level bị dồn vào
-- `emp` và không phân biệt được ai chịu trách nhiệm gì. Đây là NỚI danh sách,
-- không siết — mọi giá trị cũ vẫn hợp lệ.
ALTER TABLE okr_objectives DROP CONSTRAINT IF EXISTS okr_objectives_tier_check;
ALTER TABLE okr_objectives ADD CONSTRAINT okr_objectives_tier_check
  CHECK (tier IN ('chr','ceo','cfo','coo','cto','cmo','clo','cro','cpo','chro','emp'));

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('chr','ceo','cfo','coo','cto','cmo','clo','cro','cpo','chro','emp'));

-- ── 2 · CỘT MỚI (chỉ thêm, không đổi cột cũ) ──────────────────────────────
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS position_code text;
COMMENT ON COLUMN okr_objectives.position_code IS
  'Mã chức danh trong position_templates. Chính xác hơn tier: phân biệt được trưởng phòng kế toán với trưởng bộ phận IR, hai vai cùng rơi vào tier emp.';

ALTER TABLE okr_krs ADD COLUMN IF NOT EXISTS metric_code text;
COMMENT ON COLUMN okr_krs.metric_code IS
  'Mã chỉ số, dùng chung không gian tên với kpi_metrics.metric_code và ipo_benchmarks.metric_code — nhờ vậy số thực tế tự nối vào được.';

ALTER TABLE okr_krs ADD COLUMN IF NOT EXISTS nguon_chi_tieu text;
ALTER TABLE okr_krs DROP CONSTRAINT IF EXISTS okr_krs_nguon_chi_tieu_check;
ALTER TABLE okr_krs ADD CONSTRAINT okr_krs_nguon_chi_tieu_check
  CHECK (nguon_chi_tieu IS NULL OR nguon_chi_tieu IN ('chuan_nganh','nguoi_dat','ai_de_xuat'));
COMMENT ON COLUMN okr_krs.nguon_chi_tieu IS
  'Con số này ở đâu ra: chuan_nganh (ipo_benchmarks, có dẫn nguồn) | nguoi_dat | ai_de_xuat. Lẫn ba thứ vào nhau thì không ai biết chỉ tiêu nào đã được người chịu trách nhiệm cam kết.';

ALTER TABLE okr_krs ADD COLUMN IF NOT EXISTS nguon_ghi_chu text;
COMMENT ON COLUMN okr_krs.nguon_ghi_chu IS 'Xuất xứ nguyên văn của ngưỡng chuẩn, chép từ ipo_benchmarks.source_note.';

-- Hai bảng dưới đây trước nay chỉ có FK tenant_id, không nối vào mục tiêu nào.
ALTER TABLE masterplan_years ADD COLUMN IF NOT EXISTS objective_id uuid;
ALTER TABLE board_resolutions ADD COLUMN IF NOT EXISTS objective_id uuid;

DO $do$ BEGIN
  ALTER TABLE okr_objectives ADD CONSTRAINT okr_objectives_position_fk
    FOREIGN KEY (position_code) REFERENCES position_templates(template_code) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  ALTER TABLE masterplan_years ADD CONSTRAINT masterplan_years_objective_fk
    FOREIGN KEY (objective_id) REFERENCES okr_objectives(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  ALTER TABLE board_resolutions ADD CONSTRAINT board_resolutions_objective_fk
    FOREIGN KEY (objective_id) REFERENCES okr_objectives(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- Hai chỉ mục này là toàn bộ cơ chế chống sinh trùng khi gọi lại.
CREATE UNIQUE INDEX IF NOT EXISTS uq_objective_position
  ON okr_objectives(journey_id, position_code) WHERE position_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_kr_metric
  ON okr_krs(objective_id, metric_code) WHERE metric_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_objective_parent
  ON okr_objectives(parent_id) WHERE parent_id IS NOT NULL;

-- ── 3 · TIER CỦA TỪNG CHỨC DANH — khai trong dữ liệu, không giấu trong mã ──
ALTER TABLE position_templates ADD COLUMN IF NOT EXISTS okr_tier text;
COMMENT ON COLUMN position_templates.okr_tier IS
  'Tầng OKR tương ứng. Quản lý và trưởng bộ phận rơi vào emp — position_code mới là thứ phân biệt họ.';

UPDATE position_templates SET okr_tier = CASE template_code
  WHEN 'chairman' THEN 'chr' WHEN 'ceo' THEN 'ceo' WHEN 'cfo' THEN 'cfo'
  WHEN 'coo' THEN 'coo' WHEN 'cto' THEN 'cto' WHEN 'cmo' THEN 'cmo'
  WHEN 'clo' THEN 'clo' WHEN 'cro' THEN 'cro' WHEN 'cpo' THEN 'cpo'
  WHEN 'chro' THEN 'chro' ELSE 'emp' END;

-- ── 4 · TỪ ĐIỂN CHỈ SỐ — chỉ NHÃN, tuyệt đối không có chỉ tiêu ────────────
-- 45 cặp (vai, chỉ số) đã khai nhưng chỉ 13 có tên trong `ipo_benchmarks`.
-- Thiếu nhãn thì Key Result hiện ra mã máy (`p95_latency`) và không ai đọc
-- được. Bảng này CHỈ chứa tên/đơn vị/chiều tốt — ba thứ là quy ước gọi tên,
-- không phải số liệu. Mọi con số vẫn phải đi qua `ipo_benchmarks`.
CREATE TABLE IF NOT EXISTS tu_dien_chi_so (
  metric_code text PRIMARY KEY,
  name_vi text NOT NULL,
  unit_vi text,
  chieu text NOT NULL CHECK (chieu IN ('cao_tot','thap_tot','trung_tinh')),
  kieu_kr text NOT NULL CHECK (kieu_kr IN ('number','percentage','boolean','milestone'))
);
ALTER TABLE tu_dien_chi_so ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tdcs_public_read ON tu_dien_chi_so;
CREATE POLICY tdcs_public_read ON tu_dien_chi_so FOR SELECT USING (true);
GRANT SELECT ON tu_dien_chi_so TO authenticated;

INSERT INTO tu_dien_chi_so (metric_code, name_vi, unit_vi, chieu, kieu_kr) VALUES
 ('valuation','Định giá doanh nghiệp','VND','cao_tot','number'),
 ('readiness_score','Điểm sẵn sàng niêm yết','%','cao_tot','percentage'),
 ('rule_of_40','Quy tắc 40 (tăng trưởng + biên)','điểm','cao_tot','number'),
 ('revenue_monthly','Doanh thu tháng','VND','cao_tot','number'),
 ('runway_months','Số tháng còn sống','tháng','cao_tot','number'),
 ('nrr_pct','Tỷ lệ giữ doanh thu ròng (NRR)','%','cao_tot','percentage'),
 ('gross_margin_pct','Biên lợi nhuận gộp','%','cao_tot','percentage'),
 ('ebitda','EBITDA','VND','cao_tot','number'),
 ('net_burn','Đốt tiền ròng mỗi tháng','VND','thap_tot','number'),
 ('ccc_days','Vòng quay tiền mặt (CCC)','ngày','thap_tot','number'),
 ('burn_multiple','Bội số đốt tiền','lần','thap_tot','number'),
 ('dso_days','Số ngày thu tiền khách (DSO)','ngày','thap_tot','number'),
 ('dpo_days','Số ngày trả tiền nhà cung cấp (DPO)','ngày','trung_tinh','number'),
 ('arr','Doanh thu định kỳ năm (ARR)','VND','cao_tot','number'),
 ('net_new_arr','ARR mới ròng','VND','cao_tot','number'),
 ('magic_number','Chỉ số thần kỳ (hiệu suất bán)','lần','cao_tot','number'),
 ('pipeline_value','Giá trị pipeline','VND','cao_tot','number'),
 ('win_rate','Tỷ lệ chốt thắng','%','cao_tot','percentage'),
 ('cac','Chi phí thu hút một khách','VND','thap_tot','number'),
 ('ltv_cac_ratio','LTV trên CAC','lần','cao_tot','number'),
 ('mql_count','Số khách tiềm năng đạt chuẩn','khách','cao_tot','number'),
 ('brand_traffic','Lưu lượng tìm đến thương hiệu','phiên','cao_tot','number'),
 ('activation_rate','Tỷ lệ kích hoạt người dùng mới','%','cao_tot','percentage'),
 ('nps','Chỉ số thiện cảm khách hàng (NPS)','điểm','cao_tot','number'),
 ('feature_adoption','Tỷ lệ dùng tính năng','%','cao_tot','percentage'),
 ('uptime','Thời gian hệ thống hoạt động','%','cao_tot','percentage'),
 ('p95_latency','Độ trễ phân vị 95','ms','thap_tot','number'),
 ('deploy_frequency','Số lần phát hành','lần/tuần','cao_tot','number'),
 ('incident_count','Số sự cố','sự cố','thap_tot','number'),
 ('sla_ontime_rate','Tỷ lệ đúng hạn cam kết (SLA)','%','cao_tot','percentage'),
 ('unit_cost','Chi phí trên một đơn vị','VND','thap_tot','number'),
 ('cycle_time','Thời gian một chu trình','ngày','thap_tot','number'),
 ('sop_coverage','Độ phủ quy trình chuẩn','%','cao_tot','percentage'),
 ('headcount','Số nhân sự','người','trung_tinh','number'),
 ('attrition_rate','Tỷ lệ nghỉ việc','%','thap_tot','percentage'),
 ('esop_pool_used','Tỷ lệ quỹ ESOP đã dùng','%','trung_tinh','percentage'),
 ('time_to_hire','Thời gian tuyển một vị trí','ngày','thap_tot','number'),
 ('license_valid_count','Số giấy phép còn hiệu lực','giấy','cao_tot','number'),
 ('compliance_score','Điểm tuân thủ','%','cao_tot','percentage'),
 ('contract_backlog','Hợp đồng còn tồn đọng','hợp đồng','thap_tot','number'),
 ('investor_pipeline_count','Số nhà đầu tư đang trao đổi','nhà đầu tư','cao_tot','number'),
 ('dataroom_readiness','Độ sẵn sàng của data room','%','cao_tot','percentage'),
 ('round_progress','Tiến độ vòng gọi vốn','%','cao_tot','percentage'),
 ('board_meetings','Số phiên họp hội đồng quản trị','phiên','cao_tot','number'),
 ('resolutions','Số nghị quyết đã ban hành','nghị quyết','cao_tot','number'),
 ('internal_control_score','Điểm kiểm soát nội bộ','%','cao_tot','percentage'),
 ('open_vulns','Lỗ hổng bảo mật chưa vá','lỗ hổng','thap_tot','number'),
 ('mfa_coverage','Độ phủ xác thực hai lớp','%','cao_tot','percentage'),
 ('access_review_age','Số ngày từ lần rà soát quyền gần nhất','ngày','thap_tot','number')
ON CONFLICT (metric_code) DO UPDATE
  SET name_vi = EXCLUDED.name_vi, unit_vi = EXCLUDED.unit_vi,
      chieu = EXCLUDED.chieu, kieu_kr = EXCLUDED.kieu_kr;

-- ── 5 · SUY GIAI ĐOẠN GỌI VỐN ─────────────────────────────────────────────
-- `ipo_benchmarks` xếp ngưỡng theo `stage`, còn doanh nghiệp chỉ khai vòng gọi
-- vốn. Ánh xạ dưới đây chép đúng bảng `ROUND_TO_STAGE` đã dùng ở
-- `/api/unit-economics/derive` — một quy ước, hai nơi dùng thì phải trùng nhau.
CREATE OR REPLACE FUNCTION suy_giai_doan_von(p_tenant uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT COALESCE(
    (SELECT CASE r.round_code
       WHEN 'pre_seed' THEN 'seed'     WHEN 'angel'    THEN 'seed'
       WHEN 'seed'     THEN 'seed'     WHEN 'series_a' THEN 'series_a'
       WHEN 'series_b' THEN 'series_b' WHEN 'series_c' THEN 'growth'
       WHEN 'series_d' THEN 'growth'   WHEN 'bridge'   THEN 'growth'
       WHEN 'pre_ipo'  THEN 'pre_ipo'  WHEN 'ipo'      THEN 'pre_ipo' END
     FROM fundraise_rounds r
     WHERE r.tenant_id = p_tenant
     ORDER BY COALESCE(r.actual_close_date, r.target_close_date, r.created_at::date) DESC NULLS LAST
     LIMIT 1),
    'seed')   -- chưa gọi vốn vòng nào thì đo theo chuẩn hạt giống
$fn$;
COMMENT ON FUNCTION suy_giai_doan_von(uuid) IS
  'Vòng gọi vốn gần nhất → mã stage của ipo_benchmarks. Chưa có vòng nào thì trả seed.';
GRANT EXECUTE ON FUNCTION suy_giai_doan_von(uuid) TO authenticated;

-- ── 6 · HÀM PHÂN RÃ ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION phan_ra_muc_tieu(p_objective_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_tenant uuid; v_journey uuid; v_tier text; v_title text;
  v_phase int; v_stage text; v_industry text;
  v_vong int := 0; v_them int; v_tong_obj int := 0; v_tong_kr int := 0;
  v_obj record; v_mc text;
  v_target numeric; v_nguon text; v_ghi_chu text; v_ten text;
BEGIN
  SELECT o.tenant_id, o.journey_id, o.tier, o.title
    INTO v_tenant, v_journey, v_tier, v_title
    FROM okr_objectives o WHERE o.id = p_objective_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy mục tiêu %', p_objective_id;
  END IF;
  IF v_tier <> 'chr' THEN
    RAISE EXCEPTION 'Chỉ phân rã được từ mục tiêu tầng chủ tịch; mục tiêu này ở tầng %', v_tier;
  END IF;
  IF v_journey IS NULL THEN
    RAISE EXCEPTION 'Mục tiêu chưa gắn hành trình — không biết doanh nghiệp ở giai đoạn nào để chọn vai';
  END IF;

  -- Cùng luật quyền như compute_readiness_score (045): tác vụ nền làm cho mọi
  -- doanh nghiệp, người dùng chỉ làm trong doanh nghiệp mình.
  IF NOT la_ngu_canh_he_thong()
     AND NOT is_chairman_super()
     AND v_tenant NOT IN (SELECT id FROM list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Không có quyền với doanh nghiệp này';
  END IF;

  SELECT COALESCE(j.current_phase, 1), j.industry
    INTO v_phase, v_industry
    FROM ipo_journeys j WHERE j.id = v_journey;

  v_stage := suy_giai_doan_von(v_tenant);

  -- Mục tiêu chủ tịch nhận chức danh `chairman` để làm gốc cây.
  UPDATE okr_objectives SET position_code = 'chairman'
   WHERE id = p_objective_id
     AND position_code IS NULL
     AND NOT EXISTS (SELECT 1 FROM okr_objectives x
                      WHERE x.journey_id = v_journey
                        AND x.position_code = 'chairman'
                        AND x.id <> p_objective_id);

  -- Lan theo cây báo cáo: mỗi vòng thêm những chức danh mà CẤP TRÊN đã có mục
  -- tiêu. Lặp thay vì viết cứng 3 tầng, để thêm chức danh mới không phải sửa mã.
  LOOP
    v_vong := v_vong + 1;
    EXIT WHEN v_vong > 10;

    INSERT INTO okr_objectives
      (tenant_id, journey_id, parent_id, tier, position_code, title, description, owner_id, status)
    SELECT v_tenant, v_journey, cha.id, t.okr_tier, t.template_code,
           t.title_vi || ' — ' || t.mission_vi,
           'Phân rã từ mục tiêu chủ tịch: ' || v_title,
           (SELECT u.id FROM user_profiles u
             WHERE u.tenant_id = v_tenant AND u.role = t.okr_tier
             ORDER BY u.created_at LIMIT 1),
           'active'
      FROM position_templates t
      JOIN okr_objectives cha
        ON cha.journey_id = v_journey AND cha.position_code = t.reports_to_code
     WHERE t.reports_to_code IS NOT NULL
       AND COALESCE(t.min_phase, 1) <= v_phase
       AND t.okr_tier IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM okr_objectives e
                        WHERE e.journey_id = v_journey
                          AND e.position_code = t.template_code)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_them = ROW_COUNT;
    v_tong_obj := v_tong_obj + v_them;
    EXIT WHEN v_them = 0;
  END LOOP;

  -- Key Result: mỗi chỉ số vai đó sở hữu thành một KR.
  FOR v_obj IN
    SELECT o.id AS obj_id, t.owns_metrics AS metrics
      FROM okr_objectives o
      JOIN position_templates t ON t.template_code = o.position_code
     WHERE o.journey_id = v_journey AND o.position_code IS NOT NULL
  LOOP
    FOREACH v_mc IN ARRAY COALESCE(v_obj.metrics, ARRAY[]::text[]) LOOP
      -- Ngưỡng theo ngành đè lên ngưỡng chung; không có cái nào thì để TRỐNG.
      SELECT COALESCE(b.good_min, b.good_max), b.source_note
        INTO v_target, v_ghi_chu
        FROM (
          SELECT good_min, good_max, source_note, 1 AS uu_tien
            FROM ipo_benchmarks_by_industry
           WHERE metric_code = v_mc AND stage = v_stage AND industry_code = v_industry
          UNION ALL
          SELECT good_min, good_max, source_note, 2
            FROM ipo_benchmarks
           WHERE metric_code = v_mc AND stage = v_stage
        ) b
       ORDER BY b.uu_tien
       LIMIT 1;

      v_nguon := CASE WHEN v_target IS NULL THEN 'nguoi_dat' ELSE 'chuan_nganh' END;
      SELECT d.name_vi INTO v_ten FROM tu_dien_chi_so d WHERE d.metric_code = v_mc;
      v_ten := COALESCE(v_ten, v_mc);

      INSERT INTO okr_krs
        (objective_id, metric_code, title, metric_type, target_value, unit,
         nguon_chi_tieu, nguon_ghi_chu, status)
      VALUES
        (v_obj.obj_id, v_mc,
         v_ten || CASE WHEN v_target IS NULL THEN ' — chưa đặt chỉ tiêu'
                       ELSE ' — mốc chuẩn ' || trim(to_char(v_target,
                              CASE WHEN v_target = trunc(v_target) THEN 'FM999999999990'
                                   ELSE 'FM999999999990.99' END)) END,
         COALESCE((SELECT kieu_kr FROM tu_dien_chi_so WHERE metric_code = v_mc), 'number'),
         v_target,
         (SELECT unit_vi FROM tu_dien_chi_so WHERE metric_code = v_mc),
         v_nguon,
         CASE WHEN v_target IS NULL
              THEN 'Chưa có ngưỡng chuẩn cho chỉ số này ở giai đoạn ' || v_stage
                   || '. Người phụ trách tự đặt và chịu trách nhiệm con số.'
              ELSE v_ghi_chu END,
         'on_track')
      ON CONFLICT DO NOTHING;

      GET DIAGNOSTICS v_them = ROW_COUNT;
      v_tong_kr := v_tong_kr + v_them;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'muc_tieu_goc', p_objective_id,
    'giai_doan_hanh_trinh', v_phase,
    'giai_doan_von', v_stage,
    'muc_tieu_moi', v_tong_obj,
    'key_result_moi', v_tong_kr,
    'tong_muc_tieu', (SELECT count(*) FROM okr_objectives WHERE journey_id = v_journey),
    'chi_tieu_co_chuan', (SELECT count(*) FROM okr_krs k
                            JOIN okr_objectives o ON o.id = k.objective_id
                           WHERE o.journey_id = v_journey AND k.nguon_chi_tieu = 'chuan_nganh'),
    'chi_tieu_cho_nguoi_dat', (SELECT count(*) FROM okr_krs k
                            JOIN okr_objectives o ON o.id = k.objective_id
                           WHERE o.journey_id = v_journey AND k.nguon_chi_tieu = 'nguoi_dat'),
    'ghi_chu', 'Chỉ tiêu nhãn chuan_nganh lấy từ ipo_benchmarks có dẫn nguồn. Nhãn nguoi_dat là ô trống chờ người phụ trách cam kết con số.'
  );
END $fn$;
COMMENT ON FUNCTION phan_ra_muc_tieu(uuid) IS
  'Phân rã một mục tiêu tầng chủ tịch xuống toàn bộ cây vai theo position_templates. Chạy lại được, chỉ bổ sung phần thiếu.';
REVOKE ALL ON FUNCTION phan_ra_muc_tieu(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION phan_ra_muc_tieu(uuid) TO authenticated;
