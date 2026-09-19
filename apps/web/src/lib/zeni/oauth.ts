/**
 * ĐĂNG NHẬP BẰNG NHÀ CUNG CẤP NGOÀI (Google / GitHub) QUA ZENI ID — Lớp 5.
 *
 * ZeniIPO KHÔNG tự đấu Google OAuth. Danh tính của cả hệ sinh thái nằm ở một
 * chỗ duy nhất là Zeni ID; app chỉ mượn đường của nền tảng:
 *
 *   1. Người dùng bấm nút  → GET /api/auth/zeni/oauth/google   (route của app)
 *   2. App chuyển hướng    → GET {ZENI_ID}/auth/oauth/google/authorize?return_to=…
 *   3. Nền tảng đưa sang Google, Google gọi ngược về callback CỦA NỀN TẢNG
 *   4. Nền tảng quay về `return_to` kèm token trong #fragment của URL
 *   5. Trang /auth/oauth/callback đọc fragment, gửi token về máy chủ app
 *   6. App XÁC MINH token qua /auth/me rồi mới đặt cookie phiên
 *
 * Vì sao token đi bằng #fragment: phần sau dấu # KHÔNG được trình duyệt gửi lên
 * máy chủ, nên nó không lọt vào nhật ký truy cập, không lọt vào Referer.
 *
 * ⚠ RÀNG BUỘC PHÍA NỀN TẢNG (đọc `Zeni-Cloud-Core/backend/app/api/oauth.py`,
 * hàm `_safe_return_to`): nền tảng chỉ trả token về những origin đã nằm trong
 * danh sách trắng, chống mở đường chuyển hướng làm lộ token. Tính tới 20/09/2026
 * danh sách đó chỉ có `https://auth.zenidigital.com` — **chưa có zeniipo.com**.
 * Chưa được thêm vào thì bấm nút sẽ đăng nhập thành công nhưng rơi về
 * zenicloud.io chứ không quay lại đây. Vì vậy nút bị khoá sau cờ
 * `NEXT_PUBLIC_ZENI_OAUTH` — bật lên khi ZeniCloud xác nhận đã thêm origin.
 * Hiện nút KHÔNG hiện, để không hứa với người dùng một thứ chưa chạy trọn.
 */

/** Nhà cung cấp app cho phép. Danh sách đóng — không nhận chuỗi tuỳ ý từ URL. */
export const OAUTH_PROVIDERS = ['google', 'github'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function laProviderHopLe(v: string): v is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(v);
}

export const ZENI_ID_BASE = (
  process.env.ZENI_ID_BASE_URL ?? 'https://zenicloud.io/api/v1'
).replace(/\/$/, '');

/** Đường app nhận lại token sau khi nền tảng xử lý xong. */
export const DUONG_NHAN_CALLBACK = '/auth/oauth/callback';

/** Cookie nhớ chỗ cần quay về sau khi đăng nhập xong (ngắn hạn, 10 phút). */
export const COOKIE_QUAY_VE = 'zeni_oauth_return';

/**
 * Chỉ nhận đường dẫn nội bộ. Chặn `//evil.com` (trình duyệt hiểu là URL tuyệt
 * đối), chặn `https://…`, chặn dấu `\` mà một số trình duyệt quy về `/`.
 */
export function duongDanNoiBoAnToan(v: string | null | undefined, macDinh = '/dashboard'): string {
  const s = (v ?? '').trim();
  if (!s.startsWith('/')) return macDinh;
  if (s.startsWith('//') || s.includes('\\')) return macDinh;
  return s;
}

/**
 * Gốc công khai của app. Phải là URL tuyệt đối vì nền tảng đối chiếu nó với
 * danh sách trắng; suy từ request thì đứng sau proxy sẽ ra sai.
 */
export function goCongKhai(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://zeniipo.com').replace(/\/$/, '');
}

/** Nút đăng nhập ngoài đã được bật chưa (xem khối chú thích đầu tệp). */
export function oauthDaBat(): boolean {
  return process.env.NEXT_PUBLIC_ZENI_OAUTH === '1';
}
