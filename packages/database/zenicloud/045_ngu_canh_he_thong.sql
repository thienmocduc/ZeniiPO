-- ============================================================================
-- 045 — NGỮ CẢNH HỆ THỐNG: tác vụ nền được phép làm việc cho MỌI doanh nghiệp
--
-- BỐI CẢNH. Sau khi vá lớp service client (nó vốn không hề bỏ qua RLS), tác
-- vụ `readiness-recalc` đã NHÌN THẤY hành trình — `processed` từ 0 lên 1 — rồi
-- ngã ở bước sau:
--     Access denied: journey does not belong to caller tenant
--
-- `compute_readiness_score` kiểm `is_chairman_super() OR tenant IN
-- list_accessible_tenants()`. Đúng cho lời gọi từ người dùng. Nhưng tác vụ nền
-- KHÔNG có phiên người dùng nào: nó đã tự xác thực bằng CRON_SECRET rồi, và
-- việc của nó là tính lại điểm cho MỌI doanh nghiệp. Với nó, danh sách tenant
-- truy cập được luôn rỗng.
--
-- ── PHÂN BIỆT BẰNG VAI KẾT NỐI, KHÔNG BẰNG MỘT CỜ TỰ KHAI ──
-- Cách nhận biết: vai ĐANG KẾT NỐI có sở hữu schema `public` không.
--     service client (pool vai chủ)          → session_user = zeniipo_com_app  → CÓ
--     người dùng (vai chạy + SET ROLE auth)   → session_user = zeniipo_com_runtime → KHÔNG
--
-- Dùng `session_user` chứ không `current_user`: bên trong một hàm
-- SECURITY DEFINER thì `current_user` luôn là chủ hàm, nên không phân biệt
-- được gì. `session_user` giữ nguyên vai đã mở kết nối.
--
-- Điều này KHÔNG mở thêm cửa nào: chỉ kết nối mở bằng thông tin đăng nhập vai
-- chủ mới nhận được ngữ cảnh hệ thống, mà thông tin đó chỉ nằm ở
-- `DATABASE_URL_MIGRATION` — biến mà riêng service client dùng, và service
-- client chỉ được gọi ở nơi đã tự xác thực (CRON_SECRET, token băm ingest,
-- x-internal-key, console sau khi kiểm chủ tịch).
-- ============================================================================

CREATE OR REPLACE FUNCTION la_ngu_canh_he_thong()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_namespace n
     WHERE n.nspname = 'public'
       AND n.nspowner = (SELECT oid FROM pg_roles WHERE rolname = session_user)
  )
$$;
COMMENT ON FUNCTION la_ngu_canh_he_thong() IS
  'True khi kết nối mở bằng vai chủ schema — tức tác vụ nền đã tự xác thực, không phải người dùng. Dùng session_user vì current_user bên trong SECURITY DEFINER luôn là chủ hàm.';
GRANT EXECUTE ON FUNCTION la_ngu_canh_he_thong() TO authenticated;

-- ── Cho tác vụ nền tính lại điểm sẵn sàng ──
-- Chỉ SỬA ĐÚNG MỘT DÒNG điều kiện; phần tính toán giữ nguyên như 038.
CREATE OR REPLACE FUNCTION public.compute_readiness_score(p_journey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid;
  v_tu_khai numeric;
  v_da_xac_minh numeric;
  v_tong_tieu_chi int;
  v_so_co_ho_so int;
  v_breakdown jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.ipo_journeys WHERE id = p_journey_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Journey % not found', p_journey_id;
  END IF;
  -- Tác vụ nền (đã tự xác thực) làm việc cho mọi doanh nghiệp; người dùng thì
  -- vẫn bị giới hạn trong doanh nghiệp của mình như cũ.
  IF NOT la_ngu_canh_he_thong()
     AND NOT public.is_chairman_super()
     AND v_tenant_id NOT IN (SELECT id FROM public.list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Access denied: journey does not belong to caller tenant';
  END IF;

  SELECT
    COALESCE(sum(score_pct * weight) / NULLIF(sum(weight), 0), 0),
    COALESCE(sum(CASE WHEN status = 'verified' AND evidence_file_id IS NOT NULL AND verified_by IS NOT NULL
                      THEN score_pct * weight ELSE 0 END) / NULLIF(sum(weight), 0), 0),
    count(*),
    count(*) FILTER (WHERE evidence_file_id IS NOT NULL)
  INTO v_tu_khai, v_da_xac_minh, v_tong_tieu_chi, v_so_co_ho_so
  FROM public.ipo_readiness_criteria WHERE journey_id = p_journey_id;

  SELECT COALESCE(jsonb_object_agg(category, jsonb_build_object(
    'score', cat_score,
    'diem_da_xac_minh', cat_verified,
    'criteria_count', cat_count,
    'so_co_ho_so', cat_evidence
  )), '{}'::jsonb)
  INTO v_breakdown
  FROM (
    SELECT category,
           sum(score_pct * weight) / NULLIF(sum(weight), 0) AS cat_score,
           sum(CASE WHEN status = 'verified' AND evidence_file_id IS NOT NULL AND verified_by IS NOT NULL
                    THEN score_pct * weight ELSE 0 END) / NULLIF(sum(weight), 0) AS cat_verified,
           count(*) AS cat_count,
           count(*) FILTER (WHERE evidence_file_id IS NOT NULL) AS cat_evidence
    FROM public.ipo_readiness_criteria
    WHERE journey_id = p_journey_id
    GROUP BY category
  ) cat;

  INSERT INTO public.readiness_score_history (tenant_id, journey_id, total_score, breakdown_by_category)
  VALUES (v_tenant_id, p_journey_id, v_da_xac_minh, v_breakdown);

  RETURN jsonb_build_object(
    'total_score', v_da_xac_minh,
    'diem_da_xac_minh', v_da_xac_minh,
    'diem_tu_khai', v_tu_khai,
    'khoang_cach_bang_chung', round(v_tu_khai - v_da_xac_minh, 1),
    'tong_tieu_chi', v_tong_tieu_chi,
    'so_tieu_chi_co_ho_so', v_so_co_ho_so,
    'ghi_chu',
      CASE WHEN v_tu_khai - v_da_xac_minh >= 20
           THEN 'Chênh lệch lớn giữa tự khai và đã xác minh. Bên thẩm định sẽ hỏi hồ sơ cho phần chênh này.'
           WHEN v_tong_tieu_chi = 0
           THEN 'Chưa có tiêu chí nào — điểm 0 là do chưa khởi tạo lộ trình, không phải do yếu.'
           ELSE 'Điểm dựa trên tiêu chí có hồ sơ đính kèm.' END,
    'breakdown', v_breakdown,
    'grade',
      CASE WHEN v_da_xac_minh >= 90 THEN 'A+'
           WHEN v_da_xac_minh >= 80 THEN 'A'
           WHEN v_da_xac_minh >= 70 THEN 'B'
           WHEN v_da_xac_minh >= 60 THEN 'C'
           ELSE 'F' END
  );
END $function$;

REVOKE ALL ON FUNCTION public.compute_readiness_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_readiness_score(uuid) TO authenticated;
