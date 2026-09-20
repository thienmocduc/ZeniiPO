# 02 · BẢN ĐỒ HUYẾT THỐNG DỮ LIỆU — TRANG ↔ API ↔ Ô SỐ

> Mỗi trang lấy số liệu từ endpoint nào, ô nào trên màn hình là **số thật** của
> doanh nghiệp, ô nào còn là **số cứng** nằm sẵn trong HTML bản dựng.
>
> Chốt ngày **2026-09-20**. Mọi con số dưới đây đếm bằng máy từ mã nguồn, không phỏng đoán.
> Tài liệu này **chỉ đọc và đo**, không sửa một dòng mã nào.

---

## 0 · Kiến trúc: số chảy qua đâu

```
apps/web/src/lib/v1/source.html      ← bản dựng TĨNH 6 710 dòng, 44 khối <div class="page" id="page-XXX">
        │                              (chứa sẵn số minh hoạ của công ty mẫu ANIMA Care)
        ├─ getPageInner(pageId)  ──────► apps/web/src/lib/v1/Page.tsx  (V1Page)
        │                                  └─ TỰ BỌC <V1DataBind pageId="page-XXX">
        │                                     ↑ điểm mấu chốt: mọi trang V1 đều có binder
        └─ ROUTE_MAP (extract.ts:381)  ──► đường dẫn Next.js thật (/financials, /cap-table…)

apps/web/src/components/v1-data-bind.tsx
        ├─ PAGE_API_MAP   (dòng 30)   : 'page-XXX' → endpoint chính, fetch 1 lần khi mount
        ├─ PAGE_PATCHERS  (dòng 303)  : 'page-XXX' → hàm vá DOM, ghi số thật đè lên HTML tĩnh
        └─ markUnmeasured (dòng 199)  : fetch LỖI → xoá sạch .kpi-v + tbody, treo băng cảnh báo
                                        fetch OK nhưng hàm vá không chạm ô → SỐ CỨNG ĐỨNG NGUYÊN
```

**Luật một câu:** ô nào nằm ngoài tầm với của lệnh ghi DOM trong hàm vá thì con số hiển thị
là số của **công ty mẫu trong bản dựng**, không phải của người dùng đang đăng nhập.

---

## 1 · Cách đếm (để kiểm lại được)

### 1.1 Tách trang
Cắt theo `<div class="page..." id="page-XXX">` — cùng cách `scripts/audit_buttons_v1.py:39`
làm, **nhưng cắt cân bằng thẻ** thay vì "cắt tới mốc kế tiếp".

> ⚠️ Sai số đã sửa của bản kiểm kê cũ: `page-settings` là khối `page` **cuối cùng**, nên
> cách cắt "tới mốc kế tiếp" nuốt luôn `<script>` toàn cục (dòng 4331–6708) và các modal
> phía sau vào trang đó. Bản kiểm kê cũ vì vậy ghi `settings` có 10–11 nút và 2 ô số cứng
> sai lệch. Ở đây `<script>`/`<style>` bị loại khỏi phạm vi đếm.

### 1.2 Ô số liệu — 4 loại
| Mã | Định nghĩa | Số lượng |
|---|---|---|
| `kpi-v` | thẻ có `class="kpi-v"` (ô giá trị của thẻ KPI) | **76** |
| `td-số` | `<td>` nằm trong `<tbody>` mà nội dung có chữ số | **790** |
| `b-số` | `<b>`/`<strong>` có chữ số, **không** nằm trong `<td>` (tránh đếm trùng) | **58** |
| `số-trơn` | `<div>`/`<span>` lá mà toàn bộ chữ là một con số/tiền/phần trăm đứng một mình, có đơn vị (`$ % × / ₫ K M B tr tỷ`) hoặc ≥3 chữ số | **62** |
| | **TỔNG** | **986** |

`số-trơn` là loại bắt buộc phải có: các trang như `/sensitivity`, `/northstar`, `/valuation`
in định giá `$3.6B`, `$1.3B` bằng `<div>` có style rời, không dùng `.kpi-v` hay bảng — nếu
chỉ đếm 3 loại đầu thì những trang nguy hiểm nhất lại hiện ra "0 ô".

### 1.3 Ô được vá bằng dữ liệu thật
Ô được tính là **thật** khi nằm trong tầm ghi của một lệnh DOM trong hàm vá:

| Lệnh trong binder | Vá được gì |
|---|---|
| `patchKpiCards(root, [...])` | N ô `.kpi-v` đầu tiên trong `.kpi-row` (N = số phần tử mảng) |
| `cards[i].innerHTML` / `kpiSub[i]` từ `querySelectorAll('.kpi-row .kpi-card .kpi-v')` | đúng ô thứ `i` |
| `patchTable(root, '.card', …)` | **toàn bộ** `<td>` trong `tbody` của bảng `table.tbl` **đầu tiên** |
| `querySelector('table.tbl tbody').innerHTML` | bảng đầu tiên |
| `cards[k].querySelector('table.tbl tbody')` từ `.col-2 .card` | bảng thứ `k` trong khối `.col-2` |
| `setHTML(root,'#id')` / `el.innerHTML` với `#id` **có** trong `source.html` | mọi ô bên trong `#id` |
| `#id` **không** có trong `source.html` | binder **tạo panel mới** → không vá ô cũ nào |

### 1.4 Nút
Điều khiển = `<button>` **hoặc** thẻ có `class` chứa `btn` **hoặc** thẻ có `onclick=`,
khử trùng theo vị trí. "Đấu dây" = được binder gắn vào API thật qua
`wireButtonByText` / `wireClick` / `wireEach` trên selector **có sẵn trong bản dựng**
(không tính `button[data-…]` vì đó là nút chính binder sinh ra trong hàng bảng).

### 1.5 Lệnh tái lập
```bash
S=apps/web/src/lib/v1/source.html
grep -oE '<div class="page[^"]*" id="page-[a-z0-9-]+"' $S | wc -l   # 44  khối trang
grep -o  'class="kpi-v"'   $S | wc -l                               # 82  (6 nằm trong <script> → loại ⇒ 76)
grep -oE '<table[^>]*class="tbl"' $S | wc -l                        # 35  bảng
grep -o  'class="kpi-row"' $S | wc -l                               # 22  ← chỉ 22/44 trang có khung KPI
grep -o  '<button' $S | wc -l                                       # 123 (118 nằm trong 44 khối trang)

B=apps/web/src/components/v1-data-bind.tsx
grep -cE "^  'page-[a-z0-9-]+': (async )?\(" $B                     # 43  hàm vá
grep -oE "^  'page-[a-z0-9-]+': '/api" $B | wc -l                   # 43  endpoint khai báo
grep -c  'patchKpiCards(root' $B                                    # 39  lời gọi — trong khi chỉ có 22 .kpi-row
grep -c  'patchTable(root' $B                                       # 16  lời gọi — 7 trong số đó không có bảng để vá

python scripts/audit_buttons_v1.py                                  # kiểm kê nút (bản cũ, xem cảnh báo §1.1)
```

---

## 2 · BẢNG TỔNG HỢP CON SỐ

| Chỉ số | Giá trị | Cách ra |
|---|---:|---|
| Trang trong bản dựng (`page-*`) | **44** | đếm `<div class="page" id="page-…">` |
| Trang có đường dẫn Next thật | **44 / 44** | `ROUTE_MAP` (`extract.ts:381`) — mỗi khoá có `page.tsx` |
| Trang có hàm vá trong `PAGE_PATCHERS` | **43 / 44** | thiếu duy nhất `page-vault` |
| Trang có endpoint trong `PAGE_API_MAP` | **43 / 44** | thiếu duy nhất `page-vault` |
| **Ô số liệu tổng** | **986** | 76 `kpi-v` + 790 `td-số` + 58 `b-số` + 62 `số-trơn` |
| **Ô lấy dữ liệu THẬT** | **455** | **46,1 %** |
| **Ô còn là SỐ CỨNG** | **531** | **53,9 %** |
| Bảng `table.tbl` | **35** | được vá **14** (40,0 %) — **21 bảng số cứng nguyên vẹn** |
| Điều khiển (nút/`.btn`/`onclick`) | **123** | |
| Nút có sẵn được đấu vào API thật | **6** | **4,9 %** — 5 nút gợi ý ở `/nl-query`, 1 nút ở `/comparables` |
| Nút binder **tạo mới** và đấu dây | **21** | qua `ensureHeaderButton` (nút "+ …" ở đầu trang) |
| **Điều khiển thật sự làm việc** | **27 / 144** | **18,8 %** (6 đấu + 21 tạo mới, trên 123 + 21) |
| Trang **0 % ô thật** (vẫn có ô số) | **18** | |
| Trang **100 % ô thật** | **5** | `agents · sops · legal · board · comparables` |
| Trang có lệnh vá **chạy mà không vá được gì** | **23** | xem §5 |
| Trang bị bọc `V1DataBind` **hai lần** | **9** | fetch trùng, vá trùng — xem §5.3 |
| Trang React thuần ngoài hệ V1 (trong `(app)`) | **9** | xem §6 |

---

## 3 · BẢNG CHÍNH — 44 trang

Cột **ô thật/ô tổng** tính theo tầm với thật sự của hàm vá; **nút** = đấu dây / tạo mới / tổng.

| # | Trang | Đường dẫn Next | Hàm vá | Endpoint gọi | Ô thật/tổng | Bảng vá | Nút đấu/mới/tổng | Trạng thái |
|---|---|---|---|---|---:|---:|---|---|
| 1 | `page-pnl` | `/financials` | ✔ d.478 | `/api/financials` + `/api/financials/derive` | **82/100** | 1/3 | 0 / 2 / 3 | Thật một phần |
| 2 | `page-forecast` | `/forecast` | ✔ d.1614 | `/api/forecast` | **0/83** | 0/2 | 0 / 0 / 2 | ⛔ TRƯNG BÀY |
| 3 | `page-unit` | `/clv-cac` | ✔ d.1516 | `/api/unit-economics` + `/derive` | **25/80** | 1/3 | 0 / 2 / 2 | Thật một phần |
| 4 | `page-captable` | `/cap-table` | ✔ d.431 | `/api/cap-table` | **4/68** | 0/1 | 0 / 0 / 3 | ⚠ Chỉ 4 thẻ KPI |
| 5 | `page-sops` | `/sops` | ✔ d.1364 | `/api/sops`, `/api/sops/:id` | **49/49** | 1/1 | 0 / 1 / 2 | ✅ Thật |
| 6 | `page-team` | `/team` | ✔ d.1180 | `/api/team` + `/api/org` | **29/49** | 2/3 | 0 / 1 / 2 | Thật một phần |
| 7 | `page-investors` | `/investors` | ✔ d.1425 | `/api/investors`, `/api/pipeline/:id` | **39/44** | 1/1 | 0 / 1 / 2 | ✅ Thật |
| 8 | `page-kpi` | `/kpi-matrix` | ✔ d.894 | `/api/kpis`, `/api/kpis/:id` | **35/38** | 1/1 | 0 / 0 / 0 | ⚠ Không có nút nào |
| 9 | `page-comparables` | `/comparables` | ✔ d.1992 | `/api/comparables` | **35/35** | 1/1 | 1 / 0 / 2 | ✅ Thật |
| 10 | `page-playbook` | `/playbook` | ✔ d.1631 | `/api/modules?category=playbook` | **4/34** | 0/1 | 0 / 0 / 2 | ⚠ Bảng số cứng |
| 11 | `page-dataroom` | `/data-room` | ✔ d.949 | `/api/vault` | **31/32** | 1/1 | 0 / 1 / 3 | ✅ Thật |
| 12 | `page-vh` | `/valuation` | ✔ d.1835 | `/api/valuation` + `/api/valuation/run` | **0/31** | 0/1 | 0 / 3 / 2 | ⛔ TRƯNG BÀY |
| 13 | `page-board` | `/board` | ✔ d.1716 | `/api/board`, `/api/board/resolutions` | **28/28** | 2/2 | 0 / 1 / 2 | ✅ Thật |
| 14 | `page-ipo` | `/ipo-execution` | ✔ d.569 | `/api/journeys` + `/api/readiness` | **3/28** | 0/1 | 0 / 0 / 2 | ⚠ Chỉ 3 thẻ KPI |
| 15 | `page-mktdata` | `/market-data` | ✔ d.2036 | `/api/market-data` | **25/27** | 1/1 | 0 / 1 / 1 | ✅ Thật |
| 16 | `page-compliance` | `/compliance` | ✔ d.1645 | `/api/readiness` | **4/25** | 0/2 | 0 / 0 / 2 | ⚠ Bảng số cứng |
| 17 | `page-terms` | `/terms` | ✔ d.1489 | `/api/glossary` | **0/25** | 0/1 | 0 / 0 / 2 | ⛔ TRƯNG BÀY (hàm vá rỗng) |
| 18 | `page-fundraise` | `/governance` | ✔ d.453 | `/api/pipeline` | **16/23** | 1/1 | 0 / 0 / 9 | Thật một phần |
| 19 | `page-legal` | `/legal` | ✔ d.1658 | `/api/compliance` | **22/22** | 1/1 | 0 / 1 / 2 | ✅ Thật |
| 20 | `page-roadmap` | `/milestones` | ✔ d.596 | `/api/roadmap` + `/api/canvas` | **4/22** | 0/1 | 0 / 0 / 2 | ⚠ Bảng số cứng |
| 21 | `page-plv` | `/billing` | ✔ d.2192 | `/api/billing` | **0/16** | 0/1 | 0 / 0 / 2 | ⛔ TRƯNG BÀY |
| 22 | `page-tcdoc` | `/terms-docs` | ✔ d.2260 | `/api/modules?category=terms` | **0/16** | 0/1 | 0 / 0 / 2 | ⛔ TRƯNG BÀY |
| 23 | `page-audit` | `/audit` | ✔ d.1795 | `/api/audit` | **4/13** | 0/0 | 0 / 0 / 3 | ⚠ `patchTable` chết |
| 24 | `page-datafow` | `/dataflow` | ✔ d.1052 | `/api/dataflow` + `/api/connectors` | **0/12** | 0/0 | 0 / 1 / 3 | ⛔ TRƯNG BÀY |
| 25 | `page-council` | `/council` | ✔ d.982 | `/api/council` | **0/10** | 0/0 | 0 / 1 / 2 | ⛔ TRƯNG BÀY |
| 26 | `page-pitch` | `/pitch-deck` | ✔ d.1475 | `/api/pitch` | **4/10** | 0/1 | 0 / 0 / 3 | ⚠ Chỉ 4 thẻ KPI |
| 27 | `page-vault` | `/vault` | ✖ **không có** | — (`PAGES_NO_SOURCE`) | **0/10** | 0/1 | 0 / 0 / 6 | ⛔ TRƯNG BÀY — tự khai báo |
| 28 | `page-sales` | `/sales` | ✔ d.2179 | `/api/sales` | **0/8** | 0/1 | 0 / 0 / 2 | ⛔ TRƯNG BÀY |
| 29 | `page-burn` | `/burn` | ✔ d.1491 | `/api/burn` | **4/7** | 0/0 | 0 / 0 / 2 | ⚠ Chỉ 4 thẻ KPI |
| 30 | `page-northstar` | `/northstar` | ✔ d.785 | `/api/masterplan` + `/review` | **0/6** | 0/0 | 0 / 2 / 2 | ⛔ TRƯNG BÀY |
| 31 | `page-dash` | `/dashboard` | ✔ d.304 | `/api/dashboard` + `/api/okrs` | **0/5** | 0/0 | 0 / 0 / 5 | KPI dựng mới, 5 ô nền cứng |
| 32 | `page-schema` | `/workflow` | ✔ d.933 | `/api/workflow` | **4/5** | 0/0 | 0 / 0 / 2 | ⚠ `patchTable` chết |
| 33 | `page-sensitivity` | `/sensitivity` | ✔ d.1822 | `/api/sensitivity` | **0/5** | 0/0 | 0 / 0 / 2 | ⛔ TRƯNG BÀY |
| 34 | `page-token` | `/tokenomics` | ✔ d.1944 | `/api/tokenomics` | **0/5** | 0/0 | 0 / 1 / 1 | ⛔ TRƯNG BÀY |
| 35 | `page-admin` | `/admin` | ✔ d.2272 | `/api/admin` | **0/4** | 0/1 | 0 / 0 / 6 | ⛔ TRƯNG BÀY |
| 36 | `page-agents` | `/users` | ✔ d.682 | `/api/agents` + `/api/agents/actions` | **4/4** | 0/0 | 0 / 0 / 14 | ✅ Thật (panel mới) |
| 37 | `page-nlq` | `/nl-query` | ✔ d.2131 | `/api/nlq` | **0/3** | 0/0 | **5** / 0 / 5 | Nút thật, 3 ô nền cứng |
| 38 | `page-fclb` | `/feedback` | ✔ d.2206 | `/api/feedback` | **0/2** | 0/0 | 0 / 1 / 1 | ⛔ TRƯNG BÀY |
| 39 | `page-mktintel` | `/market-intel` | ✔ d.2084 | `/api/market-intel` | **0/1** | 0/0 | 0 / 1 / 1 | ⛔ TRƯNG BÀY |
| 40 | `page-settings` | `/settings` | ✔ d.2287 | `/api/settings` + `/api/tenant-profile`, `/api/restructure/diagnose`, `/api/simulation/run` | **0/1** | 0/0 | 0 / 0 / 2 | Panel chế độ dựng mới |
| 41 | `page-gvdoc` | `/governance-docs` | ✔ d.2248 | `/api/modules?category=governance` | **0/0** | 0/0 | 0 / 0 / 2 | Không có ô số |
| 42 | `page-okr` | `/okrs` | ✔ d.378 | `/api/okrs` | **0/0** | 0/0 | 0 / 0 / 3 | Cây OKR dựng mới vào `#okrTreeBody` |
| 43 | `page-tasks` | `/task-cascade` | ✔ d.411 | `/api/tasks` | **0/0** | 0/0 | 0 / 0 / 3 | Bảng dựng mới vào `#tasksBody` |
| 44 | `page-training` | `/training` | ✔ d.1809 | `/api/academy/progress` | **0/0** | 0/0 | 0 / 0 / 2 | Không có ô số |

Ghi chú cột **Hàm vá**: `d.NNN` = số dòng khai báo trong `apps/web/src/components/v1-data-bind.tsx`.

---

## 4 · TRANG TRƯNG BÀY

### 4.1 Trang không có hàm vá nào (1 trang)

| Trang | Đường dẫn | Ghi chú |
|---|---|---|
| `page-vault` | `/vault` | **Trung thực**: khai trong `PAGES_NO_SOURCE` (`v1-data-bind.tsx:90`) → `markUnmeasured` xoá số minh hoạ và treo băng "Két bí mật chưa có kho lưu trữ riêng". Đây là cách xử lý ĐÚNG, nên nhân bản cho 15 trang ở §4.2. |

### 4.2 Trang có hàm vá nhưng vá được **0 ô** (17 trang) — nguy hiểm hơn §4.1

> Tổng trang 0 % ô thật = **18** = 1 trang ở §4.1 (`vault`, tự khai báo) + 17 trang dưới đây.

Những trang này gọi API, **nhận 200 OK**, rồi hàm vá chạy mà không chạm được ô nào.
`markUnmeasured` **không** kích hoạt (nó chỉ chạy khi fetch lỗi), nên số minh hoạ đứng
nguyên **không kèm cảnh báo nào** — người xem tin đó là số của mình.

| Trang | Đường dẫn | Ô cứng | Nguyên nhân |
|---|---|---:|---|
| `page-forecast` | `/forecast` | 83 | `patchKpiCards` vô hiệu (trang không có `.kpi-row`), không có `patchTable` |
| `page-vh` | `/valuation` | 31 | `patchKpiCards` vô hiệu; binder chỉ dựng panel mới `#val-panel` |
| `page-terms` | `/terms` | 25 | hàm vá là thân rỗng: `'page-terms': () => { /* glossary — static for now */ }` (d.1489) |
| `page-plv` | `/billing` | 16 | `patchKpiCards` vô hiệu |
| `page-tcdoc` | `/terms-docs` | 16 | `patchKpiCards` vô hiệu |
| `page-datafow` | `/dataflow` | 12 | `patchKpiCards` **và** `patchTable` đều vô hiệu |
| `page-council` | `/council` | 10 | `patchKpiCards` vô hiệu |
| `page-sales` | `/sales` | 8 | `patchKpiCards` vô hiệu |
| `page-northstar` | `/northstar` | 6 | `patchKpiCards` **và** `patchTable` đều vô hiệu |
| `page-sensitivity` | `/sensitivity` | 5 | `patchKpiCards` vô hiệu |
| `page-token` | `/tokenomics` | 5 | `patchKpiCards` **và** `patchTable` đều vô hiệu |
| `page-dash` | `/dashboard` | 5 | 5 ô nền nằm ngoài `#kpiRow`/`#alertsList`/`#okrFocus` |
| `page-admin` | `/admin` | 4 | `patchKpiCards` vô hiệu |
| `page-nlq` | `/nl-query` | 3 | `patchKpiCards` vô hiệu (nút hỏi thì thật) |
| `page-fclb` | `/feedback` | 2 | `patchKpiCards` **và** `patchTable` đều vô hiệu |
| `page-mktintel` | `/market-intel` | 1 | `patchKpiCards` **và** `patchTable` đều vô hiệu |
| `page-settings` | `/settings` | 1 | `patchKpiCards` vô hiệu; binder chỉ dựng panel mới `#mode-panel` |

---

## 5 · LỖI GỐC — vì sao 531 ô vẫn cứng

### 5.1 `patchKpiCards` gọi trên trang không có `.kpi-row` → **21 trang chết lặng**

`patchKpiCards` (`v1-data-bind.tsx:239`) chọn `root.querySelectorAll('.kpi-row .kpi-card')`.
Bản dựng chỉ có **22** khối `class="kpi-row"`, trong khi binder gọi `patchKpiCards` ở
**39** chỗ. Trang không có `.kpi-row` thì hàm chạy xong, không lỗi, không vá gì.

Trang dính: `forecast · vh · comparables · mktdata · plv · tcdoc · sales · admin · nlq · council · northstar · mktintel · fclb · gvdoc · okr · training · sensitivity · token · datafow · kpi · settings`.

### 5.2 `patchTable` gọi trên trang không có `<table class="tbl">` → **7 trang mất dữ liệu**

`patchTable` (`v1-data-bind.tsx:257`) quét các `.card` tìm `table.tbl tbody`; không thấy thì
`return` sớm. Dữ liệu API đã dựng thành `rows` bị **huỷ âm thầm**.

Trang dính: `northstar · schema · datafow · audit · token · mktintel · fclb`.

### 5.3 Bọc `V1DataBind` hai lần → fetch trùng, vá trùng — **9 trang**

`V1Page` (`apps/web/src/lib/v1/Page.tsx:12`) **đã tự bọc** `<V1DataBind>`. Nhưng 9 `page.tsx`
lại bọc thêm một lớp nữa ở ngoài, nên mỗi lần vào trang gọi endpoint **2 lần** và chạy hàm vá
**2 lần**:

`/cap-table · /dashboard · /financials · /governance · /ipo-execution · /milestones · /okrs · /task-cascade · /users`

### 5.4 Nút — chỉ 27/144 điều khiển thật sự làm việc

* **6** nút có sẵn trong bản dựng được đấu vào API thật: 5 nút gợi ý `.btn.gh.sm` ở `/nl-query`, 1 nút "peer" ở `/comparables`.
* **21** nút do binder **tạo mới** (`ensureHeaderButton`) — các nút "+ Tháng", "+ Investor", "+ Pool"…
* **117** điều khiển còn lại chỉ có hành vi demo của `<script>` bản dựng, hoặc không có hành vi nào.
* `page-kpi` (`/kpi-matrix`) có **0 nút**, nhưng binder gọi `wireButtonByText(root,'KPI mới')` (d.916) → **không tìm được nút nào** và cũng không có `ensureHeaderButton` thay thế ⇒ **không có cách nào tạo KPI từ giao diện**.

### 5.5 Fail-closed chỉ bảo vệ nhánh lỗi

`markUnmeasured` (d.204) chạy **khi fetch hỏng**: xoá `.kpi-v`, thay `table.tbl tbody` bằng
"Chưa đo được", treo băng cảnh báo. Đây là hành vi đúng. Nhưng khi API trả **200 với dữ liệu
rỗng** hoặc hàm vá không chạm ô nào, không có lớp bảo vệ nào — số minh hoạ ở lại và trông y hệt số thật.

---

## 6 · TRANG REACT THUẦN (ngoài hệ V1) trong `(app)`

9 trang không dùng `source.html`, dựng bằng React và gọi API riêng — số liệu tất cả đều đến từ API,
không có ô cứng kiểu bản dựng.

| Đường dẫn | Tệp | Nguồn dữ liệu |
|---|---|---|
| `/cockpit` | `(app)/cockpit/page.tsx` → `./cockpit` | `/api/cockpit` |
| `/journey` | `(app)/journey/page.tsx` → `./journey-map` | `/api/journey` |
| `/financial-model` | `(app)/financial-model/page.tsx` → `./studio` | `/api/financial-model` |
| `/certificates` | `(app)/certificates/page.tsx` → `./wall` | `/api/certificates` |
| `/console` | `(app)/console/page.tsx` → `components/console-view` | `/api/console` (chỉ chairman-super) |
| `/audit-log` | `(app)/audit-log/page.tsx` → `./viewer` | `/api/audit`, `/api/audit/export` |
| `/settings-security` | `(app)/settings-security/page.tsx` → `./panel` | `/api/settings/email`, `/mfa`, `/password` |
| `/cascade-success/[journeyId]` | `(app)/cascade-success/[journeyId]/` | `/api/cascade` |
| `/academy` | `(app)/academy/page.tsx` | không có dữ liệu — `redirect('/playbook')` |

Ngoài `(app)`: `/` (landing 975 dòng), `/login`, `/signup`, `/forgot-password`,
`/reset-password`, `/verify`, `/onboarding`, `/khai-tam`, `/auth/oauth/callback`,
`/billing/success`, `/billing/cancelled` — 11 trang, không thuộc phạm vi số liệu doanh nghiệp.

> Tổng `page.tsx`: **64** = 44 (V1) + 9 (React trong `(app)`) + 11 (ngoài `(app)`).

---

## 7 · Ô SỐ CỨNG NGUY HIỂM

Tiêu chí: ô số cứng **trông như số liệu tài chính/sở hữu thật** — nhà đầu tư, thành viên HĐQT
hay nhân sự nhìn vào sẽ tưởng là số của doanh nghiệp mình. Xếp theo mức thiệt hại nếu tin nhầm.

### 🔴 Mức 1 — sở hữu & định giá (sai là mất tiền, mất cổ phần)

| Trang | Đường dẫn | Nội dung ô cứng (trích nguyên văn) |
|---|---|---|
| `page-captable` d.1342 | `/cap-table` | **64/68 ô cứng.** Bảng sở hữu: `7,500,000 – 75%` · `1,000,000 – 10%` · `1,000,000 – 10%` · `300,000 – 3%` · `200,000 – 2%`; sau pha loãng: `63.8%` · `8.5%` · `11.5%` · `2.6%` · `1.7%` · `11.9%`; các vòng `2025 Q4 – $500K @ $2.5M` · `2026 Q3 – $3M @ $30M → $33M` · `2027 Q2`. Hàm vá **chỉ** đổi 4 thẻ KPI, **toàn bộ bảng sở hữu là số của công ty mẫu**. |
| `page-vh` d.3772 | `/valuation` | **31/31 ô cứng.** Lịch sử định giá: `Q3 2026 · $500K/$4.5M/$5M · 10%` → `Q4 2026 · $2M/$18M/$20M` → `Q3 2027 · $15M/$60M/$75M · 20%` → `Q3 2028 · $40M/$227M/$267M` → `Q3 2030 · $100M/$730M/$830M · 12%`. Vá được **0 ô**. |
| `page-forecast` d.3108 | `/forecast` | **83/83 ô cứng.** Dự báo 5 năm: ARR `$820K → $4.2M → $18M → $58M → $130M`; biên gộp `42→72%`; EBITDA `-180% → +22%`; **"Định giá mục tiêu" `$47M · $92M · $345M · $970M · $1.3B SGX`**; Monte Carlo `p90 $1.82B · p50 $1.3B · p25 $840M · p10 $480M`. Vá được **0 ô**. |
| `page-sensitivity` d.3731 | `/sensitivity` | `P10 $1.2B · P25 $2.1B · **P50 $3.6B** · P75 $5.4B · P90 $7.8B` + biểu đồ SVG có chiều cao cột cố định. Nhãn "1,000 runs" và "LIVE" nhưng không có một phép tính nào chạy. |
| `page-northstar` d.1018 | `/northstar` | `Valuation đích $1.3B` · `= $130M × 10× = $1.3B ✓` · `ARR Y5 tối thiểu $130M` · `120%` · `70%`. Vá được **0 ô** (cả `patchKpiCards` lẫn `patchTable` đều chết). |
| `page-roadmap` d.1973 | `/milestones` | Bảng gọi vốn luỹ kế: `2025 $500K` · `2026 $3M → $3.5M` · `2027 $12M → $15.5M` · `2028 $45M → $60.5M` · `2030 $70M → $130.5M` · `2030 $150M → $280.5M`. Hàm vá chỉ chạm 4 thẻ KPI. |
| `page-dash` d.911 | `/dashboard` | **`Sở hữu: Zeni 85% · ESOP 10% · Cố vấn 5%`** — câu sở hữu nằm ngay trang chủ sau đăng nhập, không hề được vá. |

### 🟠 Mức 2 — doanh thu, dòng tiền, đơn vị kinh tế

| Trang | Đường dẫn | Nội dung ô cứng |
|---|---|---|
| `page-unit` d.3037 | `/clv-cac` | **55/80 ô cứng.** Bảng cohort giữ chân `Oct '25 … ` với `100% · 71% · 48% · 28%` và ARPU `$168 · $182 · $184 · $189`; CAC `$48`, LTV `$180`. Chỉ bảng #1 được vá, 2 bảng còn lại nguyên số mẫu. |
| `page-pnl` d.2834 | `/financials` | 18/100 ô cứng — bảng #1 (P&L theo tháng) đã thật, nhưng **bảng #2 và #3 vẫn cứng**: `(1,180M)` · `(1,363M)` · `+35M` · `+148M` · `(1,248M) ≈ $50K burn` · `$672K` · `$28.5K` · `($84K)`. Hai bảng thật/giả nằm cạnh nhau trên cùng màn hình — khó phát hiện nhất. |
| `page-burn` d.2924 | `/burn` | `$850K` · `$820K` · `$580K` (runway/đốt tiền) là `số-trơn` cứng; 4 thẻ KPI thì thật. |
| `page-sales` d.3954 | `/sales` | `420` lead · `147` cơ hội · deal `$48K – 30/5` · `$36K – 12/6` · `$120K – 15/6`. Vá được **0 ô**. |
| `page-plv` d.3980 | `/billing` | Hoá đơn `INV-2026-0415 · 15/4/2026 · $1,999` (và 2026-0315, 2026-0215) + dung lượng `12.4GB` · `42K` request. **Số tiền hoá đơn là bịa** — người dùng có thể đối chiếu nhầm với thẻ tín dụng. |
| `page-nlq` d.3922 | `/nl-query` | Câu trả lời mẫu `$342K · $421K · +23.1% QoQ` nằm sẵn trong khung kết quả trước khi người dùng hỏi. |
| `page-kpi` d.1115 | `/kpi-matrix` | Bảng ma trận đã thật (35/38), còn lại `$398K` · `Rule of 40` · `Gross Margin (p24)` là số cứng lẫn vào. |

### 🟡 Mức 3 — pháp lý, điều khoản, nhân sự, hội đồng

| Trang | Đường dẫn | Nội dung ô cứng |
|---|---|---|
| `page-terms` d.2770 | `/terms` | **25/25 ô cứng** — cả bảng điều khoản gọi vốn: `$30M` · `$1.5M (lead)` · `1× non-participating` · `2 Nhà sáng lập + 1 Investor + 1 Indep` · `4-year · 25% credit (p30)` · `Top-up to 12% post-money` · `$40K legal`. Hàm vá là thân rỗng. Ai đàm phán theo bảng này là đàm phán theo điều khoản của công ty khác. |
| `page-team` d.2503 | `/team` | Bảng ESOP: `C-Level (6 people) · 600,000 / 280,000 / 320,000` · `Early Employees (6) · 200,000 / 72,000 / 128,000` · `Tổng 1,000,000 · 420,000 · 580,000` · `10% of cap table`. Bảng thành viên + lời mời đã thật, bảng ESOP thì không. |
| `page-compliance` d.3244 | `/compliance` | 21/25 ô cứng — lịch tuân thủ `Apr 30 · T-10d — Tờ khai thuế GTGT Q1 2026`, `May 15 · T-25d — Tờ khai TNCN`, `Báo cáo BHXH tháng 5`… gán cho `CFO-001`/`CLO-001`. **Deadline thuế bịa** dễ bị coi là lịch thật. |
| `page-ipo` d.3389 | `/ipo-execution` | 25/28 ô cứng — toàn bộ mốc `T-180 → T+180`: `Audit Big 4 · 3-year PCAOB`, `S-1 public filing`, `Roadshow 20 cities`, `SGX Bell Ring`, `Lock-up 180 ngày`. |
| `page-council` d.1874 | `/council` | Điểm 9 hội đồng `92/100 · 88/100 · 86/100 · 84/100 · 68/100 · 82/100 · 90/100 · 72/100` + `842` + `3 flags`. Vá được **0 ô**. |
| `page-playbook` d.3174 | `/playbook` | 30/34 ô cứng — benchmark unicorn `$3.7B val` · `$7B val` · `$2B val` · `$60B+ cap` · `Mindbody acq $1B`. (Đây là tri thức ngành, ít nguy hiểm hơn, nhưng vẫn gắn nhãn "LIVE".) |
| `page-token` d.3804 | `/tokenomics` | `300M Đội ngũ` · `250M Community` · `200M Treasury` · `150M Fundraise` · `100M Liquidity` + thanh phân bổ `30/25/20/15/10%`. |
| `page-vault` d.4123 | `/vault` | `AWS S3 Storage Key · CTO · 5d ago`… — **đã được `markUnmeasured` che**, không nguy hiểm, giữ lại để đối chiếu. |
| `page-audit` d.3548 | `/audit` | 9/13 — nhật ký kiểm toán giả `CHR-001` · `CFO-001` · `Hội đồng Resolution 2026-04-18-01`. Nhật ký kiểm toán bịa là rủi ro tuân thủ. |
| `page-admin` d.4097 | `/admin` | `99.94%` uptime · `2h ago` · `5min ago` · `1w ago`. |
| `page-datafow` d.2156 | `/dataflow` | `Full-auto 28%` · `518` · `142` · `1,825` · `12 departments × 9 agents`. Vá được **0 ô**. |
| `page-pitch` d.2698 | `/pitch-deck` | Điểm chấm pitch `8.2/10` · `6.8/10` · `8.8/10` · `7.1/10` kèm tên nhà đầu tư thật `Khailee Ng · 500 Global`. |
| `page-mktintel` d.3890 | `/market-intel` | `Temasek $100M SEA SaaS fund` — tín hiệu thị trường bịa gắn tên quỹ có thật. |
| `page-dataroom` d.1806 | `/data-room` | `500 Global · Khailee Ng` còn sót (31/32 ô đã thật). |

**Tổng cộng 531 ô số cứng — trong đó 7 trang Mức 1 chiếm 212 ô (40 %) và 7 trang Mức 2 chiếm 106 ô (20 %).**

---

## 8 · Thứ tự nên sửa (tính theo số ô cứng gỡ được trên mỗi lần sửa)

| # | Việc | Gỡ được | Ghi chú |
|---|---|---:|---|
| 1 | Thêm `.kpi-row` (hoặc đổi `patchKpiCards` sang selector `.kpi-card` không phụ thuộc `.kpi-row`) | mở khoá 20 trang | sửa 1 chỗ trong `patchKpiCards` là đủ cho phần lớn |
| 2 | Vá **bảng sở hữu** `page-captable` | 64 ô Mức 1 | endpoint `/api/cap-table` đã có sẵn dữ liệu holders |
| 3 | Vá `page-forecast` (chưa có `patchTable` nào) | 83 ô | |
| 4 | Vá `page-vh` bảng lịch sử định giá | 31 ô | `/api/valuation` đã có |
| 5 | Vá bảng #2, #3 của `page-pnl` và `page-unit` | 73 ô | `patchTable` hiện chỉ với tới bảng đầu tiên |
| 6 | Cho `markUnmeasured` chạy cả khi **hàm vá không chạm ô nào** | che 531 ô tức thì | biện pháp chặn tạm, an toàn hơn để số bịa đứng |
| 7 | Gỡ lớp `V1DataBind` thừa ở 9 `page.tsx` | −50% lượt gọi API trên các trang đó | |
| 8 | Thêm nút tạo KPI cho `/kpi-matrix` | mở lại 1 luồng nghiệp vụ đang chết | |

---

## 9 · Nguồn đối chiếu

| Việc | Tệp |
|---|---|
| Bản dựng tĩnh, 44 khối trang | `apps/web/src/lib/v1/source.html` |
| Binder: `PAGE_API_MAP` d.30 · `PAGES_NO_SOURCE` d.90 · `setText` d.172 · `setHTML` d.178 · `markUnmeasured` d.204 · `patchKpiCards` d.239 · `patchTable` d.257 · `patchCardCount` d.284 · `PAGE_PATCHERS` d.303 | `apps/web/src/components/v1-data-bind.tsx` |
| Bọc `V1DataBind` tự động (d.12) | `apps/web/src/lib/v1/Page.tsx` |
| `ROUTE_MAP` `page-xxx` → đường dẫn Next (d.381) | `apps/web/src/lib/v1/extract.ts` |
| Trợ giúp gắn nút: `wireClick` d.148 · `wireButtonByText` d.158 · `wireEach` d.171 · `ensureHeaderButton` d.191 | `apps/web/src/components/v1-actions.ts` |
| Chạy lại `<script>` gốc của bản dựng | `apps/web/src/components/v1-interactivity.tsx` · `apps/web/src/lib/v1/getScript.ts` |
| Kiểm kê nút (bản cũ, cắt trang chưa cân bằng thẻ) | `scripts/audit_buttons_v1.py` |
