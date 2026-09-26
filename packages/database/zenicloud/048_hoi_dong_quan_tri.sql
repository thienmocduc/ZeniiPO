-- ============================================================================
-- 048 — HỘI ĐỒNG QUẢN TRỊ: thành viên · uỷ ban · kỳ họp · túc số · biên bản
--       · nghị quyết có hiệu lực · sổ phân phối xuống phòng ban
--
-- VÌ SAO CẦN. Điểm sẵn sàng niêm yết ĐANG CHẤM bốn tiêu chí quản trị —
-- `board_composition` (≥3 thành viên độc lập) · `audit_committee` ·
-- `governance_manual` · `insider_trading_policy` — nhưng trong 86 bảng không có
-- bảng nào lưu thành viên, uỷ ban, kỳ họp, điểm danh hay biên bản. Chỉ có
-- `board_resolutions` (đầu ra) và `data_room_docs` (kho tệp). Hệ quả: muốn
-- chứng minh "có 3 thành viên độc lập" chỉ còn cách tải lên một tệp PDF rồi
-- tin nhau. Đó là LỜI KHAI, trái với chính nguyên tắc của nền tảng.
--
-- ── ĐIỀU QUAN TRỌNG NHẤT: TÚC SỐ DO MÁY TÍNH ──────────────────────────────
-- Nghị quyết thiếu túc số là VÔ HIỆU. Một ô tích "đã đủ túc số" là lời khai và
-- vô giá trị khi thẩm định. Ở đây túc số tính từ bảng điểm danh thật
-- (`board_attendance`), và `chot_nghi_quyet()` TỪ CHỐI ký khi chưa đủ. Đây là
-- chỗ phân biệt quản trị thật với quản trị diễn.
--
-- Tỷ lệ túc số do ĐIỀU LỆ công ty quyết, không do nền tảng đoán. Cột
-- `quorum_source` ghi con số ấy ở đâu ra; khi nó là `mac_dinh_he_thong` thì
-- giao diện phải cảnh báo rằng chưa ai xác nhận theo điều lệ.
--
-- ── VÁ LỖ HỔNG THẨM QUYỀN ─────────────────────────────────────────────────
-- `plan_versions` có `published_by`/`published_at` nhưng KHÔNG cột nào nối tới
-- nghị quyết nào. Nghĩa là ZeniOS không có cách biết bản kế hoạch nó phân bổ
-- đã được hội đồng duyệt hay chỉ do một người bấm "công bố". `board_resolutions
-- .plan_version_id` + khung nhìn hợp đồng `hop_dong_ke_hoach_duoc_duyet` bịt
-- lỗ này.
--
-- ── RANH GIỚI VỚI ZENIOS (không lấn sân) ──────────────────────────────────
-- ZeniIPO nói  "phòng tài chính phải đạt biên gộp 65%"   ← chỉ tiêu, ở đây
-- ZeniOS  nói  "phòng tài chính được chi 2 tỷ quý này"   ← ngân sách, KHÔNG ở đây
-- ZeniERP nói  "đã chi 1,87 tỷ, đây là chứng từ"          ← thực tế, KHÔNG ở đây
-- Sổ phân phối dưới đây giao CHỈ TIÊU và TÀI LIỆU, tuyệt đối không giao hạn
-- mức chi. Hạn mức chi là cột "phân bổ nguồn lực" của ZeniOS.
-- ============================================================================

-- ── 1 · THÀNH VIÊN HỘI ĐỒNG ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Thành viên hội đồng KHÔNG nhất thiết có tài khoản trên nền tảng: thành
  -- viên độc lập thường là người ngoài. Buộc phải có user_id là buộc doanh
  -- nghiệp tạo tài khoản giả cho họ — dữ liệu sai ngay từ gốc.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  title_vi text,
  member_type text NOT NULL
    CHECK (member_type IN ('dieu_hanh','khong_dieu_hanh','doc_lap')),
  is_chairman boolean NOT NULL DEFAULT false,
  -- Uỷ ban kiểm toán của doanh nghiệp niêm yết cần ít nhất một người đọc được
  -- báo cáo tài chính ở mức chuyên môn. Đánh dấu ở đây để đếm được.
  is_financial_expert boolean NOT NULL DEFAULT false,
  shareholding_pct numeric(7,4),
  -- Tính độc lập PHẢI có căn cứ, không được chỉ tích chọn. `dem_thanh_vien_doc_lap()`
  -- chỉ đếm thành viên có ô này khác rỗng — cùng luật "phải có bằng chứng" của 038.
  co_so_doc_lap jsonb,
  term_start date,
  term_end date,
  appointed_by_resolution_id uuid REFERENCES board_resolutions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','resigned','removed','term_ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN board_members.co_so_doc_lap IS
  'Căn cứ tính độc lập theo điều lệ và pháp luật, do bộ phận pháp chế điền. Rỗng thì KHÔNG được đếm là thành viên độc lập, dù member_type ghi doc_lap.';
CREATE INDEX IF NOT EXISTS idx_board_members_tenant ON board_members(tenant_id, status);
-- Mỗi doanh nghiệp chỉ có một chủ tịch đang tại vị.
CREATE UNIQUE INDEX IF NOT EXISTS uq_board_one_chairman
  ON board_members(tenant_id) WHERE is_chairman AND status = 'active';

-- ── 2 · UỶ BAN ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_committees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  committee_code text NOT NULL
    CHECK (committee_code IN ('audit','remuneration','nomination','risk','other')),
  name_vi text NOT NULL,
  charter_doc_id uuid REFERENCES data_room_docs(id) ON DELETE SET NULL,
  established_resolution_id uuid REFERENCES board_resolutions(id) ON DELETE SET NULL,
  established_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','dissolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_committee_per_tenant
  ON board_committees(tenant_id, committee_code) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS board_committee_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES board_committees(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  vai text NOT NULL DEFAULT 'member' CHECK (vai IN ('chair','member')),
  from_date date,
  to_date date
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_committee_member
  ON board_committee_members(committee_id, member_id) WHERE to_date IS NULL;

-- ── 3 · KỲ HỌP ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Uỷ ban cũng họp. NULL = phiên họp toàn hội đồng.
  committee_id uuid REFERENCES board_committees(id) ON DELETE SET NULL,
  meeting_no text NOT NULL,
  title text NOT NULL,
  meeting_type text NOT NULL
    CHECK (meeting_type IN ('truc_tiep','truc_tuyen','ket_hop','lay_y_kien_van_ban')),
  -- Họp trực tuyến và lấy ý kiến bằng văn bản đều là hình thức HỢP PHÁP, không
  -- phải đường tắt. Ghi đúng hình thức thì biên bản mới đúng và thẩm định viên
  -- không hỏi lại.
  location text,
  meeting_url text,
  scheduled_at timestamptz NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  -- Thời điểm gửi triệu tập: thiếu nó là thiếu bằng chứng đã thông báo đúng
  -- thời hạn, và đó là căn cứ để một nghị quyết bị kiện vô hiệu.
  notice_sent_at timestamptz,
  convened_by uuid REFERENCES board_members(id) ON DELETE SET NULL,
  chaired_by uuid REFERENCES board_members(id) ON DELETE SET NULL,
  secretary_id uuid REFERENCES board_members(id) ON DELETE SET NULL,
  agenda jsonb NOT NULL DEFAULT '[]'::jsonb,
  quorum_required_pct numeric(5,2) NOT NULL DEFAULT 75,
  quorum_source text NOT NULL DEFAULT 'mac_dinh_he_thong'
    CHECK (quorum_source IN ('dieu_le','luat','mac_dinh_he_thong')),
  status text NOT NULL DEFAULT 'du_kien'
    CHECK (status IN ('du_kien','da_trieu_tap','dang_hop','da_hop','huy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN board_meetings.quorum_required_pct IS
  'Tỷ lệ dự họp tối thiểu. ĐIỀU LỆ công ty quyết con số này, nền tảng không được đoán. Mặc định 75 phản ánh thông lệ 3/4 cho HĐQT ở Việt Nam nhưng PHẢI được xác nhận — xem quorum_source.';
COMMENT ON COLUMN board_meetings.quorum_source IS
  'Con số túc số ở đâu ra. mac_dinh_he_thong = chưa ai xác nhận theo điều lệ, giao diện phải cảnh báo.';
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_no ON board_meetings(tenant_id, meeting_no);
CREATE INDEX IF NOT EXISTS idx_meetings_tenant ON board_meetings(tenant_id, scheduled_at DESC);

-- ── 4 · ĐIỂM DANH — nền của túc số ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES board_meetings(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  attendance text NOT NULL
    CHECK (attendance IN ('co_mat','truc_tuyen','uy_quyen','vang')),
  -- Uỷ quyền phải chỉ rõ uỷ cho ai, nếu không thì không kiểm được một người
  -- có nhận quá nhiều uỷ quyền đến mức vô hiệu hay không.
  proxy_to_member_id uuid REFERENCES board_members(id) ON DELETE SET NULL,
  joined_at timestamptz,
  left_at timestamptz,
  ghi_chu text,
  CONSTRAINT uy_quyen_phai_co_nguoi_nhan
    CHECK (attendance <> 'uy_quyen' OR proxy_to_member_id IS NOT NULL),
  CONSTRAINT khong_tu_uy_quyen_cho_minh
    CHECK (proxy_to_member_id IS NULL OR proxy_to_member_id <> member_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance ON board_attendance(meeting_id, member_id);

-- ── 5 · BIÊN BẢN ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES board_meetings(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  body_md text,
  -- Bản quét có chữ ký. Biên bản gõ trên máy không thay được bản ký.
  doc_id uuid REFERENCES data_room_docs(id) ON DELETE SET NULL,
  content_hash text,
  -- Nhãn nguồn: AI soạn nháp được, nhưng phải nói rõ là nháp AI.
  nguon text NOT NULL DEFAULT 'nguoi_soan'
    CHECK (nguon IN ('nguoi_soan','ai_de_xuat')),
  ai_model text,
  drafted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nhap_ai_phai_ghi_mo_hinh
    CHECK (nguon <> 'ai_de_xuat' OR ai_model IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_minutes_version ON board_minutes(meeting_id, version);

-- ── 6 · PHIẾU BIỂU QUYẾT — để votes_* thành số DẪN RA, không phải số gõ tay ─
CREATE TABLE IF NOT EXISTS board_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id uuid NOT NULL REFERENCES board_resolutions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  vote text NOT NULL
    CHECK (vote IN ('tan_thanh','khong_tan_thanh','khong_y_kien','khong_bieu_quyet')),
  -- Thành viên có xung đột lợi ích phải không biểu quyết, và phải ghi lý do.
  ly_do_khong_bieu_quyet text,
  voted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT khong_bieu_quyet_phai_co_ly_do
    CHECK (vote <> 'khong_bieu_quyet' OR ly_do_khong_bieu_quyet IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vote ON board_votes(resolution_id, member_id);

-- ── 7 · NỐI NGHỊ QUYẾT VÀO KỲ HỌP, MỤC TIÊU VÀ BẢN KẾ HOẠCH ───────────────
ALTER TABLE board_resolutions ADD COLUMN IF NOT EXISTS meeting_id uuid;
ALTER TABLE board_resolutions ADD COLUMN IF NOT EXISTS plan_version_id uuid;
ALTER TABLE board_resolutions ADD COLUMN IF NOT EXISTS minutes_id uuid;
ALTER TABLE board_resolutions ADD COLUMN IF NOT EXISTS executed_at timestamptz;

DO $do$ BEGIN
  ALTER TABLE board_resolutions ADD CONSTRAINT board_res_meeting_fk
    FOREIGN KEY (meeting_id) REFERENCES board_meetings(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN
  ALTER TABLE board_resolutions ADD CONSTRAINT board_res_plan_fk
    FOREIGN KEY (plan_version_id) REFERENCES plan_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN
  ALTER TABLE board_resolutions ADD CONSTRAINT board_res_minutes_fk
    FOREIGN KEY (minutes_id) REFERENCES board_minutes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ── 8 · SỔ PHÂN PHỐI — chủ tịch/CEO soi được đã giao tới đâu ───────────────
CREATE TABLE IF NOT EXISTS resolution_distribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resolution_id uuid NOT NULL REFERENCES board_resolutions(id) ON DELETE CASCADE,
  -- Giao theo CHỨC DANH, không theo người: người nghỉ thì việc vẫn thuộc ghế đó.
  position_code text REFERENCES position_templates(template_code) ON DELETE SET NULL,
  objective_id uuid REFERENCES okr_objectives(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'da_giao'
    CHECK (status IN ('da_giao','da_xac_nhan','chua_co_nguoi')),
  ghi_chu text
);
COMMENT ON TABLE resolution_distribution IS
  'Sổ giao nghị quyết xuống từng ghế. Không có sổ này thì câu "đã phân xuống phòng ban" cũng chỉ là lời khai. Giao CHỈ TIÊU và TÀI LIỆU — hạn mức chi thuộc ZeniOS.';
CREATE UNIQUE INDEX IF NOT EXISTS uq_distribution
  ON resolution_distribution(resolution_id, position_code);
CREATE INDEX IF NOT EXISTS idx_distribution_res ON resolution_distribution(resolution_id);

-- ── 9 · RLS — cùng khuôn với toàn hệ thống ────────────────────────────────
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['board_members','board_committees','board_meetings',
                           'board_minutes','resolution_distribution'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant', t);
    EXECUTE format($p$CREATE POLICY %I ON %I USING (
        is_chairman_super() OR tenant_id IN (SELECT id FROM list_accessible_tenants()))$p$,
      t||'_tenant', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
  END LOOP;
END $do$;

-- Ba bảng con không có tenant_id: cách ly qua bảng cha.
ALTER TABLE board_committee_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bcm_tenant ON board_committee_members;
CREATE POLICY bcm_tenant ON board_committee_members USING (
  EXISTS (SELECT 1 FROM board_committees c WHERE c.id = committee_id
           AND (is_chairman_super() OR c.tenant_id IN (SELECT id FROM list_accessible_tenants()))));
GRANT SELECT, INSERT, UPDATE, DELETE ON board_committee_members TO authenticated;

ALTER TABLE board_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ba_tenant ON board_attendance;
CREATE POLICY ba_tenant ON board_attendance USING (
  EXISTS (SELECT 1 FROM board_meetings m WHERE m.id = meeting_id
           AND (is_chairman_super() OR m.tenant_id IN (SELECT id FROM list_accessible_tenants()))));
GRANT SELECT, INSERT, UPDATE, DELETE ON board_attendance TO authenticated;

ALTER TABLE board_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bv_tenant ON board_votes;
CREATE POLICY bv_tenant ON board_votes USING (
  EXISTS (SELECT 1 FROM board_resolutions r WHERE r.id = resolution_id
           AND (is_chairman_super() OR r.tenant_id IN (SELECT id FROM list_accessible_tenants()))));
GRANT SELECT, INSERT, UPDATE, DELETE ON board_votes TO authenticated;

-- ── 10 · TÚC SỐ — tính từ điểm danh, không nhận lời khai ──────────────────
CREATE OR REPLACE FUNCTION tinh_tuc_so(p_meeting_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $fn$
DECLARE
  v_tenant uuid; v_committee uuid; v_can_pct numeric; v_nguon text;
  v_tong int; v_du int; v_pct numeric;
BEGIN
  SELECT tenant_id, committee_id, quorum_required_pct, quorum_source
    INTO v_tenant, v_committee, v_can_pct, v_nguon
    FROM board_meetings WHERE id = p_meeting_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Không tìm thấy kỳ họp %', p_meeting_id; END IF;

  IF NOT la_ngu_canh_he_thong() AND NOT is_chairman_super()
     AND v_tenant NOT IN (SELECT id FROM list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Không có quyền với doanh nghiệp này';
  END IF;

  -- Phiên uỷ ban đếm theo thành viên uỷ ban; phiên toàn hội đồng đếm theo
  -- thành viên đang tại vị.
  IF v_committee IS NULL THEN
    SELECT count(*) INTO v_tong FROM board_members
     WHERE tenant_id = v_tenant AND status = 'active';
  ELSE
    SELECT count(*) INTO v_tong FROM board_committee_members cm
      JOIN board_members m ON m.id = cm.member_id
     WHERE cm.committee_id = v_committee AND cm.to_date IS NULL AND m.status = 'active';
  END IF;

  -- Có mặt, dự trực tuyến và uỷ quyền đều tính là dự họp. Vắng không tính.
  SELECT count(*) INTO v_du FROM board_attendance a
   WHERE a.meeting_id = p_meeting_id AND a.attendance IN ('co_mat','truc_tuyen','uy_quyen');

  v_pct := CASE WHEN v_tong = 0 THEN 0 ELSE round(v_du::numeric * 100 / v_tong, 2) END;

  RETURN jsonb_build_object(
    'tong_thanh_vien', v_tong,
    'so_du_hop', v_du,
    'ty_le_du_hop', v_pct,
    'ty_le_yeu_cau', v_can_pct,
    'nguon_ty_le', v_nguon,
    'du_tuc_so', (v_tong > 0 AND v_pct >= v_can_pct),
    'canh_bao', CASE
      WHEN v_tong = 0 THEN 'Chưa khai thành viên hội đồng nào — không tính được túc số.'
      WHEN v_nguon = 'mac_dinh_he_thong' THEN 'Tỷ lệ túc số đang dùng mặc định hệ thống, CHƯA ai xác nhận theo điều lệ công ty.'
      ELSE NULL END
  );
END $fn$;
COMMENT ON FUNCTION tinh_tuc_so(uuid) IS
  'Túc số tính từ board_attendance. Không có tham số nào cho phép tự khai đã đủ túc số.';
GRANT EXECUTE ON FUNCTION tinh_tuc_so(uuid) TO authenticated;

-- ── 11 · ĐẾM THÀNH VIÊN ĐỘC LẬP — chỉ đếm người CÓ CĂN CỨ ─────────────────
CREATE OR REPLACE FUNCTION dem_thanh_vien_doc_lap(p_tenant uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $fn$
  SELECT jsonb_build_object(
    'tong_thanh_vien', count(*),
    'khai_doc_lap', count(*) FILTER (WHERE member_type = 'doc_lap'),
    'doc_lap_co_can_cu', count(*) FILTER (
       WHERE member_type = 'doc_lap' AND co_so_doc_lap IS NOT NULL
         AND co_so_doc_lap <> '{}'::jsonb AND co_so_doc_lap <> '[]'::jsonb),
    'chuyen_gia_tai_chinh', count(*) FILTER (WHERE is_financial_expert),
    'ghi_chu', 'Chỉ thành viên có co_so_doc_lap được tính là độc lập. Khai mà không có căn cứ thì thẩm định viên loại ngay.'
  )
  FROM board_members WHERE tenant_id = p_tenant AND status = 'active'
$fn$;
GRANT EXECUTE ON FUNCTION dem_thanh_vien_doc_lap(uuid) TO authenticated;

-- ── 12 · CHỐT NGHỊ QUYẾT — từ chối khi chưa đủ túc số ─────────────────────
CREATE OR REPLACE FUNCTION chot_nghi_quyet(p_resolution_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $fn$
DECLARE
  v_tenant uuid; v_meeting uuid; v_status text; v_loai text;
  v_tuc_so jsonb; v_thuan int; v_chong int; v_trang int; v_bo int; v_bam text;
BEGIN
  SELECT tenant_id, meeting_id, status, resolution_type
    INTO v_tenant, v_meeting, v_status, v_loai
    FROM board_resolutions WHERE id = p_resolution_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Không tìm thấy nghị quyết %', p_resolution_id; END IF;

  IF NOT la_ngu_canh_he_thong() AND NOT is_chairman_super()
     AND v_tenant NOT IN (SELECT id FROM list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Không có quyền với doanh nghiệp này';
  END IF;

  IF v_status IN ('approved','rejected','executed') THEN
    RAISE EXCEPTION 'Nghị quyết đã ở trạng thái % — chốt lại là sửa lịch sử', v_status;
  END IF;
  IF v_meeting IS NULL THEN
    RAISE EXCEPTION 'Nghị quyết chưa gắn kỳ họp nào — không có căn cứ túc số';
  END IF;

  -- `phe_duyet.nguoi_duyet` là NOT NULL và trỏ vào auth.users: không có phiên
  -- người dùng thì không ký được. Báo rõ thay vì để vỡ ở dòng INSERT phía dưới
  -- với thông báo khó hiểu.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Chốt nghị quyết phải do một người thực hiện — tác vụ nền không được ký thay hội đồng';
  END IF;

  v_tuc_so := tinh_tuc_so(v_meeting);
  IF NOT (v_tuc_so->>'du_tuc_so')::boolean THEN
    -- Không dùng ký tự phần trăm trong thông báo: trong RAISE thì %% là ký tự
    -- literal nên %%% luôn cho ra "%<số>" chứ không phải "<số>%" như mong đợi.
    RAISE EXCEPTION 'Chưa đủ túc số: % / % thành viên dự họp (tỷ lệ %), điều lệ cần tỷ lệ %. Nghị quyết thông qua trong tình trạng này là VÔ HIỆU.',
      v_tuc_so->>'so_du_hop', v_tuc_so->>'tong_thanh_vien',
      v_tuc_so->>'ty_le_du_hop', v_tuc_so->>'ty_le_yeu_cau';
  END IF;

  SELECT count(*) FILTER (WHERE vote='tan_thanh'),
         count(*) FILTER (WHERE vote='khong_tan_thanh'),
         count(*) FILTER (WHERE vote='khong_y_kien'),
         count(*) FILTER (WHERE vote='khong_bieu_quyet')
    INTO v_thuan, v_chong, v_trang, v_bo
    FROM board_votes WHERE resolution_id = p_resolution_id;

  IF v_thuan + v_chong + v_trang + v_bo = 0 THEN
    RAISE EXCEPTION 'Chưa có phiếu biểu quyết nào';
  END IF;

  -- Số phiếu là số DẪN RA từ bảng phiếu, không phải số ai đó gõ vào.
  UPDATE board_resolutions SET
    votes_for = v_thuan, votes_against = v_chong, votes_abstain = v_trang + v_bo,
    status = CASE WHEN v_thuan > v_chong THEN 'approved' ELSE 'rejected' END,
    updated_at = now()
  WHERE id = p_resolution_id;

  -- Gắn băm nội dung bằng hạ tầng phê duyệt đã có (039), không xây bảng mới.
  SELECT encode(digest(
    coalesce(title,'') || '|' || coalesce(body,'') || '|' || coalesce(resolution_no,'')
    || '|' || v_thuan || '/' || v_chong || '/' || (v_trang+v_bo)
    || '|' || (v_tuc_so->>'so_du_hop') || '/' || (v_tuc_so->>'tong_thanh_vien'), 'sha256'), 'hex')
    INTO v_bam FROM board_resolutions WHERE id = p_resolution_id;

  INSERT INTO phe_duyet (tenant_id, doi_tuong, doi_tuong_id, noi_dung_hash, nguoi_duyet, ghi_chu)
  VALUES (v_tenant, 'board_resolution', p_resolution_id, v_bam, auth.uid(),
          'Chốt nghị quyết · túc số ' || (v_tuc_so->>'ty_le_du_hop') || '%');

  RETURN jsonb_build_object(
    'nghi_quyet', p_resolution_id,
    'loai', v_loai,
    'tuc_so', v_tuc_so,
    'tan_thanh', v_thuan, 'khong_tan_thanh', v_chong,
    'khong_y_kien', v_trang, 'khong_bieu_quyet', v_bo,
    'ket_qua', CASE WHEN v_thuan > v_chong THEN 'approved' ELSE 'rejected' END,
    'bam_noi_dung', v_bam
  );
END $fn$;
COMMENT ON FUNCTION chot_nghi_quyet(uuid) IS
  'Chốt nghị quyết: kiểm túc số từ điểm danh thật, đếm phiếu từ bảng phiếu, gắn băm nội dung vào phe_duyet. Thiếu túc số thì NÉM LỖI, không cho qua.';
GRANT EXECUTE ON FUNCTION chot_nghi_quyet(uuid) TO authenticated;

-- ── 13 · PHÂN PHỐI NGHỊ QUYẾT XUỐNG TỪNG GHẾ ──────────────────────────────
CREATE OR REPLACE FUNCTION phan_phoi_nghi_quyet(p_resolution_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $fn$
DECLARE
  v_tenant uuid; v_status text; v_journey uuid; v_them int;
BEGIN
  SELECT tenant_id, status INTO v_tenant, v_status
    FROM board_resolutions WHERE id = p_resolution_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Không tìm thấy nghị quyết %', p_resolution_id; END IF;

  IF NOT la_ngu_canh_he_thong() AND NOT is_chairman_super()
     AND v_tenant NOT IN (SELECT id FROM list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Không có quyền với doanh nghiệp này';
  END IF;

  -- Chỉ phân phối nghị quyết ĐÃ THÔNG QUA. Giao bản nháp xuống phòng ban là
  -- cách nhanh nhất để cả công ty làm theo một quyết định chưa tồn tại.
  IF v_status NOT IN ('approved','executed') THEN
    RAISE EXCEPTION 'Nghị quyết đang ở trạng thái % — chỉ phân phối được khi đã thông qua', v_status;
  END IF;

  SELECT id INTO v_journey FROM ipo_journeys
   WHERE tenant_id = v_tenant AND status = 'active'
   ORDER BY created_at DESC LIMIT 1;

  INSERT INTO resolution_distribution
    (tenant_id, resolution_id, position_code, objective_id, assignee_id, status)
  SELECT v_tenant, p_resolution_id, o.position_code, o.id, o.owner_id,
         CASE WHEN o.owner_id IS NULL THEN 'chua_co_nguoi' ELSE 'da_giao' END
    FROM okr_objectives o
   WHERE o.journey_id = v_journey
     AND o.position_code IS NOT NULL
     AND o.position_code <> 'chairman'   -- hội đồng không tự giao cho chính mình
  ON CONFLICT (resolution_id, position_code) DO NOTHING;
  GET DIAGNOSTICS v_them = ROW_COUNT;

  UPDATE board_resolutions
     SET status = 'executed', executed_at = now(), updated_at = now()
   WHERE id = p_resolution_id AND status = 'approved';

  RETURN jsonb_build_object(
    'nghi_quyet', p_resolution_id,
    'giao_moi', v_them,
    'tong_da_giao', (SELECT count(*) FROM resolution_distribution WHERE resolution_id = p_resolution_id),
    'da_xac_nhan', (SELECT count(*) FROM resolution_distribution
                     WHERE resolution_id = p_resolution_id AND status = 'da_xac_nhan'),
    'chua_co_nguoi', (SELECT count(*) FROM resolution_distribution
                     WHERE resolution_id = p_resolution_id AND status = 'chua_co_nguoi'),
    'ghi_chu', CASE WHEN v_journey IS NULL
      THEN 'Doanh nghiệp chưa có hành trình đang chạy — chưa có cây vai nào để giao.'
      ELSE 'Giao theo ghế, không theo người: người nghỉ thì việc vẫn thuộc ghế đó.' END
  );
END $fn$;
GRANT EXECUTE ON FUNCTION phan_phoi_nghi_quyet(uuid) TO authenticated;

-- ── 14 · KHUNG NHÌN HỢP ĐỒNG — bịt lỗ hổng thẩm quyền cho ZeniOS ──────────
-- Mở rộng hợp đồng ba tầng, KHÔNG mở cửa sau: ZeniOS đọc khung nhìn này để
-- biết bản kế hoạch nào được hội đồng cho phép thực thi, thay vì đoán từ
-- `plan_versions.status`.
-- DROP rồi CREATE, không dùng CREATE OR REPLACE: lệnh thay thế không cho đổi
-- danh sách cột, nên lần chạy lại nào thêm/bớt cột cũng sẽ vỡ.
DROP VIEW IF EXISTS hop_dong_ke_hoach_duoc_duyet;
CREATE VIEW hop_dong_ke_hoach_duoc_duyet AS
SELECT
  pv.tenant_id,
  pv.id                AS plan_version_id,
  pv.version_no,
  pv.status            AS trang_thai_ban_ke_hoach,
  r.id                 AS resolution_id,
  r.resolution_no,
  r.meeting_date,
  r.status             AS trang_thai_nghi_quyet,
  r.executed_at,
  -- COALESCE là bắt buộc, không phải cho gọn. Nối ngoài không khớp thì r.status
  -- là NULL, và `NULL IN (...)` ra NULL chứ không ra FALSE — khi đó câu truy vấn
  -- `WHERE NOT duoc_phep_thuc_thi` của ZeniOS sẽ BỎ SÓT IM LẶNG đúng những bản
  -- kế hoạch chưa ai duyệt, tức là bỏ sót đúng thứ cần chặn.
  COALESCE(r.status IN ('approved','executed'), false) AS duoc_phep_thuc_thi,
  CASE
    WHEN r.id IS NULL THEN 'Chưa có nghị quyết hội đồng nào cho bản kế hoạch này'
    WHEN r.status IN ('approved','executed') THEN NULL
    ELSE 'Nghị quyết đang ở trạng thái ' || r.status || ', chưa có hiệu lực'
  END AS ly_do_chua_duoc_phep
FROM plan_versions pv
LEFT JOIN board_resolutions r ON r.plan_version_id = pv.id;
COMMENT ON VIEW hop_dong_ke_hoach_duoc_duyet IS
  'Điểm hợp đồng mở rộng: bản kế hoạch nào đã được hội đồng quản trị cho phép thực thi. duoc_phep_thuc_thi = false nghĩa là chưa có nghị quyết có hiệu lực — ZeniOS KHÔNG được phân bổ nguồn lực theo bản đó.';
GRANT SELECT ON hop_dong_ke_hoach_duoc_duyet TO authenticated;
