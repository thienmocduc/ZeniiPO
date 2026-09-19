# [TICKET] Cho phép zeniipo.com nhận token OAuth — mở đăng nhập Google cho ZeniIPO

- **Gửi:** đội nền tảng Zeni Cloud (Lớp 05 — Identity & Security)
- **Từ:** ZeniIPO (zeniipo.com), workspace `zeniipo-com`
- **Ngày:** 20/09/2026
- **Mức độ:** cao — chặn tính năng người dùng đã thấy trên màn hình đăng nhập
- **Liên quan:** `ZENI_TICKET_GOOGLE_OAUTH.md` (đã xong — client Google nay `ready: true`)

---

## 1. Tóm tắt một dòng

ZeniIPO đã đấu xong toàn bộ luồng đăng nhập Google qua Zeni ID, nhưng nền tảng
chỉ trả token về các origin trong danh sách trắng và **`https://zeniipo.com`
chưa có trong đó**, nên người dùng đăng nhập xong sẽ rơi về `zenicloud.io`
thay vì quay lại ZeniIPO.

## 2. Hiện trạng đã kiểm chứng

Hỏi nền tảng ngày 20/09/2026:

```
GET https://zenicloud.io/api/v1/auth/oauth/providers  → 200
  google       ready: true
  github       ready: true
  zenidigital  ready: false
```

Thử mở cửa đăng nhập — chạy đúng:

```
GET /api/v1/auth/oauth/google/authorize?return_to=https://zeniipo.com/auth/oauth/callback
  → 302 accounts.google.com/o/oauth2/v2/auth?...&redirect_uri=https%3A%2F%2Fzenicloud.io%2Fapi%2Fv1%2Fauth%2Foauth%2Fgoogle%2Fcallback
```

## 3. Chỗ nghẽn

`backend/app/api/oauth.py`:

```python
_TRUSTED_RETURN_ORIGINS = (
    "https://auth.zenidigital.com",
)
```

`_safe_return_to()` chỉ cho URL tuyệt đối khi origin nằm trong bộ này; còn lại
ép về đường dẫn tương đối của `app_base_url`. Nên `return_to` của ZeniIPO bị hạ
xuống `/app` của zenicloud.io, và khối phát token cuối hàm callback

```python
return RedirectResponse(url=f"{dich}#oauth={fragment}", status_code=302)
```

sẽ bắn token về zenicloud.io. ZeniIPO khác tên miền gốc nên không đọc được
cookie lẫn fragment đó.

## 3b. Đã tự kiểm đường tự phục vụ trước khi mở ticket

Nền tảng có sẵn luồng OAuth theo workspace (`/auth/{provider}/{ws}/login`) cho
khách tự khai `app_callback_url` của mình — ZeniIPO gọi thử bằng token của
workspace, **chạy được**:

```
GET /api/v1/identity/oauth-providers?ws=zeniipo-com      → 200  []
GET /api/v1/identity/oauth-providers/templates           → 200  (có mẫu google)
```

Nghĩa là ZeniIPO **tự khai provider được, không cần các anh động tay**. Nhưng
đường đó vẫn kẹt hai chỗ nên ZeniIPO không chọn:

1. Nó cần **cặp khoá Google riêng của ZeniIPO** (`client_id` + `client_secret`),
   mà workspace này chưa có và tạo khoá là việc ở Google Console.
2. `customer_oauth_flow.py` trả người dùng về app kèm `?email=…&access_token=…`
   dưới dạng tham số truy vấn **không ký**. App nào tin thẳng tham số đó thì bất
   kỳ ai cũng tự đăng nhập được bằng cách gõ tay URL kèm email người khác.
   Muốn dùng an toàn, app phải tự đi hỏi lại Google để xác minh token — thêm một
   đường phụ thuộc trực tiếp ra ngoài, trái với việc gom danh tính về Lớp 05.

Đường ở mục 4a dưới đây trả về **JWT Zeni ID thật** (xác minh được qua
`/auth/me`), giữ đúng nguyên tắc một danh tính cho cả hệ sinh thái, và phía các
anh chỉ tốn một dòng cấu hình. Vì vậy ZeniIPO đề nghị 4a.

## 4. Đề nghị

### 4a. (BẮT BUỘC) Thêm origin của ZeniIPO vào danh sách trắng

```python
_TRUSTED_RETURN_ORIGINS = (
    "https://auth.zenidigital.com",
    "https://zeniipo.com",
)
```

Nhận xét về rủi ro: đây là **nới danh sách trắng, không phải nới quy tắc**. Hàm
`_safe_return_to` vẫn khớp nguyên origin (`rt == goc or rt.startswith(goc + "/")`)
nên không mở đường cho `zeniipo.com.evil.com`. `zeniipo.com` là tài sản của
Zeni Holdings, cùng mức tin cậy với `auth.zenidigital.com` đã có sẵn.

Đường app dùng để nhận, xin đưa vào đúng một địa chỉ:

```
https://zeniipo.com/auth/oauth/callback
```

### 4b. (NÊN) Trả lỗi OAuth về đúng app đã khởi xướng

Hiện `_redirect_with_error()` luôn ném về `{app_base_url}/signup?oauth_error=…`.
Người dùng ZeniIPO gặp lỗi sẽ bị quăng sang trang đăng ký của zenicloud.io mà
không hiểu vì sao. Đề nghị dùng lại `return_to` đã lưu trong `oauth_states` khi
nó hợp lệ, và chỉ lùi về `app_base_url` khi không đọc được state.

### 4c. (HỎI) Bao giờ bật `zenidigital`?

Provider `zenidigital` đang `ready: false`. Chairman muốn ZeniIPO có nút "đăng
nhập bằng Zeni Digital". Cho hỏi đang thiếu gì và dự kiến khi nào xong — ZeniIPO
đã viết sẵn phần tiếp nhận, bật provider là dùng được ngay.

## 5. Phía ZeniIPO đã làm xong

| Thành phần | Đường dẫn |
|---|---|
| Mở cửa đăng nhập | `GET /api/auth/zeni/oauth/{provider}` |
| Trang hứng token | `/auth/oauth/callback` (đọc `#oauth=…`, xoá fragment ngay) |
| Đổi token lấy phiên | `POST /api/auth/zeni/oauth/session` — **xác minh qua `/auth/me` trước khi đặt cookie** |
| Chặn chuyển hướng ra ngoài | `duongDanNoiBoAnToan()`, 10 test số cứng |

Nút đang khoá sau cờ `NEXT_PUBLIC_ZENI_OAUTH`. Nhận được xác nhận 4a là ZeniIPO
bật cờ và thử lại đầu-cuối, **không cần các anh làm thêm gì ở phía ZeniIPO**.

## 6. Cách kiểm sau khi sửa

```
1. Mở  https://zeniipo.com/login  → bấm "Tiếp tục với Google"
2. Kỳ vọng: sau khi chọn tài khoản Google, trình duyệt quay về
   https://zeniipo.com/auth/oauth/callback#oauth=access_token=…
3. Kỳ vọng: vào thẳng https://zeniipo.com/dashboard, đã đăng nhập
4. Kỳ vọng: thanh địa chỉ KHÔNG còn token (app tự xoá fragment)
```

---

**Người viết:** Trợ lý code Zeni Cloud (CTO ZeniIPO)
**Cần phản hồi trước:** 22/09/2026 — sau đó ZeniIPO sẽ phải ẩn hẳn mục đăng nhập
Google khỏi lộ trình để không hứa với người dùng thứ chưa chạy được.
