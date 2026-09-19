/**
 * TEST CHO LUỒNG ĐĂNG NHẬP NGOÀI (Google / GitHub qua Zeni ID).
 *
 * Trọng tâm là `duongDanNoiBoAnToan` — cái chặn "mở đường chuyển hướng"
 * (open redirect). Nếu nó thủng, kẻ tấn công gửi cho nạn nhân đường dẫn
 * `…/oauth/google?redirect=//evil.com`, nạn nhân đăng nhập thật rồi bị ném sang
 * trang của kẻ tấn công — trang đó dựng y hệt màn hình Zeni và xin mật khẩu.
 *
 * Mỗi dòng dưới đây là một cách né đã từng dùng được ngoài thực tế, không phải
 * ví dụ nghĩ ra cho đủ số lượng.
 */
import { describe, expect, it } from 'vitest';
import { OAUTH_PROVIDERS, duongDanNoiBoAnToan, laProviderHopLe } from './oauth';

describe('duongDanNoiBoAnToan · chặn chuyển hướng ra ngoài', () => {
  it('1. đường dẫn nội bộ bình thường thì giữ nguyên', () => {
    expect(duongDanNoiBoAnToan('/dashboard')).toBe('/dashboard');
    expect(duongDanNoiBoAnToan('/cap-table?tab=vesting')).toBe('/cap-table?tab=vesting');
    expect(duongDanNoiBoAnToan('/financials#pnl')).toBe('/financials#pnl');
  });

  it('2. rỗng / thiếu → về mặc định', () => {
    expect(duongDanNoiBoAnToan(null)).toBe('/dashboard');
    expect(duongDanNoiBoAnToan(undefined)).toBe('/dashboard');
    expect(duongDanNoiBoAnToan('')).toBe('/dashboard');
    expect(duongDanNoiBoAnToan('   ')).toBe('/dashboard');
  });

  it('3. CHẶN `//host` — trình duyệt hiểu đây là URL tuyệt đối, không phải thư mục', () => {
    expect(duongDanNoiBoAnToan('//evil.com')).toBe('/dashboard');
    expect(duongDanNoiBoAnToan('//evil.com/login')).toBe('/dashboard');
  });

  it('4. CHẶN URL tuyệt đối mọi kiểu', () => {
    expect(duongDanNoiBoAnToan('https://evil.com')).toBe('/dashboard');
    expect(duongDanNoiBoAnToan('http://evil.com')).toBe('/dashboard');
    expect(duongDanNoiBoAnToan('javascript:alert(1)')).toBe('/dashboard');
    expect(duongDanNoiBoAnToan('data:text/html,<h1>x')).toBe('/dashboard');
  });

  it('5. CHẶN dấu gạch ngược — một số trình duyệt quy nó về gạch chéo', () => {
    expect(duongDanNoiBoAnToan('/\\evil.com')).toBe('/dashboard');
    expect(duongDanNoiBoAnToan('\\\\evil.com')).toBe('/dashboard');
  });

  it('6. CHẶN chuỗi không mở đầu bằng gạch chéo (ghép vào gốc sẽ ra host lạ)', () => {
    expect(duongDanNoiBoAnToan('evil.com')).toBe('/dashboard');
    expect(duongDanNoiBoAnToan('.evil.com')).toBe('/dashboard');
  });

  it('7. mặc định truyền vào được tôn trọng', () => {
    expect(duongDanNoiBoAnToan('https://evil.com', '/onboarding')).toBe('/onboarding');
  });
});

describe('laProviderHopLe · danh sách đóng', () => {
  it('8. chỉ chấp nhận đúng các nhà cung cấp đã khai', () => {
    for (const p of OAUTH_PROVIDERS) expect(laProviderHopLe(p)).toBe(true);
  });

  it('9. từ chối chuỗi lạ — không để nó ghép thẳng vào địa chỉ gọi nền tảng', () => {
    for (const xau of ['facebook', '../admin', 'google/../../x', '', 'GOOGLE', 'zenidigital']) {
      expect(laProviderHopLe(xau)).toBe(false);
    }
  });

  it('10. zenidigital CHƯA được bật — nền tảng báo ready:false (20/09/2026)', () => {
    // Canh để không ai lặng lẽ thêm vào trước khi ZeniCloud cấu hình xong;
    // thêm sớm thì người dùng bấm vào sẽ gặp lỗi của nền tảng.
    expect(OAUTH_PROVIDERS).not.toContain('zenidigital');
  });
});
