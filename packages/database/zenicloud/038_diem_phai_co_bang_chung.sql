-- ============================================================================
-- 038 — ĐIỂM SẴN SÀNG IPO PHẢI CÓ BẰNG CHỨNG, KHÔNG TỰ KHAI LÀ XONG
--
-- BỐI CẢNH. Điểm đang tính bằng `sum(score_pct × weight) / sum(weight)` trên
-- những con số người dùng TỰ GÕ VÀO. Bảng đã có sẵn ba cột `evidence_file_id`,
-- `verified_by`, `verified_at` từ migration 003 nhưng KHÔNG có ràng buộc nào
-- bắt dùng: một người có thể đặt trạng thái 'verified' cho tiêu chí "Kiểm toán
-- Big 4 hai năm liên tiếp" mà không đính kèm một tờ giấy nào, và điểm vẫn lên.
--
-- VÌ SAO ĐIỀU NÀY NGHIÊM TRỌNG. Điểm sẵn sàng là thứ đem trình hội đồng quản
-- trị và tổ chức bảo lãnh phát hành. Bên thẩm định sẽ đòi hồ sơ cho từng tiêu
-- chí; tiêu chí nào không có hồ sơ thì với họ bằng KHÔNG, bất kể trong hệ
-- thống ghi 100. Một nền tảng báo "đã sẵn sàng 92%" rồi bên mua soi ra 40% là
-- không có hồ sơ thì nền tảng đó mất uy tín, chứ không phải người dùng.
--
-- CÁCH LÀM. KHÔNG xoá điểm tự khai — giám đốc tài chính cần nó để lập kế
-- hoạch. Thay vào đó tách làm HAI con số và để khoảng cách giữa chúng lộ ra:
--     · diem_da_xac_minh — chỉ tính tiêu chí CÓ hồ sơ đính kèm + người xác
--       minh + thời điểm xác minh. Đây là con số đem đi đàm phán.
--     · diem_tu_khai     — công thức cũ, giữ nguyên, dùng để lập kế hoạch.
--     · khoang_cach_bang_chung — hiệu hai số. Chính là phần bên thẩm định sẽ
--       moi ra. Thấy trước thì còn kịp chuẩn bị.
--
-- Và chặn ở CSDL chứ không chỉ ở giao diện: đặt 'verified' mà thiếu hồ sơ hoặc
-- thiếu người xác minh thì CSDL từ chối, bất kể đi qua cửa nào.
-- ============================================================================

-- ── Ràng buộc: 'verified' phải có đủ ba thứ ──
-- Bảng đang rỗng (đã đếm: 0 dòng) nên thêm ràng buộc không đụng dữ liệu cũ.
DO $$ BEGIN
  ALTER TABLE ipo_readiness_criteria ADD CONSTRAINT xac_minh_phai_co_bang_chung
    CHECK (
      status <> 'verified'
      OR (evidence_file_id IS NOT NULL AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON CONSTRAINT xac_minh_phai_co_bang_chung ON ipo_readiness_criteria IS
  'Trạng thái "đã xác minh" đòi hồ sơ trong phòng dữ liệu + người xác minh + thời điểm. Không có đủ thì không được xác minh.';
COMMENT ON COLUMN ipo_readiness_criteria.evidence_file_id IS
  'Hồ sơ trong data_room_docs chứng minh tiêu chí. Thiếu cột này thì tiêu chí KHÔNG tính vào điểm đã xác minh.';
COMMENT ON COLUMN ipo_readiness_criteria.verified_by IS
  'Người xác minh. Máy chủ tự điền từ phiên đăng nhập — KHÔNG nhận từ phía trình duyệt, vì nhận thì giả được.';

-- ── Tính điểm: trả về cả hai con số và khoảng cách giữa chúng ──
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
  IF NOT public.is_chairman_super()
     AND v_tenant_id NOT IN (SELECT id FROM public.list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Access denied: journey does not belong to caller tenant';
  END IF;

  -- Mẫu số là TỔNG trọng số của MỌI tiêu chí ở cả hai công thức. Nếu điểm đã
  -- xác minh chỉ chia cho trọng số của những tiêu chí có hồ sơ thì một doanh
  -- nghiệp có đúng một hồ sơ sẽ ra 100% — đó là cách nói dối bằng phép chia.
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

  -- Lịch sử ghi ĐIỂM ĐÃ XÁC MINH, vì đó mới là con số chịu được thẩm định.
  INSERT INTO public.readiness_score_history (tenant_id, journey_id, total_score, breakdown_by_category)
  VALUES (v_tenant_id, p_journey_id, v_da_xac_minh, v_breakdown);

  RETURN jsonb_build_object(
    -- Giữ tên cũ để giao diện đang chạy không vỡ, nhưng nay mang NGHĨA MỚI:
    -- điểm đã có bằng chứng. Đây là thay đổi CÓ CHỦ Ý.
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
