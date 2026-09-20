-- ============================================================================
-- 043 — NHÃN NGUỒN cho ba thứ AI có thể soạn hộ: BMC · sơ đồ tổ chức · lộ trình
--
-- BỐI CẢNH. Ba bảng thiết lập nền móng của một doanh nghiệp trên ZeniIPO đều
-- đang RỖNG và đều KHÔNG có cách nào phân biệt "người viết" với "máy soạn":
--     canvas_blocks    (9 khối mô hình kinh doanh) — 0 dòng
--     org_positions    (sơ đồ tổ chức)            — 0 dòng
--     masterplan_years (lộ trình tài chính)       — 0 dòng
--
-- Sắp tới AI sẽ soạn bản nháp cho cả ba (đó là chỗ tự động hoá được nhiều
-- nhất). Ràng buộc kiến trúc #5 của masterspec đòi MỌI SỐ KÈM NHÃN NGUỒN —
-- và ở đây nhãn đó không phải chuyện hình thức:
--
--   · Nhà đầu tư đọc mô hình kinh doanh sẽ hỏi "ai nghĩ ra cái này". Một bản
--     BMC do máy soạn mà người sáng lập chưa từng đọc lại thì không bảo vệ
--     được trong phòng họp — nhưng nhìn trên màn hình lại giống hệt bản do
--     người viết.
--   · Và khi người dùng đã sửa một khối, lần soạn tự động sau KHÔNG được đè
--     lên. Nhãn này chính là thứ để biết khối nào được phép đè.
--
-- Ba trạng thái:
--     'nguoi'    — người viết hoặc đã sửa tay. KHÔNG bao giờ bị AI đè.
--     'ai'       — máy soạn, người CHƯA xem lại. Giao diện hiện cảnh báo.
--     'ai_duyet' — máy soạn, người đã đọc và giữ lại. Người chịu trách nhiệm.
--
-- ⚠ VIẾT TƯỜNG MINH TỪNG CÂU LỆNH, đừng gom vào vòng lặp `EXECUTE format()`.
-- Bản đầu của tệp này dùng vòng lặp cho gọn, và bộ canh lệch lược đồ
-- (`schema-khop-ma.test.ts`) lập tức báo 6 cột "không tồn tại" — vì nó đọc
-- migration bằng văn bản, mà tên bảng khi đó là biến. Lược đồ phải MÁY ĐỌC
-- ĐƯỢC thì mới canh được; gọn mắt người mà mù mắt máy là đánh đổi sai.
-- ============================================================================

-- ── canvas_blocks ──
ALTER TABLE canvas_blocks ADD COLUMN IF NOT EXISTS nguon text NOT NULL DEFAULT 'nguoi';
ALTER TABLE canvas_blocks ADD COLUMN IF NOT EXISTS ai_model text;
ALTER TABLE canvas_blocks ADD COLUMN IF NOT EXISTS ai_luc timestamptz;
ALTER TABLE canvas_blocks ADD COLUMN IF NOT EXISTS nguoi_sua uuid;

-- ── org_positions ──
ALTER TABLE org_positions ADD COLUMN IF NOT EXISTS nguon text NOT NULL DEFAULT 'nguoi';
ALTER TABLE org_positions ADD COLUMN IF NOT EXISTS ai_model text;
ALTER TABLE org_positions ADD COLUMN IF NOT EXISTS ai_luc timestamptz;
ALTER TABLE org_positions ADD COLUMN IF NOT EXISTS nguoi_sua uuid;

-- ── masterplan_years ──
ALTER TABLE masterplan_years ADD COLUMN IF NOT EXISTS nguon text NOT NULL DEFAULT 'nguoi';
ALTER TABLE masterplan_years ADD COLUMN IF NOT EXISTS ai_model text;
ALTER TABLE masterplan_years ADD COLUMN IF NOT EXISTS ai_luc timestamptz;
ALTER TABLE masterplan_years ADD COLUMN IF NOT EXISTS nguoi_sua uuid;

-- Ràng buộc: giá trị hợp lệ, và đã khai là máy soạn thì PHẢI nói rõ máy nào,
-- lúc nào. Thiếu hai thứ đó thì nhãn 'ai' không truy được về đâu — nhãn trang trí.
DO $$ BEGIN
  ALTER TABLE canvas_blocks ADD CONSTRAINT canvas_blocks_nguon_hop_le
    CHECK (nguon IN ('nguoi','ai','ai_duyet'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE canvas_blocks ADD CONSTRAINT canvas_blocks_ai_phai_co_dau_vet
    CHECK (nguon = 'nguoi' OR (ai_model IS NOT NULL AND ai_luc IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE org_positions ADD CONSTRAINT org_positions_nguon_hop_le
    CHECK (nguon IN ('nguoi','ai','ai_duyet'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE org_positions ADD CONSTRAINT org_positions_ai_phai_co_dau_vet
    CHECK (nguon = 'nguoi' OR (ai_model IS NOT NULL AND ai_luc IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE masterplan_years ADD CONSTRAINT masterplan_years_nguon_hop_le
    CHECK (nguon IN ('nguoi','ai','ai_duyet'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE masterplan_years ADD CONSTRAINT masterplan_years_ai_phai_co_dau_vet
    CHECK (nguon = 'nguoi' OR (ai_model IS NOT NULL AND ai_luc IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN canvas_blocks.nguon IS
  'nguoi = người viết/đã sửa (AI KHÔNG được đè) · ai = máy soạn chưa ai xem lại · ai_duyet = máy soạn, người đã giữ lại.';
COMMENT ON COLUMN org_positions.nguon IS
  'Cùng quy ước với canvas_blocks.nguon.';
COMMENT ON COLUMN masterplan_years.nguon IS
  'Cùng quy ước với canvas_blocks.nguon.';

-- ── Mô hình kinh doanh đã đủ để qua cổng bước 1 chưa ──
-- Bước 1 trong `journey_phase_specs` có cổng `canvas_5_blocks`. Đặt phép đếm
-- ở CSDL để giao diện, API và bộ chấm hành trình dùng CHUNG một định nghĩa —
-- ba nơi tự đếm theo ba kiểu là chuyện đã xảy ra ở chỗ khác rồi.
CREATE OR REPLACE FUNCTION do_day_canvas(p_tenant uuid)
RETURNS TABLE (so_khoi_co_noi_dung int, tong_khoi int, so_khoi_may_soan int, dat_cong_buoc_1 boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    count(*) FILTER (WHERE jsonb_array_length(coalesce(c.items,'[]'::jsonb)) > 0)::int,
    9,   -- mô hình kinh doanh luôn có đúng 9 khối
    count(*) FILTER (WHERE c.nguon = 'ai')::int,
    count(*) FILTER (WHERE jsonb_array_length(coalesce(c.items,'[]'::jsonb)) > 0) >= 5
  FROM canvas_blocks c
  WHERE c.tenant_id = p_tenant
$$;
COMMENT ON FUNCTION do_day_canvas(uuid) IS
  'Đếm khối BMC có nội dung. Cổng bước 1 (canvas_5_blocks) cần ≥5 khối. Một định nghĩa dùng chung cho mọi nơi.';
