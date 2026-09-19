# TRẢ LỜI TICKET — ZIPO-RESTORE-2026-09-18

**Từ:** đội ZeniIPO · **Tới:** Zeni Cloud (hạ tầng) · **Ngày:** 19/09/2026
**Trả lời ticket:** `ZENI_TICKET_ZENIIPO_khoi_phuc_2026-09-18.md`

---

## 1. Cảm ơn và xác nhận

Xác nhận đã nhận và đã kiểm chứng phía mình:

- `zeniipo.com` · `www.zeniipo.com` **đã sống**, SSL hợp lệ — cảm ơn đội đã thao tác DNS trực tiếp.
- Database `zeniipo_com` đã có, **31/31 migration chạy sạch**: `agent_catalog` 108 · `modules_catalog` 32.
- Đã đo hành trình người dùng mới: đăng ký → đăng nhập → **được cấp workspace tự động** →
  `/api/settings` · `/api/dashboard` · `/api/agents` · `/api/team` · `/api/financials` đều **200 với dữ liệu thật**.

Ba khoảng trống nền tảng ở mục 4 (thiếu 3 vai · thiếu `WITH ADMIN OPTION` · cấp lại CSDL xoay
mật khẩu) — ghi nhận, đặc biệt mục #3, đó đúng là thứ có thể làm rớt mọi ứng dụng khách đang chạy.

---

## 2. ⛔ Mục 4b (RLS không có hiệu lực) — **ĐỘI ZENIIPO CHỌN CÁCH B**

**Quyết định: cách B — Zeni cấp vai chạy app RIÊNG, không sở hữu bảng.**

Đề nghị đội Zeni dựng giúp:

| Vai | Quyền | Dùng để |
|---|---|---|
| Vai chủ (hiện tại, `zeniipo_com_app`) | sở hữu schema `public` | CHỈ chạy migration / `db-setup` |
| **Vai app mới** (vd `zeniipo_com_runtime`) | KHÔNG sở hữu bảng · `USAGE` trên schema · `SELECT/INSERT/UPDATE/DELETE` trên bảng · `EXECUTE` trên hàm · **KHÔNG** `BYPASSRLS` | ứng dụng chạy hằng ngày |

Xin đội cấp thêm:
- `GRANT authenticated, anon TO <vai app mới>;` — lớp dữ liệu của app gọi
  `SET LOCAL ROLE authenticated` mỗi phiên, cần quyền thành viên mới chuyển vai được.
- `ALTER DEFAULT PRIVILEGES` cho vai chủ để bảng tạo sau này tự có quyền cho vai app —
  nếu không, mỗi lần chạy migration mới lại phải cấp quyền tay.
- Chuỗi kết nối mới để bên mình thay `DATABASE_URL`.

**Vì sao chọn B chứ không phải A:**
Cách A (`FORCE ROW LEVEL SECURITY`) áp cho cả chủ sở hữu, nên chính bộ `db-setup` của bên mình
sẽ bị chặn — mỗi lần chạy migration lại phải tắt/bật, đúng loại thao tác dễ quên và dễ để hở
vĩnh viễn. Cách B tách bạch một lần, về sau không phải nhớ gì.

**Bên mình chuẩn bị sẵn:** lớp dữ liệu đã viết theo đúng mô hình này từ đầu — mỗi truy vấn
chạy trong một giao dịch có `SET LOCAL ROLE authenticated` + đặt định danh người dùng
(`apps/web/src/lib/zeni/db.ts`, hàm `withUser`). Nên đổi sang vai không-sở-hữu là RLS có hiệu
lực ngay, không phải sửa mã ứng dụng. Chỉ cần đổi `DATABASE_URL`.

**Đề nghị nghiệm thu sau khi đổi** — bên mình sẽ tự chạy và gửi kết quả:
tạo 2 tài khoản ở 2 tổ chức khác nhau, tài khoản A gọi API đọc dữ liệu, xác nhận **không**
thấy bất kỳ dòng nào của tổ chức B. Chưa qua phép thử này thì bên mình chưa coi là xong.

---

## 3. Mục 4c — nguyên nhân `403 "No tenant for user"` (đã rõ, không phải lỗi CSDL)

Đội Zeni loại trừ đúng: không phải RLS, không phải thiếu dòng hồ sơ.

Nguyên nhân thật: **đó là trạng thái TRƯỚC khi hồ sơ được tạo**. Ứng dụng tự cấp hồ sơ +
workspace ở lần gọi đầu tiên sau đăng nhập (`apps/web/src/lib/supabase/server.ts`, hàm
`ensureProvisioned`) — ghi vào `auth.users`, trigger `handle_new_user` của migration 001 lo
phần còn lại. Ảnh QA chụp đúng khoảnh khắc trước bước đó.

Về ghi chú "không có trigger nào tự tạo `user_profiles`": trigger **có tồn tại** nhưng gắn trên
`auth.users` (di sản mô hình Supabase), nên tra `information_schema.triggers` theo tên
`user_profile` sẽ không thấy. Đúng như đội nói, nếu đường đăng ký bỏ sót bước ghi `auth.users`
thì người dùng mới sẽ gặp 403 — bên mình đã nối bước đó và đo lại: tài khoản mới nhận được
workspace ngay, không còn 403.

---

## 4. Việc bên mình đã tự sửa (ghi lại để đội khỏi làm trùng)

- **Thứ tự migration**: đã đổi `00_zeni_stub.sql` → `000_zeni_stub.sql` (commit `3c9b491`) và
  cho bộ chạy **sắp theo số** trích từ tên tệp thay vì sắp chuỗi — đúng như đội gợi ý, nay sai
  tên cũng không vỡ. Đã ghi chú cảnh báo ngay trong tệp để không ai đổi ngược.
- Toàn bộ 27 commit đã đẩy lên GitHub nhánh `feat/zeni-console-clean` — nguồn khôi phục an toàn.

---

## 5. ⚠️ Một sự cố MỚI cần đội Zeni xem: deploy dừng ở trạng thái `built`, không tung ra

Sau khi mọi thứ đã sống, bên mình đẩy thêm 2 bản deploy và **cả hai đều dừng ở `built`**,
không chuyển sang `deploying`/`success`:

| Deploy id | Kết quả |
|---|---|
| `b4PqePRG-BKpnr36` | `built` — giữ nguyên nhiều phút, route mới trả 404 |
| `q0FEO3e26rWesO1w` | `built` — y hệt |

Ứng dụng vẫn chạy bản cũ và hoàn toàn khoẻ (`/api/health` 200), nên **không phải sự cố dịch vụ**
— nhưng bên mình **không ship được thay đổi nào** cho tới khi đội xem giúp. Trước đó luồng bình
thường là `building → deploying → success` (các deploy `sO12LYZPXepJgNP0`, `8BH6Hylr3mp-MYrH`
đều chạy đúng).

Xin đội kiểm tra bước chuyển từ `built` sang `deploying` của worker.

---

## 6. Tóm tắt việc chờ đội Zeni

| # | Việc | Mức |
|---|---|---|
| 1 | Cấp **vai chạy app riêng không sở hữu bảng** (cách B, mục 2) + chuỗi kết nối mới | **CAO** — hàng rào giữa 9 tổ chức đang tắt |
| 2 | Xem bước `built → deploying` của worker deploy (mục 5) | **CAO** — đang chặn mọi thay đổi mới |
| 3 | Sửa cửa gắn tên miền còn phát hướng dẫn hạ tầng cũ (đội đã tự nhận ở mục 5 ticket gốc) | trung bình |

Bên mình sẵn sàng đổi `DATABASE_URL` và chạy nghiệm thu cách ly dữ liệu ngay khi nhận được vai mới.
