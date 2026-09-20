/**
 * CHẾ ĐỘ GIAO DIỆN — sáng / tối.
 *
 * Giá trị nằm ở `document.documentElement.dataset.theme` và được nhớ trong
 * `localStorage`. Mặc định là TỐI: đó là bộ màu chính của sản phẩm, và người
 * dùng doanh nghiệp thường mở bảng số liệu hàng giờ.
 *
 * `localStorage` bọc try/catch: ở cửa sổ ẩn danh hoặc khi trình duyệt chặn dữ
 * liệu trang thì chỉ ĐỌC thôi cũng ném lỗi — một tiện ích nhỏ không được phép
 * làm trắng cả giao diện.
 */

export type CheDo = 'sang' | 'toi';

export const KHOA_CHE_DO = 'zeniipo:che-do';

export function docCheDo(): CheDo {
  if (typeof document === 'undefined') return 'toi';
  const tren = document.documentElement.dataset.theme;
  if (tren === 'sang' || tren === 'toi') return tren;
  try {
    const luu = window.localStorage.getItem(KHOA_CHE_DO);
    if (luu === 'sang' || luu === 'toi') return luu;
  } catch {
    /* không đọc được thì dùng mặc định */
  }
  return 'toi';
}

export function datCheDo(c: CheDo): void {
  document.documentElement.dataset.theme = c;
  try {
    window.localStorage.setItem(KHOA_CHE_DO, c);
  } catch {
    /* không lưu được thì thôi — chế độ vẫn đổi cho phiên này */
  }
}

/**
 * Đoạn mã chạy TRƯỚC khi trang vẽ, nhúng thẳng vào <head>.
 *
 * Không có nó thì trang luôn vẽ bằng chế độ tối trước rồi mới nhảy sang sáng —
 * người dùng thấy một cái chớp trắng/đen mỗi lần mở trang. Phải chạy đồng bộ,
 * trước mọi thứ khác, nên viết dạng chuỗi chèn vào <head> chứ không thể để
 * trong một component React.
 */
export const MA_CHONG_CHOP = `(function(){try{var c=localStorage.getItem('${KHOA_CHE_DO}');if(c==='sang'||c==='toi'){document.documentElement.dataset.theme=c;return}}catch(e){}document.documentElement.dataset.theme='toi'})();`;
