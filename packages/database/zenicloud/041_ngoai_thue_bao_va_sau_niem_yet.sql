-- ============================================================================
-- 041 — CHỈ SỐ THUÊ BAO KHÔNG ĐƯỢC CHẤM ĐIỂM DOANH NGHIỆP KHÔNG THUÊ BAO
--       + mở giai đoạn SAU NIÊM YẾT
--
-- ĐO ĐƯỢC, KHÔNG SUY ĐOÁN. Bảng `ipo_benchmarks` có 13 mã chỉ số dùng CHUNG
-- cho mọi ngành, nhưng đọc chính GHI CHÚ NGUỒN của chúng thì 6 mã chỉ có
-- nghĩa với mô hình doanh thu định kỳ:
--     rule_of_40   — ghi chú: "Chuẩn vàng công ty phần mềm"
--     quick_ratio  — ghi chú: "Thêm gấp 4 lần mất" ⇒ đây là tỷ số nhanh SaaS
--                    (thêm mới + mở rộng) / (rời bỏ + thu hẹp), KHÔNG phải tỷ
--                    số thanh toán nhanh trong kế toán. Trùng tên, khác hẳn
--                    nghĩa — chỗ này rất dễ hiểu nhầm.
--     nrr_pct, grr_pct — giữ chân DOANH THU ĐỊNH KỲ
--     magic_number     — hiệu quả bán hàng tính trên doanh thu định kỳ mới
--     burn_multiple    — tiền đốt trên mỗi đồng doanh thu định kỳ tăng thêm
--
-- Trong khi đó `industry_metric_sets` đã có 122 mã chỉ số cho 42 ngành, gồm
-- rất nhiều chỉ số ngoài thuê bao: revpar (khách sạn), same_store_sales
-- (bán lẻ), scrap_rate (sản xuất), table_turnover (F&B), variation_order
-- (xây dựng)… Nghĩa là phần thiếu KHÔNG phải chỉ số — mà là việc chấm điểm
-- đang lấy chuẩn phần mềm áp lên chuỗi nhà hàng.
--
-- CÁCH LÀM KHÔNG BỊA THÊM SỐ NÀO. Không nặn ra ngưỡng cho 39 ngành còn lại.
-- Chỉ ghi đúng PHẠM VI ÁP DỤNG của những con số ĐÃ CÓ, rồi loại chúng khỏi
-- việc chấm điểm khi doanh nghiệp không có doanh thu định kỳ. Không chấm còn
-- hơn chấm bằng thước của ngành khác.
--
-- VÀ QUYẾT ĐỊNH DỰA TRÊN DỮ LIỆU, KHÔNG DỰA TRÊN NGÀNH. Hàm
-- `co_doanh_thu_dinh_ky()` hỏi thẳng: doanh nghiệp này có khai doanh thu định
-- kỳ bao giờ chưa? Một xưởng cơ khí bán gói bảo trì hằng tháng thì VẪN có, còn
-- một công ty phần mềm bán đứt giấy phép thì KHÔNG — đoán theo ngành sai cả
-- hai lượt.
--
-- ⚠ NỢ CÒN LẠI, ghi ra để không ai tưởng đã đủ:
--   · `gross_margin_pct` ngưỡng chung 70% mang ghi chú "chuẩn công ty đại
--     chúng NGÀNH CÔNG NGHỆ". Đã có ngưỡng đè cho ngành 56 (F&B, 55%), 62
--     (phần mềm, 70%) và M (dịch vụ chuyên môn, 40%). 39 ngành còn lại vẫn
--     rơi về con số của ngành công nghệ. Cần nguồn cho từng ngành mới sửa
--     được — KHÔNG bịa.
--   · Hai mã `ipo_readiness_score` và `readiness_score` cùng đo một thứ với
--     ghi chú khác nhau. Chưa gộp vì chưa rõ mã nào là mã chính thức.
-- ============================================================================

-- ── 1 · Phạm vi áp dụng theo MÔ HÌNH DOANH THU ──
ALTER TABLE ipo_benchmarks             ADD COLUMN IF NOT EXISTS mo_hinh_ap_dung text NOT NULL DEFAULT 'chung';
ALTER TABLE ipo_benchmarks_by_industry ADD COLUMN IF NOT EXISTS mo_hinh_ap_dung text NOT NULL DEFAULT 'chung';
DO $$ BEGIN
  ALTER TABLE ipo_benchmarks ADD CONSTRAINT mo_hinh_ap_dung_hop_le
    CHECK (mo_hinh_ap_dung IN ('chung','thue_bao'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ipo_benchmarks_by_industry ADD CONSTRAINT mo_hinh_ap_dung_nganh_hop_le
    CHECK (mo_hinh_ap_dung IN ('chung','thue_bao'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN ipo_benchmarks.mo_hinh_ap_dung IS
  'thue_bao = chỉ có nghĩa khi doanh nghiệp có doanh thu định kỳ. chung = mọi mô hình.';

UPDATE ipo_benchmarks SET mo_hinh_ap_dung = 'thue_bao'
 WHERE metric_code IN ('rule_of_40','quick_ratio','nrr_pct','grr_pct','magic_number','burn_multiple');
UPDATE ipo_benchmarks_by_industry SET mo_hinh_ap_dung = 'thue_bao'
 WHERE metric_code IN ('rule_of_40','quick_ratio','nrr_pct','grr_pct','magic_number','burn_multiple');

-- Nói rõ cái tên gây hiểu nhầm ngay trong dữ liệu, không để trong đầu người viết.
UPDATE ipo_benchmarks
   SET name_vi = 'Tỷ số nhanh SaaS (thêm mới+mở rộng / rời bỏ+thu hẹp)'
 WHERE metric_code = 'quick_ratio' AND name_vi = 'Tỷ số nhanh';

-- ── 2 · Doanh nghiệp này CÓ doanh thu định kỳ không — hỏi DỮ LIỆU ──
CREATE OR REPLACE FUNCTION co_doanh_thu_dinh_ky(p_tenant uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM unit_economics_inputs u
     WHERE u.tenant_id = p_tenant
       AND coalesce(u.starting_mrr,0) + coalesce(u.new_mrr,0) + coalesce(u.expansion_mrr,0) > 0
  )
$$;
COMMENT ON FUNCTION co_doanh_thu_dinh_ky(uuid) IS
  'Hỏi dữ liệu thật (unit_economics_inputs) thay vì đoán theo ngành. Chưa khai gì thì false, và không chấm bằng chuẩn thuê bao.';

-- ── 3 · Tra ngưỡng: thêm bậc lọc theo mô hình doanh thu ──
-- Giữ nguyên thứ tự cũ (ngành đúng → ngành cha → chung) và CHỈ thêm một bậc
-- lọc, để không đụng vào phần đang chạy đúng.
CREATE OR REPLACE FUNCTION nguong_ap_dung_duoc(
  p_stage text, p_industry_code text DEFAULT NULL, p_co_dinh_ky boolean DEFAULT NULL
) RETURNS TABLE (metric_code text, name_vi text, good_min numeric, good_max numeric,
                 category text, source_note text, industry_code text, mo_hinh_ap_dung text,
                 ap_dung_duoc boolean, ly_do_khong_ap_dung text)
LANGUAGE sql STABLE AS $$
  SELECT n.metric_code, n.name_vi, n.good_min, n.good_max, n.category, n.source_note,
         n.industry_code,
         coalesce(b.mo_hinh_ap_dung, 'chung'),
         -- Chưa biết doanh nghiệp có định kỳ hay không (NULL) thì KHÔNG loại,
         -- nhưng cũng không khẳng định — trả cờ để bên gọi tự xử.
         (coalesce(b.mo_hinh_ap_dung,'chung') = 'chung' OR p_co_dinh_ky IS NOT FALSE),
         CASE WHEN coalesce(b.mo_hinh_ap_dung,'chung') = 'thue_bao' AND p_co_dinh_ky IS FALSE
              THEN 'Chỉ số của mô hình doanh thu định kỳ. Doanh nghiệp này chưa khai doanh thu định kỳ nào, nên không chấm mục này — chấm bằng thước của ngành khác là sai.'
              WHEN coalesce(b.mo_hinh_ap_dung,'chung') = 'thue_bao' AND p_co_dinh_ky IS NULL
              THEN 'Chỉ số của mô hình doanh thu định kỳ. Chưa xác định được doanh nghiệp có doanh thu định kỳ hay không.'
         END
    FROM nguong_hieu_luc(p_stage, p_industry_code) n
    LEFT JOIN ipo_benchmarks b
      ON b.metric_code = n.metric_code AND b.stage = p_stage
$$;
COMMENT ON FUNCTION nguong_ap_dung_duoc(text,text,boolean) IS
  'Như nguong_hieu_luc nhưng kèm phạm vi mô hình doanh thu: chỉ số thuê bao không dùng để chấm doanh nghiệp không thuê bao.';

-- ── 4 · Mở giai đoạn SAU NIÊM YẾT ──
-- Năm giai đoạn cũ dừng ở `pre_ipo`, tức nền tảng hết việc đúng lúc doanh
-- nghiệp bắt đầu phần khó nhất: làm công ty đại chúng.
ALTER TABLE ipo_benchmarks DROP CONSTRAINT IF EXISTS ipo_benchmarks_stage_check;
ALTER TABLE ipo_benchmarks ADD CONSTRAINT ipo_benchmarks_stage_check
  CHECK (stage IN ('seed','series_a','series_b','growth','pre_ipo','niem_yet'));
ALTER TABLE ipo_benchmarks_by_industry DROP CONSTRAINT IF EXISTS ipo_benchmarks_by_industry_stage_check;
ALTER TABLE ipo_benchmarks_by_industry ADD CONSTRAINT ipo_benchmarks_by_industry_stage_check
  CHECK (stage IN ('seed','series_a','series_b','growth','pre_ipo','niem_yet'));

-- ── 5 · Nghĩa vụ công bố thông tin sau niêm yết ──
-- ⚠ BẢNG NÀY CỐ Ý ĐỂ TRỐNG. Kho tri thức Wits ghi rõ ở phần phạm vi:
-- "Chứng khoán, IPO, niêm yết — ngoài phạm vi; thuộc gói tri thức khác của
-- cùng chương trình". Gói đó chưa có trên máy. Nghĩa vụ công bố có thời hạn
-- tính bằng giờ và có phạt tiền thật; điền từ trí nhớ rồi để khách trễ hạn
-- thì tệ hơn nhiều so với để trống và nói thẳng là chưa có.
CREATE TABLE IF NOT EXISTS nghia_vu_cong_bo (
  ma text PRIMARY KEY,
  ten_vi text NOT NULL,
  loai text NOT NULL CHECK (loai IN ('dinh_ky','bat_thuong','theo_yeu_cau')),
  chu_ky text,                       -- quy · ban_nien · nam · NULL nếu bất thường
  han_nop text NOT NULL,             -- thời hạn, chép đúng như văn bản quy định
  su_kien_kich_hoat text,            -- loại bất thường: sự việc nào làm phát sinh nghĩa vụ
  can_cu_phap_ly text NOT NULL,      -- BẮT BUỘC: số hiệu văn bản + điều khoản
  hieu_luc_tu date,
  ghi_chu text,
  CONSTRAINT can_cu_khong_rong CHECK (length(btrim(can_cu_phap_ly)) > 0)
);
COMMENT ON TABLE nghia_vu_cong_bo IS
  'Nghĩa vụ công bố thông tin sau niêm yết. ĐANG TRỐNG: gói tri thức chứng khoán chưa có. Mỗi dòng BẮT BUỘC dẫn căn cứ pháp lý.';

ALTER TABLE nghia_vu_cong_bo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cong_bo_public_read ON nghia_vu_cong_bo;
CREATE POLICY cong_bo_public_read ON nghia_vu_cong_bo FOR SELECT USING (true);
GRANT SELECT ON nghia_vu_cong_bo TO authenticated;
GRANT ALL ON nghia_vu_cong_bo TO service_role;

-- Trả lời thẳng "giai đoạn sau niêm yết đã có gì chưa" thay vì để màn hình trống.
CREATE OR REPLACE VIEW tinh_trang_sau_niem_yet AS
SELECT
  (SELECT count(*) FROM ipo_benchmarks WHERE stage = 'niem_yet')::int AS so_nguong_chuan,
  (SELECT count(*) FROM nghia_vu_cong_bo)::int                        AS so_nghia_vu_cong_bo,
  'Giai đoạn sau niêm yết đã mở nhưng CHƯA có dữ liệu chuẩn: gói tri thức chứng khoán/IPO nằm ngoài kho Wits hiện có. Cần nguồn chính thức (Luật Chứng khoán và văn bản hướng dẫn) trước khi nạp — không suy từ trí nhớ.'::text AS ghi_chu;
GRANT SELECT ON tinh_trang_sau_niem_yet TO authenticated;

-- ── 6 · Chấm điểm phải TÔN TRỌNG phạm vi áp dụng ──
-- Bản cũ (`grade_vs_benchmark` ở 026) đọc thẳng `ipo_benchmarks`, bỏ qua cả
-- ngành lẫn mô hình doanh thu. Hệ quả cụ thể: một chuỗi nhà hàng bị chấm
-- `nrr_pct ≥ 110` — chỉ số không thể tính được với mô hình của họ — và vì
-- không đạt nên điểm tổng bị kéo xuống. Chỉ số không áp dụng mà vẫn nằm ở
-- MẪU SỐ thì điểm thành vô nghĩa.
--
-- Nay: mục không áp dụng mang trạng thái 'khong_ap_dung', KHÔNG vào mẫu số, và
-- kèm lý do bằng tiếng Việt để người dùng hiểu vì sao mục đó vắng mặt.
CREATE OR REPLACE FUNCTION grade_vs_benchmark(p_tenant uuid, p_stage text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  rec record;
  v_items jsonb := '[]'::jsonb;
  v_pass int := 0; v_total int := 0; v_bo_qua int := 0;
  v_actual numeric; v_ok boolean;
  v_nganh text;
  v_dinh_ky boolean;
BEGIN
  -- Ngành lấy từ hành trình IPO đang hoạt động; chưa khai thì NULL và hàm tra
  -- ngưỡng tự rơi về bộ chuẩn chung.
  SELECT j.industry_code INTO v_nganh
    FROM ipo_journeys j
   WHERE j.tenant_id = p_tenant AND j.status = 'active'
   ORDER BY j.created_at DESC LIMIT 1;

  v_dinh_ky := co_doanh_thu_dinh_ky(p_tenant);

  FOR rec IN
    SELECT n.metric_code, n.name_vi, n.good_min, n.good_max, n.category, n.source_note,
           n.ap_dung_duoc, n.ly_do_khong_ap_dung
      FROM nguong_ap_dung_duoc(p_stage, v_nganh, v_dinh_ky) n
     ORDER BY n.category, n.metric_code
  LOOP
    IF NOT rec.ap_dung_duoc THEN
      v_bo_qua := v_bo_qua + 1;
      v_items := v_items || jsonb_build_object(
        'metric_code', rec.metric_code, 'name', rec.name_vi, 'category', rec.category,
        'actual', NULL, 'status', 'khong_ap_dung',
        'target', NULL,
        'note', rec.ly_do_khong_ap_dung);
      CONTINUE;
    END IF;

    SELECT k.value INTO v_actual FROM kpi_metrics k
     WHERE k.tenant_id = p_tenant AND k.metric_code = rec.metric_code
     ORDER BY k.captured_at DESC LIMIT 1;

    IF v_actual IS NULL THEN
      -- Thiếu số đo KHÔNG tính là trượt, nhưng cũng không tính là đạt: để
      -- ngoài mẫu số và nói rõ là còn thiếu dữ liệu.
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
    'nganh', v_nganh,
    'co_doanh_thu_dinh_ky', v_dinh_ky,
    'passed', v_pass, 'measured', v_total,
    'bo_qua_vi_khong_ap_dung', v_bo_qua,
    'score_pct', CASE WHEN v_total > 0 THEN round(v_pass::numeric / v_total * 100, 0) ELSE 0 END,
    'ghi_chu', CASE
      WHEN v_total = 0 THEN 'Chưa đo được chỉ số nào — điểm 0 là do THIẾU DỮ LIỆU, không phải do yếu.'
      WHEN v_bo_qua > 0 THEN format('%s chỉ số bị bỏ qua vì không hợp mô hình kinh doanh của doanh nghiệp này. Chấm bằng thước của ngành khác còn tệ hơn không chấm.', v_bo_qua)
      ELSE 'Chấm theo chuẩn hợp với ngành và mô hình doanh thu.' END,
    'items', v_items);
END;
$$;
GRANT EXECUTE ON FUNCTION grade_vs_benchmark(uuid, text) TO authenticated, service_role;
