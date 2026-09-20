-- ============================================================================
-- 033 — DANH MỤC NGÀNH CHUẨN (VSIC 2018 · bắc cầu GICS · khoá kho tri thức Wits)
--
-- BỐI CẢNH. Cột `industry` đang là CHỮ TỰ DO ở 4 bảng (`ipo_journeys` 002,
-- `comparables` + `market_intel` 010, `tenant_operating_profile` 028). Người gõ
-- "SaaS", người gõ "Phần mềm", người gõ "Software" — hệ thống coi là ba ngành
-- khác nhau, nên mọi phép so sánh theo ngành sai một cách IM LẶNG: không báo
-- lỗi, chỉ ra số vô nghĩa. Thêm nữa, `ipo_benchmarks` (026 + 032) KHÔNG có
-- chiều ngành: công ty phần mềm và công ty sản xuất đang bị chấm bằng cùng một
-- ngưỡng biên lợi nhuận gộp — chính ghi chú cuối tệp 032 đã nêu nợ này.
--
-- NEO VÀO CHUẨN, KHÔNG TỰ CHẾ.
--   · VSIC 2018 — Hệ thống ngành kinh tế Việt Nam, Quyết định 27/2018/QĐ-TTg:
--     21 ngành cấp 1 (A→U) và ngành cấp 2 (mã 2 chữ số). Đây là chuẩn PHÁP LÝ,
--     trùng với ngành nghề ghi trên giấy đăng ký kinh doanh của chính khách
--     hàng — nên khách không phải dịch lại ngành của mình sang ngôn ngữ riêng
--     của phần mềm.
--   · GICS — 11 nhóm ngành mà nhà đầu tư quốc tế dùng để chọn bộ công ty so
--     sánh khi định giá. Không có cầu này thì trang định giá không biết lấy
--     peer ở đâu.
--   · Khoá Wits (`wits_key`) — nối sang 22 ngành của kho tri thức Wits để tri
--     thức ngành đã có chỗ neo vào danh mục pháp lý.
--
-- QUYẾT ĐỊNH THIẾT KẾ — VÌ SAO KHÔNG NHÉT THẲNG `industry_code` VÀO
-- `ipo_benchmarks` RỒI MỞ RỘNG KHOÁ CHÍNH (đây là chỗ bản thiết kế ban đầu
-- phải đổi, nên ghi rõ lý do thay vì làm thầm):
--   1. PostgreSQL KHÔNG cho cột NULL nằm trong PRIMARY KEY. Mà dòng ngưỡng
--      CHUNG bắt buộc phải để `industry_code` NULL. Khoá chính ba cột
--      (metric_code, stage, industry_code) do đó không tồn tại được.
--   2. Nặng hơn: 026 và 032 đều ghi `ON CONFLICT (metric_code, stage)`. Câu đó
--      chỉ chạy được khi CÒN một chỉ mục duy nhất đúng hai cột ấy. Muốn để
--      nhiều dòng cùng (metric_code, stage) trong CÙNG một bảng thì phải xoá
--      chỉ mục đó — và ngay vòng chạy thứ hai của cả chuỗi migration, tệp 026
--      sẽ chết với "no unique or exclusion constraint matching the ON CONFLICT
--      specification". Bất biến "chạy cả chuỗi 2-3 vòng đều xanh" của thư mục
--      này (xem CONVERSION_NOTES.md và scripts/bench-db.cjs) sẽ gãy, mà tệp
--      026/032 thì không được sửa.
--   Nên: lớp CHUNG ở nguyên `ipo_benchmarks` (31 dòng của 032 KHÔNG bị đụng
--   tới — không DROP, không DELETE, không đổi khoá), lớp ĐÈ theo ngành nằm ở
--   bảng `ipo_benchmarks_by_industry` với khoá chính đúng ba cột
--   (metric_code, stage, industry_code). Khung nhìn `ipo_benchmarks_effective`
--   hợp nhất hai lớp thành ĐÚNG hình dạng đã mô tả: dòng `industry_code IS
--   NULL` là ngưỡng CHUNG, dòng có mã ngành là ngưỡng ĐÈ. Ứng dụng đọc một chỗ
--   duy nhất, không phải biết có hai bảng.
--
-- THỨ TỰ TRA NGƯỠNG (hàm `nguong_hieu_luc`): ngành đúng → ngành CHA (cấp 1) →
-- ngưỡng CHUNG. Nhờ bậc "ngành cha" mà một công ty luật (69) vẫn nhận được
-- ngưỡng của khối dịch vụ chuyên môn (M) mà không phải nạp lặp cho từng ngành
-- con.
--
-- CÒN THIẾU — ghi ra để không ai tưởng đã đủ:
--   · Danh mục cấp 2 mới nạp 21 mã tương ứng 22 ngành Wits, KHÔNG phải toàn bộ
--     ~88 ngành cấp 2 của VSIC. Bổ sung dần theo nhu cầu khách hàng thật.
--   · Ngưỡng ĐÈ theo ngành chỉ có 5 dòng, vì kho tri thức Wits hiện CHỈ nói rõ
--     khác biệt ngành ở hai chỗ (xem mục 8). Không có căn cứ thì để trống —
--     bịa một con số cho đủ bảng còn tệ hơn là thiếu.
--   · Ba ngành cấp 1 O (quản lý nhà nước), T (hộ gia đình tự tiêu dùng), U (tổ
--     chức quốc tế) KHÔNG có bộ chỉ số: đây không phải khu vực doanh nghiệp đi
--     huy động vốn hay niêm yết, gán chỉ số cho chúng là gán cho có.
-- ============================================================================

-- ── 1 · industries — DANH MỤC THAM CHIẾU (công khai, đọc được không cần tenant)
-- Không có tenant_id: đây là danh mục pháp lý dùng chung, giống `ipo_benchmarks`
-- của 026 — nên dùng lại đúng khuôn RLS `benchmarks_public_read` của tệp đó.
CREATE TABLE IF NOT EXISTS industries (
  code text PRIMARY KEY,                 -- mã VSIC: chữ cái A-U (cấp 1) hoặc 2 chữ số (cấp 2)
  vsic_section text NOT NULL,            -- ngành cấp 1 chứa nó, luôn là A-U
  name_vi text NOT NULL,                 -- tên theo văn bản VSIC 2018
  name_en text NOT NULL,                 -- tên ISIC Rev.4 tương ứng (VSIC không công bố bản tiếng Anh)
  gics_sector text NOT NULL,             -- 1 trong 11 nhóm GICS, hoặc "Không áp dụng"
  wits_key text,                         -- khoá ngành trong kho tri thức Wits (NULL nếu kho chưa có)
  parent_code text REFERENCES industries(code),  -- NULL = ngành cấp 1
  note_vi text,                          -- chỗ ghi thẳng điều CHƯA CHẮC, để người sau còn biết mà đối chiếu
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT industries_section_hop_le CHECK (vsic_section ~ '^[A-U]$'),
  CONSTRAINT industries_wits_key_duy_nhat UNIQUE (wits_key)
);
CREATE INDEX IF NOT EXISTS idx_industries_parent ON industries(parent_code);
CREATE INDEX IF NOT EXISTS idx_industries_section ON industries(vsic_section);
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS industries_public_read ON industries;
CREATE POLICY industries_public_read ON industries FOR SELECT USING (true);
GRANT SELECT ON industries TO authenticated;
GRANT ALL ON industries TO service_role;

-- ── 2 · industry_metric_sets — MỖI NGÀNH ĐO THỨ KHÁC NHAU ──────────────────
-- Đây là chỗ sửa sai lầm nghiệp vụ nặng nhất của bản cũ: bắt mọi ngành dùng
-- chung một bộ chỉ số. Một nhà máy không có NRR, một quán ăn không có magic
-- number, một ngân hàng không đo biên lợi nhuận gộp — họ đo OEE, đo doanh thu
-- trên ghế, đo NIM. `why_vi` bắt buộc có: chỉ số không giải thích được vì sao
-- ngành đó đo nó thì đừng đưa vào bộ.
CREATE TABLE IF NOT EXISTS industry_metric_sets (
  industry_code text NOT NULL REFERENCES industries(code) ON DELETE CASCADE,
  metric_code text NOT NULL,             -- dùng chung không gian tên với kpi_metrics.metric_code
  name_vi text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,   -- chỉ số CỐT LÕI: mất nó là không đọc được sức khoẻ ngành
  why_vi text NOT NULL,                  -- một câu: vì sao ngành này đo chỉ số đó
  unit_vi text,                          -- đơn vị đọc được bằng tiếng Việt (%, ngày, VND/đơn...)
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (industry_code, metric_code)
);
CREATE INDEX IF NOT EXISTS idx_ims_primary ON industry_metric_sets(industry_code, is_primary);
ALTER TABLE industry_metric_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ims_public_read ON industry_metric_sets;
CREATE POLICY ims_public_read ON industry_metric_sets FOR SELECT USING (true);
GRANT SELECT ON industry_metric_sets TO authenticated;
GRANT ALL ON industry_metric_sets TO service_role;

-- ── 3 · ipo_benchmarks_by_industry — LỚP NGƯỠNG ĐÈ THEO NGÀNH ──────────────
-- Cùng bộ cột với `ipo_benchmarks` (026) để hai lớp hợp nhất được bằng UNION
-- ALL mà không phải ép kiểu. Quy ước good_min/good_max giữ nguyên như 032:
-- good_min cho chỉ số CÀNG CAO CÀNG TỐT, good_max cho chỉ số CÀNG THẤP CÀNG TỐT.
CREATE TABLE IF NOT EXISTS ipo_benchmarks_by_industry (
  metric_code text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('seed','series_a','series_b','growth','pre_ipo')),
  industry_code text NOT NULL REFERENCES industries(code) ON DELETE CASCADE,
  name_vi text NOT NULL,
  good_min numeric,
  good_max numeric,
  category text NOT NULL,
  source_note text,                      -- BẮT BUỘC dẫn nguồn: không nguồn thì không nạp
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_code, stage, industry_code)
);
ALTER TABLE ipo_benchmarks_by_industry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS benchmarks_nganh_public_read ON ipo_benchmarks_by_industry;
CREATE POLICY benchmarks_nganh_public_read ON ipo_benchmarks_by_industry FOR SELECT USING (true);
GRANT SELECT ON ipo_benchmarks_by_industry TO authenticated;
GRANT ALL ON ipo_benchmarks_by_industry TO service_role;

-- ── 4 · Cột industry_code cho 4 bảng đang dùng chữ tự do ────────────────────
-- Cột `industry` cũ GIỮ NGUYÊN (không xoá, không ép chuyển) — dữ liệu khách đã
-- gõ vào đó không được phép mất. Cột mới là mã chuẩn, ứng dụng điền dần; khi
-- nào đủ dữ liệu mới tính chuyện bỏ cột chữ tự do.
ALTER TABLE tenant_operating_profile ADD COLUMN IF NOT EXISTS industry_code text;
ALTER TABLE ipo_journeys ADD COLUMN IF NOT EXISTS industry_code text;
ALTER TABLE comparables ADD COLUMN IF NOT EXISTS industry_code text;
ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS industry_code text;

-- Khoá ngoại phải thêm bằng DO vì PostgreSQL không có ADD CONSTRAINT IF NOT
-- EXISTS — chạy lại vòng 2 mà không có lớp bảo vệ này là lỗi "constraint đã tồn tại".
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_operating_profile','ipo_journeys','comparables','market_intel'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_industry_code_fkey') THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (industry_code) REFERENCES industries(code)',
        t, t || '_industry_code_fkey');
    END IF;
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_top_industry_code ON tenant_operating_profile(industry_code);
CREATE INDEX IF NOT EXISTS idx_comparables_industry_code ON comparables(industry_code);

-- ── 5 · NẠP 21 NGÀNH CẤP 1 VSIC 2018 (A→U) ─────────────────────────────────
-- Nạp cấp 1 TRƯỚC cấp 2 vì khoá ngoại parent_code kiểm ngay tại dòng insert.
-- O, T, U để gics_sector = "Không áp dụng": GICS chỉ phân loại doanh nghiệp
-- niêm yết, không phân loại cơ quan nhà nước, hộ gia đình hay tổ chức quốc tế.
-- Ghi "Không áp dụng" là nói thật, khác hẳn với gán bừa một nhóm cho đủ ô.
INSERT INTO industries (code, vsic_section, name_vi, name_en, gics_sector, wits_key, parent_code, note_vi) VALUES
  ('A','A','Nông nghiệp, lâm nghiệp và thuỷ sản','Agriculture, forestry and fishing','Consumer Staples',NULL,NULL,NULL),
  ('B','B','Khai khoáng','Mining and quarrying','Materials',NULL,NULL,'Dầu khí trong GICS thuộc Energy chứ không phải Materials — chọn theo sản phẩm chính của doanh nghiệp'),
  ('C','C','Công nghiệp chế biến, chế tạo','Manufacturing','Industrials','san_xuat',NULL,'VSIC không có mã cấp 2 nào bao hết khối chế biến chế tạo, nên khoá Wits san_xuat neo ở cấp 1. GICS đổi theo sản phẩm: thực phẩm sang Consumer Staples, điện tử sang Information Technology'),
  ('D','D','Sản xuất và phân phối điện, khí đốt, nước nóng, hơi nước và điều hoà không khí','Electricity, gas, steam and air conditioning supply','Utilities',NULL,NULL,NULL),
  ('E','E','Cung cấp nước; hoạt động quản lý và xử lý rác thải, nước thải','Water supply; sewerage, waste management and remediation activities','Utilities',NULL,NULL,NULL),
  ('F','F','Xây dựng','Construction','Industrials',NULL,NULL,NULL),
  ('G','G','Bán buôn và bán lẻ; sửa chữa ô tô, mô tô, xe máy và xe có động cơ khác','Wholesale and retail trade; repair of motor vehicles and motorcycles','Consumer Discretionary',NULL,NULL,NULL),
  ('H','H','Vận tải kho bãi','Transportation and storage','Industrials',NULL,NULL,NULL),
  ('I','I','Dịch vụ lưu trú và ăn uống','Accommodation and food service activities','Consumer Discretionary',NULL,NULL,NULL),
  ('J','J','Thông tin và truyền thông','Information and communication','Communication Services',NULL,NULL,'Riêng ngành 62 và 63 trong GICS thuộc Information Technology, không thuộc Communication Services'),
  ('K','K','Hoạt động tài chính, ngân hàng và bảo hiểm','Financial and insurance activities','Financials',NULL,NULL,NULL),
  ('L','L','Hoạt động kinh doanh bất động sản','Real estate activities','Real Estate',NULL,NULL,NULL),
  ('M','M','Hoạt động chuyên môn, khoa học và công nghệ','Professional, scientific and technical activities','Industrials',NULL,NULL,NULL),
  ('N','N','Hoạt động hành chính và dịch vụ hỗ trợ','Administrative and support service activities','Industrials',NULL,NULL,NULL),
  ('O','O','Hoạt động của Đảng Cộng sản, tổ chức chính trị xã hội, quản lý nhà nước, an ninh quốc phòng, bảo đảm xã hội bắt buộc','Public administration and defence; compulsory social security','Không áp dụng',NULL,NULL,'Tên đầy đủ trong Quyết định 27/2018 dài hơn bản rút gọn ở đây — cần đối chiếu văn bản gốc trước khi in ra hồ sơ pháp lý'),
  ('P','P','Giáo dục và đào tạo','Education','Consumer Discretionary',NULL,NULL,NULL),
  ('Q','Q','Y tế và hoạt động trợ giúp xã hội','Human health and social work activities','Health Care',NULL,NULL,NULL),
  ('R','R','Nghệ thuật, vui chơi và giải trí','Arts, entertainment and recreation','Communication Services',NULL,NULL,'Thể thao và khu vui chơi trong GICS thuộc Consumer Discretionary'),
  ('S','S','Hoạt động dịch vụ khác','Other service activities','Consumer Discretionary',NULL,NULL,NULL),
  ('T','T','Hoạt động làm thuê các công việc trong các hộ gia đình, sản xuất sản phẩm vật chất và dịch vụ tự tiêu dùng của hộ gia đình','Activities of households as employers','Không áp dụng',NULL,NULL,NULL),
  ('U','U','Hoạt động của các tổ chức và cơ quan quốc tế','Activities of extraterritorial organizations and bodies','Không áp dụng',NULL,NULL,NULL)
ON CONFLICT (code) DO UPDATE SET
  vsic_section = EXCLUDED.vsic_section,
  name_vi      = EXCLUDED.name_vi,
  name_en      = EXCLUDED.name_en,
  gics_sector  = EXCLUDED.gics_sector,
  wits_key     = EXCLUDED.wits_key,
  parent_code  = EXCLUDED.parent_code,
  note_vi      = EXCLUDED.note_vi;

-- ── 6 · NẠP 21 NGÀNH CẤP 2 ỨNG VỚI 22 NGÀNH KHO TRI THỨC WITS ──────────────
-- 21 mã cấp 2 + khoá san_xuat đã neo ở ngành C = đủ 22 ngành Wits.
-- Chỗ nào VSIC không có mã tương ứng một-một (xuất nhập khẩu, truyền thông)
-- thì ghi thẳng vào note_vi là suy luận của mình, KHÔNG im lặng làm như chắc chắn.
INSERT INTO industries (code, vsic_section, name_vi, name_en, gics_sector, wits_key, parent_code, note_vi) VALUES
  ('01','A','Nông nghiệp và hoạt động dịch vụ có liên quan','Crop and animal production, hunting and related service activities','Consumer Staples','nong_nghiep','A',NULL),
  ('14','C','Sản xuất trang phục','Manufacture of wearing apparel','Consumer Discretionary','thoi_trang','C','Thương hiệu thời trang chỉ thiết kế và bán lẻ, không tự may, thì thuộc 47 chứ không phải 14'),
  ('35','D','Sản xuất và phân phối điện, khí đốt, nước nóng, hơi nước và điều hoà không khí','Electricity, gas, steam and air conditioning supply','Utilities','nang_luong','D',NULL),
  ('41','F','Xây dựng nhà các loại','Construction of buildings','Industrials','xay_dung','F','Nhà thầu hạ tầng thuộc 42, thầu chuyên dụng thuộc 43 — khoá Wits xay_dung neo ở 41 vì kho tri thức hiện là hồ sơ nhà dân dụng. Chủ đầu tư bán nhà thuộc 68'),
  ('46','G','Bán buôn (trừ ô tô, mô tô, xe máy và xe có động cơ khác)','Wholesale trade, except of motor vehicles and motorcycles','Industrials','xuat_nhap_khau','G','VSIC KHÔNG có ngành riêng cho xuất nhập khẩu — hoạt động này được xếp theo mặt hàng, phổ biến nhất là bán buôn 46. Cần đối chiếu lại khi khách có mã ngành thật trên giấy phép. GICS xếp doanh nghiệp thương mại vào Industrials nhóm Trading Companies and Distributors'),
  ('47','G','Bán lẻ (trừ ô tô, mô tô, xe máy và xe có động cơ khác)','Retail trade, except of motor vehicles and motorcycles','Consumer Discretionary','ban_le','G','Bán lẻ thực phẩm và hàng thiết yếu trong GICS thuộc Consumer Staples'),
  ('52','H','Kho bãi và các hoạt động hỗ trợ cho vận tải','Warehousing and support activities for transportation','Industrials','logistics','H','Doanh nghiệp tự chạy xe thuộc 49, chuyển phát thuộc 53 — khoá logistics neo ở 52 vì đó là nhóm bao quát dịch vụ hậu cần'),
  ('56','I','Dịch vụ ăn uống','Food and beverage service activities','Consumer Discretionary','f_and_b','I',NULL),
  ('59','J','Hoạt động điện ảnh, sản xuất chương trình truyền hình, ghi âm và xuất bản âm nhạc','Motion picture, video and television programme production, sound recording and music publishing activities','Communication Services','truyen_thong','J','CHƯA CHẮC: công ty truyền thông Việt Nam thường đăng ký 5911 sản xuất nội dung hoặc 7310 quảng cáo. Neo ở 59 vì phần sản xuất nội dung là lõi; nếu doanh nghiệp chủ yếu chạy quảng cáo thì phải đổi sang 73'),
  ('61','J','Viễn thông','Telecommunications','Communication Services','vien_thong','J',NULL),
  ('62','J','Lập trình máy vi tính, dịch vụ tư vấn và các hoạt động khác liên quan đến máy vi tính','Computer programming, consultancy and related activities','Information Technology','cong_nghe','J','Đây là mã của phần lớn công ty phần mềm Việt Nam. GICS xếp vào Information Technology chứ không theo ngành cấp 1 J'),
  ('64','K','Hoạt động dịch vụ tài chính (trừ bảo hiểm và bảo hiểm xã hội)','Financial service activities, except insurance and pension funding','Financials','ngan_hang','K','Ngân hàng nằm ở nhóm cấp 3 641 trung gian tiền tệ thuộc mã 64 này'),
  ('65','K','Bảo hiểm, tái bảo hiểm và bảo hiểm xã hội (trừ bảo đảm xã hội bắt buộc)','Insurance, reinsurance and pension funding, except compulsory social security','Financials','bao_hiem','K',NULL),
  ('66','K','Hoạt động tài chính khác','Activities auxiliary to financial service and insurance activities','Financials','tai_chinh','K','CHƯA CHẮC tên gọi cấp 2 — cần đối chiếu Quyết định 27/2018. Công ty fintech, quỹ đầu tư, môi giới neo ở đây để phân biệt với ngân hàng 64'),
  ('68','L','Hoạt động kinh doanh bất động sản','Real estate activities','Real Estate','bat_dong_san','L',NULL),
  ('69','M','Hoạt động pháp luật, kế toán và kiểm toán','Legal and accounting activities','Industrials','luat','M','VSIC gộp pháp luật với kế toán kiểm toán ở cấp 2; chỉ đến cấp 3 mới tách 691 hoạt động pháp luật. Khoá luat neo ở 69 và chấp nhận độ rộng đó'),
  ('72','M','Nghiên cứu khoa học và phát triển','Scientific research and development','Industrials','nghien_cuu','M','Viện nghiên cứu dược và công nghệ sinh học trong GICS thuộc Health Care'),
  ('73','M','Quảng cáo và nghiên cứu thị trường','Advertising and market research','Communication Services','marketing','M','GICS xếp công ty quảng cáo vào Communication Services nhóm Media, khác với ngành cấp 1 M'),
  ('79','N','Hoạt động của các đại lý du lịch, kinh doanh tua du lịch và các dịch vụ hỗ trợ, liên quan đến quảng bá và tổ chức tua du lịch','Travel agency, tour operator and other reservation service and related activities','Consumer Discretionary','du_lich','N','Khách sạn và lưu trú thuộc ngành 55 của khối I, không thuộc 79'),
  ('85','P','Giáo dục và đào tạo','Education','Consumer Discretionary','giao_duc','P',NULL),
  ('86','Q','Hoạt động y tế','Human health activities','Health Care','y_te','Q',NULL)
ON CONFLICT (code) DO UPDATE SET
  vsic_section = EXCLUDED.vsic_section,
  name_vi      = EXCLUDED.name_vi,
  name_en      = EXCLUDED.name_en,
  gics_sector  = EXCLUDED.gics_sector,
  wits_key     = EXCLUDED.wits_key,
  parent_code  = EXCLUDED.parent_code,
  note_vi      = EXCLUDED.note_vi;

-- ── 7 · BỘ CHỈ SỐ RIÊNG TỪNG NGÀNH ─────────────────────────────────────────
-- Đây là phần trả lời câu hỏi nghiệp vụ: NGÀNH NÀY SỐNG CHẾT BẰNG SỐ NÀO.
-- Chỉ số ở đây là ĐỊNH NGHĨA (đo cái gì, vì sao đo) — KHÔNG phải ngưỡng. Ngưỡng
-- phải có nguồn và nằm ở mục 8. Trộn hai thứ này là cách nhanh nhất để bịa số.
INSERT INTO industry_metric_sets (industry_code, metric_code, name_vi, is_primary, why_vi, unit_vi) VALUES
  -- Ngành cấp 1: bộ tối thiểu, dùng khi khách mới chỉ khai được ngành lớn
  ('A','yield_per_ha','Năng suất trên hecta',true,'Đất là nguồn lực hữu hạn nên toàn bộ lợi nhuận nông nghiệp quyết định ở sản lượng thu được trên mỗi hecta','tấn/ha'),
  ('A','cost_per_kg','Giá thành trên kilogam',true,'Giá bán nông sản do thị trường quyết định, doanh nghiệp chỉ còn cửa cạnh tranh bằng giá thành','VND/kg'),
  ('A','post_harvest_loss_pct','Tỷ lệ hao hụt sau thu hoạch',false,'Hàng hỏng sau thu hoạch là lợi nhuận đã làm ra rồi lại mất, không thể bù bằng tăng doanh thu','%'),
  ('B','reserve_life_years','Số năm trữ lượng còn khai thác',true,'Mỏ là tài sản cạn dần nên nhà đầu tư định giá theo số năm còn khai thác được chứ không theo doanh thu năm nay','năm'),
  ('B','cash_cost_per_tonne','Chi phí khai thác trên tấn',true,'Giá khoáng sản biến động theo thế giới nên chỉ doanh nghiệp có chi phí trên tấn thấp mới sống qua chu kỳ giá xuống','VND/tấn'),
  ('B','recovery_rate_pct','Tỷ lệ thu hồi quặng',false,'Thu hồi thấp nghĩa là đào lên rồi bỏ đi phần lớn tài nguyên đã tốn tiền khai thác','%'),
  ('C','oee_pct','Hiệu suất thiết bị toàn phần OEE',true,'Nhà máy đã bỏ vốn cố định lớn nên lợi nhuận đến từ việc máy chạy được bao nhiêu phần trăm thời gian có ích','%'),
  ('C','capacity_utilisation_pct','Hiệu suất công suất',true,'Chi phí khấu hao chia đều cho sản lượng, chạy dưới công suất là tự đẩy giá thành đơn vị lên','%'),
  ('C','scrap_rate_pct','Tỷ lệ phế phẩm',true,'Phế phẩm ăn cả nguyên liệu lẫn giờ máy đã bỏ ra, nên nó đánh vào biên lợi nhuận gấp đôi so với cảm nhận thông thường','%'),
  ('C','inventory_turnover','Vòng quay hàng tồn kho',false,'Tồn kho là tiền nằm im trong kho, vòng quay chậm làm cạn dòng tiền dù báo cáo vẫn có lãi','vòng/năm'),
  ('C','on_time_delivery_pct','Tỷ lệ giao hàng đúng hạn',false,'Khách công nghiệp phạt hoặc cắt đơn khi trễ hạn, nên đúng hạn là điều kiện giữ hợp đồng dài hạn','%'),
  ('D','capacity_factor_pct','Hệ số công suất',true,'Nhà máy điện bán được bao nhiêu phụ thuộc thời gian phát thực tế trên công suất lắp đặt','%'),
  ('D','unplanned_downtime_pct','Tỷ lệ dừng máy ngoài kế hoạch',true,'Mỗi giờ dừng ngoài kế hoạch là doanh thu mất hẳn vì điện không tồn kho được','%'),
  ('D','ebitda_per_mw','EBITDA trên mỗi MW công suất',false,'Cho phép so sánh hiệu quả giữa các nhà máy khác quy mô trên cùng một thước đo','triệu VND/MW'),
  ('E','nrw_pct','Tỷ lệ thất thoát nước',true,'Nước đã xử lý xong mà rò rỉ trên đường ống là chi phí đã bỏ ra nhưng không bao giờ thu được tiền','%'),
  ('E','treatment_capacity_used_pct','Tỷ lệ sử dụng công suất xử lý',true,'Công trình xử lý vốn đầu tư lớn, chạy non tải là chôn vốn','%'),
  ('E','cost_per_tonne_waste','Chi phí xử lý trên tấn',false,'Giá dịch vụ thường bị khống chế theo hợp đồng nên lợi nhuận nằm ở chi phí xử lý trên tấn','VND/tấn'),
  ('F','backlog_to_revenue','Giá trị hợp đồng chưa thực hiện trên doanh thu năm',true,'Nhà thầu sống bằng khối lượng việc đã ký, chỉ số này cho biết còn việc làm mấy tháng tới','lần'),
  ('F','contract_gross_margin_pct','Biên lợi nhuận gộp theo hợp đồng',true,'Mỗi công trình là một đơn vị lời lỗ riêng, lãi tổng có thể che một hợp đồng đang lỗ nặng','%'),
  ('F','on_schedule_delivery_pct','Tỷ lệ công trình đúng tiến độ',true,'Chậm tiến độ kéo theo phạt hợp đồng và chi phí nhân công máy móc phát sinh ngoài dự toán','%'),
  ('G','inventory_turnover','Vòng quay hàng tồn kho',true,'Thương mại kiếm lời bằng số vòng quay chứ không bằng biên lợi nhuận trên từng món','vòng/năm'),
  ('G','gmroi','Lợi nhuận gộp trên vốn hàng tồn GMROI',true,'Kết hợp biên lợi nhuận với tốc độ quay để biết mỗi đồng vốn nằm trong kho sinh ra bao nhiêu lãi gộp','lần'),
  ('G','dso_days','Số ngày phải thu',false,'Bán được hàng mà chưa thu được tiền thì vẫn phải vay để nhập lô tiếp','ngày'),
  ('H','load_factor_pct','Hệ số sử dụng phương tiện',true,'Xe hoặc tàu chạy non tải vẫn tốn gần đủ chi phí nhiên liệu và tài xế','%'),
  ('H','on_time_delivery_pct','Tỷ lệ giao đúng hạn',true,'Đúng hạn là sản phẩm thật sự mà khách mua trong ngành vận tải','%'),
  ('H','revenue_per_vehicle','Doanh thu trên mỗi phương tiện',false,'Đội xe là tài sản lớn nhất, so doanh thu trên đầu xe mới thấy đội xe có bị thừa hay không','triệu VND/xe/tháng'),
  ('I','occupancy_rate_pct','Tỷ lệ lấp đầy',true,'Phòng trống và bàn trống không bán lại được ngày hôm sau, doanh thu mất là mất vĩnh viễn','%'),
  ('I','revpar','Doanh thu trên mỗi phòng sẵn có RevPAR',true,'Gộp cả giá bán lẫn tỷ lệ lấp đầy nên không thể làm đẹp bằng cách giảm giá để lấp phòng','VND/phòng/đêm'),
  ('I','adr','Giá bán bình quân ADR',false,'Cho biết vị thế thương hiệu, đi kèm RevPAR để phát hiện tăng trưởng nhờ phá giá','VND/đêm'),
  ('J','arpu','Doanh thu bình quân trên người dùng ARPU',true,'Mô hình thuê bao và quảng cáo đều quy về giá trị một người dùng mang lại mỗi tháng','VND/người/tháng'),
  ('J','subscriber_churn_pct','Tỷ lệ rời bỏ thuê bao',true,'Rời bỏ cao buộc phải liên tục mua khách mới chỉ để đứng yên tại chỗ','%/tháng'),
  ('J','revenue_per_employee','Doanh thu trên đầu người',false,'Ngành nội dung và công nghệ đo được khả năng mở rộng qua doanh thu trên đầu người','triệu VND/người/năm'),
  ('K','roe_pct','Tỷ suất lợi nhuận trên vốn chủ ROE',true,'Định chế tài chính kinh doanh bằng vốn nên hiệu quả phải đo trên vốn chủ sở hữu','%'),
  ('K','cir_pct','Tỷ lệ chi phí trên thu nhập CIR',true,'Đây là thước đo hiệu quả vận hành chuẩn của ngành tài chính, thay cho biên lợi nhuận gộp','%'),
  ('K','car_pct','Tỷ lệ an toàn vốn CAR',false,'Là ngưỡng pháp lý bắt buộc, không đạt là bị hạn chế hoạt động bất kể lãi bao nhiêu','%'),
  ('L','occupancy_rate_pct','Tỷ lệ lấp đầy',true,'Bất động sản cho thuê chỉ sinh dòng tiền khi có người thuê, diện tích trống vẫn phải trả chi phí vận hành','%'),
  ('L','cap_rate_pct','Tỷ suất vốn hoá cap rate',true,'Đây là cách thị trường định giá tài sản cho thuê, mọi quyết định mua bán đều quy về nó','%'),
  ('L','noi','Thu nhập hoạt động ròng NOI',true,'Lọc bỏ cấu trúc vốn và thuế để thấy tài sản tự nó sinh ra bao nhiêu tiền','triệu VND/năm'),
  ('M','utilisation_rate_pct','Tỷ lệ sử dụng nhân sự',true,'Hàng bán của dịch vụ chuyên môn là giờ công, giờ không tính được cho khách là hàng hỏng','%'),
  ('M','realisation_rate_pct','Tỷ lệ thu hồi trên giờ ghi nhận',true,'Ghi giờ mà không thu được đủ tiền theo biểu phí nghĩa là đang giảm giá ngầm','%'),
  ('M','revenue_per_fee_earner','Doanh thu trên mỗi nhân sự tính phí',false,'Quy mô đội ngũ là chi phí cố định lớn nhất nên doanh thu phải đo trên đầu người tạo ra phí','triệu VND/người/năm'),
  ('N','utilisation_rate_pct','Tỷ lệ sử dụng nhân sự',true,'Dịch vụ hỗ trợ bán nhân lực theo giờ hoặc theo suất nên nhân sự rảnh là lỗ trực tiếp','%'),
  ('N','contract_renewal_pct','Tỷ lệ gia hạn hợp đồng',true,'Doanh thu ngành này là hợp đồng lặp lại, mất gia hạn là mất nền doanh thu năm sau','%'),
  ('N','revenue_per_employee','Doanh thu trên đầu người',false,'Cho biết mô hình có mở rộng được hay chỉ tăng doanh thu bằng cách tuyển thêm người','triệu VND/người/năm'),
  ('P','student_retention_pct','Tỷ lệ học viên duy trì',true,'Giáo dục sống bằng học viên học tiếp khoá sau, tuyển mới luôn đắt hơn giữ chân','%'),
  ('P','course_completion_pct','Tỷ lệ hoàn thành khoá học',true,'Học viên bỏ giữa chừng vừa mất doanh thu còn lại vừa phá uy tín tuyển sinh kỳ sau','%'),
  ('P','revenue_per_student','Doanh thu trên mỗi học viên',false,'Cho biết trường đang tăng trưởng bằng chất lượng chương trình hay chỉ bằng số lượng ghi danh','triệu VND/học viên'),
  ('Q','bed_occupancy_pct','Công suất sử dụng giường',true,'Cơ sở y tế có chi phí cố định rất cao nên công suất giường quyết định điểm hoà vốn','%'),
  ('Q','revenue_per_visit','Doanh thu trên mỗi lượt khám',true,'Phản ánh cơ cấu dịch vụ, tăng lượt khám mà doanh thu mỗi lượt giảm là đang xuống cấp dịch vụ','VND/lượt'),
  ('Q','readmission_rate_pct','Tỷ lệ tái nhập viện',false,'Chỉ số chất lượng điều trị được cơ quan quản lý và người bệnh soi kỹ nhất','%'),
  ('R','seat_occupancy_pct','Tỷ lệ lấp đầy chỗ',true,'Ghế trống trong một suất diễn là doanh thu mất vĩnh viễn giống phòng khách sạn trống','%'),
  ('R','revenue_per_ticket','Doanh thu trên mỗi vé',true,'Cho biết sức mạnh thương hiệu và khả năng nâng giá mà không mất khán giả','VND/vé'),
  ('R','ancillary_revenue_pct','Tỷ trọng doanh thu phụ trợ',false,'Đồ ăn uống và hàng lưu niệm thường có biên cao hơn vé, quyết định lời lỗ cả suất diễn','%'),
  ('S','repeat_customer_pct','Tỷ lệ khách quay lại',true,'Dịch vụ cá nhân sống bằng khách quen vì chi phí tìm khách mới lớn hơn giá trị một lần dùng','%'),
  ('S','revenue_per_visit','Doanh thu trên mỗi lượt khách',true,'Là đòn bẩy lợi nhuận chính khi lượng khách bị giới hạn bởi mặt bằng và nhân sự','VND/lượt'),
  ('S','revenue_per_employee','Doanh thu trên đầu người',false,'Nhân công là chi phí lớn nhất nên năng suất đầu người quyết định biên lợi nhuận','triệu VND/người/năm'),
  -- Ngành cấp 2 tương ứng 22 ngành kho tri thức Wits: bộ đầy đủ hơn
  ('01','yield_per_ha','Năng suất trên hecta',true,'Sản lượng trên đơn vị diện tích là năng lực sản xuất cốt lõi của trồng trọt','tấn/ha'),
  ('01','fcr','Hệ số chuyển đổi thức ăn FCR',true,'Với chăn nuôi, thức ăn chiếm phần lớn giá thành nên mỗi phần trăm FCR đổi thẳng thành lợi nhuận','kg thức ăn/kg tăng trọng'),
  ('01','cost_per_kg','Giá thành trên kilogam',false,'Nông sản bán theo giá thị trường nên lợi thế cạnh tranh nằm hết ở giá thành','VND/kg'),
  ('01','post_harvest_loss_pct','Tỷ lệ hao hụt sau thu hoạch',false,'Hao hụt bảo quản và vận chuyển ăn vào phần lãi đã làm ra','%'),
  ('01','export_grade_pct','Tỷ lệ đạt chuẩn xuất khẩu',false,'Cùng một lô hàng nhưng đạt chuẩn xuất khẩu có giá cao hơn hẳn bán nội địa','%'),
  ('14','sell_through_pct','Tỷ lệ bán hết bộ sưu tập',true,'Thời trang theo mùa, hàng không bán hết trong mùa phải xả lỗ nên đây là chỉ số sống còn','%'),
  ('14','markdown_pct','Tỷ lệ hàng phải giảm giá',true,'Mỗi phần trăm phải giảm giá là phần lãi gộp đã dự tính nhưng không bao giờ thu được','%'),
  ('14','inventory_turnover','Vòng quay hàng tồn kho',true,'Mẫu mã lỗi mốt nhanh nên tồn kho chậm quay mất giá trị theo thời gian','vòng/năm'),
  ('14','return_rate_pct','Tỷ lệ trả hàng',false,'Bán trực tuyến có tỷ lệ trả cao, chi phí xử lý hàng trả ăn hết biên lợi nhuận đơn hàng','%'),
  ('14','sales_per_sqm','Doanh thu trên mét vuông',false,'Mặt bằng bán lẻ là chi phí cố định lớn nhất của thương hiệu thời trang','triệu VND/m2/tháng'),
  ('35','capacity_factor_pct','Hệ số công suất',true,'Quyết định sản lượng điện bán được trên cùng một khoản đầu tư nhà máy','%'),
  ('35','transmission_loss_pct','Tỷ lệ tổn thất truyền tải',true,'Điện mất trên đường dây là sản lượng đã phát nhưng không bán được cho ai','%'),
  ('35','avg_price_per_kwh','Giá bán bình quân trên kWh',false,'Giá bán phụ thuộc hợp đồng mua bán điện và khung giá nhà nước nên phải theo dõi riêng','VND/kWh'),
  ('35','ebitda_per_mw','EBITDA trên mỗi MW công suất',false,'Thước đo so sánh hiệu quả giữa các dự án khác quy mô','triệu VND/MW'),
  ('35','unplanned_downtime_pct','Tỷ lệ dừng máy ngoài kế hoạch',false,'Điện không tồn kho được nên giờ dừng máy là doanh thu mất hẳn','%'),
  ('41','backlog_to_revenue','Giá trị hợp đồng chưa thực hiện trên doanh thu năm',true,'Cho biết nhà thầu còn bao nhiêu tháng việc đã ký, đây là thứ ngân hàng và nhà đầu tư hỏi đầu tiên','lần'),
  ('41','contract_gross_margin_pct','Biên lợi nhuận gộp theo hợp đồng',true,'Lãi toàn công ty có thể che một công trình đang lỗ, phải soi từng hợp đồng','%'),
  ('41','on_schedule_delivery_pct','Tỷ lệ công trình đúng tiến độ',true,'Chậm tiến độ kéo theo phạt hợp đồng cộng chi phí nhân công và máy móc nằm chờ','%'),
  ('41','variation_order_pct','Tỷ trọng phát sinh ngoài hợp đồng',false,'Phát sinh không được duyệt là phần việc đã làm nhưng không ai trả tiền','%'),
  ('41','dso_days','Số ngày phải thu',false,'Xây dựng ứng vốn trước rồi nghiệm thu sau nên dòng tiền chết vì chậm thu hồi công nợ','ngày'),
  ('41','safety_incident_rate','Tần suất tai nạn lao động',false,'Mất an toàn dừng công trường và loại nhà thầu khỏi các gói thầu lớn','vụ/triệu giờ công'),
  ('46','inventory_turnover','Vòng quay hàng tồn kho',true,'Thương mại bán buôn lãi mỏng nên lợi nhuận đến từ số vòng quay vốn hàng','vòng/năm'),
  ('46','dso_days','Số ngày phải thu',true,'Bán buôn thường cho công nợ, thu chậm là phải vay để nhập lô tiếp','ngày'),
  ('46','order_gross_margin_pct','Biên lợi nhuận gộp theo lô hàng',true,'Mỗi lô nhập khẩu là một thương vụ riêng với giá vốn và tỷ giá riêng','%'),
  ('46','fx_exposure_pct','Tỷ trọng doanh thu chịu rủi ro tỷ giá',false,'Xuất nhập khẩu lãi mỏng nên biến động tỷ giá có thể xoá sạch lãi cả lô hàng','%'),
  ('46','logistics_cost_pct','Tỷ trọng chi phí logistics trên doanh thu',false,'Cước vận tải và lưu kho là biến phí lớn nhất, quyết định giá chào có cạnh tranh không','%'),
  ('47','same_store_sales_growth_pct','Tăng trưởng doanh thu cùng cửa hàng',true,'Tách tăng trưởng thật ra khỏi tăng trưởng do mở thêm cửa hàng, đây là chỉ số nhà đầu tư bán lẻ soi đầu tiên','%'),
  ('47','inventory_turnover','Vòng quay hàng tồn kho',true,'Bán lẻ biên mỏng nên lời lỗ nằm ở tốc độ quay vòng hàng','vòng/năm'),
  ('47','sales_per_sqm','Doanh thu trên mét vuông',true,'Mặt bằng là chi phí cố định lớn nhất nên năng suất mỗi mét vuông quyết định điểm hoà vốn','triệu VND/m2/tháng'),
  ('47','gmroi','Lợi nhuận gộp trên vốn hàng tồn GMROI',false,'Cho biết mỗi đồng vốn nằm trong kho sinh ra bao nhiêu lãi gộp','lần'),
  ('47','shrinkage_pct','Tỷ lệ hao hụt hàng hoá',false,'Mất mát và hỏng hàng ăn thẳng vào lãi gộp vốn đã rất mỏng','%'),
  ('47','basket_size','Giá trị hoá đơn bình quân',false,'Tăng giá trị mỗi lần mua rẻ hơn nhiều so với kéo thêm khách mới vào cửa hàng','VND/hoá đơn'),
  ('52','cost_per_order','Chi phí trên mỗi đơn',true,'Khách hàng logistics mua theo đơn giá trên đơn nên toàn bộ lợi nhuận nằm ở chi phí phục vụ mỗi đơn','VND/đơn'),
  ('52','on_time_delivery_pct','Tỷ lệ giao đúng hạn',true,'Đúng hạn là cam kết dịch vụ chính, không đạt thì mất hợp đồng bất kể giá rẻ','%'),
  ('52','fill_rate_pct','Tỷ lệ đáp ứng đơn hàng',false,'Thiếu hàng khi khách cần làm hỏng cả chuỗi cung ứng phía sau','%'),
  ('52','empty_running_pct','Tỷ lệ chạy rỗng',false,'Xe chạy về không vẫn tốn nhiên liệu và tài xế, đây là lãng phí lớn nhất của vận tải đường bộ','%'),
  ('52','warehouse_utilisation_pct','Tỷ lệ sử dụng kho',false,'Kho thuê trả tiền theo diện tích chứ không theo lượng hàng thực chứa','%'),
  ('56','revenue_per_seat','Doanh thu trên mỗi ghế',true,'Số ghế là giới hạn vật lý của quán nên doanh thu phải tính trên đơn vị ghế','VND/ghế/ngày'),
  ('56','food_cost_pct','Tỷ lệ chi phí nguyên liệu',true,'Nguyên liệu là khoản chi lớn nhất và biến động theo giá chợ từng ngày','%'),
  ('56','table_turnover','Vòng quay bàn',true,'Cùng một mặt bằng, phục vụ được nhiều lượt khách hơn là cách tăng doanh thu không cần tăng chi phí cố định','lượt/bàn/ngày'),
  ('56','labour_cost_pct','Tỷ lệ chi phí nhân công',false,'Cộng với chi phí nguyên liệu thành prime cost, hai khoản này quyết định quán lời hay lỗ','%'),
  ('56','average_check','Giá trị hoá đơn bình quân',false,'Bán thêm đồ uống và món phụ là cách tăng lợi nhuận rẻ nhất trong ngành ăn uống','VND/hoá đơn'),
  ('59','revenue_per_content','Doanh thu trên mỗi đầu nội dung',true,'Nội dung là đơn vị sản phẩm của ngành truyền thông nên lời lỗ tính trên từng đầu nội dung','triệu VND/nội dung'),
  ('59','production_cost_per_episode','Chi phí sản xuất trên mỗi tập',true,'Chi phí sản xuất bỏ ra trước khi biết nội dung có ăn khách hay không, đây là rủi ro lớn nhất của ngành','triệu VND/tập'),
  ('59','audience_retention_pct','Tỷ lệ giữ chân khán giả',false,'Khán giả xem hết bao nhiêu phần trăm nội dung quyết định giá bán quảng cáo','%'),
  ('59','cpm','Doanh thu quảng cáo trên nghìn lượt xem',false,'Là giá thị trường trả cho mỗi nghìn lượt tiếp cận, nền tảng định giá toàn ngành','VND/1000 lượt'),
  ('59','licensing_revenue_pct','Tỷ trọng doanh thu bản quyền',false,'Doanh thu bản quyền lặp lại nhiều năm nên được định giá cao hơn doanh thu sản xuất một lần','%'),
  ('61','arpu','Doanh thu bình quân trên thuê bao ARPU',true,'Ngành viễn thông bão hoà thuê bao nên tăng trưởng chỉ còn đến từ doanh thu mỗi thuê bao','VND/thuê bao/tháng'),
  ('61','subscriber_churn_pct','Tỷ lệ rời mạng',true,'Thuê bao rời mạng phải bù bằng thuê bao mới với chi phí thu hút cao hơn nhiều','%/tháng'),
  ('61','sac','Chi phí thu hút thuê bao mới',true,'Trợ giá máy và hoa hồng đại lý là khoản đầu tư phải hoàn lại bằng ARPU trong bao nhiêu tháng','VND/thuê bao'),
  ('61','ebitda_margin_pct','Biên EBITDA',false,'Hạ tầng viễn thông khấu hao rất lớn nên EBITDA phản ánh vận hành đúng hơn lợi nhuận sau thuế','%'),
  ('61','network_utilisation_pct','Tỷ lệ sử dụng hạ tầng mạng',false,'Hạ tầng đã đầu tư mà không có lưu lượng chạy qua là vốn chết','%'),
  ('62','nrr_pct','Giữ chân doanh thu ròng NRR',true,'Phần mềm bán thuê bao nên khách cũ mở rộng chi tiêu là nguồn tăng trưởng rẻ nhất và là đòn bẩy định giá mạnh nhất','%'),
  ('62','rule_of_40','Quy tắc 40',true,'Nhà đầu tư phần mềm chấp nhận đánh đổi giữa tăng trưởng và lợi nhuận, nhưng tổng hai chỉ số phải đạt 40','điểm'),
  ('62','magic_number','Hệ số kỳ diệu',true,'Cho biết mỗi đồng chi bán hàng tiếp thị tạo ra bao nhiêu doanh thu định kỳ mới, đủ cao mới nên tăng chi','lần'),
  ('62','gross_margin_pct','Biên lợi nhuận gộp',false,'Biên cao là bằng chứng sản phẩm thật sự tự động hoá chứ không phải dịch vụ đội lốt phần mềm','%'),
  ('62','cac_payback_months','Số tháng hoàn vốn khách',false,'Quyết định công ty cần bao nhiêu vốn lưu động để tăng trưởng','tháng'),
  ('62','logo_churn_pct','Tỷ lệ mất khách theo số lượng',false,'Tách khỏi NRR để phát hiện trường hợp mất nhiều khách nhỏ nhưng được che bởi vài khách lớn mở rộng','%/năm'),
  ('64','nim_pct','Biên lãi ròng NIM',true,'Ngân hàng kiếm tiền bằng chênh lệch lãi suất huy động và cho vay, đây chính là biên lợi nhuận của ngành','%'),
  ('64','cir_pct','Tỷ lệ chi phí trên thu nhập CIR',true,'Thước đo hiệu quả vận hành chuẩn của ngân hàng, thay cho biên lợi nhuận gộp vốn không có ý nghĩa ở đây','%'),
  ('64','npl_pct','Tỷ lệ nợ xấu NPL',true,'Nợ xấu là rủi ro lớn nhất của ngân hàng, một cú tăng nhỏ xoá sạch lợi nhuận nhiều năm','%'),
  ('64','car_pct','Tỷ lệ an toàn vốn CAR',true,'Ngưỡng pháp lý bắt buộc của Ngân hàng Nhà nước, không đạt là bị hạn chế tăng trưởng tín dụng','%'),
  ('64','casa_pct','Tỷ lệ tiền gửi không kỳ hạn CASA',false,'Tiền gửi không kỳ hạn là nguồn vốn rẻ nhất, CASA cao kéo NIM lên mà không cần tăng lãi cho vay','%'),
  ('64','ldr_pct','Tỷ lệ cho vay trên huy động LDR',false,'Cho vay vượt huy động là rủi ro thanh khoản và bị cơ quan quản lý giới hạn','%'),
  ('65','combined_ratio_pct','Tỷ lệ kết hợp',true,'Cộng tỷ lệ bồi thường và tỷ lệ chi phí, trên 100 phần trăm nghĩa là nghiệp vụ bảo hiểm đang lỗ dù có thể lãi nhờ đầu tư','%'),
  ('65','loss_ratio_pct','Tỷ lệ bồi thường',true,'Cho biết phí thu về bị trả lại bao nhiêu cho bồi thường, phản ánh chất lượng thẩm định rủi ro','%'),
  ('65','expense_ratio_pct','Tỷ lệ chi phí khai thác',false,'Hoa hồng đại lý và chi phí quản lý là phần doanh nghiệp kiểm soát được, khác với bồi thường','%'),
  ('65','persistency_pct','Tỷ lệ duy trì hợp đồng',false,'Hợp đồng nhân thọ chỉ có lãi khi khách đóng phí đủ nhiều năm','%'),
  ('65','solvency_ratio','Biên khả năng thanh toán',false,'Ngưỡng pháp lý bắt buộc để được tiếp tục bán bảo hiểm','lần'),
  ('66','aum_growth_pct','Tăng trưởng tài sản quản lý',true,'Doanh thu của công ty tài chính tỷ lệ thuận với quy mô tài sản đang quản lý','%'),
  ('66','take_rate_pct','Tỷ lệ phí trên quy mô giao dịch',true,'Cho biết công ty giữ lại được bao nhiêu phần trăm giá trị chảy qua nền tảng','%'),
  ('66','portfolio_npl_pct','Tỷ lệ nợ xấu danh mục',false,'Cho vay tiêu dùng và fintech có rủi ro tín dụng cao hơn ngân hàng nên phải theo dõi riêng','%'),
  ('66','cost_of_funds_pct','Chi phí vốn',false,'Không có tiền gửi giá rẻ như ngân hàng nên chi phí vốn quyết định biên lợi nhuận','%'),
  ('66','active_users_monthly','Số khách hàng hoạt động hàng tháng',false,'Phân biệt người dùng thật với tài khoản mở rồi bỏ, nền tảng của mọi doanh thu phí','người'),
  ('68','occupancy_rate_pct','Tỷ lệ lấp đầy',true,'Diện tích trống vẫn phải trả chi phí vận hành và lãi vay nên lấp đầy quyết định dòng tiền','%'),
  ('68','cap_rate_pct','Tỷ suất vốn hoá cap rate',true,'Là cách thị trường định giá bất động sản cho thuê, mọi thương vụ mua bán quy về chỉ số này','%'),
  ('68','noi','Thu nhập hoạt động ròng NOI',true,'Lọc bỏ cấu trúc vốn và thuế để thấy tài sản tự nó sinh ra bao nhiêu tiền','triệu VND/năm'),
  ('68','absorption_rate_pct','Tỷ lệ hấp thụ',false,'Cho biết thị trường tiêu thụ sản phẩm nhanh hay chậm, quyết định thời điểm mở bán giai đoạn sau','%/quý'),
  ('68','rent_per_sqm','Giá thuê trên mét vuông',false,'So sánh trực tiếp với mặt bằng cùng khu vực để biết tài sản đang được định giá đúng chưa','VND/m2/tháng'),
  ('69','utilisation_rate_pct','Tỷ lệ sử dụng nhân sự',true,'Hàng bán của hãng luật là giờ luật sư, giờ không tính được cho khách là hàng hỏng không lưu kho được','%'),
  ('69','realisation_rate_pct','Tỷ lệ thu hồi trên giờ ghi nhận',true,'Ghi giờ mà thu không đủ theo biểu phí nghĩa là đang giảm giá ngầm mà không ai ghi nhận','%'),
  ('69','revenue_per_fee_earner','Doanh thu trên mỗi luật sư tính phí',true,'Đội ngũ là chi phí cố định lớn nhất nên doanh thu phải đo trên đầu người tạo ra phí','triệu VND/người/năm'),
  ('69','wip_days','Số ngày công việc dở dang',false,'Việc đã làm nhưng chưa xuất hoá đơn là tiền đang mắc kẹt trong quy trình','ngày'),
  ('69','collection_days','Số ngày thu hồi phí',false,'Hãng luật thường bị chậm trả phí nên dòng tiền phụ thuộc kỷ luật thu hồi','ngày'),
  ('72','rd_intensity_pct','Tỷ trọng chi cho nghiên cứu phát triển',true,'Đây là ngành lấy chi nghiên cứu làm đầu vào sản xuất nên cường độ chi phản ánh năng lực thật','%'),
  ('72','patents_filed','Số hồ sơ sở hữu trí tuệ đã nộp',true,'Tài sản của viện nghiên cứu là quyền sở hữu trí tuệ chứ không phải nhà xưởng','hồ sơ/năm'),
  ('72','tech_transfer_rate_pct','Tỷ lệ đề tài chuyển giao được',false,'Nghiên cứu không chuyển giao ra thị trường thì không thành doanh thu','%'),
  ('72','time_to_prototype_months','Thời gian từ ý tưởng đến mẫu thử',false,'Rút ngắn vòng lặp nghiên cứu là lợi thế cạnh tranh chính của ngành','tháng'),
  ('72','grant_funding_pct','Tỷ trọng kinh phí từ tài trợ và đề tài',false,'Phụ thuộc quá nhiều vào ngân sách tài trợ là rủi ro khi xét hồ sơ gọi vốn','%'),
  ('73','roas','Hiệu suất chi tiêu quảng cáo ROAS',true,'Khách hàng giữ hay bỏ agency dựa trên số tiền doanh thu tạo ra từ mỗi đồng quảng cáo','lần'),
  ('73','client_retention_pct','Tỷ lệ giữ chân khách hàng',true,'Doanh thu agency là hợp đồng dài hạn, mất một khách lớn là mất cả mảng doanh thu','%'),
  ('73','utilisation_rate_pct','Tỷ lệ sử dụng nhân sự',false,'Agency bán giờ sáng tạo nên nhân sự rảnh là lỗ trực tiếp giống dịch vụ chuyên môn','%'),
  ('73','revenue_per_employee','Doanh thu trên đầu người',false,'Cho biết agency có mở rộng được không hay chỉ tăng doanh thu bằng cách tuyển thêm người','triệu VND/người/năm'),
  ('73','new_business_win_rate_pct','Tỷ lệ thắng thầu dự án mới',false,'Chi phí tham gia đấu thầu ý tưởng rất lớn nên tỷ lệ thắng quyết định hiệu quả kinh doanh','%'),
  ('79','tour_fill_rate_pct','Tỷ lệ lấp đầy tua',true,'Chi phí tua phần lớn cố định theo đoàn nên chỗ trống ăn thẳng vào lợi nhuận chuyến đi','%'),
  ('79','revenue_per_traveller','Doanh thu trên mỗi lượt khách',true,'Bán thêm dịch vụ tại điểm đến là nguồn biên lợi nhuận cao nhất của công ty lữ hành','VND/khách'),
  ('79','cancellation_rate_pct','Tỷ lệ huỷ đặt chỗ',false,'Huỷ sát ngày làm mất chỗ đã đặt cọc với khách sạn và hàng không','%'),
  ('79','repeat_customer_pct','Tỷ lệ khách quay lại',false,'Khách cũ có chi phí bán gần bằng không, quyết định biên lợi nhuận dài hạn','%'),
  ('79','cost_per_booking','Chi phí trên mỗi lượt đặt chỗ',false,'Hoa hồng nền tảng và chi phí quảng cáo trực tuyến là khoản chi lớn nhất của đại lý du lịch','VND/lượt đặt'),
  ('85','student_retention_pct','Tỷ lệ học viên học tiếp',true,'Doanh thu giáo dục lặp lại theo khoá nên giữ chân quyết định tăng trưởng dài hạn','%'),
  ('85','course_completion_pct','Tỷ lệ hoàn thành khoá học',true,'Học viên bỏ dở vừa mất doanh thu còn lại vừa phá uy tín tuyển sinh kỳ sau','%'),
  ('85','revenue_per_student','Doanh thu trên mỗi học viên',true,'Cho biết đang tăng trưởng bằng chất lượng chương trình hay chỉ bằng số lượng ghi danh','triệu VND/học viên'),
  ('85','class_fill_rate_pct','Tỷ lệ lấp đầy lớp',false,'Chi phí giáo viên và phòng học cố định theo lớp nên lớp vắng là lỗ','%'),
  ('85','cac_per_student','Chi phí tuyển sinh trên mỗi học viên',false,'So với doanh thu trọn đời của học viên để biết tuyển sinh có hiệu quả không','VND/học viên'),
  ('86','bed_occupancy_pct','Công suất sử dụng giường',true,'Bệnh viện có chi phí cố định rất cao nên công suất giường quyết định điểm hoà vốn','%'),
  ('86','revenue_per_visit','Doanh thu trên mỗi lượt khám',true,'Phản ánh cơ cấu dịch vụ, tăng lượt khám mà doanh thu mỗi lượt giảm là đang xuống cấp dịch vụ','VND/lượt'),
  ('86','average_length_of_stay','Số ngày điều trị bình quân',true,'Vừa là chỉ số chất lượng điều trị vừa quyết định số lượt bệnh nhân phục vụ được trên cùng số giường','ngày'),
  ('86','readmission_rate_pct','Tỷ lệ tái nhập viện',false,'Chỉ số chất lượng điều trị được cơ quan quản lý và người bệnh soi kỹ nhất','%'),
  ('86','infection_rate_pct','Tỷ lệ nhiễm khuẩn bệnh viện',false,'Sự cố nhiễm khuẩn gây đình chỉ chuyên môn và mất niềm tin không lấy lại được','%'),
  ('86','revenue_per_doctor','Doanh thu trên mỗi bác sĩ',false,'Nhân lực y tế là nguồn lực khan hiếm và đắt nhất của cơ sở khám chữa bệnh','triệu VND/người/năm')
ON CONFLICT (industry_code, metric_code) DO UPDATE SET
  name_vi    = EXCLUDED.name_vi,
  is_primary = EXCLUDED.is_primary,
  why_vi     = EXCLUDED.why_vi,
  unit_vi    = EXCLUDED.unit_vi;

-- ── 8 · NGƯỠNG ĐÈ THEO NGÀNH — CHỈ NHỮNG GÌ CÓ CĂN CỨ ──────────────────────
-- Nguồn duy nhất: kho tri thức Wits, bộ ngưỡng chuẩn vốn tất định
-- (D:/WitsAGI-Data/wits-llm/du-lieu-nganh/nguong-von.json — chính bộ đã nạp ở
-- 032). Rà toàn bộ 31 dòng của bộ đó, CHỈ có 3 dòng nói rõ khác biệt theo ngành:
--   · Biên lợi nhuận gộp, Vòng A: "Phần mềm ≥70% · dịch vụ ≥40% · ăn uống 55-65%"
--   · Biên lợi nhuận gộp, Tiền niêm yết: "Chuẩn công ty đại chúng ngành công nghệ"
--   · Quy tắc 40, Tăng trưởng: "Chuẩn vàng công ty phần mềm"
-- Hai dòng sau cho thấy một điều quan trọng: ngưỡng CHUNG đang dùng cho mọi
-- ngành thực chất là ngưỡng của NGÀNH CÔNG NGHỆ. Nạp lại chúng thành ngưỡng ĐÈ
-- của ngành 62 là để nói thẳng điều đó ra bằng dữ liệu, thay vì để nó ẩn trong
-- một câu ghi chú mà không ai đọc.
--
-- KHÔNG có căn cứ cho các ngành còn lại nên KHÔNG nạp. Cụ thể còn thiếu ngưỡng
-- riêng cho: ngân hàng (NIM, CIR, NPL, CAR), bảo hiểm (tỷ lệ kết hợp), bán lẻ
-- (doanh thu cùng cửa hàng, vòng quay tồn), sản xuất (OEE), bất động sản (cap
-- rate), logistics (chi phí trên đơn) — tất cả đã có ĐỊNH NGHĨA ở mục 7 nhưng
-- chưa có CON SỐ. Cần nguồn ngành thật (báo cáo NHNN, hiệp hội ngành, dữ liệu
-- doanh nghiệp niêm yết HOSE) trước khi nạp. Bịa số ở đây là hỏng cả hệ thống
-- chấm điểm vì không ai biết số đó từ đâu ra.
--
-- Vì sao ăn uống chỉ đặt good_min 55 mà KHÔNG đặt good_max 65: good_max theo
-- quy ước của 032 nghĩa là "càng thấp càng tốt", đặt 65 sẽ chấm FAIL cho quán
-- có biên 70 phần trăm — tức là phạt doanh nghiệp vì làm tốt hơn. Dải 55-65 là
-- khoảng phổ biến của ngành, không phải trần chất lượng, nên ghi vào source_note.
INSERT INTO ipo_benchmarks_by_industry (metric_code, stage, industry_code, name_vi, good_min, good_max, category, source_note) VALUES
  ('gross_margin_pct','series_a','62','Biên lợi nhuận gộp (%)', 70, NULL, 'profitability', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · nguyên văn: Phần mềm ≥70%'),
  ('gross_margin_pct','series_a','M','Biên lợi nhuận gộp (%)', 40, NULL, 'profitability', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · nguyên văn: dịch vụ ≥40% · neo ở ngành cấp 1 M để các ngành con 69, 72, 73 thừa hưởng'),
  ('gross_margin_pct','series_a','56','Biên lợi nhuận gộp (%)', 55, NULL, 'profitability', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · nguyên văn: ăn uống 55-65% · dải phổ biến của ngành, không đặt trần vì biên cao hơn không phải là lỗi'),
  ('gross_margin_pct','pre_ipo','62','Biên lợi nhuận gộp (%)', 70, NULL, 'profitability', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · nguyên văn: Chuẩn công ty đại chúng ngành công nghệ — ghi rõ đây là số của ngành công nghệ, ngành khác chưa có căn cứ'),
  ('rule_of_40','growth','62','Quy tắc 40', 40, NULL, 'growth', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · nguyên văn: Chuẩn vàng công ty phần mềm — áp quy tắc này cho nhà máy hay ngân hàng là sai nghiệp vụ')
ON CONFLICT (metric_code, stage, industry_code) DO UPDATE SET
  name_vi     = EXCLUDED.name_vi,
  good_min    = EXCLUDED.good_min,
  good_max    = EXCLUDED.good_max,
  category    = EXCLUDED.category,
  source_note = EXCLUDED.source_note;

-- ── 9 · ipo_benchmarks_effective — MỘT CHỖ ĐỌC DUY NHẤT ────────────────────
-- Ứng dụng không cần biết có hai bảng: đọc khung nhìn này thì dòng industry_code
-- NULL là ngưỡng CHUNG, dòng có mã ngành là ngưỡng ĐÈ. 31 dòng của 032 xuất
-- hiện nguyên vẹn ở nhánh đầu.
CREATE OR REPLACE VIEW ipo_benchmarks_effective AS
  SELECT b.metric_code, b.stage, NULL::text AS industry_code, b.name_vi,
         b.good_min, b.good_max, b.category, b.source_note
    FROM ipo_benchmarks b
  UNION ALL
  SELECT n.metric_code, n.stage, n.industry_code, n.name_vi,
         n.good_min, n.good_max, n.category, n.source_note
    FROM ipo_benchmarks_by_industry n;
GRANT SELECT ON ipo_benchmarks_effective TO authenticated;
GRANT ALL ON ipo_benchmarks_effective TO service_role;

-- ── 10 · nguong_hieu_luc — LUẬT TRA NGƯỠNG NẰM Ở ĐÚNG MỘT CHỖ ──────────────
-- Thứ tự ưu tiên: ngành đúng → ngành cha (cấp 1) → ngưỡng chung. Đặt luật này
-- trong hàm thay vì rải ra từng route để sau này đổi luật chỉ phải sửa một nơi.
-- Mọi tham chiếu cột đều viết đủ tiền tố bảng: hàm SQL có tham số đầu ra trùng
-- tên cột, viết trống tiền tố là lỗi "column reference is ambiguous".
CREATE OR REPLACE FUNCTION nguong_hieu_luc(p_stage text, p_industry_code text DEFAULT NULL)
RETURNS TABLE (metric_code text, name_vi text, good_min numeric, good_max numeric,
               category text, source_note text, industry_code text)
LANGUAGE sql
STABLE
AS $$
  SELECT t.metric_code, t.name_vi, t.good_min, t.good_max, t.category, t.source_note, t.industry_code
    FROM (
      SELECT DISTINCT ON (b.metric_code) b.*
        FROM ipo_benchmarks_effective b
       WHERE b.stage = p_stage
         AND (b.industry_code IS NULL
              OR b.industry_code = p_industry_code
              OR b.industry_code = (SELECT i.parent_code FROM industries i WHERE i.code = p_industry_code))
       ORDER BY b.metric_code,
                CASE WHEN b.industry_code = p_industry_code THEN 0
                     WHEN b.industry_code = (SELECT i.parent_code FROM industries i WHERE i.code = p_industry_code) THEN 1
                     ELSE 2 END
    ) t
   ORDER BY t.category, t.metric_code;
$$;
GRANT EXECUTE ON FUNCTION nguong_hieu_luc(text, text) TO authenticated, service_role;

-- ── 11 · grade_vs_benchmark — CHẤM ĐIỂM THEO ĐÚNG NGÀNH CỦA DOANH NGHIỆP ───
-- Thay thân hàm của 026 (không sửa tệp 026; migration chạy theo thứ tự nên bản
-- này luôn là bản cuối cùng có hiệu lực). Chữ ký và hình dạng kết quả GIỮ
-- NGUYÊN để route /api/unit-economics/derive không phải đổi một dòng nào.
-- Khác biệt duy nhất: lấy ngưỡng qua nguong_hieu_luc theo industry_code của
-- tenant. Tenant chưa gán mã ngành thì v_nganh NULL và hàm chạy y hệt trước
-- đây — không có bước nhảy hành vi nào cho dữ liệu đang có.
-- Thêm một trường industry_code vào mỗi phần tử items để giao diện nói được
-- "ngưỡng này là ngưỡng riêng của ngành bạn" thay vì để người dùng đoán.
CREATE OR REPLACE FUNCTION grade_vs_benchmark(p_tenant uuid, p_stage text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  rec record;
  v_items jsonb := '[]'::jsonb;
  v_pass int := 0; v_total int := 0;
  v_actual numeric; v_ok boolean;
  v_nganh text;
BEGIN
  SELECT p.industry_code INTO v_nganh
    FROM tenant_operating_profile p WHERE p.tenant_id = p_tenant;

  FOR rec IN SELECT * FROM nguong_hieu_luc(p_stage, v_nganh)
  LOOP
    SELECT k.value INTO v_actual FROM kpi_metrics k
     WHERE k.tenant_id = p_tenant AND k.metric_code = rec.metric_code
     ORDER BY k.captured_at DESC LIMIT 1;

    IF v_actual IS NULL THEN
      v_items := v_items || jsonb_build_object(
        'metric_code', rec.metric_code, 'name', rec.name_vi, 'category', rec.category,
        'actual', NULL, 'status', 'missing',
        'target', COALESCE('≥'||rec.good_min::text, '≤'||rec.good_max::text),
        'note', rec.source_note, 'industry_code', rec.industry_code);
    ELSE
      v_ok := (rec.good_min IS NULL OR v_actual >= rec.good_min)
          AND (rec.good_max IS NULL OR v_actual <= rec.good_max);
      v_total := v_total + 1;
      IF v_ok THEN v_pass := v_pass + 1; END IF;
      v_items := v_items || jsonb_build_object(
        'metric_code', rec.metric_code, 'name', rec.name_vi, 'category', rec.category,
        'actual', v_actual, 'status', CASE WHEN v_ok THEN 'pass' ELSE 'fail' END,
        'target', COALESCE('≥'||rec.good_min::text, '≤'||rec.good_max::text),
        'note', rec.source_note, 'industry_code', rec.industry_code);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'stage', p_stage, 'industry_code', v_nganh,
    'passed', v_pass, 'measured', v_total,
    'score_pct', CASE WHEN v_total > 0 THEN round(v_pass::numeric / v_total * 100, 0) ELSE 0 END,
    'items', v_items);
END;
$$;
GRANT EXECUTE ON FUNCTION grade_vs_benchmark(uuid, text) TO authenticated, service_role;
