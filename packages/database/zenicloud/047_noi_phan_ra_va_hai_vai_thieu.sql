-- ============================================================================
-- 047 — NỐI CHUỖI PHÂN RÃ VÀO LÚC CHỦ TỊCH CHỐT MỤC TIÊU + BỔ HAI VAI THIẾU
--
-- 046 dựng được hàm `phan_ra_muc_tieu()` nhưng chưa ai gọi nó. Doanh nghiệp
-- mới vẫn nhận đúng 4 mục tiêu chủ tịch rồi đứng im — tức là chuỗi vẫn đứt ở
-- ngoài thực tế dù hàm đã chạy được khi gọi tay.
--
-- ── HAI VAI KHÔNG AI PHỤ TRÁCH (chairman quyết 26/09/2026) ─────────────────
-- Đối chiếu 12 phòng ban với 12 chức danh: hai phòng có chỉ số mà không chức
-- danh nào sở hữu.
--   · An ninh — Rủi ro : lỗ hổng chưa vá · độ phủ 2FA · tuổi rà soát quyền
--   · Quản trị công ty : số phiên họp HĐQT · số nghị quyết · ĐIỂM KIỂM SOÁT
--                        NỘI BỘ  ← mục thẩm định viên soi đầu tiên (SOX 404)
--
-- CISO báo cáo CEO chứ KHÔNG báo cáo CTO: người dựng hệ thống không được đồng
-- thời là người xác nhận hệ thống đó an toàn. Với doanh nghiệp chuẩn bị niêm
-- yết đó là xung đột nhiệm vụ, không phải chuyện sơ đồ cho đẹp.
--
-- Thư ký công ty báo cáo CHỦ TỊCH chứ không qua CEO: người giữ biên bản và
-- túc số phải độc lập với ban điều hành, nếu không thì hội đồng mất công cụ
-- giám sát chính ban điều hành.
-- ============================================================================

-- ── 1 · NỚI TIER CHO HAI VAI MỚI ──────────────────────────────────────────
ALTER TABLE okr_objectives DROP CONSTRAINT IF EXISTS okr_objectives_tier_check;
ALTER TABLE okr_objectives ADD CONSTRAINT okr_objectives_tier_check
  CHECK (tier IN ('chr','ceo','cfo','coo','cto','cmo','clo','cro','cpo','chro','ciso','gov','emp'));

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('chr','ceo','cfo','coo','cto','cmo','clo','cro','cpo','chro','ciso','gov','emp'));

-- ── 2 · HAI CHỨC DANH MỚI ─────────────────────────────────────────────────
INSERT INTO position_templates
  (template_code, unit_code, title_vi, level, reports_to_code, mission_vi,
   capabilities, decision_rights, owns_metrics, min_phase, display_order, okr_tier)
VALUES
  ('ciso', 'security', 'Giám đốc an ninh thông tin (CISO)', 'c_level', 'ceo',
   'Giữ hệ thống và dữ liệu không bị xâm phạm: vá lỗ hổng, kiểm soát truy cập, sạch khi thẩm định an ninh.',
   '[{"name":"Quản trị lỗ hổng và vá lỗi","level":"expert","category":"security"},
     {"name":"Kiểm soát truy cập và rà soát quyền định kỳ","level":"expert","category":"security"},
     {"name":"Ứng phó sự cố và điều tra","level":"advanced","category":"security"},
     {"name":"Bảo vệ dữ liệu cá nhân (NĐ13)","level":"advanced","category":"legal"}]'::jsonb,
   ARRAY['Phê duyệt chính sách an ninh thông tin','Quyết định cấp/thu hồi quyền truy cập hệ thống trọng yếu','Chốt phương án ứng phó sự cố'],
   ARRAY['open_vulns','mfa_coverage','access_review_age'],
   5, 13, 'ciso'),

  ('corp_sec', 'governance', 'Thư ký công ty — Trưởng ban Quản trị công ty', 'director', 'chairman',
   'Giữ guồng quản trị chạy đúng luật: triệu tập họp, tính túc số, lưu biên bản và nghị quyết đủ hiệu lực.',
   '[{"name":"Tổ chức phiên họp hội đồng đúng trình tự","level":"expert","category":"governance"},
     {"name":"Soạn và lưu biên bản, nghị quyết","level":"expert","category":"governance"},
     {"name":"Kiểm soát nội bộ và khung SOX","level":"advanced","category":"governance"},
     {"name":"Công bố thông tin theo quy định niêm yết","level":"advanced","category":"legal"}]'::jsonb,
   ARRAY['Xác nhận túc số phiên họp','Chốt hình thức biểu quyết','Quyết định thời điểm công bố thông tin'],
   ARRAY['board_meetings','resolutions','internal_control_score'],
   4, 14, 'gov')
ON CONFLICT (template_code) DO UPDATE
  SET unit_code = EXCLUDED.unit_code, title_vi = EXCLUDED.title_vi,
      level = EXCLUDED.level, reports_to_code = EXCLUDED.reports_to_code,
      mission_vi = EXCLUDED.mission_vi, capabilities = EXCLUDED.capabilities,
      decision_rights = EXCLUDED.decision_rights, owns_metrics = EXCLUDED.owns_metrics,
      min_phase = EXCLUDED.min_phase, display_order = EXCLUDED.display_order,
      okr_tier = EXCLUDED.okr_tier;

-- ── 3 · GỌI PHÂN RÃ NGAY KHI CHỦ TỊCH CHỐT MỤC TIÊU ───────────────────────
-- Giữ NGUYÊN chữ ký 6 tham số. Thêm tham số thứ 7 có giá trị mặc định sẽ tạo
-- hàm nạp chồng, và lời gọi 6 tham số của hai endpoint hiện tại trở thành nhập
-- nhằng — Postgres sẽ từ chối. Sao Bắc Đẩu do tầng ứng dụng ghi, xem
-- `/api/cascade/route.ts`.
CREATE OR REPLACE FUNCTION public.cascade_chairman_event(
  p_tenant_id uuid, p_valuation numeric, p_venue text,
  p_year integer, p_industry text, p_strategy text)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  v_event_id uuid;
  v_journey_id uuid;
  v_obj_chinh uuid;
  v_phan_ra jsonb;
BEGIN
  IF NOT public.is_chr_or_ceo() THEN
    RAISE EXCEPTION 'Only CHR/CEO can cascade events';
  END IF;

  INSERT INTO events (tenant_id, actor_id, event_type, payload)
  VALUES (p_tenant_id, auth.uid(), 'chairman_goal_set', jsonb_build_object(
    'valuation', p_valuation, 'venue', p_venue, 'year', p_year,
    'industry', p_industry, 'strategy', p_strategy
  )) RETURNING id INTO v_event_id;

  INSERT INTO ipo_journeys (tenant_id, name, valuation_target, exit_venue, target_year, industry, strategy)
  VALUES (p_tenant_id, 'IPO ' || p_year || ' · ' || upper(p_venue),
          p_valuation, p_venue, p_year, p_industry, p_strategy)
  RETURNING id INTO v_journey_id;

  -- Mục tiêu CHÍNH tách riêng để lấy id — nó là gốc của cây phân rã.
  INSERT INTO okr_objectives (tenant_id, journey_id, tier, title)
  VALUES (p_tenant_id, v_journey_id, 'chr',
          'Đạt định giá ' || trim(to_char(p_valuation, 'FM999999999999990'))
          || ' tại ' || upper(p_venue) || ' năm ' || p_year)
  RETURNING id INTO v_obj_chinh;

  INSERT INTO okr_objectives (tenant_id, journey_id, tier, title)
  VALUES
    (p_tenant_id, v_journey_id, 'chr', 'Đưa kinh tế đơn vị đạt chuẩn niêm yết'),
    (p_tenant_id, v_journey_id, 'chr', 'Vận hành xuất sắc — đo được, lặp lại được'),
    (p_tenant_id, v_journey_id, 'chr', 'Quản trị và tuân thủ đạt chuẩn niêm yết');

  -- Đây là mắt nối 046 còn thiếu: phân rã xuống toàn bộ cây vai.
  v_phan_ra := public.phan_ra_muc_tieu(v_obj_chinh);

  UPDATE events SET cascade_status = 'completed',
    cascade_result = jsonb_build_object(
      'journey_id', v_journey_id,
      'objectives_created', 4 + COALESCE((v_phan_ra->>'muc_tieu_moi')::int, 0),
      'phan_ra', v_phan_ra)
  WHERE id = v_event_id;

  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'journey_id', v_journey_id,
    'objective_goc', v_obj_chinh,
    'muc_tieu_chu_tich', 4,
    'muc_tieu_phan_ra', COALESCE((v_phan_ra->>'muc_tieu_moi')::int, 0),
    'key_result', COALESCE((v_phan_ra->>'key_result_moi')::int, 0),
    'chi_tieu_co_chuan', COALESCE((v_phan_ra->>'chi_tieu_co_chuan')::int, 0),
    'chi_tieu_cho_nguoi_dat', COALESCE((v_phan_ra->>'chi_tieu_cho_nguoi_dat')::int, 0),
    'status', 'success'
  );
END $fn$;
COMMENT ON FUNCTION public.cascade_chairman_event(uuid, numeric, text, integer, text, text) IS
  'Chủ tịch chốt mục tiêu → sinh hành trình + 4 mục tiêu tầng chủ tịch + phân rã xuống toàn cây vai kèm Key Result. Trả về số đếm THẬT, không trả số cứng.';
