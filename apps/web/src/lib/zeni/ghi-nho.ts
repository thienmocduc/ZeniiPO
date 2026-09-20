/**
 * GHI NHỚ TIỆN ÍCH NHỎ TRÊN MÁY NGƯỜI DÙNG (email đã dùng, cách đăng nhập quen).
 *
 * Vì sao phải bọc try/catch: `localStorage` KHÔNG phải lúc nào cũng dùng được —
 * cửa sổ ẩn danh, trình duyệt chặn dữ liệu trang, hoặc khi trang bị nhúng trong
 * khung. Ở những nơi đó chỉ ĐỌC thôi cũng ném lỗi, và nếu không bắt thì cả màn
 * hình đăng nhập trắng xoá. Tiện ích nhỏ không bao giờ được làm hỏng việc chính.
 *
 * CHỈ để những thứ tiện tay. TUYỆT ĐỐI không lưu mật khẩu, token hay mã OTP.
 */

const TIEN_TO = 'zeniipo:';

export function docGhiNho(khoa: string): string | null {
  try {
    return window.localStorage.getItem(TIEN_TO + khoa);
  } catch {
    return null;
  }
}

export function luuGhiNho(khoa: string, giaTri: string): void {
  try {
    window.localStorage.setItem(TIEN_TO + khoa, giaTri);
  } catch {
    /* không lưu được thì thôi — không được làm hỏng luồng đăng nhập */
  }
}

export function xoaGhiNho(khoa: string): void {
  try {
    window.localStorage.removeItem(TIEN_TO + khoa);
  } catch {
    /* bỏ qua */
  }
}

export const KHOA = {
  emailCuoi: 'dang-nhap:email-cuoi',
  cachCuoi: 'dang-nhap:cach-cuoi',
} as const;
