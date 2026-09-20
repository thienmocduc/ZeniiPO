-- ============================================================================
-- 039 — DẤU VẾT PHÊ DUYỆT: ai duyệt, lúc nào, và duyệt ĐÚNG nội dung nào
--
-- BỐI CẢNH ĐO ĐƯỢC. Rà toàn bộ 78 bảng: chỉ đúng MỘT bảng (`data_room_docs`)
-- có cột `approved_by`/`approved_at`. Ba thứ nặng nhất thì không có gì:
--   · `valuation_runs` chỉ có `created_by` — người chạy mô hình cũng là người
--     duy nhất đứng sau con số. Định giá là số đi vào tài liệu chào bán; không
--     có người thứ hai ký thì không ai chịu trách nhiệm ngoài người tự tính.
--   · `plan_versions` có `published_by` — người BẤM nút, không phải người
--     DUYỆT. Hai vai khác nhau.
--   · `cap_table_snapshots` đã có chuỗi băm `prev_hash`/`row_hash` (tốt, bất
--     biến) nhưng không ai ký.
--
-- CHUẨN ÁP DỤNG. Kiểm soát nội bộ (SOX 404, và thông lệ kiểm toán VN) đòi
-- TÁCH VAI người lập và người duyệt. Một người vừa lập vừa duyệt thì chữ ký
-- đó không có giá trị kiểm soát nào.
--
-- ── ĐIỂM CỐT LÕI: PHÊ DUYỆT GẮN VÀO NỘI DUNG, KHÔNG GẮN VÀO CÁI TÊN ──
-- Ghi "đã duyệt" lên một dòng rồi cho phép sửa dòng đó là tạo ra thứ tệ hơn
-- không duyệt: chữ ký thật nằm trên nội dung đã khác. Nên bảng này lưu BĂM
-- NỘI DUNG tại đúng thời điểm ký. Nội dung đổi một chữ thì băm khác đi và
-- phê duyệt cũ KHÔNG còn khớp — tự mất hiệu lực, không cần ai nhớ đi thu hồi.
--
-- Vì sao MỘT bảng chung thay vì thêm cột vào từng bảng: dấu vết phê duyệt là
-- bằng chứng kiểm toán, phải CHỈ THÊM, không sửa không xoá. Gắn thành cột
-- trên bảng nghiệp vụ thì mỗi lần sửa bản ghi là ghi đè mất lịch sử ký.
-- ============================================================================

CREATE TABLE IF NOT EXISTS phe_duyet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  doi_tuong text NOT NULL CHECK (doi_tuong IN
    ('valuation_run','plan_version','cap_table_snapshot','board_resolution')),
  doi_tuong_id uuid NOT NULL,
  /** Băm nội dung TẠI LÚC KÝ. Nội dung đổi ⇒ không khớp ⇒ hết hiệu lực. */
  noi_dung_hash text NOT NULL CHECK (length(noi_dung_hash) = 64),
  /** Người lập ra đối tượng — chép lại để chốt việc tách vai ngay tại đây. */
  nguoi_soan uuid REFERENCES auth.users(id),
  nguoi_duyet uuid REFERENCES auth.users(id) NOT NULL,
  duyet_luc timestamptz NOT NULL DEFAULT now(),
  ghi_chu text,
  -- TÁCH VAI: người lập KHÔNG được tự duyệt.
  CONSTRAINT nguoi_soan_khong_tu_duyet CHECK (nguoi_soan IS NULL OR nguoi_soan <> nguoi_duyet),
  -- Một nội dung chỉ cần ký một lần.
  UNIQUE (doi_tuong, doi_tuong_id, noi_dung_hash)
);
CREATE INDEX IF NOT EXISTS idx_phe_duyet_tra_cuu ON phe_duyet (doi_tuong, doi_tuong_id);

COMMENT ON TABLE phe_duyet IS
  'Dấu vết phê duyệt, CHỈ THÊM. Phê duyệt gắn với băm nội dung nên nội dung đổi là tự hết hiệu lực.';

-- ── CHỈ THÊM: cấm sửa, cấm xoá, kể cả từ ứng dụng ──
-- Cùng khuôn với `plan_targets` (029): bằng chứng kiểm toán mà sửa được thì
-- không còn là bằng chứng.
CREATE OR REPLACE FUNCTION chan_sua_phe_duyet() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Dấu vết phê duyệt chỉ được THÊM. Duyệt nhầm thì ký một bản ghi mới, không xoá dấu cũ.';
END $$;
DROP TRIGGER IF EXISTS trg_phe_duyet_chi_them ON phe_duyet;
CREATE TRIGGER trg_phe_duyet_chi_them BEFORE UPDATE OR DELETE ON phe_duyet
  FOR EACH ROW EXECUTE FUNCTION chan_sua_phe_duyet();

ALTER TABLE phe_duyet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS super_admin_bypass ON phe_duyet;
CREATE POLICY super_admin_bypass ON phe_duyet FOR ALL
  USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON phe_duyet;
CREATE POLICY tenant_isolation ON phe_duyet FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT ON phe_duyet TO authenticated;
GRANT ALL ON phe_duyet TO service_role;

-- ── Băm nội dung của từng loại đối tượng ──
-- Chỉ băm những trường LÀM NÊN kết luận. Cố tình BỎ QUA `created_at` và các
-- cột kỹ thuật: thêm chúng vào thì mỗi lần đụng bản ghi là băm đổi, phê duyệt
-- rụng oan và người dùng sẽ mất niềm tin vào cơ chế này.
CREATE OR REPLACE FUNCTION bam_noi_dung(p_doi_tuong text, p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_txt text;
BEGIN
  IF p_doi_tuong = 'valuation_run' THEN
    SELECT concat_ws('|', method, inputs::text, result::text,
                     enterprise_value_usd::text, equity_value_usd::text)
      INTO v_txt FROM valuation_runs WHERE id = p_id;
  ELSIF p_doi_tuong = 'plan_version' THEN
    -- Gồm cả chỉ tiêu đã sinh: duyệt bản kế hoạch là duyệt những con số CAM KẾT.
    SELECT concat_ws('|', v.version_no::text, v.name, v.horizon_months::text,
                     v.start_period::text, v.status,
                     (SELECT coalesce(string_agg(t.period::text||':'||t.coa_line||':'||t.amount::text, ',' ORDER BY t.period, t.coa_line), '')
                        FROM plan_targets t WHERE t.plan_version_id = v.id))
      INTO v_txt FROM plan_versions v WHERE v.id = p_id;
  ELSIF p_doi_tuong = 'cap_table_snapshot' THEN
    -- Bảng này đã tự giữ chuỗi băm; dùng lại chứ không băm chồng lên.
    SELECT row_hash INTO v_txt FROM cap_table_snapshots WHERE id = p_id;
    RETURN v_txt;
  ELSIF p_doi_tuong = 'board_resolution' THEN
    SELECT concat_ws('|', resolution_no, title, body, meeting_date::text,
                     votes_for::text, votes_against::text, votes_abstain::text)
      INTO v_txt FROM board_resolutions WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Loại đối tượng không hỗ trợ: %', p_doi_tuong;
  END IF;

  IF v_txt IS NULL THEN
    RETURN NULL;   -- không tìm thấy đối tượng
  END IF;
  RETURN encode(sha256(convert_to(v_txt, 'UTF8')), 'hex');
END $$;

COMMENT ON FUNCTION bam_noi_dung(text, uuid) IS
  'Băm phần nội dung làm nên kết luận. Bỏ qua cột kỹ thuật để phê duyệt không rụng oan.';

-- ── Đối tượng này có phê duyệt CÒN HIỆU LỰC không? ──
CREATE OR REPLACE FUNCTION da_duyet(p_doi_tuong text, p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM phe_duyet p
     WHERE p.doi_tuong = p_doi_tuong
       AND p.doi_tuong_id = p_id
       -- Khớp băm HIỆN TẠI: sửa nội dung sau khi ký thì câu này thành sai.
       AND p.noi_dung_hash = bam_noi_dung(p_doi_tuong, p_id)
  )
$$;
COMMENT ON FUNCTION da_duyet(text, uuid) IS
  'True chỉ khi có chữ ký khớp với nội dung HIỆN TẠI. Sửa sau khi ký ⇒ về false.';

REVOKE ALL ON FUNCTION bam_noi_dung(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION da_duyet(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bam_noi_dung(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION da_duyet(text, uuid) TO authenticated;
