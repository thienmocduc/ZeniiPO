-- ============================================================================
-- 042 — ĐỊNH GIÁ ĐỌC LẠI ĐƯỢC, VÀ ĐỌC KÈM TRẠNG THÁI PHÊ DUYỆT
--
-- BỐI CẢNH. `/api/valuation/run` ghi kết quả vào `valuation_runs`, nhưng rà
-- toàn bộ mã: KHÔNG route nào đọc bảng đó ra. `/api/valuation` chỉ trả hành
-- trình, lịch sử cổ phần và bộ so sánh. Nghĩa là mỗi lần chạy định giá xong,
-- con số rơi vào bảng rồi không ai nhìn thấy lại — muốn xem phải vào CSDL.
--
-- Và migration 039 đã dựng dấu vết phê duyệt nhưng chưa có đường nào phơi ra,
-- nên người dùng không biết một lần định giá đã có người thứ hai ký hay chưa.
-- Cơ chế kiểm soát mà không ai thấy thì không kiểm soát được gì.
--
-- View này trả lời cả hai trong một lần đọc, và phân biệt ba trạng thái khác
-- nhau về bản chất:
--   · chua_duyet     — chưa ai ký. Số này CHƯA dùng được cho tài liệu chính thức.
--   · het_hieu_luc   — đã ký nhưng NỘI DUNG ĐÃ ĐỔI sau đó ⇒ chữ ký cũ không còn
--                      khớp. Nguy hiểm nhất, vì nhìn qua tưởng đã duyệt.
--   · da_duyet       — đã ký và nội dung vẫn nguyên như lúc ký.
-- ============================================================================

CREATE OR REPLACE VIEW dinh_gia_kem_phe_duyet AS
SELECT
  v.id,
  v.tenant_id,
  v.method,
  v.enterprise_value_usd,
  v.equity_value_usd,
  v.inputs,
  v.result,
  v.created_by                              AS nguoi_chay,
  v.created_at                              AS chay_luc,
  da_duyet('valuation_run', v.id)           AS con_hieu_luc,
  p.nguoi_duyet,
  p.duyet_luc,
  p.ghi_chu                                 AS ghi_chu_duyet,
  CASE
    WHEN p.id IS NULL                          THEN 'chua_duyet'
    WHEN da_duyet('valuation_run', v.id)       THEN 'da_duyet'
    ELSE 'het_hieu_luc'
  END                                       AS trang_thai_duyet,
  CASE
    WHEN p.id IS NULL
      THEN 'Chưa ai duyệt. Con số này chưa dùng được cho tài liệu chính thức.'
    WHEN da_duyet('valuation_run', v.id)
      THEN 'Đã duyệt và nội dung vẫn nguyên như lúc ký.'
    ELSE 'ĐÃ TỪNG được duyệt nhưng nội dung đổi sau đó — chữ ký cũ không còn hiệu lực. Cần duyệt lại.'
  END                                       AS giai_thich
FROM valuation_runs v
LEFT JOIN LATERAL (
  SELECT ph.id, ph.nguoi_duyet, ph.duyet_luc, ph.ghi_chu
    FROM phe_duyet ph
   WHERE ph.doi_tuong = 'valuation_run' AND ph.doi_tuong_id = v.id
   ORDER BY ph.duyet_luc DESC
   LIMIT 1
) p ON true;

COMMENT ON VIEW dinh_gia_kem_phe_duyet IS
  'Định giá kèm trạng thái phê duyệt. Tách riêng "hết hiệu lực" khỏi "chưa duyệt" — nhìn qua giống nhau nhưng khác hẳn về rủi ro.';

-- View kế thừa RLS của `valuation_runs` bên dưới (security_invoker), nên không
-- mở thêm cửa nào: người dùng chỉ thấy định giá của doanh nghiệp mình.
ALTER VIEW dinh_gia_kem_phe_duyet SET (security_invoker = true);
GRANT SELECT ON dinh_gia_kem_phe_duyet TO authenticated;
