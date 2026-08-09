# ZENIIPO — MASTERSPEC "BUSINESS BRAIN V2" (2026-08-10 · ACTIVE theo lệnh chairman — build full giải pháp)

> Dẫn xuất 1-1 từ **BMC v3.1** (`docs/ZENIIPO_BMC.md` — Phần III-B biểu phí 7 vai trò, Phần IV trình tự BUILD FULL → KẾT NỐI → PHÁT TRIỂN ACC, Phần V Zeni Capital, Phần VI khung EPIC).
> Kỷ luật spec-kit: mỗi EPIC = WHY (khối BMC) → WHAT (ticket) → AC đo được. **Test acceptance = điều kiện DONE.**
> V1 (`docs/TICKETS_BRAIN_V1.md`) vẫn hiệu lực cho phần nợ — gom vào EPIC 9. ID ticket V2 bắt đầu 401.

## ✅ ĐÃ CÓ SẴN (KHÔNG làm lại — tái dùng)
| Thứ | Ở đâu |
|---|---|
| Agent engine + 108 `agent_catalog` + playbooks + dispatcher | migration 024 · `apps/web/src/lib/agents/*` |
| AI Gateway ZeniCloud (zen-pro-5 FAST · zen-pro-5.5 DEEP verifier 2-pass) | `apps/web/src/lib/ai/*` |
| Connector framework (token hash · mapping whitelist · sync_runs) + ingest VN-number | migration 028 · `lib/connectors/ingest.ts` · `/api/ingest` |
| PLAN tier: COA VAS 13 mã · plan engine 41/41 · publish immutable · plan_targets API | migration 029 · `lib/plan/*` · ZIPO-102/103/104/201 ✅ |
| Business spine (P&L tháng · derive KPIs · CCC) + MBA engine (31 benchmark · unit econ · 3 định giá) + Operating Brain (12 ghế) | migrations 025-027 |
| Deploy ZeniCloud (ws=zeniipo-com) + zeniipo.com LIVE | runbook trong memory |

## ⛔ RÀNG BUỘC KIẾN TRÚC — 8 điều V1 GIỮ NGUYÊN + 2 điều mới (vi phạm = không merge)
1-8. (V1) SSoT phân tầng · COA VAS+tháng+company_id · plan immutable sau publish · **tiền BIGINT VND** · nhãn nguồn mọi số · investor-facing = snapshot + human review · fail-closed ("chưa đo được", cấm ước) · AC = DONE.
9. **LUỒNG VỐN:** mọi hành vi liên quan vốn (deal, giới thiệu, phí) có **log bất biến** + human review; naming pháp lý kỷ luật (KHÔNG "sàn/môi giới/quản lý danh mục" khi chưa license); KHÔNG chào bán công khai (showcase không giá/điều khoản/nút đầu tư); NĐT chỉ thấy chi tiết SAU verify + startup opt-in; không nội dung nào hứa lợi nhuận.
10. **ZENI PRO ADVISORS:** mọi output AI gắn nhãn "Zeni Pro đề xuất — chờ người duyệt"; grounding bắt buộc trên dữ liệu có nhãn nguồn; thiếu dữ liệu → trả lời "chưa đo được" kèm cách nối nguồn; advisor pháp lý/thuế luôn kèm "cần luật sư/kế toán trưởng xác nhận"; KHÔNG tư vấn đầu tư cá nhân hoá cho NĐT (chỉ thông tin kiểm chứng).

## THỨ TỰ BUILD (dependency — làm đúng hàng)
**EPIC 7 (billing/entitlement — luật "mọi vai trò trả phí" phải nằm trong nền) → EPIC 4 (trust data) → EPIC 10 (Zeni Pro Advisors) → EPIC 5 (Capital Hub Nấc 1) → EPIC 6 (Zeni Capital) → EPIC 8 (Bank pack) → EPIC 9 (nợ V1 — xen kẽ khi chờ review).** Landing content (giọng chuyên gia) đã áp trước theo lệnh chairman.

---

## EPIC 7 · BILLING & ENTITLEMENT 7 VAI TRÒ 〔WHY: BMC III-B/III-C — mọi vai trò trả phí〕
- **ZIPO-431 · Schema phí:** migration `030_billing_entitlements.sql` — `billing_plans` (seed đủ 7 nhóm V1-V7 theo III-B, giá **BIGINT VND**/tháng+năm, quota jsonb: ai_credit, seats, deal_listing, pack_export), `subscriptions` (tenant/user × plan × trạng thái × kỳ), `entitlements` view/function `has_entitlement(actor, key)`, `billing_events` (log bất biến append-only), `service_orders` (Dựng Số Sạch · pack lẻ · trạng thái nghiệm thu). **AC:** seed 7 nhóm đúng số III-B · trigger chặn UPDATE/DELETE `billing_events` · idempotent 2 lần.
- **ZIPO-432 · Checkout VND + hoá đơn:** flow đăng ký gói qua ZeniCloud (Lớp 04) — tạo order → xác nhận thanh toán (webhook/manual chairman xác nhận giai đoạn đầu) → kích hoạt subscription + ghi `billing_events` + bản ghi hoá đơn VAT (số liệu xuất cho kế toán). **AC:** E2E đăng ký→trả→mở quyền trên cả 3 gói DN + Investor Member + Fund Access; chưa thanh toán = quyền không mở.
- **ZIPO-433 · Paywall "free để NHÌN":** ma trận entitlement per route/API (showcase public = free; deal room, số kiểm chứng, export hồ sơ, advisor sâu = paid). Middleware + guard API. **AC:** test 7 vai trò × 5 hành động giá trị — chặn/mở đúng 35/35; cross-tenant vẫn rỗng.
- **ZIPO-434 · AI credit metering→charge:** nối cost/run có sẵn của agent engine vào trừ quota tier; vượt quota → chặn mềm + gợi ý mua credit (ví ZeniCloud). **AC:** run vượt quota bị chặn có thông báo; sổ credit khớp meter từng run.
- **ZIPO-435 · Academy paywall + chứng chỉ thu phí:** khoá L2+ sau paywall; lệ phí thi ghi `billing_events`. **AC:** chưa nộp phí không vào được bài L2/không thi.

## EPIC 4 · TRUST DATA — KIỂM CHỨNG 3 CẤP 〔WHY: I.4 "số tin được" — IP lõi〕
- **ZIPO-401 · Connector hoá đơn điện tử:** tenant tự cấp credential cổng HĐĐT của họ (meInvoice/VNPT/Viettel — qua connector framework 028, token hash sẵn); parse XML chuẩn TCT → doanh thu tháng map 5111/5113, nhãn `xác thực thuế`. **AC:** import bộ XML mẫu → tổng doanh thu khớp từng đồng với kỳ vọng; file hỏng → fail-closed ghi sync_runs.
- **ZIPO-402 · Connector sao kê ngân hàng:** nhận CSV/API sao kê (chuẩn hoá cột phổ biến các bank VN); phân loại thu-chi; nhãn `xác thực bank`. **AC:** bộ sao kê mẫu 3 bank parse đúng 100% dòng; số dư cuối kỳ khớp.
- **ZIPO-403 · Báo cáo đối soát 3 nguồn:** hàm `reconcile(tenant, kỳ)` so sổ (financial_statements) vs bank vs hoá đơn → bảng lệch + cờ đỏ. **AC:** case lệch 1 đồng bị bắt; kỳ thiếu nguồn → "chưa đo được" (không ước).
- **ZIPO-404 · Nhãn kiểm chứng 3 cấp phủ UI:** badge `tự khai < đối soát < xác thực` trên mọi con số tiền (mở rộng nhãn nguồn ràng buộc #5). **AC:** grep UI các trang tiền tệ chính — 100% số có badge; screenshot.

## EPIC 10 · ZENI PRO ADVISORS — HẠ TẦNG AI CHUYÊN GIA THEO NGHIỆP VỤ 〔WHY: lệnh chairman — "tất cả đều là chuyên gia trợ lý Zeni Pro mạnh nhất đúng nghiệp vụ"〕
- **ZIPO-451 · Catalog 12 Zeni Pro:** nâng cấp `agent_catalog`/playbooks thành 12 persona chuyên gia đầu ngành (KHÔNG tạo hệ mới — mở rộng dispatcher sẵn có): ①CFO ②Kế toán trưởng VAS ③Investment Banker–định giá ④Luật DN & Chứng khoán ⑤IR ⑥Chiến lược & BMC ⑦COO/Chuỗi cung ⑧CMO/Tăng trưởng ⑨CHRO/ESOP ⑩Thuế & Tuân thủ ⑪Kiểm toán nội bộ & Rủi ro ⑫Thư ký HĐQT. Mỗi persona: system prompt nghiệp vụ + công cụ được phép + red-line pháp lý (#10) + format output. **AC:** 12/12 trả lời đúng vai trên cùng 1 câu hỏi thử (không lẫn vai); persona luật/thuế luôn kèm dòng "cần chuyên gia con người xác nhận".
- **ZIPO-452 · Routing DEEP/FAST:** định giá · pháp lý · tài liệu investor-facing · chẩn đoán 8 trụ → `zen-pro-5.5` verifier 2-pass; vận hành hằng ngày → `zen-pro-5`. Bảng routing config, không hardcode. **AC:** log model đúng tuyến 10/10 case thử; cost ghi từng run.
- **ZIPO-453 · Grounding + citation:** context builder (mở rộng `context-builder.ts`) bơm benchmark/playbook/số tenant CÓ NHÃN NGUỒN; câu trả lời trích `{nguồn · thời điểm}`; thiếu nguồn → "chưa đo được" + hướng dẫn nối connector. **AC:** 10 câu hỏi số liệu — 10/10 có citation hoặc từ chối đúng chuẩn; 0 số bịa.
- **ZIPO-454 · Review-gate:** output investor-facing (memo, deal card note, hồ sơ) vào hàng chờ duyệt (bảng `advisor_outputs` trạng thái draft→approved, immutable sau approve). **AC:** không tồn tại đường code nào tự publish; approve ghi người duyệt + thời điểm.
- **ZIPO-455 · Quota theo tier:** nối EPIC 7 (434). **AC:** tier thấp gọi advisor DEEP bị chặn mềm đúng ma trận III-B.

## EPIC 5 · CAPITAL HUB NẤC 1 〔WHY: BMC I.7 — hợp pháp ngay, ràng buộc #9〕
- **ZIPO-411 · Showcase public:** trang hồ sơ DN công khai (opt-in): giới thiệu + readiness badge + cờ "đang mở vòng" — **KHÔNG giá/định giá/điều khoản/nút đầu tư**. **AC:** render không chứa trường cấm (test tự động grep response); tenant tắt opt-in → 404.
- **ZIPO-412 · Investor verify:** đăng ký NĐT → KYC nhẹ + phân hạng (tự khai chuẩn NĐT chuyên nghiệp: danh mục ≥2 tỷ / thu nhập ≥1 tỷ/năm — lưu bằng chứng tự khai + disclaimer) + NDA điện tử. **AC:** chưa verify: không thấy bất kỳ deal nào (API rỗng); log NDA đủ.
- **ZIPO-413 · Deal room kín:** deal card sinh từ **snapshot immutable** (plan published + unit econ + readiness — ràng buộc #6); startup opt-in TỪNG NĐT; watermark; access log từng view/download. **AC:** cross-tenant/chưa-opt-in = rỗng; mọi truy cập có log; card chỉ tạo được từ snapshot.
- **ZIPO-414 · Intro ledger:** state machine `request → accepted → meeting → term → closed|dead` — append-only, không nhảy cóc; phí thành công C1 ghi nhận BIGINT khi `closed` (hợp đồng tư vấn ký ngoài, upload bản scan). **AC:** thử nhảy cóc bị chặn; ledger bất biến; báo cáo phí khớp từng đồng.
- **ZIPO-415 · Sổ cổ đông số (mô hình Carta):** công ty dùng cap-table hash-chain sẵn có làm sổ chính thức; giao dịch SPA ngoài → công ty xác nhận → ghi sổ + lịch sử. (Không đụng ràng buộc #1: đây là sổ CÔNG TY trên IPO cho tenant chưa dùng OS; khi tenant lên OS → chuyển nguồn theo ZIPO-003.) **AC:** chuỗi hash liền mạch sau 5 giao dịch thử; sửa bản ghi cũ = phát hiện.
- **ZIPO-416 · Investor dashboard read-only:** danh mục tự ghi nhận + đồng bộ từ các công ty trên nền tảng; KHÔNG nút đặt lệnh, KHÔNG giữ tài sản, không chữ "quản lý danh mục". **AC:** grep UI 0 từ cấm; số danh mục khớp sổ cổ đông từng công ty.

## EPIC 6 · ZENI CAPITAL MODULE 〔WHY: BMC Phần V — quỹ nhà mỏ neo, chống xung đột〕
- **ZIPO-421 · Pipeline quỹ nhà:** screening deal theo tiêu chí (consent-based — chỉ tenant opt-in); ticket size; trạng thái thẩm định. **AC:** tenant không opt-in không xuất hiện trong pipeline (test).
- **ZIPO-422 · Portfolio monitoring:** cty nhận vốn (điều khoản vận hành trên ZeniIPO) → dashboard danh mục quỹ: KPI, runway, cờ đỏ từ agent. **AC:** số khớp nguồn tenant + nhãn nguồn; tenant ngoài danh mục không lộ.
- **ZIPO-423 · COI/Disclosure engine:** quỹ nhà truy cập = quyền NĐT verified thường (không hơn); deal có quỹ nhà → nhãn công khai "NĐT liên quan nền tảng"; access-parity test. **AC:** test chứng minh quỹ nhà không query được trường nào NĐT thường không thấy.
- **ZIPO-424 · Báo cáo LP:** snapshot quý immutable + human review trước gửi. **AC:** báo cáo chỉ sinh từ snapshot; có người duyệt.

## EPIC 8 · BANK PACK 〔WHY: PB3 — kênh vốn lớn nhất VN〕
- **ZIPO-441 · Bộ hồ sơ vay chuẩn:** generator từ snapshot số kiểm chứng (P&L VAS, đối soát 3 nguồn, dòng tiền, tài sản đảm bảo khai báo) → PDF/Excel template bank; human review trước export (#6). **AC:** hồ sơ mẫu đủ mục theo checklist template; số khớp snapshot từng đồng; chưa review không export được.
- **ZIPO-442 · Bank portal + referral ledger:** cổng đối tác bank (V4 III-B): nhận hồ sơ, cập nhật trạng thái (nhận→thẩm định→giải ngân|từ chối), phí giới thiệu ghi khi `giải ngân` (BIGINT, log bất biến). **AC:** state machine đúng; báo cáo phí đối chiếu được.

## EPIC 9 · ĐÓNG NỢ V1 (giữ ID cũ)
- **ZIPO-101** BMC UI chuyển `canvas_blocks` → `business_models` version hoá (nhập BMC v3.1 làm v1 published đầu tiên — dogfood). AC theo V1.
- **ZIPO-301/302/303** stage-gate + unit econ + readiness: bổ sung `nguon_api` + "chưa đo được" + nhãn nguồn phủ UI. AC theo V1.
- **Nợ BIGINT:** migration chuyển `financial_statements`/`unit_economics_inputs`/`masterplan_years` numeric → BIGINT VND + thêm `coa_line`,`company_id` cho financial_statements (ràng buộc #2,#4). AC: 2 lần chạy idempotent, dữ liệu cũ convert đúng.
- **ZIPO-002/003/203** (Zeni ID SSO · cap-table OS · test xuyên 3 tầng): giữ nguyên V1, lịch theo phối hợp đội OS/ERP.

## KHÔNG LÀM (mọi EPIC)
Sàn công khai/khớp lệnh/quản lý danh mục (đợi Nấc 2 CTCK) · sổ kế toán ERP (của ZeniERP) · chat/work-management · token hoá chứng khoán · content hứa lợi nhuận · nền tảng ngoài hệ Zeni.

## DEFINITION OF DONE (mọi ticket — kế thừa V1)
Build 0 lỗi + AC pass có log/screenshot dán kèm · không vi phạm 10 ràng buộc · demo bằng tenant demo · UI theo design system sẵn có · mobile 375px + light/dark · security cùng task (G7) · cập nhật memory tiến độ.
