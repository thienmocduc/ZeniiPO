-- ============================================================================
-- 034 — BỐ CỤC MÀN HÌNH THEO VAI (mỗi C-level thấy đúng việc của mình)
--
-- BỐI CẢNH. CSDL đã khai 8 vai nội bộ (chr·ceo·cfo·coo·cto·cmo·clo·emp) từ
-- migration 001, nhưng rà toàn bộ mã giao diện thì **chỉ đúng MỘT trang** đổi
-- theo vai (`/audit-log`). Còn lại mọi vai thấy y hệt nhau: CFO thấy đúng những
-- gì CTO thấy, và phải lội qua 51 mục menu để tìm phần tài chính.
--
-- VÌ SAO ĐỂ TRONG BẢNG, KHÔNG VIẾT VÀO MÃ. Bố cục màn hình là thứ thay đổi
-- theo cách công ty vận hành, không phải theo phiên bản phần mềm. Để trong mã
-- thì mỗi lần đổi thứ tự một mục cũng phải dựng lại và tung lại bản chạy; để
-- trong bảng thì sửa dữ liệu là xong, và mỗi công ty về sau có thể có bố cục
-- riêng mà không cần nhánh mã riêng.
--
-- KHÔNG PHẢI PHÂN QUYỀN. Bảng này quyết định thấy gì TRƯỚC, không quyết định
-- được phép xem gì. Quyền vẫn do RLS ở CSDL giữ. Nhầm hai thứ này là tự tạo
-- ra lỗ bảo mật kiểu "giấu nút đi coi như đã cấm".
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_dashboard_blocks (
  role       text NOT NULL CHECK (role IN ('chr','ceo','cfo','coo','cto','cmo','clo','emp')),
  block_key  text NOT NULL,           -- đường dẫn trang ('/financials') hoặc khối ('dash:okr')
  position   int  NOT NULL,           -- thứ tự hiện, nhỏ hơn thì lên trước
  title_vi   text NOT NULL,
  why_vi     text,                    -- một câu: vì sao vai này cần nhìn thứ đó trước
  is_primary boolean NOT NULL DEFAULT true,
  PRIMARY KEY (role, block_key)
);

ALTER TABLE role_dashboard_blocks ENABLE ROW LEVEL SECURITY;

-- Danh mục tham chiếu, không chứa dữ liệu công ty ⇒ cho đọc công khai, cùng
-- mẫu với `benchmarks_public_read` ở 026.
DROP POLICY IF EXISTS role_blocks_public_read ON role_dashboard_blocks;
CREATE POLICY role_blocks_public_read ON role_dashboard_blocks FOR SELECT USING (true);

INSERT INTO role_dashboard_blocks (role, block_key, position, title_vi, why_vi) VALUES
-- ── CHỦ TỊCH — nhìn xuyên hệ sinh thái, không sa vào một chức năng ──
 ('chr','/cockpit',       1,'Buồng lái điều hành','Một màn hình gom tình trạng mọi công ty'),
 ('chr','/console',       2,'Zeni Console','Điều hành cấp nền tảng, xuyên công ty'),
 ('chr','/northstar',     3,'Sao Bắc Đẩu','Chỉ số duy nhất cả tổ chức đang đuổi theo'),
 ('chr','/cap-table',     4,'Bảng cổ phần','Cơ cấu sở hữu là thứ chủ tịch chịu trách nhiệm cuối'),
 ('chr','/financials',    5,'Báo cáo tài chính','Sức khoẻ tài chính hợp nhất'),
 ('chr','/investors',     6,'Nhà đầu tư','Quan hệ cổ đông là việc không uỷ quyền được'),
 ('chr','/board',         7,'Hội đồng quản trị','Nghị quyết và trách nhiệm quản trị'),
 ('chr','/milestones',    8,'Cột mốc','Tiến độ tới ngày niêm yết'),

-- ── CEO — điều hành mục tiêu và tăng trưởng ──
 ('ceo','/cockpit',       1,'Buồng lái điều hành','Tình trạng toàn công ty trong một màn hình'),
 ('ceo','/northstar',     2,'Sao Bắc Đẩu','Mục tiêu duy nhất dẫn mọi quyết định'),
 ('ceo','/okrs',          3,'OKR','Mục tiêu quý và kết quả then chốt'),
 ('ceo','/kpi-matrix',    4,'Ma trận KPI','Chỉ số vận hành theo từng bộ phận'),
 ('ceo','/sales',         5,'Bán hàng','Nguồn tăng trưởng thật'),
 ('ceo','/investors',     6,'Nhà đầu tư','Đường ống gọi vốn'),
 ('ceo','/ipo-execution', 7,'Thực thi IPO','Việc phải làm để lên sàn'),
 ('ceo','/team',          8,'Nhân sự','Năng lực thực thi'),

-- ── CFO — tiền, chuẩn mực, và khả năng sống ──
 ('cfo','/financials',     1,'Báo cáo tài chính','Ba báo cáo phải nối nhau'),
 ('cfo','/burn',           2,'Đốt tiền & Số tháng sống','Câu hỏi sống còn: còn sống được bao lâu'),
 ('cfo','/forecast',       3,'Dự báo 5 năm','Kế hoạch tài chính dài hạn'),
 ('cfo','/financial-model',4,'Mô hình tài chính','Nơi kiểm giả định trước khi cam kết'),
 ('cfo','/valuation',      5,'Định giá','Phải nêu được phương pháp, ngày và bộ so sánh'),
 ('cfo','/clv-cac',        6,'Kinh tế đơn vị','Một khách mang lại bao nhiêu so với chi phí có được'),
 ('cfo','/cap-table',      7,'Bảng cổ phần','Pha loãng ảnh hưởng trực tiếp tới giá trị mỗi cổ phần'),
 ('cfo','/sensitivity',    8,'Phân tích độ nhạy','Giả định nào sai thì vỡ kế hoạch'),
 ('cfo','/billing',        9,'Thanh toán','Dòng tiền vào thực tế'),

-- ── COO — quy trình và năng lực chạy ──
 ('coo','/task-cascade', 1,'Thác công việc','Mục tiêu đã chảy xuống việc cụ thể chưa'),
 ('coo','/sops',         2,'Quy trình vận hành','Thứ biến công ty phụ thuộc người thành công ty chạy được'),
 ('coo','/workflow',     3,'Luồng công việc','Việc đi qua những chặng nào'),
 ('coo','/team',         4,'Nhân sự','Ai làm được việc gì'),
 ('coo','/kpi-matrix',   5,'Ma trận KPI','Đo năng suất theo bộ phận'),
 ('coo','/dataflow',     6,'Luồng dữ liệu','Số liệu vận hành đến từ đâu'),
 ('coo','/playbook',     7,'Cẩm nang','Cách làm đã chuẩn hoá'),

-- ── CTO — hệ thống, dữ liệu, an toàn ──
 ('cto','/dataflow',         1,'Luồng dữ liệu','Bản đồ dữ liệu chảy trong hệ thống'),
 ('cto','/console',          2,'Zeni Console','Trạng thái hạ tầng và dịch vụ'),
 ('cto','/settings-security',3,'Bảo mật','Tư thế an toàn của hệ thống'),
 ('cto','/audit-log',        4,'Nhật ký kiểm toán','Ai làm gì, lúc nào'),
 ('cto','/nl-query',         5,'Hỏi đáp bằng lời','Tra dữ liệu không cần viết truy vấn'),
 ('cto','/workflow',         6,'Luồng công việc','Tự động hoá đang chạy tới đâu'),

-- ── CMO — khách hàng, kênh, câu chuyện ──
 ('cmo','/sales',       1,'Bán hàng','Kết quả cuối của mọi hoạt động tiếp thị'),
 ('cmo','/clv-cac',     2,'Kinh tế đơn vị','Chi phí có được một khách và giá trị khách mang lại'),
 ('cmo','/market-data', 3,'Dữ liệu thị trường','Quy mô và tốc độ của thị trường'),
 ('cmo','/market-intel',4,'Tin tức thị trường','Đối thủ và xu hướng'),
 ('cmo','/comparables', 5,'So sánh ngành','Mình đứng đâu so với cùng ngành'),
 ('cmo','/pitch-deck',  6,'Hồ sơ gọi vốn','Câu chuyện kể với nhà đầu tư'),
 ('cmo','/feedback',    7,'Phản hồi','Khách nói gì'),

-- ── CLO — pháp lý, tuân thủ, công bố ──
 ('clo','/legal',          1,'Pháp lý','Hồ sơ pháp lý của doanh nghiệp'),
 ('clo','/compliance',     2,'Tuân thủ','Nghĩa vụ có ngày hạn — trễ là bị phạt'),
 ('clo','/governance-docs',3,'Hồ sơ quản trị','Điều lệ, quy chế, nghị quyết'),
 ('clo','/terms',          4,'Điều khoản','Điều khoản gọi vốn và ràng buộc kèm theo'),
 ('clo','/board',          5,'Hội đồng quản trị','Thẩm quyền và biên bản'),
 ('clo','/data-room',      6,'Phòng dữ liệu','Ai được xem hồ sơ gì, tới khi nào'),
 ('clo','/audit-log',      7,'Nhật ký kiểm toán','Bằng chứng cho thẩm định'),

-- ── NHÂN VIÊN — việc của mình và cách làm ──
 ('emp','/task-cascade',1,'Công việc của tôi','Việc được giao và hạn'),
 ('emp','/sops',        2,'Quy trình','Cách làm đúng'),
 ('emp','/academy',     3,'Học viện','Nâng năng lực'),
 ('emp','/training',    4,'Thao trường','Luyện theo tình huống thật'),
 ('emp','/feedback',    5,'Phản hồi','Góp ý và ghi nhận')
ON CONFLICT (role, block_key) DO UPDATE SET
  position = EXCLUDED.position,
  title_vi = EXCLUDED.title_vi,
  why_vi   = EXCLUDED.why_vi;
