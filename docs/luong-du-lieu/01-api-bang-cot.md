# Bản đồ huyết thống dữ liệu — API ↔ bảng ↔ cột

> Rút TỰ ĐỘNG từ mã nguồn ngày 20/09/2026. Không có con số nào ước lượng:
> mỗi con số dưới đây là kết quả đếm của một bộ rút trích đọc thẳng
> `apps/web/src/app/api/**/route.ts` và `packages/database/zenicloud/*.sql`.

**Cách đọc.** Tầng dữ liệu KHÔNG phải Supabase thật: `@/lib/supabase/server`
là lớp tương thích dựng trên `pg` (`apps/web/src/lib/zeni/compat.ts`), nên mỗi
`.from('bảng').select('a,b').eq('x',y)` là một câu SQL thật chạy vào Postgres
Zeni Cloud. Cách ly theo công ty do RLS ở CSDL lo (hầu hết bảng có `tenant_id`).

**Ký hiệu cột “bảng chạm”:** `tên(đ)` = chỉ đọc · `tên(g)` = có ghi
(insert/update/upsert/delete) · `tên(đg)` = cả hai.

## 1 · Con số tổng hợp (kèm cách đếm lại)

| Con số | Giá trị | Đếm lại bằng cách nào |
|---|---:|---|
| Tệp `route.ts` dưới `app/api` | 127 | `find apps/web/src/app/api -name route.ts \| wc -l` |
| Phương thức HTTP được xuất ra | 207 | cộng số hàm `export async function GET/POST/…` + tên trong `export const { … } = createCrud…` |
| Route CÓ chạm CSDL | 104 | route có ít nhất một `.from('…')` hoặc một `createCrud*({ table: '…' })` |
| Route KHÔNG có `.from()` nào trong tệp | 23 | phần bù của dòng trên — liệt kê đủ ở mục 4 |
| … trong đó route thật sự KHÔNG đụng CSDL (không RPC, không thư viện đọc hộ, không SQL thô) | 14 | loại tiếp route gọi `.rpc()`, import thư viện `@/lib` có `.from()`, hoặc import `@/lib/zeni/db` |
| Route trả **501 — chưa nối** | 3 | `grep -rl "status: 501" apps/web/src/app/api` |
| Bảng trong lược đồ (schema `public`) | 78 | `CREATE TABLE` trong 32 tệp `.sql` (không kể bảng stub `auth.users`) |
| Tên bảng route gọi tới (gồm cả tên không có thật) | 71 | tập hợp tên trong `.from('…')` + `table: '…'` của mọi route |
| Bảng route gọi mà lược đồ KHÔNG có | 2 | hiệu của hai tập trên: `governance_docs`, `modules` |
| **Bảng mồ côi** — có trong lược đồ, không route nào đọc | 9 | hiệu `lược đồ − bảng route dùng`; danh sách đủ ở mục 5 |
| … trong đó KHÔNG chỗ nào trong `apps/web/src` chạm tới | 7 | quét thêm mọi `.ts/.tsx` ngoài `app/api` tìm `.from('tên')` |
| **Chỗ dùng cột KHÔNG tồn tại** | 26 | so từng cột trong `.select/.eq/.order/.insert/.update` với cột thật của bảng |
| … nằm ở bao nhiêu route | 9 | số URL khác nhau trong mục 6 |
| RPC (hàm SQL) được route gọi | 16 | `.rpc('tên')` trong `app/api`; đối chiếu `CREATE FUNCTION` ở mục 7 |
| Hàm SQL có trong migration | 35 | `CREATE [OR REPLACE] FUNCTION` trong 32 tệp `.sql` |
| Route KHÔNG có bằng chứng xác thực trong tệp | 14 | không thấy `requireUserAndTenant` / `auth.getUser` / `createCrud*` / cron-secret / token nội bộ |
| Route dùng **service-role** (đi vòng RLS) | 7 | `grep -rl "supabase/service" apps/web/src/app/api` |

**14 route công khai là những route nào.** `/api/auth/signout`, `/api/auth/zeni/forgot`, `/api/auth/zeni/login`, `/api/auth/zeni/logout`, `/api/auth/zeni/oauth/[provider]`, `/api/auth/zeni/oauth/session`, `/api/auth/zeni/phone/login`, `/api/auth/zeni/phone/otp`, `/api/auth/zeni/register`, `/api/auth/zeni/reset`, `/api/glossary`, `/api/health`, `/api/modules`, `/api/verify`.
Chúng công khai có lý do: đăng nhập/đăng ký chưa có phiên thì làm sao đòi phiên,
`/api/health` để máy giám sát gọi, `/api/verify` để người ngoài kiểm chứng chỉ.
Trong số đó 2 route có đọc bảng — `/api/glossary`, `/api/modules` — đều là danh mục dùng chung, và migration `005_catalog_public_read.sql` mở
quyền đọc cho vai trò `anon` đúng cho nhóm bảng này.

**Middleware không gác thay route.** `apps/web/src/middleware.ts` chỉ chặn
`PROTECTED_PREFIXES` là các TRANG (`/dashboard`, `/settings`…), không có tiền tố
`/api`. Với API nó chỉ làm rate-limit + CSRF cho POST/PUT/PATCH/DELETE, và bỏ qua
cả CSRF cho `/api/ingest`, `/api/cron`, `/api/internal`. Nghĩa là **mỗi route API
phải tự xác thực** — cột “cần đăng nhập” dưới đây chính là toàn bộ hàng rào.

### Đọc nhanh — năm chỗ đáng lo nhất, tất cả đều đếm được

1. **9 endpoint ghi không bao giờ ghi được.** Câu `insert/upsert`
   của chúng nhắc tên cột bảng không có, nên Postgres bật lỗi ngay: `/api/academy/cert/[drill-id]`, `/api/cap-table/compute`, `/api/dd/access`, `/api/dd/qa`, `/api/external`, `/api/okrs`, `/api/pipeline`, `/api/rounds`, `/api/tasks` (mục 6).
2. **`/api/roadmap` chấm điểm bằng hai bảng không tồn tại** — `modules` (tên thật
   là `modules_catalog`) và `governance_docs` (không có trong lược đồ). Route lại
   nuốt lỗi bằng hàm `safe()`, nên hai cổng gate đó **luôn bằng 0** mà không ai
   thấy lỗi (mục 5).
3. **Cả tầng mô hình kinh doanh chưa có API.** `business_models` và
   `external_access_logs` không được route, thư viện, hay hàm SQL nào đọc —
   `external_access_logs` nghĩa là **truy cập data room của người ngoài chưa từng
   được ghi nhật ký** (mục 5).
4. **7 route chạy bằng service-role, đi vòng RLS** — hàng rào cách ly
   theo công ty ở những route này không phải CSDL lo mà là mã tự lo: `/api/console`, `/api/cron/agents`, `/api/cron/audit-retention`, `/api/cron/readiness-recalc`, `/api/cron/weekly-digest`, `/api/ingest`, `/api/internal/plan-targets`.
5. **3 route cài đặt tài khoản mới chỉ là chỗ giữ sẵn**
   — `/api/settings/email`, `/api/settings/mfa`,
   `/api/settings/password` đều trả 501; giao diện gọi vào sẽ không đổi được gì.

## 2 · Từng route theo miền nghiệp vụ

Nói một lần cho khỏi lặp: **62 route** gọi `requireUserAndTenant` /
`getCurrentTenantId` trong `@/lib/api/tenant`, và hàm đó đọc `user_profiles`
để lấy `tenant_id`. Nên mọi dòng ghi “có · user+tenant” đều ngầm chạm thêm
`user_profiles` — cột “bảng chạm” bên dưới không lặp lại điều đó.

### Tài chính & kế hoạch — 24 route

| URL | Phương thức | Bảng chạm | Cần đăng nhập | Ghi chú |
|---|---|---|---|---|
| `/api/billing` | GET | `membership_tiers`(đ), `subscriptions`(đ) | có · user+tenant |  |
| `/api/burn` | GET | `kpi_metrics`(đ) | có · user+tenant |  |
| `/api/compute/monte-carlo` | POST | `user_profiles`(đ) | có · user+tenant |  |
| `/api/financial-model` | GET, POST | `financial_models`(đg), `ipo_journeys`(đ) | có · user+tenant |  |
| `/api/financials` | GET, POST | `financial_statements`(đg) | có · user+tenant |  |
| `/api/financials/derive` | POST | `finance_assumptions`(đ), `fundraise_rounds`(đ) | có · user+tenant | RPC: `derive_finance_kpis` |
| `/api/forecast` | GET | `kpi_metrics`(đ) | có · user+tenant |  |
| `/api/masterplan` | GET, POST | `ipo_journeys`(đ), `masterplan_years`(đg) | có · user+tenant |  |
| `/api/masterplan/[id]` | GET, PATCH, DELETE | `masterplan_years`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/masterplan/review` | POST | — (không bảng) | có · user+tenant | RPC: `plan_vs_actual` |
| `/api/plan` | GET, POST | `plan_assumptions`(đg), `plan_coa_lines`(đ), `plan_lines`(đg), `plan_targets`(đ), `plan_versions`(đg) | có · user+tenant |  |
| `/api/plan/publish` | POST | — (không bảng) | có · user+tenant | RPC: `publish_plan_version` · gián tiếp qua `@/lib/plan/build-input`: `plan_assumptions`, `plan_lines`, `plan_versions`, `tax_rates` |
| `/api/plan/run` | POST | — (không bảng) | có · user+tenant | gián tiếp qua `@/lib/plan/build-input`: `plan_assumptions`, `plan_lines`, `plan_versions`, `tax_rates` |
| `/api/sales` | GET | `investor_pipeline`(đ), `kpi_metrics`(đ) | có · user+tenant |  |
| `/api/sensitivity` | GET | `kpi_metrics`(đ) | có · user+tenant |  |
| `/api/simulation/run` | POST | `financial_statements`(g), `simulation_scenarios`(g), `tenant_operating_profile`(g), `unit_economics_inputs`(g) | có · user+tenant |  |
| `/api/stripe/checkout` | POST | — (không bảng) | có · user | tính toán thuần — không chạm CSDL |
| `/api/stripe/portal` | POST | `subscriptions`(đ) | có · user+tenant |  |
| `/api/stripe/webhook` | POST | `subscriptions`(đg) | chữ ký Stripe |  |
| `/api/unit-economics` | GET, POST | `unit_economics_inputs`(đg) | có · user+tenant |  |
| `/api/unit-economics/derive` | POST | `fundraise_rounds`(đ) | có · user+tenant | RPC: `derive_unit_economics`, `grade_vs_benchmark` |
| `/api/unit-metrics` | GET | `kpi_metrics`(đ) | có · user+tenant |  |
| `/api/valuation` | GET | `cap_table_snapshots`(đ), `comparables`(đ), `ipo_journeys`(đ) | có · user+tenant |  |
| `/api/valuation/run` | POST | `comparables`(đ), `financial_statements`(đ), `valuation_runs`(g) | có · user+tenant |  |

### Gọi vốn & nhà đầu tư — 22 route

| URL | Phương thức | Bảng chạm | Cần đăng nhập | Ghi chú |
|---|---|---|---|---|
| `/api/cap-table` | GET, POST | `cap_table_snapshots`(đg), `ipo_journeys`(đg) | có · user+tenant |  |
| `/api/cap-table/compute` | POST | `cap_table_snapshots`(đg), `fundraise_rounds`(đ) | có · user | ❌ 4 cột sai |
| `/api/cap-table/dilute` | POST | `cap_table_snapshots`(đ) | có · user+tenant |  |
| `/api/comparables` | GET, POST | `comparables`(đg) | có · user+tenant (crud) | qua createCrudHandler |
| `/api/comparables/[id]` | GET, PATCH, DELETE | `comparables`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/dd/access` | GET, POST | `dd_investor_access`(đg) | có · user | ❌ 6 cột sai |
| `/api/dd/logs` | GET | `dd_access_logs`(đ) | có · user |  |
| `/api/dd/qa` | GET, POST, PATCH | `dd_qa_threads`(đg) | có · user | ❌ 3 cột sai |
| `/api/external` | GET, POST | `external_stakeholders`(đg) | có · user | ❌ 3 cột sai |
| `/api/investors` | GET, POST | `investor_pipeline`(đg) | có · user+tenant (crud) | qua createCrudHandler |
| `/api/market-data` | GET, POST | `market_data`(đg) | có · user+tenant (crud) | qua createCrudHandler |
| `/api/market-data/[id]` | GET, PATCH, DELETE | `market_data`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/market-intel` | GET, POST | `market_intel`(đg) | có · user+tenant (crud) | qua createCrudHandler |
| `/api/market-intel/[id]` | GET, PATCH, DELETE | `market_intel`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/pipeline` | GET, POST | `investor_pipeline`(đg) | có · user | ❌ 1 cột sai |
| `/api/pipeline/[id]` | PATCH, DELETE | `investor_pipeline`(g) | có · user |  |
| `/api/pitch` | GET | `data_room_docs`(đ), `data_room_folders`(đ) | có · user+tenant |  |
| `/api/rounds` | GET, POST | `fundraise_rounds`(đg) | có · user | ❌ 6 cột sai |
| `/api/rounds/[id]` | GET, PATCH, DELETE | `fundraise_rounds`(đg), `tenants`(đ) | có · user |  |
| `/api/tokenomics` | GET, POST | `tokenomics_allocations`(đg) | có · user+tenant (crud) | qua createCrudHandler |
| `/api/tokenomics/[id]` | GET, PATCH, DELETE | `tokenomics_allocations`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/vault` | GET, POST | `data_room_docs`(đ), `data_room_folders`(đg) | có · user+tenant |  |

### Lộ trình IPO & học viện — 17 route

| URL | Phương thức | Bảng chạm | Cần đăng nhập | Ghi chú |
|---|---|---|---|---|
| `/api/academy` | GET | `academy_assessments`(đ), `academy_deliverable_specs`(đ), `academy_lessons`(đ) | có · user+tenant |  |
| `/api/academy/cert/[drill-id]` | POST | `academy_progress`(g), `training_drills`(đ) | có · user | ❌ 1 cột sai · RPC: `has_academy_access` |
| `/api/academy/progress` | GET, POST | `academy_progress`(đg) | có · user | RPC: `has_academy_access` |
| `/api/cascade` | POST | `tenants`(đ) | có · user | RPC: `cascade_chairman_event` |
| `/api/certificates` | GET | `certificates`(đ) | có · user+tenant | RPC: `issue_certificates` |
| `/api/compliance` | GET, POST | `compliance_items`(đg) | có · user+tenant (crud) | qua createCrudHandler |
| `/api/compliance/[id]` | GET, PATCH, DELETE | `compliance_items`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/council` | GET, POST | `events`(đg), `tenants`(đ) | có · user |  |
| `/api/glossary` | GET | `glossary`(đ) | KHÔNG (công khai) |  |
| `/api/journey` | GET, POST | `tenant_level_progress`(đ) | có · user+tenant | RPC: `advance_level`, `get_journey_state`, `init_tenant_journey`, `issue_certificates` |
| `/api/journeys` | GET, POST | `ipo_journeys`(đg) | có · user |  |
| `/api/journeys/[id]` | GET, PATCH, DELETE | `ipo_journeys`(đg) | có · user |  |
| `/api/readiness` | GET | `ipo_readiness_criteria`(đ), `readiness_score_history`(đ) | có · user | RPC: `compute_readiness_score` |
| `/api/readiness/compute` | POST | — (không bảng) | có · user | RPC: `compute_readiness_score` |
| `/api/readiness/criteria/[id]` | PATCH | `ipo_readiness_criteria`(g) | có · user |  |
| `/api/restructure/diagnose` | POST | `restructure_diagnostics`(đg) | có · user+tenant | RPC: `diagnose_restructure` |
| `/api/verify` | GET | — (không bảng) | KHÔNG (công khai) | RPC: `verify_certificate` |

### Quản trị & định danh — 29 route

| URL | Phương thức | Bảng chạm | Cần đăng nhập | Ghi chú |
|---|---|---|---|---|
| `/api/admin` | GET | `events`(đ), `ipo_journeys`(đ), `tenants`(đ), `user_profiles`(đ) | có · user | RPC: `is_chairman_super` |
| `/api/audit` | GET | `audit_logs`(đ) | có · user+tenant |  |
| `/api/audit/export` | GET | `audit_logs`(đ), `user_profiles`(đ) | có · user+tenant |  |
| `/api/auth/signout` | POST | — (không bảng) | KHÔNG (công khai) | tính toán thuần — không chạm CSDL |
| `/api/auth/zeni/forgot` | POST | — (không bảng) | KHÔNG (công khai) | gọi dịch vụ Zeni ID qua HTTP |
| `/api/auth/zeni/login` | POST | — (không bảng) | KHÔNG (công khai) | gọi dịch vụ Zeni ID qua HTTP |
| `/api/auth/zeni/logout` | POST | — (không bảng) | KHÔNG (công khai) | tính toán thuần — không chạm CSDL |
| `/api/auth/zeni/oauth/[provider]` | GET | — (không bảng) | KHÔNG (công khai) | gọi dịch vụ Zeni ID qua HTTP |
| `/api/auth/zeni/oauth/session` | POST | — (không bảng) | KHÔNG (công khai) | gọi dịch vụ Zeni ID qua HTTP |
| `/api/auth/zeni/phone/login` | POST | — (không bảng) | KHÔNG (công khai) | gọi dịch vụ Zeni ID qua HTTP |
| `/api/auth/zeni/phone/otp` | POST | — (không bảng) | KHÔNG (công khai) | gọi dịch vụ Zeni ID qua HTTP |
| `/api/auth/zeni/register` | POST | — (không bảng) | KHÔNG (công khai) | gọi dịch vụ Zeni ID qua HTTP |
| `/api/auth/zeni/reset` | GET, POST | — (không bảng) | KHÔNG (công khai) | gọi dịch vụ Zeni ID qua HTTP |
| `/api/board` | GET | `user_profiles`(đ) | có · user+tenant |  |
| `/api/board/resolutions` | GET, POST | `board_resolutions`(đg) | có · user+tenant (crud) | qua createCrudHandler |
| `/api/board/resolutions/[id]` | GET, PATCH, DELETE | `board_resolutions`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/console` | GET, POST | `events`(đ), `ipo_journeys`(đ), `kpi_metrics`(đ), `okr_objectives`(đ), `readiness_score_history`(đ), `subscriptions`(đ), `tenants`(đg), `user_profiles`(đ) | có · user | RPC: `is_chairman_super` · ⚠ service-role, đi vòng RLS |
| `/api/modules` | GET | `modules_catalog`(đ) | KHÔNG (công khai) |  |
| `/api/onboarding/complete` | POST | `ipo_journeys`(đg), `kpi_metrics`(g), `okr_objectives`(g) | có · user+tenant | RPC: `cascade_chairman_event` |
| `/api/onboarding/status` | GET | `ipo_journeys`(đ) | có · user+tenant |  |
| `/api/org` | GET, POST | `ipo_journeys`(đ), `org_positions`(đg), `org_units`(đ), `position_templates`(đ) | có · user+tenant |  |
| `/api/org/[id]` | GET, PATCH, DELETE | `org_positions`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/settings` | GET, PATCH | `tenants`(đ), `user_profiles`(đg) | có · user |  |
| `/api/settings/email` | POST | — (không bảng) | có · user | 🚧 trả 501 — chưa nối, chỉ là chỗ giữ sẵn · gọi dịch vụ Zeni ID qua HTTP |
| `/api/settings/mfa` | GET, POST, PATCH, DELETE | — (không bảng) | có · user | 🚧 trả 501 — chưa nối, chỉ là chỗ giữ sẵn · gọi dịch vụ Zeni ID qua HTTP |
| `/api/settings/password` | POST | — (không bảng) | có · user | 🚧 trả 501 — chưa nối, chỉ là chỗ giữ sẵn · gọi dịch vụ Zeni ID qua HTTP |
| `/api/team` | GET | `invitations`(đ), `user_profiles`(đ) | có · user+tenant |  |
| `/api/tenant-profile` | GET, POST | `tenant_operating_profile`(đg) | có · user+tenant |  |
| `/api/tenants/switchable` | GET | `user_profiles`(đ) | có · user | RPC: `list_accessible_tenants` |

### Vận hành & tác tử — 23 route

| URL | Phương thức | Bảng chạm | Cần đăng nhập | Ghi chú |
|---|---|---|---|---|
| `/api/agents` | GET | `agent_actions`(đ), `agent_catalog`(đ), `agent_runs`(đ), `agent_schedules`(đ), `agents`(đ) | có · user |  |
| `/api/agents/[id]/run` | POST | `agent_runs`(g), `agents`(g) | có · user | gián tiếp qua `@/lib/agents/dispatcher`: `agent_catalog`, `agents` |
| `/api/agents/actions` | GET, PATCH | `agent_actions`(đg) | có · user | gián tiếp qua `@/lib/agents/action-executor`: `agent_memory`, `feedback_items`, `kpi_metrics`, `tasks` |
| `/api/agents/schedules` | GET, POST | `agent_catalog`(đ), `agent_schedules`(đg) | có · user |  |
| `/api/canvas` | GET, POST | `canvas_blocks`(đg) | có · user+tenant |  |
| `/api/connectors` | GET, POST | `connector_mappings`(đg), `data_connectors`(đg), `sync_runs`(đ) | token nạp dữ liệu |  |
| `/api/connectors/[id]` | GET, PATCH, DELETE | `data_connectors`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/connectors/[id]/mappings` | POST | `connector_mappings`(g), `data_connectors`(đ) | có · user+tenant |  |
| `/api/dataflow` | GET | `events`(đ) | có · user+tenant |  |
| `/api/ingest` | POST | `connector_mappings`(đ), `data_connectors`(đg), `sync_runs`(g) | token nạp dữ liệu | ⚠ service-role, đi vòng RLS · bảng động `target` |
| `/api/kpis` | GET, POST | `kpi_metrics`(đg) | có · user |  |
| `/api/kpis/[id]` | GET, PATCH, DELETE | `kpi_metrics`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/krs` | GET, POST | `okr_krs`(đg) | có · user |  |
| `/api/krs/[id]` | PATCH, DELETE | `okr_krs`(g) | có · user |  |
| `/api/nlq` | GET, POST | `nlq_logs`(đg) | có · user+tenant | bảng động `intent.table` |
| `/api/okrs` | GET, POST | `okr_objectives`(đg) | có · user | ❌ 1 cột sai |
| `/api/okrs/[id]` | PATCH, DELETE | `okr_objectives`(g) | có · user |  |
| `/api/roadmap` | GET | `agent_schedules`(đ), `canvas_blocks`(đ), `data_room_docs`(đ), `events`(đ), `financial_statements`(đ), `fundraise_rounds`(đ), `governance_docs`(đ), `ipo_journeys`(đ), `journey_phase_specs`(đ), `kpi_metrics`(đ), `market_data`(đ), `market_intel`(đ), `modules`(đ), `okr_objectives`(đ), `readiness_score_history`(đ), `user_profiles`(đ) | có · user+tenant | ❌ bảng `governance_docs` không có trong lược đồ · ❌ bảng `modules` không có trong lược đồ |
| `/api/sops` | GET, POST | `sop_processes`(đg) | có · user+tenant |  |
| `/api/sops/[id]` | GET, PATCH, DELETE | `sop_processes`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/tasks` | GET, POST | `tasks`(đg) | có · user | ❌ 1 cột sai |
| `/api/tasks/[id]` | PATCH, DELETE | `tasks`(g) | có · user |  |
| `/api/workflow` | GET | `ipo_journeys`(đ), `phase_gates`(đ) | có · user+tenant |  |

### Hệ thống & tự động — 12 route

| URL | Phương thức | Bảng chạm | Cần đăng nhập | Ghi chú |
|---|---|---|---|---|
| `/api/cockpit` | GET | `cap_table_snapshots`(đ), `certificates`(đ), `events`(đ), `financial_models`(đ), `ipo_journeys`(đ), `kpi_metrics`(đ), `readiness_score_history`(đ), `tasks`(đ), `tenant_level_progress`(đ), `tenants`(đ), `user_profiles`(đ) | có · user+tenant | RPC: `get_journey_state`, `init_tenant_journey` |
| `/api/cron/agents` | GET | — (không bảng) | cron-secret | ⚠ service-role, đi vòng RLS · gián tiếp qua `@/lib/agents/engine`: `agent_actions`, `agent_catalog`, `agent_memory`, `agent_runs`, `agent_schedules`, `agents`, `ipo_journeys` |
| `/api/cron/audit-retention` | GET | `audit_logs`(đg) | cron-secret | ⚠ service-role, đi vòng RLS |
| `/api/cron/readiness-recalc` | GET | `ipo_journeys`(đ) | cron-secret | RPC: `compute_readiness_score` · ⚠ service-role, đi vòng RLS |
| `/api/cron/weekly-digest` | GET | `events`(đ), `kpi_metrics`(đ), `readiness_score_history`(đ), `tasks`(đ), `tenants`(đ), `user_profiles`(đ) | cron-secret | ⚠ service-role, đi vòng RLS |
| `/api/dashboard` | GET | `events`(đ), `ipo_journeys`(đ), `kpi_metrics`(đ), `tasks`(đ), `tenants`(đ), `user_profiles`(đ) | có · user | RPC: `compute_readiness_score` |
| `/api/feedback` | GET, POST | `feedback_items`(đg) | có · user+tenant (crud) | qua createCrudHandler |
| `/api/feedback/[id]` | GET, PATCH, DELETE | `feedback_items`(đg) | có · user+tenant (crud) | qua createCrudItemHandler |
| `/api/health` | GET | — (không bảng) | KHÔNG (công khai) | tính toán thuần — không chạm CSDL |
| `/api/internal/db-export` | GET | — (không bảng) | token nội bộ | ⚠ SQL thô qua `@/lib/zeni/db` — **không đi qua RLS** · gọi dịch vụ Zeni ID qua HTTP |
| `/api/internal/db-setup` | GET, POST | — (không bảng) | token nội bộ | ⚠ SQL thô qua `@/lib/zeni/db` — **không đi qua RLS** · gọi dịch vụ Zeni ID qua HTTP |
| `/api/internal/plan-targets` | GET, POST, PUT, PATCH, DELETE | `plan_targets`(đ), `plan_versions`(đ), `tenants`(đ), `user_profiles`(đ) | token nội bộ | ⚠ service-role, đi vòng RLS · POST→405 · PUT→405 · PATCH→405 · DELETE→405 |

## 3 · Chi tiết cột từng route (đọc gì · lọc gì · ghi gì)

Chỉ liệt kê route có chạm bảng. `select` là danh sách cột route đọc về;
`lọc` là cột dùng trong `.eq/.in/.gt/…`; `ghi` là khoá được insert/update
(khoá lấy từ object literal, hoặc suy từ `z.object` khi mã viết `...parsed.data`).

**`/api/academy`** — `apps/web/src/app/api/academy/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `academy_lessons` | select | lesson_code, order_idx, title_vi, title_en, analogy_vi, body_vi, takeaway_vi | level_num, status · sắp: order_idx | — |
| GET | `academy_assessments` | select | pass_mark, total, questions | level_num | — |
| GET | `academy_deliverable_specs` | select | code, label_vi, entity, hint_vi | level_num | — |

**`/api/academy/cert/[drill-id]`** — `apps/web/src/app/api/academy/cert/[drill-id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `training_drills` | select | * | id | — |
| POST | `academy_progress` | upsert ❌ | — | — | user_id, content_type, content_id, status, progress_pct, completed_at, cert_issued_at |

**`/api/academy/progress`** — `apps/web/src/app/api/academy/progress/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `academy_progress` | select | * | user_id · sắp: started_at | — |
| POST | `academy_progress` | upsert | — | — | *chưa đo được — payload là biến* |

**`/api/admin`** — `apps/web/src/app/api/admin/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `tenants` | select | id, name, slug, plan, created_at | sắp: created_at | — |
| GET | `user_profiles` | select | id, email, role, tenant_id, created_at, last_active_at | sắp: created_at | — |
| GET | `ipo_journeys` | select | id, name, current_phase, valuation_target, tenant_id, created_at | sắp: created_at | — |
| GET | `events` | select | id, event_type, payload, created_at | sắp: created_at | — |

**`/api/agents`** — `apps/web/src/app/api/agents/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `agents` | select | * | sắp: name | — |
| GET | `agent_catalog` | select | * | sắp: display_order | — |
| GET | `agent_schedules` | select | id, agent_code, cadence, autonomy, enabled, next_run_at, last_run_at | sắp: agent_code | — |
| GET | `agent_actions` | select | id, agent_code, action_type, title, payload, confidence, status, created_at | status · sắp: created_at | — |
| GET | `agent_actions` | select | id, agent_code, action_type, title, status, created_at, executed_at | status · sắp: created_at | — |
| GET | `agent_runs` | select | id, agent_id, status, cost_usd, created_at | sắp: created_at | — |
| GET | `agents` | select | id, agent_code, name, tenant_id | id | — |

**`/api/agents/[id]/run`** — `apps/web/src/app/api/agents/[id]/run/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `agent_runs` | insert | — | — | agent_id, triggered_by, input, output, tokens_input, tokens_output, cost_usd, duration_ms, status |
| POST | `agents` | update | — | id | last_run_at |
| POST | `agent_runs` | insert | — | — | agent_id, triggered_by, input, output, tokens_input, tokens_output, cost_usd, duration_ms, status, error_message |

**`/api/agents/actions`** — `apps/web/src/app/api/agents/actions/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `agent_actions` | select | id, agent_code, action_type, title, payload, confidence, status, created_at, executed_at, error_message | status · sắp: created_at | — |
| PATCH | `agent_actions` | select | id, tenant_id, agent_code, action_type, title, payload, status | id | — |
| PATCH | `agent_actions` | update | id, status | id | status, decided_by, decided_at |
| PATCH | `agent_actions` | update | — | id | status, decided_by, decided_at, error_message |
| PATCH | `agent_actions` | update | id, status, result, error_message | id | status, decided_by, decided_at, executed_at, result, error_message |

**`/api/agents/schedules`** — `apps/web/src/app/api/agents/schedules/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `agent_schedules` | select | id, agent_code, cadence, autonomy, enabled, next_run_at, last_run_at | sắp: agent_code | — |
| GET | `agent_catalog` | select | agent_code, name, department, is_chief | agent_code | — |
| POST | `agent_schedules` | upsert | id, agent_code, cadence, autonomy, enabled, next_run_at | — | *chưa đo được — payload là biến* |

**`/api/audit`** — `apps/web/src/app/api/audit/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `audit_logs` | select | * | action, target_table · sắp: created_at | — |

**`/api/audit/export`** — `apps/web/src/app/api/audit/export/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `user_profiles` | select | role | id | — |
| GET | `audit_logs` | select | id, action, target_table, target_id, actor_id, ip_address, user_agent, created_at | action, target_table, created_at, created_at · sắp: created_at | — |

**`/api/billing`** — `apps/web/src/app/api/billing/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `membership_tiers` | select | * | sắp: price_usd_month | — |
| GET | `subscriptions` | select | * | tenant_id · sắp: created_at | — |

**`/api/board`** — `apps/web/src/app/api/board/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `user_profiles` | select | id, full_name, email, role, last_active_at, created_at | role · sắp: created_at | — |

**`/api/board/resolutions`** — `apps/web/src/app/api/board/resolutions/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, POST | `board_resolutions` | danh sách+tạo (crud chung) | * | status, resolution_type · sắp: meeting_date | schema `Schema` |

**`/api/board/resolutions/[id]`** — `apps/web/src/app/api/board/resolutions/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `board_resolutions` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/burn`** — `apps/web/src/app/api/burn/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `kpi_metrics` | select | id, name, value, unit, period, captured_at | tenant_id, name · sắp: captured_at | — |

**`/api/canvas`** — `apps/web/src/app/api/canvas/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `canvas_blocks` | select | block_key, items, updated_at | — | — |
| POST | `canvas_blocks` | upsert | block_key, items | — | tenant_id, block_key, items |

**`/api/cap-table`** — `apps/web/src/app/api/cap-table/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `ipo_journeys` | select | id | tenant_id · sắp: created_at | — |
| POST | `ipo_journeys` | insert | id | — | tenant_id, name, current_phase, exit_venue, target_year |
| POST | `cap_table_snapshots` | insert | — | — | tenant_id, journey_id, snapshot_date, snapshot_type, holders, total_shares, fully_diluted_shares, valuation_usd |
| GET | `cap_table_snapshots` | select | * | sắp: created_at | — |
| GET | `cap_table_snapshots` | select | * | sắp: created_at | — |

**`/api/cap-table/compute`** — `apps/web/src/app/api/cap-table/compute/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `fundraise_rounds` | select | * | id | — |
| POST | `cap_table_snapshots` | select ❌ | * | tenant_id · sắp: created_at | — |
| POST | `cap_table_snapshots` | insert ❌ | — | — | tenant_id, round_id, pre_money_valuation, post_money_valuation, holdings, created_by |

**`/api/cap-table/dilute`** — `apps/web/src/app/api/cap-table/dilute/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `cap_table_snapshots` | select | total_shares, holders | tenant_id · sắp: created_at | — |

**`/api/cascade`** — `apps/web/src/app/api/cascade/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `tenants` | select | name | id | — |

**`/api/certificates`** — `apps/web/src/app/api/certificates/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `certificates` | select | * | tenant_id · sắp: issued_at | — |

**`/api/cockpit`** — `apps/web/src/app/api/cockpit/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `tenant_level_progress` | select | id | tenant_id | — |
| GET | `user_profiles` | select | full_name, role | id | — |
| GET | `tenants` | select | name, slug, plan | id | — |
| GET | `ipo_journeys` | select | id, name, current_phase, valuation_target, exit_venue, target_year, industry, north_star_metric | tenant_id · sắp: created_at | — |
| GET | `readiness_score_history` | select | total_score, breakdown_by_category, captured_at | tenant_id · sắp: captured_at | — |
| GET | `financial_models` | select | result, assumptions, created_at | tenant_id · sắp: created_at | — |
| GET | `cap_table_snapshots` | select | total_shares, holders, valuation_usd, created_at | tenant_id · sắp: created_at | — |
| GET | `certificates` | select | kind, level_num | tenant_id | — |
| GET | `tasks` | select | id, title, status, priority, due_date | status · sắp: created_at | — |
| GET | `kpi_metrics` | select | name, value, unit, trend, captured_at | tenant_id · sắp: captured_at | — |
| GET | `events` | select | event_type, payload, created_at | tenant_id · sắp: created_at | — |

**`/api/comparables`** — `apps/web/src/app/api/comparables/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, POST | `comparables` | danh sách+tạo (crud chung) | * | industry, region, exchange · sắp: created_at | schema `Schema` |

**`/api/comparables/[id]`** — `apps/web/src/app/api/comparables/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `comparables` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/compliance`** — `apps/web/src/app/api/compliance/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, POST | `compliance_items` | danh sách+tạo (crud chung) | * | item_type, status · sắp: expiry_date | schema `Schema` |

**`/api/compliance/[id]`** — `apps/web/src/app/api/compliance/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `compliance_items` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/compute/monte-carlo`** — `apps/web/src/app/api/compute/monte-carlo/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `user_profiles` | select | role | id | — |

**`/api/connectors`** — `apps/web/src/app/api/connectors/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `data_connectors` | select | id, provider, name, direction, status, token_hint, config, last_sync_at, last_sync_status, total_rows_ingested, created_at | sắp: created_at | — |
| GET | `connector_mappings` | select | id, connector_id, source_object, target_table, field_map, is_enabled | — | — |
| GET | `sync_runs` | select | id, connector_id, target_table, rows_received, rows_written, rows_rejected, status, started_at | sắp: started_at | — |
| POST | `data_connectors` | insert | id, provider, name, status, token_hint | — | tenant_id, provider, name, direction, status, token_hash, token_hint, config |
| POST | `connector_mappings` | insert | id, source_object, target_table | — | tenant_id, connector_id, source_object, target_table, field_map |

**`/api/connectors/[id]`** — `apps/web/src/app/api/connectors/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `data_connectors` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/connectors/[id]/mappings`** — `apps/web/src/app/api/connectors/[id]/mappings/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `data_connectors` | select | id | id | — |
| POST | `connector_mappings` | insert | id, source_object, target_table, field_map | — | tenant_id, connector_id, source_object, target_table, field_map, dedupe_keys |

**`/api/console`** — `apps/web/src/app/api/console/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `tenants` | select | id, name, slug, plan, owner_id, created_at, parent_tenant_id | sắp: created_at | — |
| GET | `tenants` | select | id, name, slug, plan, owner_id, created_at | sắp: created_at | — |
| GET | `user_profiles` | select | id, email, full_name, role, tenant_id, is_chairman_super, last_active_at, created_at | — | — |
| GET | `ipo_journeys` | select | id, tenant_id, name, current_phase, target_year, valuation_target, status, created_at | — | — |
| GET | `subscriptions` | select | tenant_id, plan, status, current_period_end | — | — |
| GET | `events` | select | tenant_id, event_type, created_at | sắp: created_at | — |
| GET | `readiness_score_history` | select | tenant_id, total_score, captured_at | sắp: captured_at | — |
| GET | `okr_objectives` | select | tenant_id | — | — |
| GET | `kpi_metrics` | select | tenant_id, metric_code, value, captured_at | sắp: captured_at | — |
| POST | `tenants` | update | id, name, parent_tenant_id | id | parent_tenant_id |

**`/api/council`** — `apps/web/src/app/api/council/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `events` | select | id, payload, cascade_status, created_at | event_type · sắp: created_at | — |
| POST | `events` | insert | — | — | tenant_id, actor_id, event_type, payload, cascade_status |
| POST | `tenants` | select | name | id | — |
| POST | `events` | insert | — | — | tenant_id, actor_id, event_type, payload, cascade_status |

**`/api/cron/audit-retention`** — `apps/web/src/app/api/cron/audit-retention/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `audit_logs` | select | id | created_at | — |
| GET | `audit_logs` | delete | — | created_at | — |

**`/api/cron/readiness-recalc`** — `apps/web/src/app/api/cron/readiness-recalc/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `ipo_journeys` | select | id, tenant_id | status | — |

**`/api/cron/weekly-digest`** — `apps/web/src/app/api/cron/weekly-digest/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `tenants` | select | id, name | — | — |
| GET | `user_profiles` | select | id, email, full_name, role | tenant_id, role · sắp: created_at | — |
| GET | `kpi_metrics` | select | name, value, unit, trend | tenant_id · sắp: captured_at | — |
| GET | `tasks` | select | id | tenant_id, status | — |
| GET | `readiness_score_history` | select | total_score | tenant_id · sắp: captured_at | — |
| GET | `events` | select | id | tenant_id, created_at | — |

**`/api/dashboard`** — `apps/web/src/app/api/dashboard/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `user_profiles` | select | * | id | — |
| GET | `tenants` | select | * | id | — |
| GET | `ipo_journeys` | select | * | tenant_id · sắp: created_at | — |
| GET | `kpi_metrics` | select | * | tenant_id · sắp: captured_at | — |
| GET | `tasks` | select | * | sắp: created_at | — |
| GET | `events` | select | * | sắp: created_at | — |

**`/api/dataflow`** — `apps/web/src/app/api/dataflow/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `events` | select | id, event_type, payload, created_at | sắp: created_at | — |

**`/api/dd/access`** — `apps/web/src/app/api/dd/access/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `dd_investor_access` | insert ❌ | — | — | tenant_id, investor_email, investor_name, nda_accepted, folder_scopes, expires_at, round_id, invited_by |
| GET | `dd_investor_access` | select ❌ | * | sắp: access_granted_at | — |

**`/api/dd/logs`** — `apps/web/src/app/api/dd/logs/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `dd_access_logs` | select | * | investor_access_id · sắp: created_at | — |

**`/api/dd/qa`** — `apps/web/src/app/api/dd/qa/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `dd_qa_threads` | select ❌ | * | sắp: question_asked_at | — |
| POST | `dd_qa_threads` | insert ❌ | — | — | tenant_id, access_id, question, topic, status, asked_by |
| PATCH | `dd_qa_threads` | update ❌ | — | id | *chưa đo được — payload là biến* |

**`/api/external`** — `apps/web/src/app/api/external/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `external_stakeholders` | select ❌ | * | sắp: created_at | — |
| POST | `external_stakeholders` | insert ❌ | — | — | tenant_id, role, name, email, organization, scope, invited_by |

**`/api/feedback`** — `apps/web/src/app/api/feedback/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, POST | `feedback_items` | danh sách+tạo (crud chung) | * | status, category, severity · sắp: created_at | schema `Schema` |

**`/api/feedback/[id]`** — `apps/web/src/app/api/feedback/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `feedback_items` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/financial-model`** — `apps/web/src/app/api/financial-model/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `financial_models` | select | * | tenant_id · sắp: created_at | — |
| POST | `ipo_journeys` | select | id | tenant_id · sắp: created_at | — |
| POST | `financial_models` | insert | — | — | tenant_id, journey_id, name, assumptions, result, sensitivity, created_by |

**`/api/financials`** — `apps/web/src/app/api/financials/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `financial_statements` | select | * | sắp: period | — |
| POST | `financial_statements` | upsert | id, period, revenue, cash_balance | — | tenant_id, period |

**`/api/financials/derive`** — `apps/web/src/app/api/financials/derive/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `finance_assumptions` | select | key, value | — | — |
| POST | `fundraise_rounds` | select | id, round_name, round_code, target_raise_usd, actual_raise_usd, status, target_close_date | — | — |

**`/api/forecast`** — `apps/web/src/app/api/forecast/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `kpi_metrics` | select | name, value, captured_at | tenant_id, name · sắp: captured_at | — |

**`/api/glossary`** — `apps/web/src/app/api/glossary/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `glossary` | select | * | sắp: term | — |

**`/api/ingest`** — `apps/web/src/app/api/ingest/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `data_connectors` | select | id, tenant_id, name, provider, status, total_rows_ingested | token_hash | — |
| POST | `connector_mappings` | select | id, source_object, target_table, field_map, is_enabled | connector_id, source_object | — |
| POST | `sync_runs` | insert | id | — | tenant_id, connector_id, target_table, rows_received, rows_rejected, status, source_ip |
| POST | *(biến `target`)* | upsert | | | |
| POST | *(biến `target`)* | insert | | | |
| POST | `sync_runs` | update | — | id | rows_written, status, errors, finished_at |
| POST | `data_connectors` | update | — | id | last_sync_at, last_sync_status, total_rows_ingested |

**`/api/internal/plan-targets`** — `apps/web/src/app/api/internal/plan-targets/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `tenants` | select | id, slug, name | slug | — |
| GET | `user_profiles` | select | id | id, tenant_id | — |
| GET | `plan_versions` | select | id, version_no, status, published_at, start_period, horizon_months | tenant_id, status, version_no · sắp: version_no | — |
| GET | `plan_targets` | select | company_id, period, coa_line, amount, metric_key, scenario | tenant_id, plan_version_id · sắp: period, coa_line | — |

**`/api/investors`** — `apps/web/src/app/api/investors/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, POST | `investor_pipeline` | danh sách+tạo (crud chung) | * | stage, priority, investor_type · sắp: created_at | schema `Schema` |

**`/api/journey`** — `apps/web/src/app/api/journey/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `tenant_level_progress` | select | id | tenant_id | — |

**`/api/journeys`** — `apps/web/src/app/api/journeys/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `ipo_journeys` | select | * | sắp: created_at | — |
| POST | `ipo_journeys` | insert | — | — | tenant_id, name, valuation_target, exit_venue, target_year, industry, strategy |

**`/api/journeys/[id]`** — `apps/web/src/app/api/journeys/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `ipo_journeys` | select | * | id | — |
| PATCH | `ipo_journeys` | update | — | id | *chưa đo được — payload là biến* |
| DELETE | `ipo_journeys` | delete | — | id | — |

**`/api/kpis`** — `apps/web/src/app/api/kpis/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `kpi_metrics` | select | * | metric_code, period · sắp: captured_at | — |
| POST | `kpi_metrics` | insert | — | — | tenant_id, metric_code, name, value, unit, period, trend |

**`/api/kpis/[id]`** — `apps/web/src/app/api/kpis/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `kpi_metrics` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/krs`** — `apps/web/src/app/api/krs/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `okr_krs` | select | * | objective_id · sắp: due_date | — |
| POST | `okr_krs` | insert | — | — | objective_id, title, metric_type, target_value |

**`/api/krs/[id]`** — `apps/web/src/app/api/krs/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| PATCH | `okr_krs` | update | — | id | *chưa đo được — payload là biến* |
| DELETE | `okr_krs` | delete | — | id | — |

**`/api/market-data`** — `apps/web/src/app/api/market-data/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, POST | `market_data` | danh sách+tạo (crud chung) | * | metric_type, region, segment · sắp: created_at | schema `Schema` |

**`/api/market-data/[id]`** — `apps/web/src/app/api/market-data/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `market_data` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/market-intel`** — `apps/web/src/app/api/market-intel/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, POST | `market_intel` | danh sách+tạo (crud chung) | * | category, severity · sắp: created_at | schema `Schema` |

**`/api/market-intel/[id]`** — `apps/web/src/app/api/market-intel/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `market_intel` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/masterplan`** — `apps/web/src/app/api/masterplan/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `masterplan_years` | select | * | sắp: year | — |
| GET | `ipo_journeys` | select | current_phase, target_year, valuation_target, north_star_metric | status | — |
| POST | `masterplan_years` | upsert | id, year, revenue_target | — | tenant_id, year, phase, revenue_target, gross_margin_target_pct, ebitda_target, headcount_target, funding_target, funding_round_code, valuation_target, key_milestone, notes |

**`/api/masterplan/[id]`** — `apps/web/src/app/api/masterplan/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `masterplan_years` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/modules`** — `apps/web/src/app/api/modules/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `modules_catalog` | select | * | is_enabled · sắp: display_order | — |

**`/api/nlq`** — `apps/web/src/app/api/nlq/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `nlq_logs` | select | id, query_text, query_intent, result_summary, status, duration_ms, cost_usd, created_at | tenant_id · sắp: created_at | — |
| POST | `nlq_logs` | insert | — | — | tenant_id, user_id, query_text, agent_model, tokens_input, tokens_output, cost_usd, duration_ms, status, error_message |
| POST | *(biến `intent.table`)* | select | | | |
| POST | `nlq_logs` | insert | — | — | tenant_id, user_id, query_text, query_intent, resolved_sql, agent_model, tokens_input, tokens_output, cost_usd, duration_ms, status, error_message |
| POST | `nlq_logs` | insert | — | — | tenant_id, user_id, query_text, query_intent, resolved_sql, result_summary, result_json, agent_model, tokens_input, tokens_output, cost_usd, duration_ms, status |

**`/api/okrs`** — `apps/web/src/app/api/okrs/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `okr_objectives` | select ❌ | * | sắp: created_at | — |
| POST | `okr_objectives` | insert ❌ | — | — | tenant_id, created_by, tier, title, description, parent_id |

**`/api/okrs/[id]`** — `apps/web/src/app/api/okrs/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| PATCH | `okr_objectives` | update | — | id | *chưa đo được — payload là biến* |
| DELETE | `okr_objectives` | delete | — | id | — |

**`/api/onboarding/complete`** — `apps/web/src/app/api/onboarding/complete/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `ipo_journeys` | select | id | tenant_id | — |
| POST | `ipo_journeys` | update | — | id | name, north_star_metric, industry |
| POST | `kpi_metrics` | insert | id, name | — | *chưa đo được — payload là biến* |
| POST | `okr_objectives` | insert | id, title | — | tenant_id, title, description, tier, owner_id, journey_id |

**`/api/onboarding/status`** — `apps/web/src/app/api/onboarding/status/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `ipo_journeys` | select | id | tenant_id | — |

**`/api/org`** — `apps/web/src/app/api/org/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `org_units` | select | * | sắp: display_order | — |
| GET | `position_templates` | select | * | sắp: display_order | — |
| GET | `org_positions` | select | * | sắp: level, title_vi | — |
| GET | `ipo_journeys` | select | current_phase | status | — |
| POST | `position_templates` | select | capabilities, decision_rights, owns_metrics | template_code | — |
| POST | `org_positions` | insert | id, title_vi, unit_code, status | — | tenant_id, template_code, unit_code, title_vi, level, holder_name, status, target_hire_date |

**`/api/org/[id]`** — `apps/web/src/app/api/org/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `org_positions` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/pipeline`** — `apps/web/src/app/api/pipeline/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `investor_pipeline` | select ❌ | * | round_id, stage · sắp: created_at | — |
| POST | `investor_pipeline` | insert ❌ | — | — | tenant_id, stage, round_id, investor_name, contact_email, check_size, notes |

**`/api/pipeline/[id]`** — `apps/web/src/app/api/pipeline/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| PATCH | `investor_pipeline` | update | — | id | *chưa đo được — payload là biến* |
| DELETE | `investor_pipeline` | delete | — | id | — |

**`/api/pitch`** — `apps/web/src/app/api/pitch/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `data_room_folders` | select | id, name | name | — |
| GET | `data_room_docs` | select | id, title, storage_path, folder_id, created_at | folder_id · sắp: created_at | — |

**`/api/plan`** — `apps/web/src/app/api/plan/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `plan_versions` | select | id, version_no, name, horizon_months, start_period, status, published_at, created_at | sắp: version_no | — |
| GET | `plan_coa_lines` | select | * | sắp: display_order | — |
| GET | `plan_lines` | select | * | plan_version_id · sắp: coa_line | — |
| GET | `plan_assumptions` | select | * | plan_version_id · sắp: key | — |
| GET | `plan_targets` | select | id | plan_version_id | — |
| POST | `plan_versions` | select | version_no | sắp: version_no | — |
| POST | `plan_versions` | insert | id, version_no, name, status | — | tenant_id, version_no, name, horizon_months, start_period, business_model_id, status |
| POST | `plan_lines` | select | * | plan_version_id | — |
| POST | `plan_assumptions` | select | * | plan_version_id | — |
| POST | `plan_lines` | insert | — | — | *chưa đo được — payload là biến* |
| POST | `plan_assumptions` | insert | — | — | *chưa đo được — payload là biến* |

**`/api/readiness`** — `apps/web/src/app/api/readiness/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `ipo_readiness_criteria` | select | * | journey_id · sắp: category | — |
| GET | `readiness_score_history` | select | * | journey_id · sắp: captured_at | — |

**`/api/readiness/criteria/[id]`** — `apps/web/src/app/api/readiness/criteria/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| PATCH | `ipo_readiness_criteria` | update | — | id | *chưa đo được — payload là biến* |

**`/api/restructure/diagnose`** — `apps/web/src/app/api/restructure/diagnose/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `restructure_diagnostics` | insert | id, created_at | — | tenant_id, pillars, overall_score, readiness_gap, created_by |
| POST | `restructure_diagnostics` | select | overall_score, created_at | sắp: created_at | — |

**`/api/roadmap`** — `apps/web/src/app/api/roadmap/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `journey_phase_specs` | select | * | sắp: phase | — |
| GET | `ipo_journeys` | select | id, current_phase, north_star_metric, valuation_target, target_year, status | status | — |
| GET | `canvas_blocks` | select | block_key, items | — | — |
| GET | `events` | select | id | event_type | — |
| GET | `market_data` | select | metric_type | — | — |
| GET | `market_intel` | select | id | — | — |
| GET | `financial_statements` | select | period, revenue, cogs | sắp: created_at | — |
| GET | `okr_objectives` | select | id | — | — |
| GET | `modules` ❌không có trong lược đồ | select | id | category | — |
| GET | `agent_schedules` | select | id | enabled | — |
| GET | `user_profiles` | select | id, role | role | — |
| GET | `governance_docs` ❌không có trong lược đồ | select | id | — | — |
| GET | `data_room_docs` | select | id | — | — |
| GET | `readiness_score_history` | select | total_score, captured_at | sắp: captured_at | — |
| GET | `fundraise_rounds` | select | status, target_raise_usd | — | — |
| GET | `kpi_metrics` | select | metric_code, value, period | category · sắp: captured_at | — |

**`/api/rounds`** — `apps/web/src/app/api/rounds/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `fundraise_rounds` | select ❌ | * | sắp: created_at | — |
| POST | `fundraise_rounds` | insert ❌ | — | — | tenant_id, status, name, round_type, target_amount, pre_money_valuation, opened_at, expected_close_at |

**`/api/rounds/[id]`** — `apps/web/src/app/api/rounds/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `fundraise_rounds` | select | * | id | — |
| PATCH | `fundraise_rounds` | update | — | id | *chưa đo được — payload là biến* |
| PATCH | `tenants` | select | name | id | — |
| DELETE | `fundraise_rounds` | delete | — | id | — |

**`/api/sales`** — `apps/web/src/app/api/sales/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `kpi_metrics` | select | name, value, unit, captured_at | tenant_id, name · sắp: captured_at | — |
| GET | `investor_pipeline` | select | id, investor_name, stage, target_check_usd, committed_usd, created_at | sắp: created_at | — |

**`/api/sensitivity`** — `apps/web/src/app/api/sensitivity/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `kpi_metrics` | select | name, value | tenant_id, name · sắp: captured_at | — |

**`/api/settings`** — `apps/web/src/app/api/settings/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `user_profiles` | select | * | id | — |
| GET | `user_profiles` | select | tenant_id | id | — |
| GET | `tenants` | select | id, name, slug, plan, created_at | id | — |
| PATCH | `user_profiles` | update | — | id | full_name, avatar_url, locale |

**`/api/simulation/run`** — `apps/web/src/app/api/simulation/run/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `simulation_scenarios` | insert | id, created_at | — | tenant_id, name, base_revenue, base_customers, assumptions, months, result, status, created_by |
| POST | `financial_statements` | upsert | id | — | *chưa đo được — payload là biến* |
| POST | `unit_economics_inputs` | upsert | id | — | *chưa đo được — payload là biến* |
| POST | `tenant_operating_profile` | upsert | — | — | tenant_id, mode, data_source |

**`/api/sops`** — `apps/web/src/app/api/sops/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `sop_processes` | select | * | unit_code · sắp: unit_code, title_vi | — |
| POST | `sop_processes` | insert | id, title_vi, unit_code, status | — | tenant_id, title_vi, unit_code, code, purpose_vi, steps, frequency, sla_hours, status |

**`/api/sops/[id]`** — `apps/web/src/app/api/sops/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `sop_processes` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/stripe/portal`** — `apps/web/src/app/api/stripe/portal/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `subscriptions` | select | stripe_customer_id | tenant_id · sắp: created_at | — |

**`/api/stripe/webhook`** — `apps/web/src/app/api/stripe/webhook/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `subscriptions` | upsert | — | — | tenant_id, stripe_subscription_id, stripe_customer_id, price_id, tier_code, plan, status, current_period_start, current_period_end, cancel_at_period_end |
| POST | `subscriptions` | update | — | stripe_subscription_id | status, canceled_at |
| POST | `subscriptions` | select | plan, current_period_end | stripe_subscription_id | — |

**`/api/tasks`** — `apps/web/src/app/api/tasks/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `tasks` | select ❌ | * | status, assignee_id · sắp: created_at | — |
| POST | `tasks` | insert ❌ | — | — | created_by, title, kr_id, assignee_id, priority, due_date |

**`/api/tasks/[id]`** — `apps/web/src/app/api/tasks/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| PATCH | `tasks` | update | — | id | *chưa đo được — payload là biến* |
| DELETE | `tasks` | delete | — | id | — |

**`/api/team`** — `apps/web/src/app/api/team/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `user_profiles` | select | id, full_name, email, role, avatar_url, last_active_at, created_at | sắp: created_at | — |
| GET | `invitations` | select | id, email, role, expires_at, accepted_at, created_at | sắp: created_at | — |

**`/api/tenant-profile`** — `apps/web/src/app/api/tenant-profile/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `tenant_operating_profile` | select | * | tenant_id | — |
| POST | `tenant_operating_profile` | upsert | * | — | *chưa đo được — payload là biến* |

**`/api/tenants/switchable`** — `apps/web/src/app/api/tenants/switchable/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `user_profiles` | select | tenant_id | id | — |

**`/api/tokenomics`** — `apps/web/src/app/api/tokenomics/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, POST | `tokenomics_allocations` | danh sách+tạo (crud chung) | * | token_symbol, blockchain · sắp: created_at | schema `Schema` |

**`/api/tokenomics/[id]`** — `apps/web/src/app/api/tokenomics/[id]/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET, PATCH, DELETE | `tokenomics_allocations` | xem+sửa+xoá theo id (crud chung) | * | — | schema `UpdateSchema` |

**`/api/unit-economics`** — `apps/web/src/app/api/unit-economics/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `unit_economics_inputs` | select | * | sắp: period | — |
| POST | `unit_economics_inputs` | upsert | id, period, active_customers | — | tenant_id, period |

**`/api/unit-economics/derive`** — `apps/web/src/app/api/unit-economics/derive/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `fundraise_rounds` | select | round_code, created_at | sắp: created_at | — |

**`/api/unit-metrics`** — `apps/web/src/app/api/unit-metrics/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `kpi_metrics` | select | id, name, value, unit, period, captured_at | tenant_id, name · sắp: captured_at | — |

**`/api/valuation`** — `apps/web/src/app/api/valuation/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `ipo_journeys` | select | id, name, valuation_target, current_phase, target_year, exit_venue | tenant_id · sắp: created_at | — |
| GET | `cap_table_snapshots` | select | id, snapshot_date, snapshot_type, total_shares, fully_diluted_shares, valuation_usd, share_price_usd, holders | tenant_id · sắp: snapshot_date | — |
| GET | `comparables` | select | company_name, ticker, ev_revenue_multiple, ev_ebitda_multiple, pe_ratio, growth_rate_pct | tenant_id · sắp: updated_at | — |

**`/api/valuation/run`** — `apps/web/src/app/api/valuation/run/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| POST | `financial_statements` | select | revenue, cogs, opex_sales, opex_rnd, opex_ga, other_income, capex | sắp: period | — |
| POST | `comparables` | select | company_name, ev_revenue_multiple, ev_ebitda_multiple, pe_ratio | — | — |
| POST | `valuation_runs` | insert | id, created_at | — | tenant_id, method, inputs, result, enterprise_value_usd, equity_value_usd, created_by |

**`/api/vault`** — `apps/web/src/app/api/vault/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `data_room_folders` | select | id, name, parent_id, created_at | sắp: name | — |
| GET | `data_room_docs` | select | id, title, storage_path, mime_type, file_size_bytes, folder_id, created_at | folder_id · sắp: created_at | — |
| GET | `data_room_docs` | select | id, title, storage_path, mime_type, file_size_bytes, folder_id, created_at | sắp: created_at | — |
| POST | `data_room_folders` | insert | id, name, parent_id, created_at | — | tenant_id, name, parent_id |

**`/api/workflow`** — `apps/web/src/app/api/workflow/route.ts`

| PT | Bảng | Việc | Cột select | Cột lọc / sắp xếp | Khoá ghi |
|---|---|---|---|---|---|
| GET | `ipo_journeys` | select | id, current_phase, target_year, valuation_target, status, name | tenant_id · sắp: created_at | — |
| GET | `phase_gates` | select | id, phase_num, gate_code, criterion_name_vi, criterion_category, status, current_value, target_value, pass_score | journey_id · sắp: phase_num, gate_code | — |

## 4 · Route không có `.from()` nào trong tệp

23 route. “Không có `.from()`” **không** đồng nghĩa với “không chạm
dữ liệu”: một số route gọi RPC, một số nhờ thư viện `@/lib` truy vấn hộ, hai route
`internal/*` chạy SQL thô. Cột giữa nói rõ từng trường hợp.

| URL | Phương thức | Nguồn dữ liệu thay thế | Cần đăng nhập |
|---|---|---|---|
| `/api/auth/signout` | POST | dịch vụ Zeni ID (HTTP) | KHÔNG (công khai) |
| `/api/auth/zeni/forgot` | POST | dịch vụ Zeni ID (HTTP) | KHÔNG (công khai) |
| `/api/auth/zeni/login` | POST | dịch vụ Zeni ID (HTTP) | KHÔNG (công khai) |
| `/api/auth/zeni/logout` | POST | tính toán thuần / cấu hình | KHÔNG (công khai) |
| `/api/auth/zeni/oauth/[provider]` | GET | dịch vụ Zeni ID (HTTP) | KHÔNG (công khai) |
| `/api/auth/zeni/oauth/session` | POST | dịch vụ Zeni ID (HTTP) | KHÔNG (công khai) |
| `/api/auth/zeni/phone/login` | POST | dịch vụ Zeni ID (HTTP) | KHÔNG (công khai) |
| `/api/auth/zeni/phone/otp` | POST | dịch vụ Zeni ID (HTTP) | KHÔNG (công khai) |
| `/api/auth/zeni/register` | POST | dịch vụ Zeni ID (HTTP) | KHÔNG (công khai) |
| `/api/auth/zeni/reset` | GET, POST | dịch vụ Zeni ID (HTTP) | KHÔNG (công khai) |
| `/api/cron/agents` | GET | `@/lib/agents/engine` đọc `agent_actions`, `agent_catalog`, `agent_memory`, `agent_runs`, `agent_schedules`, `agents`, `ipo_journeys` | cron-secret |
| `/api/health` | GET | tính toán thuần / cấu hình | KHÔNG (công khai) |
| `/api/internal/db-export` | GET | **SQL thô** qua `@/lib/zeni/db` (mọi bảng `public`) · dịch vụ Zeni ID (HTTP) | token nội bộ |
| `/api/internal/db-setup` | GET, POST | **SQL thô** qua `@/lib/zeni/db` (mọi bảng `public`) · dịch vụ Zeni ID (HTTP) | token nội bộ |
| `/api/masterplan/review` | POST | RPC `plan_vs_actual` · `@/lib/api/tenant` đọc `user_profiles` | có · user+tenant |
| `/api/plan/publish` | POST | RPC `publish_plan_version` · `@/lib/api/tenant` đọc `user_profiles` · `@/lib/plan/build-input` đọc `plan_assumptions`, `plan_lines`, `plan_versions`, `tax_rates` | có · user+tenant |
| `/api/plan/run` | POST | `@/lib/api/tenant` đọc `user_profiles` · `@/lib/plan/build-input` đọc `plan_assumptions`, `plan_lines`, `plan_versions`, `tax_rates` | có · user+tenant |
| `/api/readiness/compute` | POST | RPC `compute_readiness_score` | có · user |
| `/api/settings/email` | POST | dịch vụ Zeni ID (HTTP) · 🚧 trả 501 — chưa nối | có · user |
| `/api/settings/mfa` | GET, POST, PATCH, DELETE | dịch vụ Zeni ID (HTTP) · 🚧 trả 501 — chưa nối | có · user |
| `/api/settings/password` | POST | dịch vụ Zeni ID (HTTP) · 🚧 trả 501 — chưa nối | có · user |
| `/api/stripe/checkout` | POST | `@/lib/api/tenant` đọc `user_profiles` | có · user |
| `/api/verify` | GET | RPC `verify_certificate` | KHÔNG (công khai) |

Trong 23 route này, 9 route vẫn
lấy dữ liệu thật (qua RPC hoặc qua thư viện `@/lib` chạy truy vấn giúp); chỉ
14 route là hoàn toàn không đụng tới CSDL.

## 5 · BẢNG MỒ CÔI — có trong lược đồ, không route nào đọc

Số học: 78 bảng trong lược đồ − 69 bảng
thật sự được route dùng (= 71 tên route gọi − 2 tên không
có trong lược đồ) = **9 bảng mồ côi**.

Nhưng “không route nào đọc” chưa chắc là chết — có bảng được đọc bởi hàm SQL ngay
trong CSDL, hoặc bởi thư viện `@/lib` mà route gọi vòng qua. Ba nhóm dưới đây khác
nhau hẳn về mức độ đáng lo.

| Bảng | Khai sinh ở | Ai còn đọc nó | Xếp loại |
|---|---|---|---|
| `agent_memory` | `024_agent_engine.sql` | `apps/web/src/lib/agents/action-executor.ts`, `apps/web/src/lib/agents/context-builder.ts`, `apps/web/src/lib/agents/engine.ts` | sống gián tiếp |
| `business_models` | `029_plan_tier.sql` | không ai, ở bất cứ đâu | **CHẾT** |
| `external_access_logs` | `003_ipo_complete_flows.sql` | không ai, ở bất cứ đâu | **CHẾT** |
| `ipo_benchmarks` | `026_mba_ipo_engine.sql` | hàm SQL trong `026_mba_ipo_engine.sql` | sống trong CSDL |
| `ipo_readiness_criteria_template` | `003_ipo_complete_flows.sql` | hàm SQL trong `004_seed_content.sql` | sống trong CSDL |
| `journey_levels` | `014_journey_engine.sql` | hàm SQL trong `014_journey_engine.sql`, `015_fix_advance_level_event.sql`, `016_certifications.sql`, `017_fix_master_cert_unique.sql`, `021_academy_scaffold.sql` | sống trong CSDL |
| `phase_content` | `002_core_schema.sql` | hàm SQL trong `003_ipo_complete_flows.sql` | sống trong CSDL |
| `platform_superadmins` | `031_provision_user_fn.sql` | hàm SQL trong `031_provision_user_fn.sql` | sống trong CSDL |
| `tax_rates` | `029_plan_tier.sql` | `apps/web/src/lib/plan/build-input.ts` | sống gián tiếp |

- **2 bảng sống gián tiếp** — thư viện trong `@/lib` đọc giúp, route
  gọi thư viện: `agent_memory`, `tax_rates`.
- **5 bảng sống trong CSDL** — hàm SQL/RPC đọc, API chỉ thấy kết quả
  đã nấu: `ipo_benchmarks`, `ipo_readiness_criteria_template`, `journey_levels`, `phase_content`, `platform_superadmins`.
- **2 bảng CHẾT HẲN** — không route, không thư viện, không hàm SQL nào
  đọc: `business_models`, `external_access_logs`.

(Con số “7 bảng không dòng mã nào trong `apps/web/src` nhắc tới”
gộp cả nhóm sống-trong-CSDL, nên đừng đọc nó như số bảng chết.)

**Chiều ngược lại — route gọi bảng không tồn tại:**

| Bảng route gọi | Route nào gọi | Bảng thật gần nhất trong lược đồ |
|---|---|---|
| `governance_docs` | `/api/roadmap` | `(không có)` |
| `modules` | `/api/roadmap` | `modules_catalog` |

## 6 · CỘT SAI — route dùng cột bảng KHÔNG có

26 chỗ, nằm ở 9 route. Postgres trả lỗi ngay khi câu
lệnh chạy, nên mỗi chỗ ở nhánh ghi là một endpoint **không bao giờ tạo được bản ghi**.

### `/api/academy/cert/[drill-id]` — 1 chỗ

`apps/web/src/app/api/academy/cert/[drill-id]/route.ts`

Tất cả đều nằm ở nhánh **ghi** ⇒ endpoint này chưa bao giờ tạo/sửa được
bản ghi; mọi lần gọi đều rơi vào nhánh `error` và trả 500.

Cột THẬT của `academy_progress`: `cert_level`, `completed_at`, `content_id`, `content_type`, `id`, `progress_pct`, `started_at`, `status`, `tenant_id`, `time_spent_minutes`, `user_id`

| Mã đang dùng | Xuất hiện ở | Dòng | Cột thật gần tên nhất |
|---|---|---:|---|
| `cert_issued_at` | .upsert() khoá trực tiếp | 42 | `completed_at`, `started_at` |

### `/api/cap-table/compute` — 4 chỗ

`apps/web/src/app/api/cap-table/compute/route.ts`

Tất cả đều nằm ở nhánh **ghi** ⇒ endpoint này chưa bao giờ tạo/sửa được
bản ghi; mọi lần gọi đều rơi vào nhánh `error` và trả 500.

Cột THẬT của `cap_table_snapshots`: `created_at`, `fully_diluted_shares`, `holders`, `id`, `journey_id`, `prev_hash`, `round_id`, `row_hash`, `share_price_usd`, `snapshot_date`, `snapshot_type`, `tenant_id`, `total_shares`, `valuation_usd`

| Mã đang dùng | Xuất hiện ở | Dòng | Cột thật gần tên nhất |
|---|---|---:|---|
| `pre_money_valuation` | .insert() khoá trực tiếp | 67 | `valuation_usd` |
| `post_money_valuation` | .insert() khoá trực tiếp | 67 | `valuation_usd` |
| `holdings` | .insert() khoá trực tiếp | 67 | `holders` |
| `created_by` | .insert() khoá trực tiếp | 67 | `created_at` |

### `/api/dd/access` — 6 chỗ

`apps/web/src/app/api/dd/access/route.ts`

Tất cả đều nằm ở nhánh **ghi** ⇒ endpoint này chưa bao giờ tạo/sửa được
bản ghi; mọi lần gọi đều rơi vào nhánh `error` và trả 500.

Cột THẬT của `dd_investor_access`: `access_expires_at`, `access_granted_at`, `access_token`, `can_download`, `created_by`, `folder_scope`, `id`, `investor_id`, `invitee_email`, `invitee_name`, `nda_doc_url`, `nda_signed_at`, `revoke_reason`, `revoked_at`, `round_id`, `tenant_id`, `watermark_pattern`

| Mã đang dùng | Xuất hiện ở | Dòng | Cột thật gần tên nhất |
|---|---|---:|---|
| `investor_email` | .insert() khoá trực tiếp | 38 | `investor_id`, `invitee_email` |
| `investor_name` | .insert() khoá trực tiếp | 38 | `investor_id`, `invitee_name` |
| `nda_accepted` | .insert() khoá trực tiếp | 38 | `access_token` |
| `folder_scopes` | .insert() khoá trực tiếp | 38 | `folder_scope` |
| `expires_at` | .insert() khoá trực tiếp | 38 | `access_expires_at`, `revoked_at` |
| `invited_by` | .insert() khoá trực tiếp | 38 | `invitee_name`, `invitee_email` |

### `/api/dd/qa` — 3 chỗ

`apps/web/src/app/api/dd/qa/route.ts`

Tất cả đều nằm ở nhánh **ghi** ⇒ endpoint này chưa bao giờ tạo/sửa được
bản ghi; mọi lần gọi đều rơi vào nhánh `error` và trả 500.

Cột THẬT của `dd_qa_threads`: `answer`, `answered_at`, `answered_by`, `document_id`, `id`, `investor_access_id`, `question`, `question_asked_at`, `round_id`, `status`, `tenant_id`

| Mã đang dùng | Xuất hiện ở | Dòng | Cột thật gần tên nhất |
|---|---|---:|---|
| `access_id` | .insert() khoá trực tiếp | 57 | `investor_access_id`, `document_id` |
| `topic` | .insert() khoá trực tiếp | 57 | *(không có cột nào gần)* |
| `asked_by` | .insert() khoá trực tiếp | 57 | `answered_by`, `answered_at` |

### `/api/external` — 3 chỗ

`apps/web/src/app/api/external/route.ts`

Tất cả đều nằm ở nhánh **ghi** ⇒ endpoint này chưa bao giờ tạo/sửa được
bản ghi; mọi lần gọi đều rơi vào nhánh `error` và trả 500.

Cột THẬT của `external_stakeholders`: `access_token`, `created_at`, `email`, `expires_at`, `firm_name`, `full_name`, `id`, `invited_by`, `last_accessed_at`, `notes`, `role`, `scope_permissions`, `session_duration_hours`, `status`, `tenant_id`

| Mã đang dùng | Xuất hiện ở | Dòng | Cột thật gần tên nhất |
|---|---|---:|---|
| `name` | .insert() khoá trực tiếp | 53 | `full_name`, `firm_name` |
| `organization` | .insert() khoá trực tiếp | 53 | *(không có cột nào gần)* |
| `scope` | .insert() khoá trực tiếp | 53 | *(không có cột nào gần)* |

### `/api/okrs` — 1 chỗ

`apps/web/src/app/api/okrs/route.ts`

Tất cả đều nằm ở nhánh **ghi** ⇒ endpoint này chưa bao giờ tạo/sửa được
bản ghi; mọi lần gọi đều rơi vào nhánh `error` và trả 500.

Cột THẬT của `okr_objectives`: `created_at`, `description`, `id`, `journey_id`, `owner_id`, `parent_id`, `progress`, `quarter`, `status`, `tenant_id`, `tier`, `title`

| Mã đang dùng | Xuất hiện ở | Dòng | Cột thật gần tên nhất |
|---|---|---:|---|
| `created_by` | .insert() khoá trực tiếp | 65 | `created_at` |

### `/api/pipeline` — 1 chỗ

`apps/web/src/app/api/pipeline/route.ts`

Tất cả đều nằm ở nhánh **ghi** ⇒ endpoint này chưa bao giờ tạo/sửa được
bản ghi; mọi lần gọi đều rơi vào nhánh `error` và trả 500.

Cột THẬT của `investor_pipeline`: `champion_user_id`, `committed_usd`, `contact_email`, `contact_linkedin`, `contact_name`, `created_at`, `firm_name`, `id`, `investor_name`, `investor_type`, `last_activity_at`, `next_action`, `next_action_date`, `notes`, `priority`, `probability_pct`, `round_id`, `stage`, `target_check_usd`, `tenant_id`

| Mã đang dùng | Xuất hiện ở | Dòng | Cột thật gần tên nhất |
|---|---|---:|---|
| `check_size` | .insert() qua zod | 64 | `target_check_usd` |

### `/api/rounds` — 6 chỗ

`apps/web/src/app/api/rounds/route.ts`

Tất cả đều nằm ở nhánh **ghi** ⇒ endpoint này chưa bao giờ tạo/sửa được
bản ghi; mọi lần gọi đều rơi vào nhánh `error` và trả 500.

Cột THẬT của `fundraise_rounds`: `actual_close_date`, `actual_raise_usd`, `created_at`, `esop_pre_carve_pct`, `id`, `journey_id`, `lead_investor`, `post_money_usd`, `pre_money_usd`, `round_code`, `round_name`, `status`, `target_close_date`, `target_raise_usd`, `tenant_id`, `terms_summary`

| Mã đang dùng | Xuất hiện ở | Dòng | Cột thật gần tên nhất |
|---|---|---:|---|
| `name` | .insert() qua zod | 57 | `round_name` |
| `round_type` | .insert() qua zod | 57 | `round_name`, `round_code` |
| `target_amount` | .insert() qua zod | 57 | `target_raise_usd`, `target_close_date` |
| `pre_money_valuation` | .insert() qua zod | 57 | `pre_money_usd`, `post_money_usd` |
| `opened_at` | .insert() qua zod | 57 | `created_at`, `round_name` |
| `expected_close_at` | .insert() qua zod | 57 | `target_close_date`, `actual_close_date` |

### `/api/tasks` — 1 chỗ

`apps/web/src/app/api/tasks/route.ts`

Tất cả đều nằm ở nhánh **ghi** ⇒ endpoint này chưa bao giờ tạo/sửa được
bản ghi; mọi lần gọi đều rơi vào nhánh `error` và trả 500.

Cột THẬT của `tasks`: `agent_generated`, `assignee_id`, `completed_at`, `created_at`, `description`, `due_date`, `id`, `kr_id`, `metadata`, `priority`, `status`, `tenant_id`, `title`

| Mã đang dùng | Xuất hiện ở | Dòng | Cột thật gần tên nhất |
|---|---|---:|---|
| `created_by` | .insert() khoá trực tiếp | 57 | `created_at`, `completed_at` |

## 7 · RPC — hàm SQL route gọi

16 hàm được gọi từ `app/api`. Đối chiếu với
`CREATE [OR REPLACE] FUNCTION` trong migration (35 hàm tất cả).

| Hàm | Có thật trong migration? | Khai ở | Route gọi |
|---|---|---|---|
| `advance_level` | ✅ có | `014_journey_engine.sql` | `/api/journey` |
| `cascade_chairman_event` | ✅ có | `002_core_schema.sql` | `/api/cascade`, `/api/onboarding/complete` |
| `compute_readiness_score` | ✅ có | `003_ipo_complete_flows.sql` | `/api/cron/readiness-recalc`, `/api/dashboard`, `/api/readiness`, `/api/readiness/compute` |
| `derive_finance_kpis` | ✅ có | `025_business_spine.sql` | `/api/financials/derive` |
| `derive_unit_economics` | ✅ có | `026_mba_ipo_engine.sql` | `/api/unit-economics/derive` |
| `diagnose_restructure` | ✅ có | `028_modes_and_connectors.sql` | `/api/restructure/diagnose` |
| `get_journey_state` | ✅ có | `014_journey_engine.sql` | `/api/cockpit`, `/api/journey` |
| `grade_vs_benchmark` | ✅ có | `026_mba_ipo_engine.sql` | `/api/unit-economics/derive` |
| `has_academy_access` | ✅ có | `003_ipo_complete_flows.sql` | `/api/academy/cert/[drill-id]`, `/api/academy/progress` |
| `init_tenant_journey` | ✅ có | `014_journey_engine.sql` | `/api/cockpit`, `/api/journey` |
| `is_chairman_super` | ✅ có | `006_chairman_super_admin.sql` | `/api/admin`, `/api/console` |
| `issue_certificates` | ✅ có | `016_certifications.sql` | `/api/certificates`, `/api/journey` |
| `list_accessible_tenants` | ✅ có | `006_chairman_super_admin.sql` | `/api/tenants/switchable` |
| `plan_vs_actual` | ✅ có | `027_operating_brain.sql` | `/api/masterplan/review` |
| `publish_plan_version` | ✅ có | `029_plan_tier.sql` | `/api/plan/publish` |
| `verify_certificate` | ✅ có | `016_certifications.sql` | `/api/verify` |

**Không hàm nào bị thiếu** — cả 16 RPC đều có định nghĩa trong migration.

Ngược lại, 19 hàm SQL không route nào gọi (phần lớn là trigger
và hàm trợ giúp RLS, gọi từ trong CSDL chứ không qua API): `block_delete_published_bm`, `block_mutate_plan_targets`, `block_update_published_bm`, `block_update_published_plan`, `cap_table_hash_chain`, `cap_table_no_update`, `check_phase_ready`, `current_tenant_id`, `evaluate_level_gate`, `gen_cert_code`, `handle_new_user`, `has_role`, `is_chr_or_ceo`, `promote_phase`, `seed_readiness_criteria_for_journey`, `set_updated_at`, `trigger_round_closed_cap_snapshot`, `verify_cap_table_chain`, `zeni_provision_user`.

## 8 · Tra ngược: bảng nào được route nào dùng

| Bảng | Số route | Route |
|---|---:|---|
| `academy_assessments` | 1 | `/api/academy` |
| `academy_deliverable_specs` | 1 | `/api/academy` |
| `academy_lessons` | 1 | `/api/academy` |
| `academy_progress` | 2 | `/api/academy/cert/[drill-id]`, `/api/academy/progress` |
| `agent_actions` | 2 | `/api/agents`, `/api/agents/actions` |
| `agent_catalog` | 2 | `/api/agents`, `/api/agents/schedules` |
| `agent_runs` | 2 | `/api/agents`, `/api/agents/[id]/run` |
| `agent_schedules` | 3 | `/api/agents`, `/api/agents/schedules`, `/api/roadmap` |
| `agents` | 2 | `/api/agents`, `/api/agents/[id]/run` |
| `audit_logs` | 3 | `/api/audit`, `/api/audit/export`, `/api/cron/audit-retention` |
| `board_resolutions` | 2 | `/api/board/resolutions`, `/api/board/resolutions/[id]` |
| `canvas_blocks` | 2 | `/api/canvas`, `/api/roadmap` |
| `cap_table_snapshots` | 5 | `/api/cap-table`, `/api/cap-table/compute`, `/api/cap-table/dilute`, `/api/cockpit`, `/api/valuation` |
| `certificates` | 2 | `/api/certificates`, `/api/cockpit` |
| `comparables` | 4 | `/api/comparables`, `/api/comparables/[id]`, `/api/valuation`, `/api/valuation/run` |
| `compliance_items` | 2 | `/api/compliance`, `/api/compliance/[id]` |
| `connector_mappings` | 3 | `/api/connectors`, `/api/connectors/[id]/mappings`, `/api/ingest` |
| `data_connectors` | 4 | `/api/connectors`, `/api/connectors/[id]`, `/api/connectors/[id]/mappings`, `/api/ingest` |
| `data_room_docs` | 3 | `/api/pitch`, `/api/roadmap`, `/api/vault` |
| `data_room_folders` | 2 | `/api/pitch`, `/api/vault` |
| `dd_access_logs` | 1 | `/api/dd/logs` |
| `dd_investor_access` | 1 | `/api/dd/access` |
| `dd_qa_threads` | 1 | `/api/dd/qa` |
| `events` | 8 | `/api/admin`, `/api/cockpit`, `/api/console`, `/api/council`, `/api/cron/weekly-digest`, `/api/dashboard`, `/api/dataflow`, `/api/roadmap` |
| `external_stakeholders` | 1 | `/api/external` |
| `feedback_items` | 2 | `/api/feedback`, `/api/feedback/[id]` |
| `finance_assumptions` | 1 | `/api/financials/derive` |
| `financial_models` | 2 | `/api/cockpit`, `/api/financial-model` |
| `financial_statements` | 4 | `/api/financials`, `/api/roadmap`, `/api/simulation/run`, `/api/valuation/run` |
| `fundraise_rounds` | 6 | `/api/cap-table/compute`, `/api/financials/derive`, `/api/roadmap`, `/api/rounds`, `/api/rounds/[id]`, `/api/unit-economics/derive` |
| `glossary` | 1 | `/api/glossary` |
| `governance_docs` ❌ | 1 | `/api/roadmap` |
| `investor_pipeline` | 4 | `/api/investors`, `/api/pipeline`, `/api/pipeline/[id]`, `/api/sales` |
| `invitations` | 1 | `/api/team` |
| `ipo_journeys` | 16 | `/api/admin`, `/api/cap-table`, `/api/cockpit`, `/api/console`, `/api/cron/readiness-recalc`, `/api/dashboard`, `/api/financial-model`, `/api/journeys`, `/api/journeys/[id]`, `/api/masterplan`, `/api/onboarding/complete`, `/api/onboarding/status`, `/api/org`, `/api/roadmap`, `/api/valuation`, `/api/workflow` |
| `ipo_readiness_criteria` | 2 | `/api/readiness`, `/api/readiness/criteria/[id]` |
| `journey_phase_specs` | 1 | `/api/roadmap` |
| `kpi_metrics` | 13 | `/api/burn`, `/api/cockpit`, `/api/console`, `/api/cron/weekly-digest`, `/api/dashboard`, `/api/forecast`, `/api/kpis`, `/api/kpis/[id]`, `/api/onboarding/complete`, `/api/roadmap`, `/api/sales`, `/api/sensitivity`, `/api/unit-metrics` |
| `market_data` | 3 | `/api/market-data`, `/api/market-data/[id]`, `/api/roadmap` |
| `market_intel` | 3 | `/api/market-intel`, `/api/market-intel/[id]`, `/api/roadmap` |
| `masterplan_years` | 2 | `/api/masterplan`, `/api/masterplan/[id]` |
| `membership_tiers` | 1 | `/api/billing` |
| `modules` ❌ | 1 | `/api/roadmap` |
| `modules_catalog` | 1 | `/api/modules` |
| `nlq_logs` | 1 | `/api/nlq` |
| `okr_krs` | 2 | `/api/krs`, `/api/krs/[id]` |
| `okr_objectives` | 5 | `/api/console`, `/api/okrs`, `/api/okrs/[id]`, `/api/onboarding/complete`, `/api/roadmap` |
| `org_positions` | 2 | `/api/org`, `/api/org/[id]` |
| `org_units` | 1 | `/api/org` |
| `phase_gates` | 1 | `/api/workflow` |
| `plan_assumptions` | 1 | `/api/plan` |
| `plan_coa_lines` | 1 | `/api/plan` |
| `plan_lines` | 1 | `/api/plan` |
| `plan_targets` | 2 | `/api/internal/plan-targets`, `/api/plan` |
| `plan_versions` | 2 | `/api/internal/plan-targets`, `/api/plan` |
| `position_templates` | 1 | `/api/org` |
| `readiness_score_history` | 5 | `/api/cockpit`, `/api/console`, `/api/cron/weekly-digest`, `/api/readiness`, `/api/roadmap` |
| `restructure_diagnostics` | 1 | `/api/restructure/diagnose` |
| `simulation_scenarios` | 1 | `/api/simulation/run` |
| `sop_processes` | 2 | `/api/sops`, `/api/sops/[id]` |
| `subscriptions` | 4 | `/api/billing`, `/api/console`, `/api/stripe/portal`, `/api/stripe/webhook` |
| `sync_runs` | 2 | `/api/connectors`, `/api/ingest` |
| `tasks` | 5 | `/api/cockpit`, `/api/cron/weekly-digest`, `/api/dashboard`, `/api/tasks`, `/api/tasks/[id]` |
| `tenant_level_progress` | 2 | `/api/cockpit`, `/api/journey` |
| `tenant_operating_profile` | 2 | `/api/simulation/run`, `/api/tenant-profile` |
| `tenants` | 10 | `/api/admin`, `/api/cascade`, `/api/cockpit`, `/api/console`, `/api/council`, `/api/cron/weekly-digest`, `/api/dashboard`, `/api/internal/plan-targets`, `/api/rounds/[id]`, `/api/settings` |
| `tokenomics_allocations` | 2 | `/api/tokenomics`, `/api/tokenomics/[id]` |
| `training_drills` | 1 | `/api/academy/cert/[drill-id]` |
| `unit_economics_inputs` | 2 | `/api/simulation/run`, `/api/unit-economics` |
| `user_profiles` | 13 | `/api/admin`, `/api/audit/export`, `/api/board`, `/api/cockpit`, `/api/compute/monte-carlo`, `/api/console`, `/api/cron/weekly-digest`, `/api/dashboard`, `/api/internal/plan-targets`, `/api/roadmap`, `/api/settings`, `/api/team`, `/api/tenants/switchable` |
| `valuation_runs` | 1 | `/api/valuation/run` |

## 9 · Bộ rút trích làm việc thế nào (để kiểm lại hoặc chạy lại)

1. **Lược đồ**: đọc 32 tệp `packages/database/zenicloud/*.sql`, gỡ chú thích
   `--` trước khi tách cột (nếu không, cột đứng ngay sau dòng chú thích bị bỏ sót —
   đúng lỗi này từng làm bộ đếm báo nhầm 83 chỗ cột sai thay vì 26), lấy cột từ
   `CREATE TABLE` và mọi `ADD COLUMN` trong cùng một lệnh `ALTER TABLE`.
2. **Route**: với mỗi `.from('bảng')`, đọc chuỗi gọi phía sau cho tới `.from(` kế
   tiếp (tối đa 1500 ký tự) để gom `.select/.eq/.order/.insert/.update`. Truy vấn
   được gán cho phương thức HTTP theo vị trí: nó thuộc về `export async function`
   gần nhất phía trên. (Đếm ngoặc để tìm đúng cuối thân hàm KHÔNG dùng được —
   một dấu nháy đơn trong chú thích là đủ làm lệch, và `console/route.ts` đã lệch
   thật.)
3. **Route dùng CRUD chung** (`@/lib/api/crud`): bảng nằm ở `table: '…'`, cột
   sắp xếp mặc định là `created_at`, và khoá ghi lấy từ `z.object` được trỏ bởi
   `createSchema`/`updateSchema`.
4. **Giới hạn đã biết**: cột nằm trong biến, trong chuỗi ghép, hoặc trong hàm
   trợ giúp ở `@/lib` thì không đếm được — những chỗ đó ghi *chưa đo được* chứ
   không đoán. Bảng nào mã gọi mà lược đồ không khai (`modules`,
   `governance_docs`) được đánh dấu riêng thay vì bỏ qua.

Bộ rút trích là script dùng một lần, đặt ở thư mục tạm của phiên làm việc
(`scratchpad/rut_ban_do.py`) — không nằm trong repo.
