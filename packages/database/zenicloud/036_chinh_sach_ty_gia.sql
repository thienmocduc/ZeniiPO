-- ============================================================================
-- 036 — CHÍNH SÁCH TỶ GIÁ: đồng tiền chức năng · tỷ giá có ngày · có nguồn
--
-- BỐI CẢNH ĐO ĐƯỢC, KHÔNG PHẢI SUY ĐOÁN. Rà 78 cột số thực trong CSDL:
--   · `financial_statements` — bảng ba báo cáo cốt lõi, 11 cột tiền, KHÔNG có
--     một cột đồng tiền nào. Không ai đọc bảng đó mà biết số là VND hay USD.
--   · `fundraise_rounds`, `valuation_runs`, `cap_table_snapshots`,
--     `comparables`, `investor_pipeline` — nhét đồng tiền vào TÊN CỘT
--     (`pre_money_usd`…). Doanh nghiệp Việt gọi vốn bằng VND thì buộc phải ghi
--     VND vào cột tên USD, hoặc tự quy đổi bằng một tỷ giá không ai ghi lại.
--   · `membership_tiers` giữ song song giá USD và VND, và bốn dòng đang mang
--     BỐN tỷ giá ngầm khác nhau:
--         explorer  49$ / 1.200.000đ   → 24.490
--         pro      499$ / 12.000.000đ  → 24.048
--         elite   1999$ / 48.000.000đ  → 24.012
--         enterprise 4999$/120.000.000đ→ 24.005
--     Tức gói rẻ nhất đang bị tính đắt hơn 2% so với gói đắt nhất, chỉ vì tỷ
--     giá được gõ tay từng dòng ở những thời điểm khác nhau.
--
-- CHUẨN ÁP DỤNG. VAS 10 / IAS 21: mỗi đơn vị có MỘT đồng tiền chức năng;
-- nghiệp vụ ngoại tệ ghi theo tỷ giá giao dịch thực tế TẠI NGÀY phát sinh;
-- tỷ giá đã dùng và ngày áp dụng phải thuyết minh được.
--
-- ⚠ KHÔNG NẠP SẴN TỶ GIÁ NÀO. VAS đòi tỷ giá thực tế của ngân hàng thương mại
-- nơi đơn vị giao dịch — đó là dữ liệu của từng doanh nghiệp, em không có và
-- không được bịa. Bảng này để RỖNG; hàm `ty_gia()` trả NULL khi chưa có, và
-- bên gọi phải chặn lại thay vì quy đổi bừa. Thà báo "chưa có tỷ giá" còn hơn
-- in ra một con số không ai bảo vệ được trước kiểm toán.
-- ============================================================================

-- ── Đồng tiền chức năng, khai ở cấp doanh nghiệp ──
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS functional_ccy text NOT NULL DEFAULT 'VND';
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_functional_ccy_chk CHECK (functional_ccy ~ '^[A-Z]{3}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN tenants.functional_ccy IS
  'Đồng tiền chức năng (VAS 10/IAS 21). Mọi báo cáo quy về đồng tiền này. Mặc định VND.';

-- ── Tỷ giá: có ngày hiệu lực, có loại, và BẮT BUỘC có nguồn ──
CREATE TABLE IF NOT EXISTS fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_ccy   text NOT NULL CHECK (base_ccy  ~ '^[A-Z]{3}$'),
  quote_ccy  text NOT NULL CHECK (quote_ccy ~ '^[A-Z]{3}$'),
  -- 1 base_ccy = rate quote_ccy. Ví dụ USD→VND: base='USD', quote='VND', rate=24005.
  rate numeric NOT NULL CHECK (rate > 0),
  effective_from date NOT NULL,
  -- spot: tỷ giá giao dịch · closing: tỷ giá cuối kỳ (đánh giá lại khoản mục
  -- tiền tệ) · average: tỷ giá bình quân kỳ (dùng cho báo cáo kết quả).
  rate_type text NOT NULL DEFAULT 'spot' CHECK (rate_type IN ('spot','closing','average')),
  -- Tỷ giá không nguồn là tỷ giá bịa ⇒ NOT NULL, và cấm chuỗi rỗng.
  source text NOT NULL CHECK (length(btrim(source)) > 0),
  note text,
  created_at timestamptz DEFAULT now(),
  CHECK (base_ccy <> quote_ccy),
  UNIQUE (base_ccy, quote_ccy, effective_from, rate_type)
);
COMMENT ON TABLE fx_rates IS
  'Tỷ giá có ngày hiệu lực. Quy ước: 1 base_ccy = rate quote_ccy. source bắt buộc (tên ngân hàng + ngày công bố).';

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fx_public_read ON fx_rates;
CREATE POLICY fx_public_read ON fx_rates FOR SELECT USING (true);
GRANT SELECT ON fx_rates TO authenticated;
GRANT ALL ON fx_rates TO service_role;
CREATE INDEX IF NOT EXISTS idx_fx_tra_cuu ON fx_rates (base_ccy, quote_ccy, rate_type, effective_from DESC);

-- ── Tra tỷ giá có hiệu lực tại một ngày ──
-- Cùng khuôn với `nguong_hieu_luc` (033) và `tax_rates` (029): lấy bản ghi mới
-- nhất còn hiệu lực tính tới ngày hỏi. CHƯA CÓ thì trả NULL, KHÔNG suy diễn.
CREATE OR REPLACE FUNCTION ty_gia(
  p_base text, p_quote text, p_ngay date DEFAULT current_date, p_loai text DEFAULT 'spot'
) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT rate FROM fx_rates
   WHERE base_ccy = upper(p_base) AND quote_ccy = upper(p_quote)
     AND rate_type = p_loai AND effective_from <= p_ngay
   ORDER BY effective_from DESC
   LIMIT 1
$$;
COMMENT ON FUNCTION ty_gia(text,text,date,text) IS
  'Tỷ giá hiệu lực tại ngày. Trả NULL khi chưa khai — bên gọi PHẢI chặn, cấm quy đổi bừa.';

-- ── Soi các tỷ giá NGẦM đang nằm trong dữ liệu ──
-- Bảng giá đang giữ song song USD và VND nên tự nó hàm ý một tỷ giá. View này
-- phơi ra để thấy chúng lệch nhau, thay vì để lệch âm thầm trong hoá đơn.
-- ⚠ ÉP KIỂU ::numeric CÓ CHỦ Ý, đừng gỡ. Migration 037 đổi hai cột giá sang
-- bigint; khi đó `round(bigint / bigint)` cho ra double precision chứ không
-- còn numeric, và `CREATE OR REPLACE VIEW` từ chối đổi kiểu cột đã có ⇒ chạy
-- lại migration lần hai là hỏng. Ép numeric làm biểu thức ổn định kiểu dù cột
-- gốc là numeric hay bigint. (Đã đo: không ép thì lần chạy thứ hai báo
-- "cannot change data type of view column ty_gia_ngam".)
CREATE OR REPLACE VIEW ty_gia_ngam_trong_bang_gia AS
SELECT tier_code,
       price_usd_month,
       price_vnd_month,
       round(price_vnd_month::numeric / price_usd_month::numeric) AS ty_gia_ngam,
       round(price_vnd_month::numeric / price_usd_month::numeric)
         - (SELECT round(min(price_vnd_month::numeric / price_usd_month::numeric))
              FROM membership_tiers WHERE price_usd_month > 0) AS lech_so_voi_thap_nhat
  FROM membership_tiers
 WHERE price_usd_month > 0;
COMMENT ON VIEW ty_gia_ngam_trong_bang_gia IS
  'Tỷ giá suy ra từ cặp giá USD/VND của từng gói. Lệch nhau = khách cùng gói trả giá thực khác nhau.';
GRANT SELECT ON ty_gia_ngam_trong_bang_gia TO authenticated;
