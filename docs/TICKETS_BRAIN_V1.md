# ZENIIPO — BỘ TICKET "BUSINESS BRAIN V1" (bàn giao build tiếp · 2026-08-06)

> **Cho đội ZeniIPO.** Chairman đã chốt kiến trúc 3 tầng cho cả hệ Zeni:
> **ZeniIPO = PLAN** (thiết kế business: BMC · financial model · masterplan · vốn) → **ZeniOS = DECISION** (nhận target, so plan-vs-actual, ra quyết định) → **ZeniERP = ACTUAL** (sổ kế toán VAS, bất biến).
> Bản repo hiện tại (54 màn) đã phủ ~85% hành trình — RẤT TỐT. Bộ ticket này là 15% còn thiếu + 3 khoản nợ nền tảng, viết đủ chi tiết để build không phải hỏi lại. Có gì mơ hồ: hỏi chairman/Claude trước khi tự đoán.

## ⛔ 8 RÀNG BUỘC KIẾN TRÚC (áp cho MỌI ticket — vi phạm = không merge)
1. **SSoT phân tầng**: IPO sở hữu PLAN · OS sở hữu cap-table/data-room/decision · ERP sở hữu sổ. IPO **không tạo bảng** cho dữ liệu nhà khác — chỉ đọc API.
2. **Chung ngôn ngữ số**: mọi dòng tiền kế hoạch map **hệ tài khoản VAS** (danh mục ở ZIPO-102) + kỳ THÁNG + company_id. Không có dòng P&L "tự do".
3. **Plan version hoá — immutable sau publish**: sửa kế hoạch = tạo version mới; version cũ giữ vĩnh viễn (nhà đầu tư soi "hứa vs làm").
4. **Tiền = BIGINT VND** (hoặc minor-unit USD) — cấm float; tỷ lệ/%/ratio tính runtime, không lưu.
5. **Mọi số hiển thị kèm nhãn nguồn** `{nguồn · thời điểm}` — số không nguồn là bug.
6. **Tài liệu investor-facing**: sinh từ snapshot immutable + bắt buộc human-review — AI chỉ đề xuất.
7. **Fail-closed**: input âm/thiếu → throw, không đoán; nguồn chưa nối → hiện "chưa đo được", không ước.
8. **Test acceptance là điều kiện DONE** — mỗi ticket có AC đo được bên dưới; thiếu evidence = chưa xong.

---

## EPIC 0 — NỀN TẢNG (làm TRƯỚC, chặn mọi thứ khác)

### ZIPO-001 · Di trú hạ tầng: Vercel + Supabase → Zeni Cloud 〔P0 · blocker〕
**Bối cảnh:** zeniipo.com đang chết (HTTP 402 Vercel DEPLOYMENT_DISABLED); hạ tầng ngoài trái chuẩn tập đoàn (mọi app chạy Zeni Cloud).
**Việc:**
- Build image bằng `Dockerfile` sẵn ở root (multi-stage pnpm+turbo → Next standalone) → đẩy registry `asia-southeast1-docker.pkg.dev/zeni-cloud-prod/zeni-cloud/zeniipo:<git-sha>`.
- Deploy qua Zeni Cloud Platform API (`POST /api/v1/projects?ws=zeni-digital-saas-business`, cần PAT chairman cấp) — **không set env `PORT`**, **không set secret `DATABASE_URL`** (platform tự inject).
- Chuyển 28 migrations `packages/database/supabase/migrations/` → chạy trên Zeni Postgres (schema tương thích — bỏ phần supabase-specific: `auth.users` của Supabase thay bằng `auth.users` chuẩn Zeni đã có; RLS dùng GUC `app.uid` thay `auth.uid()` của Supabase — xem mẫu tại repo Zeni-Digital-Web3 `ops/db-setup/sql/01_init.sql`).
- Trỏ DNS zeniipo.com → service mới.
**AC:** zeniipo.com trả 200 · toàn bộ migrations chạy idempotent trên Zeni Postgres · 0 tham chiếu `supabase.co` trong network tab khi dùng app.

### ZIPO-002 · Thay Supabase Auth → Zeni ID SSO 〔P0〕
**Bối cảnh:** cả hệ dùng 1 tài khoản Zeni ID (`zenicloud.io/api/v1/auth/*`); hub đăng nhập tập trung.
**Việc:** bỏ `lib/supabase/client.ts + middleware.ts` → session cookie Zeni ID (xem mẫu `zeni-hub/src/lib/zeni/session.ts` + `proxy.ts` refresh ngầm ở repo Web3); login = redirect về Hub `/auth?continue=<url>`; user record upsert `auth.users(id=Zeni-ID-UUID, email)`.
**AC:** đăng nhập bằng tài khoản Zeni ID thật vào được dashboard · phiên tự gia hạn (không bị đá sau 60') · logout sạch cookie · 0 import supabase trong `apps/web/src`.

### ZIPO-003 · Cap-table: bỏ bảng riêng → đọc API ZeniOS (SSoT) 〔P0〕
**Bối cảnh:** migration `019_captable_hashchain.sql` tạo cap-table riêng — vi phạm luật SSoT (cap-table sống ở ZeniOS, event-sourced).
**Việc:** GIỮ nguyên UI màn cap-table (đẹp) — đổi data source: `GET {OS}/api/internal/cap-table?tenant=` (headers `x-internal-key` + `x-user-id` = uid phiên thật — RLS giữ nguyên chuỗi); mô phỏng pha loãng GỌI funding-engine của OS qua API (1 engine toàn hệ); GHI vòng vốn mới = `POST` về OS có approval, IPO không INSERT thẳng. Drop bảng cap-table local sau khi chuyển xong (migration mới, giữ bảng cũ read-only 30 ngày để đối chiếu).
**AC:** màn cap-table hiện đúng số từ OS kèm nhãn `nguồn: zenios · <thời điểm>` · grep 0 INSERT/UPDATE vào bảng cap local · thử sửa trực tiếp → không có đường (route/API đã gỡ).

---

## EPIC 1 — BUSINESS DESIGN STUDIO (tầng PLAN)

### ZIPO-101 · Màn Business Model Canvas 9 khối (version hoá) 〔P1〕
**Bối cảnh:** hành trình thiết kế bắt đầu từ BMC — repo chưa có màn này (grep canvas/BMC = 0).
**Spec:** 9 khối chuẩn Osterwalder: Phân khúc khách hàng · Giá trị cốt lõi · Kênh · Quan hệ khách hàng · Dòng doanh thu · Nguồn lực chính · Hoạt động chính · Đối tác chính · Cơ cấu chi phí. Mỗi khối = list items (text + tag). Bảng `business_models (id, tenant_id, version, blocks jsonb, status draft|published, published_at)`. Autosave draft; publish = khoá (immutable — trigger DB chặn UPDATE bản published, sửa = version mới). Nút "Sinh nháp bằng AI" (gọi router, output đề xuất gắn nhãn "AI đề xuất — chưa áp dụng", user bấm từng item để nhận — **0 item tự vào canvas**).
**AC:** tạo → autosave → publish → UPDATE bản published bị DB chặn · version 2 tạo được và diff hiển thị khối nào đổi · AI draft không tự ghi (đếm items sau draft = 0 khi chưa accept).

### ZIPO-102 · Chart of Accounts mapping — "ngôn ngữ chung" của financial model 〔P1 · nền của mọi ticket EPIC 2〕
**Bối cảnh:** kế hoạch phải so được với sổ thật TỪNG DÒNG → mọi line kế hoạch map TK VAS.
**Spec:** bảng `plan_coa_lines (code, label_vi, statement pnl|cf|bs, sign)` seed tối thiểu:
`5111 Doanh thu bán hàng · 5113 Doanh thu dịch vụ · 521 Giảm trừ · 632 Giá vốn · 6411 CP bán hàng-nhân sự · 6417 CP marketing · 6421 CP quản lý-nhân sự · 6427 CP thuê văn phòng · 635 CP tài chính · 515 DT tài chính · 711 Thu nhập khác · 811 CP khác · 821 CP thuế TNDN` (+ mở rộng theo nhu cầu, code phải là prefix hợp lệ của COA VAS thật — đối chiếu `coa_accounts` bên ZeniERP).
Form nhập model: mỗi dòng doanh thu/chi phí BẮT BUỘC chọn coa_line từ danh mục — không có ô text tự do cho tên dòng tiền.
**AC:** tạo model có dòng không map COA → validate chặn · export plan (ZIPO-201) mọi row có coa_line hợp lệ.

### ZIPO-103 · Financial Model Engine chuẩn MBA — assumptions → P&L/CF 36–60 tháng 〔P1 · trái tim〕
**Bối cảnh:** màn `financial-model/studio.tsx` có UI — cần engine tất định chuẩn bên dưới (hiện chưa map COA, chưa chuẩn công thức).
**Spec công thức (pure function, test số cứng từng công thức):**
- **Revenue build-up** (per dòng doanh thu, per company): `revenue[m] = price[m] × volume[m]`; `volume[m] = volume[m-1] × (1+growth_m)`; SaaS: `MRR[m] = MRR[m-1] × (1 + new_rate − churn_rate)`; doanh thu ghi vào coa 5111/5113.
- **COGS**: `cogs[m] = revenue[m] × cogs_pct` HOẶC `unit_cost × volume` (chọn per dòng) → 632.
- **OPEX**: nhân sự = `Σ headcount_plan[m][role] × salary[role] × (1 + insurance_pct)` → 6411/6421; marketing = `budget[m]` hoặc `CAC × new_customers[m]` → 6417; thuê + khác = lịch cố định → 6427.
- **EBITDA = revenue − 521 − 632 − 641x − 642x**; **EBT = EBITDA − 635 + 515 + 711 − 811**; **thuế 821 = max(0, EBT) × 20%** (thuế suất TNDN VN — config `effective_from`, không hardcode); **net = EBT − 821**.
- **Cash Flow gián tiếp**: `CF[m] = net[m] + Δworking_capital`; WC từ 3 tham số chuẩn: `DSO` (ngày phải thu — AR = revenue×DSO/30), `DPO` (phải trả), `DIO` (tồn kho); `cash[m] = cash[m-1] + CF[m] + equity_in[m] − capex[m]`.
- **3 kịch bản** base/bull/bear: mỗi assumption có 3 giá trị (hoặc multiplier) — engine chạy 3 lần, KHÔNG copy model.
- **Sensitivity (màn sẵn có — nối engine)**: tornado ±10/20% từng assumption → Δ EBITDA năm 3, xếp hạng.
- Bất biến kiểm trong engine: `Σ 12 tháng = tổng năm` từng dòng (integer, VND); `cash[m]` liên tục (cuối m = đầu m+1); âm assumption → throw.
**AC:** bộ test ≥12 case số cứng (mỗi công thức ≥1) pass · 3 kịch bản chạy từ 1 bộ assumptions · sensitivity ra bảng xếp hạng · mọi output row mang coa_line.

### ZIPO-104 · Plan versioning + Publish + Diff 〔P1〕
**Spec:** `plan_versions (id, tenant_id, version_no, model_ref, status draft|published, published_by, published_at)` — publish trong 1 transaction: khoá version (trigger immutable) + sinh `plan_targets` (ZIPO-201). Màn diff v(n) vs v(n−1): assumption nào đổi, dòng P&L nào đổi >X%.
**AC:** publish → UPDATE version bị DB chặn · diff hiển thị đúng 3 thay đổi test · v cũ query được nguyên vẹn.

---

## EPIC 2 — "THÔNG HÀM SỐ" PLAN → RUN → RECORD

### ZIPO-201 · Bảng plan_targets + Internal API cho ZeniOS 〔P1〕
**Spec:** `plan_targets (id, tenant_id, plan_version_id, company_id, period date (ngày 01), coa_line, amount bigint, metric_key null)` — sinh tự động lúc publish (từ output engine 103). API: `GET /api/internal/plan-targets?tenant=<slug>&version=<n|active>` — auth 2 lớp: header `x-internal-key` (server-to-server) + `x-user-id` (uid phiên thật bên OS — giữ nguyên chuỗi RLS; xem mẫu `zenierp/src/app/api/internal/pnl-summary/route.ts` repo Web3). GET only; sai key 401; POST 405.
**AC:** curl 3 case 200/401/405 · cross-tenant: uid không thuộc tenant → rows rỗng · số trả về khớp engine từng đồng (test đối chiếu).

### ZIPO-202 · [PHỐI HỢP — OWNER: đội Zeni Digital core] OS nhận target + variance
**Ghi để biết ranh giới, KHÔNG build bên IPO:** OS sẽ có `plan-client` + engine `variance.ts` + rule `revenue_miss` + màn Variance (tasks T720-T724 repo Web3). Bên IPO chỉ cần đảm bảo ZIPO-201 đúng contract.

### ZIPO-203 · Bộ test xuyên 3 tầng — "hàm số thông" 〔P1 · gate nghiệm thu của chairman〕
**Spec:** script tự động 1 lệnh: (1) publish plan v-test: revenue công ty A tháng T = 1.000.000.000 (coa 5111) → (2) gọi API plan-targets xác nhận đúng 1 tỷ → (3) ghi bút toán bên ERP 5111 = 900.000.000 posted (qua API/fixture ERP dev) → (4) OS variance = −10% + nguồn `plan:v-test` → (5) ngưỡng rule 5% → Decision Card sinh. Mỗi bước in PASS/FAIL.
**AC:** script chạy pass cả 5 bước trên môi trường dev chung · chạy 2 lần không sinh card trùng (no-dup).

---

## EPIC 3 — CHUẨN VỐN QUỐC TẾ (nâng các màn sẵn có)

### ZIPO-301 · Stage-gate vốn: Seed→A→B→Pre-IPO→Listed có điều kiện ĐO ĐƯỢC 〔P2〕
**Spec:** khung gate chuẩn (data version-controlled, không hardcode): mỗi giai đoạn = bộ tiêu chí máy đo được từ hệ, ví dụ chuẩn thị trường: Series A ~ `ARR ≥ $1M + tăng trưởng ≥15%/tháng 6 tháng + churn <3% + runway >12 tháng`; Pre-IPO VN ~ `2 năm BCTC kiểm toán + ROE dương + không lỗ luỹ kế (điều kiện HOSE NĐ155) + governance đủ (BKS, ĐHĐCĐ minutes)`. Mỗi tiêu chí `{metric, nguồn_api (ERP/OS/Law), threshold, trạng_thái: đạt|chưa|chưa-đo-được}` — nguồn chưa nối = "chưa đo được", cấm ước.
**AC:** tenant demo đủ/thiếu hồ sơ biết trước → gate chấm đúng · đổi khung = data migration có duyệt, không sửa code.

### ZIPO-302 · Unit Economics chuẩn — nối số THẬT 〔P2〕
**Spec:** màn `clv-cac`/`burn` sẵn có — nối công thức chuẩn + nguồn thật: `CAC = chi phí S&M kỳ (641x từ ERP) ÷ khách mới`; `LTV = ARPA × gross_margin% ÷ churn`; `LTV/CAC` (chuẩn ≥3×); `CAC payback = CAC ÷ (ARPA × GM%)` tháng (chuẩn ≤12-18); `Burn Multiple = net burn ÷ net new ARR` (chuẩn <1.5 tốt); `Rule of 40 = growth% + FCF margin%`. Mỗi chỉ số hiện: giá trị + benchmark + nhãn nguồn (ERP kỳ nào).
**AC:** số khớp tay trên fixture · thiếu nguồn → "chưa đo được".

### ZIPO-303 · Readiness Score 6 trụ đọc dữ liệu thật 〔P2〕
**Spec:** theo spec sản phẩm §10.2 (repo Web3 `docs/products/zeniipo.spec.md`): pure function, mỗi tiêu chí `{metric, nguon_api, gia_tri, threshold, ket_qua}`; trụ: tài chính (số kỳ khoá sổ liên tục từ ERP) · pháp lý (giấy phép Vault Law) · quản trị (nghị quyết OS) · cap-table (event-sourced sạch OS) · vận hành (OKR/kpi OS) · CBTT. Điểm tổng kèm % coverage (bao nhiêu tiêu chí đo được).
**AC:** fixture đủ/thiếu → điểm đúng · coverage hiển thị · không trụ nào "ước".

---

## DEFINITION OF DONE (mọi ticket)
Build 0 lỗi + test AC pass có log dán vào PR · không vi phạm 8 ràng buộc đầu file · số demo dùng tenant demo (không số thật Zeni Holdings khi chưa duyệt) · UI theo design system sẵn có của repo · mọi PR ghi rõ ticket ID.

*Thắc mắc kiến trúc → đối chiếu: `Zeni-Digital-Web3/docs/products/zeniipo.spec.md` (§0b PLAN-RUN-RECORD) + `docs/specs/007-zeniipo-brain/` (spec + tasks phía Zeni Digital). Hai bên gặp nhau ở contract ZIPO-201.*
