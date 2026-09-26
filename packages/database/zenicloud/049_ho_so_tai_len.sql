-- ============================================================================
-- 049 — TẢI HỒ SƠ LÊN: bịt chỗ khiến cả chuỗi bằng chứng không bao giờ chạy
--
-- PHÁT HIỆN 26/09/2026. Quét toàn bộ `apps/web/src`: **không một route nào GHI
-- vào `data_room_docs`** — tất cả chỉ SELECT. Bảng có 0 dòng và không có đường
-- nào để có dòng.
--
-- Hệ quả rộng hơn nhiều so với "chưa tải được tệp":
--   · `ipo_readiness_criteria.evidence_file_id` trỏ vào `data_room_docs`, và
--     migration 038 chỉ tính điểm cho tiêu chí CÓ hồ sơ đính kèm. Không có
--     đường tải lên ⇒ **điểm đã xác minh không bao giờ vượt được 0**, mãi mãi.
--   · Bốn tiêu chí quản trị (≥3 thành viên độc lập · uỷ ban kiểm toán · quy chế
--     quản trị · quy chế giao dịch nội bộ) không có cách nào chứng minh.
--   · `board_minutes.doc_id` (bản quét biên bản có chữ ký) không dùng được.
--
-- ── HAI NƠI GIỮ BYTE, GHI RÕ NƠI NÀO ──────────────────────────────────────
-- Chính: ZeniCloud Lớp 02 — `POST /api/v1/storage/buckets/{bucket}/objects`.
-- Dự phòng: chính CSDL Postgres của ZeniCloud (bảng dưới đây), dùng khi biến
-- môi trường lưu trữ chưa được nạp. Cả hai đều nằm trong hạ tầng ZeniCloud,
-- KHÔNG có nền tảng thứ ba nào.
--
-- `storage_path` mang tiền tố cho biết byte nằm ở đâu:
--     zenicloud://<bucket>/<key>     · csdl://blob/<doc_id>
-- Không ghi rõ thì sau này không ai biết tệp thật sự ở đâu, và đó là kiểu nợ
-- khó trả nhất.
--
-- ── BĂM TỆP LÀ BẮT BUỘC VỚI HỒ SƠ BẰNG CHỨNG ──────────────────────────────
-- `board_minutes.content_hash` băm phần VĂN BẢN. Bản quét có chữ ký cần băm
-- riêng của chính nó, nếu không thì không chứng minh được tệp chưa bị thay sau
-- khi ký — mà tráo tệp là cách gian lận đơn giản nhất với hồ sơ thẩm định.
-- ============================================================================

-- ── 1 · CỘT BỔ SUNG CHO data_room_docs ────────────────────────────────────
ALTER TABLE data_room_docs ADD COLUMN IF NOT EXISTS sha256 text;
ALTER TABLE data_room_docs DROP CONSTRAINT IF EXISTS data_room_docs_sha256_check;
ALTER TABLE data_room_docs ADD CONSTRAINT data_room_docs_sha256_check
  CHECK (sha256 IS NULL OR length(sha256) = 64);
COMMENT ON COLUMN data_room_docs.sha256 IS
  'Băm SHA-256 của chính tệp. Thiếu nó thì không chứng minh được bản quét chưa bị tráo sau khi ký.';

ALTER TABLE data_room_docs ADD COLUMN IF NOT EXISTS uploaded_by uuid;
DO $do$ BEGIN
  ALTER TABLE data_room_docs ADD CONSTRAINT data_room_docs_uploaded_by_fk
    FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

ALTER TABLE data_room_docs ADD COLUMN IF NOT EXISTS nha_cung_cap text;
ALTER TABLE data_room_docs DROP CONSTRAINT IF EXISTS data_room_docs_nha_cung_cap_check;
ALTER TABLE data_room_docs ADD CONSTRAINT data_room_docs_nha_cung_cap_check
  CHECK (nha_cung_cap IS NULL OR nha_cung_cap IN ('zenicloud', 'csdl'));
COMMENT ON COLUMN data_room_docs.nha_cung_cap IS
  'Byte của tệp nằm ở đâu: zenicloud (Lớp 02 storage) hoặc csdl (bảng data_room_blobs). Cả hai đều là hạ tầng ZeniCloud.';

ALTER TABLE data_room_docs ADD COLUMN IF NOT EXISTS ten_tep_goc text;
COMMENT ON COLUMN data_room_docs.ten_tep_goc IS
  'Tên tệp người dùng đặt. Chỉ để hiển thị — KHÔNG bao giờ dùng làm đường dẫn lưu trữ, vì tên tệp là dữ liệu do người ngoài đặt.';

-- ── 2 · BẢNG BYTE DỰ PHÒNG ────────────────────────────────────────────────
-- Tách bảng riêng chứ không thêm cột bytea vào `data_room_docs`: mọi truy vấn
-- danh sách hồ sơ sẽ phải đọc qua cả nội dung tệp nếu để cùng bảng, và Postgres
-- không cho bỏ cột lớn ra khỏi kế hoạch đọc một cách chắc chắn.
CREATE TABLE IF NOT EXISTS data_room_blobs (
  doc_id uuid PRIMARY KEY REFERENCES data_room_docs(id) ON DELETE CASCADE,
  noi_dung bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE data_room_blobs IS
  'Byte tệp giữ tạm trong CSDL khi lớp lưu trữ ZeniCloud chưa được nạp khoá. Có hạn mức kích thước ở tầng ứng dụng.';

ALTER TABLE data_room_blobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS drb_tenant ON data_room_blobs;
-- Cách ly qua bảng cha: bảng này không có `tenant_id` riêng để không có hai
-- nguồn sự thật về chủ sở hữu tệp.
CREATE POLICY drb_tenant ON data_room_blobs USING (
  EXISTS (
    SELECT 1 FROM data_room_docs d
     WHERE d.id = doc_id
       AND (is_chairman_super() OR d.tenant_id IN (SELECT id FROM list_accessible_tenants()))
  )
);
GRANT SELECT, INSERT, DELETE ON data_room_blobs TO authenticated;

-- ── 3 · ĐẾM HỒ SƠ THEO NHÀ CUNG CẤP — để biết còn bao nhiêu tệp nằm tạm ───
CREATE OR REPLACE FUNCTION thong_ke_ho_so(p_tenant uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $fn$
  SELECT jsonb_build_object(
    'tong', count(*),
    'tren_zenicloud', count(*) FILTER (WHERE nha_cung_cap = 'zenicloud'),
    'giu_tam_trong_csdl', count(*) FILTER (WHERE nha_cung_cap = 'csdl'),
    'khong_ro_noi_luu', count(*) FILTER (WHERE nha_cung_cap IS NULL),
    'thieu_bam', count(*) FILTER (WHERE sha256 IS NULL),
    'tong_byte', COALESCE(sum(file_size_bytes), 0)
  )
  FROM data_room_docs WHERE tenant_id = p_tenant
$fn$;
COMMENT ON FUNCTION thong_ke_ho_so(uuid) IS
  'Bao nhiêu tệp còn nằm tạm trong CSDL — con số này phải về 0 sau khi lớp lưu trữ ZeniCloud được nạp khoá.';
GRANT EXECUTE ON FUNCTION thong_ke_ho_so(uuid) TO authenticated;
