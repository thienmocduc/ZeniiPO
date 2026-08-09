# ZENIIPO — BỘ TICKET "BUSINESS BRAIN V1" (bản 2 · 2026-08-06 — CẬP NHẬT SAU KHI SCHEMA ĐÃ CONVERT XONG)

> **Cho đội ZeniIPO.** Kiến trúc 3 tầng chairman đã chốt: **ZeniIPO = PLAN** (BMC · financial model · masterplan · vốn) → **ZeniOS = DECISION** (target, variance, quyết định) → **ZeniERP = ACTUAL** (sổ VAS bất biến).
> **Thay đổi so bản 1:** đội core (Claude) đã làm xong phần schema + chuẩn bị deploy — EPIC 0 giờ chỉ còn THI HÀNH theo runbook, không còn phải tự convert gì. Đọc kỹ mục "ĐÃ CÓ SẴN" trước khi làm để không làm trùng.

## ✅ ĐÃ CÓ SẴN (đội core làm xong — KHÔNG làm lại)
| Thứ | Ở đâu | Trạng thái |
|---|---|---|
| **29 migrations chuẩn Zeni Postgres** (convert từ 28 bản Supabase + `00_zeni_stub`) | `packages/database/zenicloud/*.sql` | ✅ Verify 3 vòng idempotent 29/29 EXIT_OK trên DB thử; sanity 108 agent · 32 module · 8 tenant không nhân đôi |
| Ghi chú convert từng thay đổi | `packages/database/zenicloud/CONVERSION_NOTES.md` | ✅ Đọc TRƯỚC khi đụng DB |
| `.gcloudignore` (repo 285MB → gọn khi build) | repo root | ✅ |
| Entry deploy `zeniipo` (image tag theo git-sha) | `Zeni-Digital-Web3/scripts/deploy-zeni-cloud.mjs` | ✅ Sẵn — chạy 1 lệnh khi có PAT |
| Bản gốc Supabase migrations | `packages/database/supabase/migrations/` | Giữ nguyên làm đối chiếu — KHÔNG sửa |

## ⛔ 2 NÚT CHẶN NGOÀI CODE (chairman đang xử — theo dõi, không chờ mù)
1. **Billing GCP `zeni-cloud-prod` delinquent** → build image đang bị chặn. Chairman đang gỡ (thanh toán hoặc link sang billing account đang sống).
2. **PAT Zeni Cloud** (`zeni_pat_…`) — cần cho bước deploy qua Platform API.

## ⛔ 8 RÀNG BUỘC KIẾN TRÚC (giữ nguyên từ bản 1 — vi phạm = không merge)
1. SSoT phân tầng: IPO sở hữu PLAN · OS sở hữu cap-table/data-room/decision · ERP sở hữu sổ — IPO không tạo bảng cho dữ liệu nhà khác, chỉ đọc API.
2. Chung ngôn ngữ số: mọi dòng tiền kế hoạch map hệ tài khoản VAS + kỳ THÁNG + company_id.
3. Plan version hoá — immutable sau publish.
4. Tiền = BIGINT; tỷ lệ tính runtime.
5. Mọi số hiển thị kèm nhãn nguồn `{nguồn · thời điểm}`.
6. Tài liệu investor-facing: snapshot immutable + human-review bắt buộc.
7. Fail-closed: input sai → throw; nguồn chưa nối → "chưa đo được", không ước.
8. Test acceptance là điều kiện DONE — thiếu evidence = chưa xong.

---

## EPIC 0 — DEPLOY ĐÚNG DỮ LIỆU LÊN ZENI CLOUD (runbook thi hành theo THỨ TỰ — mỗi bước có lệnh + kiểm chứng)

### ZIPO-001a · Build image lên registry 〔chạy được NGAY khi billing sống〕
```bash
cd Zeni-iPO
gcloud builds submit . --project zeni-cloud-prod \
  --account zeni-cloud-deployer@zeni-cloud-prod.iam.gserviceaccount.com \
  --region asia-southeast1 \
  --tag asia-southeast1-docker.pkg.dev/zeni-cloud-prod/zeni-cloud/zeniipo:$(git rev-parse --short HEAD)
```
**Kiểm chứng DONE:** build SUCCESS + digest sha256 in ra; `.gcloudignore` có hiệu lực (archive < 20MB, KHÔNG phải 285MB).

### ZIPO-001b · Deploy service qua Platform API (cần PAT — KHÔNG deploy raw gcloud)
```bash
cd Zeni-Digital-Web3
ZENI_TOKEN=<PAT_chairman_cấp> node scripts/deploy-zeni-cloud.mjs --only=zeniipo
```
Ghi nhớ: **không** set env `PORT`, **không** set secret `DATABASE_URL` (platform tự inject socket /cloudsql + gắn Cloud SQL instance). Nếu API báo image không được phép → nhờ chairman POST image-whitelist prefix (đã có prefix `asia-southeast1-docker.pkg.dev/zeni-cloud-prod/zeni-cloud/` từ trước — thường không cần).
**Kiểm chứng DONE:** `GET /projects?ws=zeni-digital-saas-business` thấy `zeniipo` status `running` + có `domain` (URL *.run.app).

### ZIPO-001c · DỰNG DỮ LIỆU: chạy 29 migrations lên DB prod — THỨ TỰ BẮT BUỘC
Chạy qua job `ops/db-setup` (pattern zenios-saas) hoặc runner `zenios/scripts/run-sql.ts` với connection prod do chairman cấp phiên. **Tuyệt đối theo thứ tự tên file** (00 → 001 → … → 028):
```
00_zeni_stub.sql   ← LUÔN ĐẦU TIÊN (auth schema + GUC + roles authenticated/anon/service_role)
001_auth_rbac.sql … 028_modes_and_connectors.sql
```
Quy tắc an toàn prod:
- DB đích: **database RIÊNG cho zeniipo** trên instance `zeni-tenant-db` (vd `zeni_ipo`) — KHÔNG đổ chung vào `zeni_digital_saas_business` (28 bảng khác domain, tránh giẫm tên bảng OS/ERP). Tạo DB mới `ENCODING 'UTF8' TEMPLATE template0` (bài học WIN1252 trong CONVERSION_NOTES).
- Chạy 2 LẦN liên tiếp — lần 2 phải sạch y như lần 1 (idempotent đã verify ở dev; prod phải lặp lại được kết quả đó).
**Kiểm chứng DONE:** cả 2 lần 29/29 EXIT_OK · đếm sanity: `agent_catalog=108, modules_catalog=32` · `SELECT auth.uid()` trả NULL khi chưa set GUC.

### ZIPO-001d · Seed/Import dữ liệu nghiệp vụ
- Seed catalog (agent/module/journey template) ĐÃ NẰM TRONG migrations — không seed tay.
- **Data người dùng cũ trên Supabase (`moduqdlwgbmvlwiiicqp`)**: chairman xác nhận 1 trong 2:
  (a) *data test → BỎ* — không import gì, hệ sạch;
  (b) *data quý → chairman lấy Database password (Supabase dashboard → Settings → Database)* → dump `pg_dump --data-only --exclude-schema=auth --exclude-schema=storage` → rà mapping user id (auth.users Supabase → Zeni ID UUID — bảng đối chiếu email) → import. Mọi row import giữ nguyên timestamps.
**Kiểm chứng DONE:** biên bản 5 dòng ghi rõ đã chọn (a) hay (b) + số row import từng bảng (nếu b).

### ZIPO-002 · Thay Supabase Auth → Zeni ID SSO 〔làm SONG SONG 001a-c, PHẢI xong trước khi mở public〕
Bỏ `lib/supabase/{client,middleware}.ts` → session cookie Zeni ID (mẫu: `Zeni-Digital-Web3/zeni-hub/src/lib/zeni/session.ts` + `proxy.ts` refresh ngầm + **memo token TTL 60s** — bắt buộc copy pattern memo này, không có nó mỗi trang chậm ~2s vì gọi /auth/me nhiều lần). Login = redirect Hub `/auth?continue=<url>`. Upsert `auth.users(id=UUID Zeni ID, email)` khi phiên mới.
**Kiểm chứng DONE:** đăng nhập tài khoản Zeni ID thật vào dashboard · phiên không bị đá sau 60' · 0 import supabase trong `apps/web/src` (grep) · trang load < 1s sau đăng nhập.

### ZIPO-003 · Cap-table đổi nguồn sang API ZeniOS 〔sau 002〕
GIỮ UI — đổi data source sang `GET {OS}/api/internal/cap-table` (headers `x-internal-key` + `x-user-id`); dilution gọi funding-engine OS; ghi vòng mới = POST về OS có approval. Bảng cap local: đóng ghi (read-only 30 ngày đối chiếu) → drop.
**Kiểm chứng DONE:** số cap-table hiện từ OS kèm nhãn nguồn · grep 0 INSERT/UPDATE bảng cap local.

### ZIPO-004 · DNS + nghiệm thu cuối
Chairman đổi DNS `zeniipo.com` → domain service mới (sau khi 001b-c-d + 002 PASS trên URL *.run.app). Smoke cuối: đăng nhập → onboarding wizard → dashboard → cap-table (đọc OS) → audit-log ghi nhận.
**Kiểm chứng DONE:** zeniipo.com 200 · 5 bước smoke có screenshot · 0 request nào tới *.supabase.co / *.vercel.app (network tab).

---

## EPIC 1 — BUSINESS DESIGN STUDIO (PLAN) 〔giữ nguyên bản 1〕
- **ZIPO-101** BMC 9 khối version hoá (autosave draft · publish immutable · AI draft gắn nhãn "đề xuất", 0 item tự vào canvas).
- **ZIPO-102** COA mapping — bảng `plan_coa_lines` seed: `5111 · 5113 · 521 · 632 · 6411 · 6417 · 6421 · 6427 · 635 · 515 · 711 · 811 · 821` (đối chiếu `coa_accounts` ZeniERP); mọi dòng model bắt buộc chọn từ danh mục.
- **ZIPO-103** Financial Model Engine chuẩn MBA (pure + test số cứng ≥12): revenue build-up `price×volume` / MRR `(1+new−churn)`; COGS %-hoặc-unit; OPEX theo headcount×(lương+BH) + CAC×khách mới; EBITDA→EBT→thuế 20% (config effective_from)→net; **CF gián tiếp theo DSO/DPO/DIO**; cash liên tục tháng nối tháng; 3 kịch bản 1 bộ assumptions; sensitivity tornado; Σ12 tháng = năm (integer).
- **ZIPO-104** plan_versions immutable sau publish + màn diff v(n)/v(n−1).

## EPIC 2 — "THÔNG HÀM SỐ" 〔giữ nguyên bản 1〕
- **ZIPO-201** `plan_targets (version × company × period × coa_line × amount bigint)` sinh lúc publish + API `GET /api/internal/plan-targets` (2 lớp key + uid pass-through — mẫu `zenierp/src/app/api/internal/pnl-summary/route.ts`). AC: 200/401/405 + cross-tenant rỗng + khớp engine từng đồng.
- **ZIPO-202** [OWNER: đội Zeni Digital core] OS nhận target + variance + rule revenue_miss — bên IPO chỉ giữ đúng contract 201.
- **ZIPO-203** Test xuyên 3 tầng 1 lệnh: plan 1 tỷ → OS target → ERP bút toán 900tr → variance −10% → Decision Card. 5 bước PASS/FAIL, chạy 2 lần không card trùng. **Đây là gate nghiệm thu của chairman.**

## EPIC 3 — CHUẨN VỐN QUỐC TẾ 〔giữ nguyên bản 1〕
- **ZIPO-301** Stage-gate Seed→Listed điều kiện máy đo được (Series A ~ ARR $1M · churn <3% · runway >12th; Pre-IPO VN theo NĐ155/HOSE: 2 năm BCTC kiểm toán · ROE dương · không lỗ luỹ kế · governance đủ) — data version-controlled, nguồn chưa nối = "chưa đo được".
- **ZIPO-302** Unit economics nối số thật ERP: CAC = S&M(641x)÷khách mới · LTV = ARPA×GM%÷churn · LTV/CAC ≥3× · payback ≤12-18th · Burn Multiple <1.5 · Rule of 40.
- **ZIPO-303** Readiness 6 trụ pure function `{metric, nguon_api, gia_tri, threshold, ket_qua}` + % coverage — không trụ nào ước.

## DEFINITION OF DONE (mọi ticket)
Build 0 lỗi + AC pass có log dán PR · không vi phạm 8 ràng buộc · demo dùng tenant demo (số thật Zeni Holdings phải chairman duyệt trước khi lộ) · UI theo design system sẵn có · PR ghi ticket ID.

*Đối chiếu kiến trúc: `Zeni-Digital-Web3/docs/products/zeniipo.spec.md` (§0b) + `docs/specs/007-zeniipo-brain/`. Hai đội gặp nhau tại contract ZIPO-201.*
