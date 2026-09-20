/**
 * CHUẨN HOÁ SỐ ĐIỆN THOẠI VIỆT NAM về dạng quốc tế E.164 (+84…).
 *
 * Vì sao phải chuẩn hoá ở phía app: mã OTP được nền tảng lưu theo SỐ. Nếu lúc xin
 * mã người dùng gõ "0901234567" còn lúc nhập mã lại gõ "+84 901 234 567" thì hai
 * lần đó phải quy về cùng một chuỗi, không thì mã đúng vẫn báo sai.
 *
 * Quy tắc: bỏ mọi khoảng trắng/dấu chấm/gạch/ngoặc, rồi
 *   0xxxxxxxxx   → +84xxxxxxxxx
 *   84xxxxxxxxx  → +84xxxxxxxxx
 *   +84…         → giữ nguyên
 *   9 chữ số trần→ +84 + số đó
 */

/** Đầu số di động Việt Nam đang được cấp (sau khi bỏ số 0 / mã +84). */
const DAU_SO_DI_DONG = [
  // Viettel
  '32', '33', '34', '35', '36', '37', '38', '39', '86', '96', '97', '98',
  // Vinaphone
  '81', '82', '83', '84', '85', '88', '91', '94',
  // MobiFone
  '70', '76', '77', '78', '79', '89', '90', '93',
  // Vietnamobile
  '52', '56', '58', '92',
  // Gmobile
  '59', '99',
];

export function chuanHoaSoVN(raw: string): string | null {
  const s = (raw ?? '').replace(/[\s.\-()]/g, '');
  if (!s) return null;

  let so: string;
  if (s.startsWith('+84')) so = s.slice(3);
  else if (s.startsWith('84') && s.length >= 11) so = s.slice(2);
  else if (s.startsWith('0')) so = s.slice(1);
  else so = s;

  if (!/^\d{9}$/.test(so)) return null;
  if (!DAU_SO_DI_DONG.includes(so.slice(0, 2))) return null;

  return `+84${so}`;
}

/** Che bớt để hiện lại cho người dùng mà không phơi cả số: +8490****567 */
export function cheSo(e164: string): string {
  if (e164.length < 8) return e164;
  return `${e164.slice(0, 6)}****${e164.slice(-3)}`;
}
