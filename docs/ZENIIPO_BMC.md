# BUSINESS MODEL CANVAS — ZENIIPO (v1 · 2026-08-09 · chờ chairman duyệt)

> Dogfooding: đây là BMC của CHÍNH nền tảng, viết theo đúng 9 khối Osterwalder mà
> sản phẩm dạy khách hàng. Khi migration 029 apply, nhập bản này vào bảng
> `business_models` làm version 1 và publish (bất biến).

---

## 1 · PHÂN KHÚC KHÁCH HÀNG (Customer Segments)

| Phân khúc | Chân dung | Trả tiền cho gì |
|---|---|---|
| **S1 · Startup 0→1** | Founder solo/pre-seed VN & SEA, chưa có hệ thống | Khung bài bản: BMC → model tài chính → gọi vốn |
| **S2 · DN đang tăng trưởng cần tái cấu trúc** | Doanh nghiệp có doanh thu (5-500 tỷ/năm) muốn chuẩn hoá theo cơ chế vốn IPO | Chẩn đoán 8 trụ, quản trị, minh bạch số liệu |
| **S3 · Tập đoàn & Holding** | Nhiều công ty con, cần điều hành hợp nhất (như chính Zeni Holdings) | Console đa công ty, masterplan, plan-vs-actual |
| **S4 · Nhà đầu tư** (quỹ VC/PE, angel, CLB đầu tư) | Cần deal-flow sạch: startup có số liệu chuẩn hoá, data room sẵn | Deal đã thẩm định bằng dữ liệu chuẩn, so sánh được |
| S5 · Học viên Academy | Người học vận hành chuẩn IPO-MBA, thi chứng chỉ | Nội dung + chứng chỉ IPO-Ready Founder |

**Insight hai chiều:** S1-S3 tạo NGUỒN CUNG deal chuẩn hoá → S4 là NGUỒN CẦU vốn.
Càng nhiều startup vận hành trên ZeniIPO, dữ liệu càng chuẩn, nhà đầu tư càng phải vào đây tìm deal → hiệu ứng mạng 2 chiều. **Đây là con hào (moat) của nền tảng.**

## 2 · GIÁ TRỊ CỐT LÕI (Value Propositions)

- **Cho founder:** "Từ Day-0 đến ring-bell" — một nền tảng duy nhất thay 20 công cụ rời rạc; vận hành đúng chuẩn công ty niêm yết NGAY TỪ ĐẦU (COA VAS, plan bất biến, số có nguồn).
- **Cho DN tái cấu trúc:** chẩn đoán 8 trụ so chuẩn IPO bằng dữ liệu thật + lộ trình vá từng trụ; đấu nối dữ liệu sẵn có (Google/Lark/MISA) không phải nhập lại.
- **Cho nhà đầu tư:** deal-flow đã CHUẨN HOÁ — mọi startup cùng hệ quy chiếu (COA VAS, LTV:CAC, Rule of 40, readiness score), so sánh táo-với-táo, DD nhanh gấp nhiều lần.
- **Khác biệt lõi:** 108 AI agent vận hành tự động ~90% + tri thức MBA/banker mã hoá thành hàm (31 benchmark, 3 phương pháp định giá, stage-gate) — không phải dashboard trống mà là "đầu não có sẵn chuyên gia".

## 3 · KÊNH (Channels)

- Sản phẩm tự phục vụ: zeniipo.com (trial 14 ngày, không cần thẻ)
- Academy + chứng chỉ → phễu kéo founder vào nền tảng
- Hệ sinh thái Zeni: ZeniCloud (hạ tầng), ZeniOS/ZeniERP (khách chéo), cộng đồng CLB founder
- Đối tác giới thiệu: công ty luật, kiểm toán, ngân hàng đầu tư, vườn ươm
- Sự kiện Demo Day / báo cáo benchmark ngành (content marketing bằng dữ liệu)

## 4 · QUAN HỆ KHÁCH HÀNG (Customer Relationships)

- Tự phục vụ + AI CTO Assistant trong app (S1)
- CSM chuyên trách + war-room IPO (S3, Enterprise)
- Cộng đồng founder + Academy cohort (giữ chân bằng học tập)
- Với nhà đầu tư: quan hệ curated — chỉ mở deal đạt ngưỡng readiness

## 5 · DÒNG DOANH THU (Revenue Streams) — 7 MODEL

| # | Model | Cơ chế | Trạng thái |
|---|---|---|---|
| R1 | **SaaS subscription** | 5 tier: Free trial · Explorer $49 · Pro $499 · Elite $1.999 · Enterprise $4.999+/tháng | ✅ Đã có bảng giá + Stripe |
| R2 | **Capital Hub — phí thành công gọi vốn** | Quy tụ startup chuẩn hoá ↔ giới thiệu quỹ; phí thành công 1-3% giá trị round khi chốt qua nền tảng | 🔶 CHIẾN LƯỢC MỚI — cần thêm vào spec (đề xuất ZIPO-401) |
| R3 | **Academy & chứng chỉ** | Khoá IPO-MBA thực chiến + phí thi chứng chỉ IPO-Ready Founder; bán lẻ hoặc gói doanh nghiệp | ⚠️ Scaffold đã có (L1 seed), cần content L2-7 + cổng thu phí |
| R4 | **AI usage vượt hạn mức** | Agent run/Council/NLQ theo credit khi vượt quota tier (bill qua ví ZeniCloud) | ⚠️ Đã đo tokens/cost từng run — cần bật billing |
| R5 | **Dịch vụ đối tác (referral)** | Giới thiệu luật, kiểm toán, định giá, IR — ăn phí giới thiệu 10-20% | 🔶 Chưa có — gắn vào sổ pháp lý/data room |
| R6 | **Dữ liệu & báo cáo benchmark** | Báo cáo benchmark ngành ẩn danh (ai đạt Rule of 40, median LTV:CAC theo ngành VN/SEA) bán cho quỹ/ngân hàng | 🔶 Tương lai — cần khối lượng tenant đủ lớn + opt-in minh bạch |
| R7 | **White-label / licensing** | Bán nền tảng cho vườn ươm, quỹ, ngân hàng chạy chương trình riêng | 🔶 Tương lai (Enterprise+) |

**Trình tự kích hoạt đề xuất:** R1 (nay) → R3 + R4 (quý tới) → R2 Capital Hub (khi ≥30-50 tenant có dữ liệu chuẩn — đây là bước ngoặt doanh thu lớn nhất) → R5 → R6/R7.

## 6 · NGUỒN LỰC CHÍNH (Key Resources)

- Nền tảng: 111+ API, 53 trang, 29 migration, engine tài chính đã test 41/41
- Tri thức mã hoá: 31 benchmark VC/banker, 13 mã COA VAS, 12 playbook phòng ban, 10 stage-gate, 3 phương pháp định giá — **đây là IP thật, khó sao chép**
- Hạ tầng Zeni Cloud (6 lớp) + AI Gateway (zen-pro-5/5.5)
- Dữ liệu vận hành chuẩn hoá của tenant (tài sản tăng theo thời gian)
- Thương hiệu & mạng lưới chairman (CLB founder, quan hệ quỹ)

## 7 · HOẠT ĐỘNG CHÍNH (Key Activities)

- Phát triển sản phẩm theo masterspec BUSINESS BRAIN (PLAN → DECISION → ACTUAL)
- Curate tri thức chuẩn (benchmark, playbook, gate) — cập nhật theo quy định VN/SEA
- Vận hành Capital Hub: thẩm định deal, kết nối quỹ, bảo chứng chất lượng dữ liệu
- Academy: sản xuất nội dung + tổ chức thi chứng chỉ
- Bảo mật & tuân thủ dữ liệu (RLS đa tầng, audit log, NĐ13)

## 8 · ĐỐI TÁC CHÍNH (Key Partnerships)

- **Nội bộ hệ sinh thái:** ZeniCloud (hạ tầng+AI), ZeniOS (decision layer), ZeniERP (sổ VAS), WitsAGI (LLM)
- Quỹ VC/PE + angel network (phía cầu của Capital Hub)
- Công ty luật, kiểm toán Big4/local, ngân hàng đầu tư (dịch vụ IPO)
- Sở giao dịch & đơn vị tư vấn niêm yết (SGX/HOSE/HNX đường dài)
- Vườn ươm, accelerator, trường kinh doanh (kênh phân phối S1)

## 9 · CƠ CẤU CHI PHÍ (Cost Structure)

- Hạ tầng cloud + AI inference (biến đổi theo usage — đã đo cost từng agent run)
- Đội ngũ sản phẩm/kỹ thuật (cố định lớn nhất)
- Curate tri thức + nội dung Academy
- Sales & CSM cho Enterprise; marketing phễu tự phục vụ
- Pháp lý & tuân thủ (đặc biệt khi vận hành Capital Hub — có thể chạm quy định môi giới vốn → cần cấu trúc phí giới thiệu/tư vấn đúng luật VN)

---

## TRẢ LỜI TRỰC TIẾP 3 CÂU HỎI CỦA CHAIRMAN

**1. Spec đã có mục hỗ trợ gọi vốn chưa?**
Công cụ PHỤC VỤ gọi vốn: ĐÃ CÓ (investor pipeline CRM, fundraise rounds, data room, pitch, định giá 3 phương pháp, stage-gate ZIPO-301). Nhưng **"quy tụ startup ↔ kết nối nhà đầu tư" (Capital Hub hai chiều) CHƯA CÓ trong masterspec** — spec hiện dừng ở tool cho từng doanh nghiệp, chưa có marketplace. Đề xuất thêm **ZIPO-401 · Capital Hub**: cổng nhà đầu tư (duyệt deal theo readiness/ngành/stage), startup opt-in mở hồ sơ chuẩn hoá, luồng giới thiệu có log, phí thành công 1-3%.

**2. Đã viết BMC cho ZeniIPO chưa?** Trước đây CHƯA — tài liệu này chính là bản v1, chờ chairman duyệt/sửa từng khối. Duyệt xong sẽ nhập vào chính công cụ BMC của nền tảng (bảng `business_models`) và publish làm version 1 bất biến.

**3. Model doanh thu:** 7 dòng ở khối 5 — hiện MỚI CHẠY R1 (SaaS). Đòn bẩy lớn nhất là **R2 Capital Hub** vì nó biến chính khách hàng thành tài sản mạng lưới, không đối thủ SaaS thuần nào có.
