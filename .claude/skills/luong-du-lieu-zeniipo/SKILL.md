---
name: luong-du-lieu-zeniipo
description: Tra và sửa luồng dữ liệu ZeniIPO — dùng khi đấu nối FE↔BE, thêm/sửa trường dữ liệu, truy ngược một con số về nguồn, thêm trang hoặc endpoint mới, hoặc khi nghi ngờ số liệu trên màn hình là số bịa. Chứa kiến trúc tầng, bất biến tài chính bắt buộc, quy ước trường, và quy trình 4 bước truy nguồn.
---

# LUỒNG DỮ LIỆU ZENIIPO

> Nền tảng này đưa số liệu tài chính cho nhà đầu tư và hội đồng quản trị đọc.
> Một con số sai ở đây không phải lỗi giao diện — nó là **sai sót công bố**.
> Mọi quy tắc dưới đây tồn tại vì lý do đó, không phải vì thẩm mỹ mã nguồn.

---

## 0. ĐỌC 30 GIÂY — nếu chỉ kịp nhớ ba điều

1. **Một con số chỉ có MỘT nguồn sự thật.** Mọi chỗ khác là dẫn xuất, và phải
   dẫn xuất bằng công thức trong mã, không phải bằng cách gõ lại.
2. **Mọi con số hiện ra màn hình phải mang NHÃN NGUỒN.** Đo được · Ước tính ·
   Mục tiêu · Chưa đo được. Không có nhãn = không được hiện.
3. **Chưa đo được thì ghi "chưa đo được".** Tuyệt đối không điền số đẹp cho đỡ
   trống. Số bịa trên màn hình nhà đầu tư là rủi ro pháp lý, không phải lỗi UI.

---

## 1. KIẾN TRÚC BA TẦNG — và ranh giới không được vượt

```
   ZeniIPO              ZeniOS                 ZeniERP
   KẾ HOẠCH       →     QUYẾT ĐỊNH       →     THỰC TẾ
   (plan)               (decision)             (actual)

   Đặt mục tiêu         Chốt phương án         Ghi nhận phát sinh
   Mô hình 5 năm        Duyệt ngân sách        Hoá đơn, phiếu chi
   Kịch bản             Phân bổ nguồn lực      Sổ cái
```

**Điểm hợp đồng duy nhất giữa ba tầng:**

```
plan_targets ( company_id × month × coa_code × amount_vnd BIGINT )
```

- ZeniIPO **ghi** vào bảng này. ZeniOS/ZeniERP **đọc** và đối chiếu.
- Không tầng nào được đọc thẳng bảng nội bộ của tầng khác. Muốn thêm trường
  trao đổi → mở rộng hợp đồng này, không mở cửa sau.
- Sai lệch kế hoạch ↔ thực tế là **thông tin có giá trị**, phải hiện ra, không
  được che bằng cách cho tầng này ghi đè tầng kia.

---

## 2. BẢY BẤT BIẾN TÀI CHÍNH — vi phạm là chặn, không phải cảnh báo

Đây là chỗ một tiến sĩ tài chính hoặc thạc sĩ MBA sẽ soi đầu tiên. Nếu nền
tảng không giữ nổi bảy điều này thì mọi thứ phía trên chỉ là đồ hoạ.

| # | Bất biến | Vì sao | Kiểm ở đâu |
|---|---|---|---|
| 1 | **Tiền = số nguyên VND** (BIGINT), không dùng số thực | Số thực làm tròn sai; cộng 12 tháng lệch vài đồng là báo cáo không khớp | `plan/engine.ts` · migration |
| 2 | **Σ 12 tháng = số năm** | Người đọc sẽ tự cộng lại để thử. Lệch một lần là mất tin cậy toàn bộ | test số cứng trong `engine.test.ts` |
| 3 | **Tiền cuối kỳ = tiền đầu kỳ + dòng tiền ròng trong kỳ** | Đây là phép thử sơ đẳng nhất của một mô hình tài chính | `engine.test.ts` |
| 4 | **Lỗ thì thuế = 0**, không âm | Thuế âm nghĩa là nhà nước trả tiền cho doanh nghiệp — vô nghĩa với VAS | `engine.ts` |
| 5 | **Ba báo cáo phải nối nhau**: lãi lỗ → bảng cân đối → lưu chuyển tiền | Ba bảng rời nhau là dấu hiệu số liệu gõ tay | mô hình tài chính |
| 6 | **Cơ cấu sở hữu cộng đúng 100%**, phân biệt rõ cơ bản và pha loãng hoàn toàn | Cap table lệch 0,1% là tranh chấp cổ phần | `cap-table` |
| 7 | **Kế hoạch đã công bố thì BẤT BIẾN** — sửa = tạo phiên bản mới | Nhà đầu tư đã xem bản nào thì bản đó phải còn nguyên để đối chiếu | `plan_versions` |

**Quy tắc kèm theo:**
- **Đơn vị tiền chức năng là VND.** Mọi con số USD hiện ra màn hình phải kèm
  *tỷ giá* và *ngày áp tỷ giá*. Không có hai thứ đó thì con số vô nghĩa.
- **Mọi con số phải gắn với một kỳ.** `(công ty × kỳ × mã COA)` là bộ khoá tối
  thiểu. Con số không có kỳ là con số không kiểm toán được.
- **COA theo chuẩn VAS**, có ánh xạ sang IFRS cho nhà đầu tư nước ngoài. Đừng
  tự chế mã tài khoản.
- **Định giá phải nêu phương pháp + ngày + bộ so sánh.** "Định giá 47 triệu đô"
  mà không nói bằng phương pháp nào thì không ai ký được.

---

## 3. QUY TRÌNH 4 BƯỚC — truy một con số về nguồn

Dùng khi có người hỏi *"con số này ở đâu ra?"* — câu hỏi nhà đầu tư hay hỏi
nhất, và là câu hỏi mà mã nguồn lộn xộn không trả lời được.

```
Bước 1 — TRANG:    số nằm ở trang nào? → docs/luong-du-lieu/02-trang-api-o-so.md
                   Trang đó có hàm vá trong PAGE_PATCHERS không?
                   KHÔNG có  ⇒ con số là SỐ CỨNG trong source.html ⇒ SỐ BỊA.

Bước 2 — ENDPOINT: hàm vá gọi API nào? (xem v1-data-bind.tsx)

Bước 3 — BẢNG:     endpoint đọc bảng/cột nào? → docs/luong-du-lieu/01-api-bang-cot.md

Bước 4 — NGUỒN:    dữ liệu vào bảng đó bằng đường nào?
                   · người dùng nhập  → có nhật ký ai nhập, lúc nào không?
                   · nối từ hệ khác   → connectors/ingest.ts, có nhãn nguồn không?
                   · máy tính ra      → công thức nằm ở đâu? có test số cứng không?
```

Đứt ở bước nào thì **đó** là chỗ phải sửa. Đừng vá ở bước 1 khi gốc ở bước 4 —
vá màn hình cho đẹp trong khi dữ liệu sai là làm nặng thêm vấn đề.

---

## 4. TRƯỚC KHI ĐẤU MỘT LUỒNG MỚI — danh mục kiểm

Làm đủ, theo thứ tự. Bỏ bước nào thì ghi rõ vì sao.

- [ ] **Con số này có nguồn sự thật chưa?** Chưa có thì dựng nguồn trước, đừng
      dựng màn hình trước rồi đi tìm số sau.
- [ ] **Bảng đã có cột cần dùng chưa?** Tra `packages/database/zenicloud/*.sql`.
      TypeScript **không** biết lược đồ CSDL — tên cột chỉ là chuỗi, gõ sai thì
      tới lúc chạy mới vỡ. *(Đã mắc: 21 endpoint trả 500 vì `created_at` không
      tồn tại, bảng dùng `captured_at`.)*
- [ ] **Có `tenant_id` và RLS bật chưa?** Bảng tenant-scoped mà thiếu là lộ chéo
      công ty.
- [ ] **Tiền có phải BIGINT VND không?** Số thực là không đạt.
- [ ] **Có nhãn nguồn không?** Con số không nhãn không được hiện.
- [ ] **Đường thất bại xử thế nào?** Gọi API hỏng thì phải hiện "chưa đo được",
      KHÔNG được hiện số cũ hoặc số 0 như thể là thật.
- [ ] **Có test số cứng không?** Công thức tài chính bắt buộc phải có test với
      số vào–ra cụ thể, không chỉ test "hàm chạy không lỗi".
- [ ] **Chạy `pnpm -C apps/web exec vitest run`** — bộ test đã canh sẵn: cột có
      thật (`schema-khop-ma.test.ts`), giao diện tiếng Việt (`tieng-viet.test.ts`),
      từ điển thuật ngữ (`thuat-ngu.test.ts`).

---

## 5. QUY ƯỚC TRƯỜNG DỮ LIỆU

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Khoá chính | `id uuid` | |
| Công ty | `tenant_id uuid NOT NULL` — bắt buộc với bảng nghiệp vụ | |
| Tiền | `*_vnd bigint` (nguyên, VND) · `*_usd numeric` chỉ khi buộc phải | `amount_vnd` |
| Tỷ lệ | `*_pct numeric` 0–100, **không** dùng 0–1 lẫn lộn | `probability_pct` |
| Thời điểm ghi nhận | `captured_at` (số liệu) · `issued_at` (chứng nhận) · `started_at`/`finished_at` (tiến trình) | |
| Thời điểm tạo bản ghi | `created_at` — **không phải mọi bảng đều có**, phải tra trước khi dùng | |
| Kỳ | `period text` (`2026-Q2`) hoặc `month date` (ngày đầu tháng) | |
| Trạng thái | `status text` có ràng buộc `CHECK`, không dùng số ma thuật | |

**Bẫy đã mắc:** `kpi_metrics` có `captured_at` chứ **không** có `created_at`;
`certificates` dùng `issued_at`; `okr_krs` dùng `due_date`; `dd_access_logs`
dùng `investor_access_id` chứ không phải `access_id`. Luôn tra lược đồ.

---

## 6. CÁCH LY CÔNG TY — không thoả hiệp

- Ứng dụng nối CSDL bằng vai **`zeniipo_com_runtime`**, vai này **KHÔNG sở hữu
  bảng**. Đó là điều kiện bắt buộc để Postgres áp RLS — vai chủ sở hữu bảng
  được bỏ qua RLS theo thiết kế.
- Vai chủ `zeniipo_com_app` **chỉ** dùng chạy migration
  (`DATABASE_URL_MIGRATION`). **Đừng bao giờ** trỏ `DATABASE_URL` về vai chủ.
- Mỗi truy vấn chạy trong `withUser(uid)`: mở giao dịch, `SET LOCAL ROLE
  authenticated`, đặt `app.uid`. Chính sách RLS đọc `current_tenant_id()` từ đó.
- Vai chạy không với tới schema `auth`. Cần ghi vào đó thì mở **một hàm
  SECURITY DEFINER** hẹp (mẫu: `zeni_provision_user` ở migration 031), đừng nới
  quyền cho cả vai.
- **Phép thử bắt buộc trước khi tin là đã cách ly:** hai tài khoản ở hai công
  ty, mỗi bên tạo một bản ghi, rồi đọc chéo. Đọc thẳng theo mã bản ghi của bên
  kia phải trả **404**. Chạy ở tầng HTTP, không phải chỉ ở tầng SQL.

---

## 7. NHỮNG LỖI ĐÃ MẮC — đọc để không lặp

| Lỗi | Gốc | Bài học |
|---|---|---|
| 21 endpoint trả 500 | truy vấn cột không tồn tại | TypeScript không biết lược đồ CSDL → phải có test đọc thẳng migration |
| Đăng ký hỏng trong im lặng | lệnh ghi thất bại nhưng lỗi bị nuốt trong `catch` | "best-effort" mà nuốt lỗi là giấu hỏng hóc; phải ghi log rõ ràng |
| Cách ly không có hiệu lực | ứng dụng nối bằng vai chủ sở hữu bảng | RLS viết đủ vẫn vô dụng nếu vai kết nối sai |
| Test xanh vì lý do sai | test dò `[role="alert"]` mà Next.js chèn sẵn phần tử đó vào mọi trang | canh bằng bằng chứng không giả được (lượt gọi mạng + mã trả về) |
| Xoá nhầm nút Đăng nhập | biểu thức tìm-thay lười trên HTML | kiểm CẢ thứ phải CÒN, không chỉ thứ phải mất |
| Số cứng trông như số thật | ô số liệu trong bản dựng không ai vá | mọi con số phải có nhãn nguồn |

---

## 8. TỆP TRA CỨU

| Cần gì | Mở tệp |
|---|---|
| Endpoint đọc bảng/cột nào | `docs/luong-du-lieu/01-api-bang-cot.md` |
| Trang lấy số từ đâu, ô nào là số cứng | `docs/luong-du-lieu/02-trang-api-o-so.md` |
| Lược đồ thật | `packages/database/zenicloud/*.sql` |
| Hàm vá số liệu vào màn hình | `apps/web/src/components/v1-data-bind.tsx` |
| Đấu dây nút bấm | `apps/web/src/components/v1-actions.ts` |
| Trang ↔ đường dẫn | `ROUTE_MAP` trong `apps/web/src/lib/v1/extract.ts` |
| Tầng dữ liệu, `withUser` | `apps/web/src/lib/zeni/db.ts` |
| Công thức tài chính | `apps/web/src/lib/plan/engine.ts` |
| Từ điển thuật ngữ song ngữ | `apps/web/src/lib/v1/thuat-ngu.ts` |
