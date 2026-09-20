/**
 * TEST CHUẨN HOÁ SỐ ĐIỆN THOẠI.
 *
 * Vì sao đáng test kỹ: mã OTP được nền tảng lưu theo SỐ. Lúc xin mã gõ
 * "0901234567" mà lúc nhập mã gõ "+84 901 234 567" thì nếu hai lần không quy về
 * cùng một chuỗi, mã ĐÚNG vẫn báo sai — và người dùng sẽ tưởng hệ thống hỏng.
 */
import { describe, expect, it } from 'vitest';
import { cheSo, chuanHoaSoVN } from './phone';

describe('chuanHoaSoVN · mọi cách gõ của cùng một số phải ra một kết quả', () => {
  it('1. các cách gõ phổ biến của cùng một số đều quy về +84901234567', () => {
    for (const cach of [
      '0901234567',
      '+84901234567',
      '84901234567',
      '090 123 4567',
      '090-123-4567',
      '090.123.4567',
      '(090) 1234567',
      ' +84 901 234 567 ',
      '901234567',
    ]) {
      expect(chuanHoaSoVN(cach), `gõ kiểu "${cach}"`).toBe('+84901234567');
    }
  });

  it('2. nhận đủ đầu số của cả 5 nhà mạng', () => {
    const mau: [string, string][] = [
      ['0321234567', '+84321234567'], // Viettel
      ['0961234567', '+84961234567'], // Viettel
      ['0811234567', '+84811234567'], // Vinaphone
      ['0941234567', '+84941234567'], // Vinaphone
      ['0701234567', '+84701234567'], // MobiFone
      ['0931234567', '+84931234567'], // MobiFone
      ['0521234567', '+84521234567'], // Vietnamobile
      ['0591234567', '+84591234567'], // Gmobile
    ];
    for (const [vao, ra] of mau) expect(chuanHoaSoVN(vao)).toBe(ra);
  });

  it('3. TỪ CHỐI số sai độ dài', () => {
    for (const xau of ['090123456', '09012345678', '0', '', '   ']) {
      expect(chuanHoaSoVN(xau), `"${xau}"`).toBeNull();
    }
  });

  it('4. TỪ CHỐI đầu số không phải di động (số bàn, tổng đài)', () => {
    // 024 = cố định Hà Nội, 028 = cố định TP.HCM, 1900 = tổng đài.
    for (const xau of ['02412345678', '02812345678', '1900541234', '0121234567']) {
      expect(chuanHoaSoVN(xau), `"${xau}"`).toBeNull();
    }
  });

  it('5. TỪ CHỐI chuỗi có chữ hoặc ký tự lạ', () => {
    for (const xau of ['090abc4567', '+84-90x-123-4567', 'không phải số']) {
      expect(chuanHoaSoVN(xau), `"${xau}"`).toBeNull();
    }
  });

  it('6. số nước ngoài KHÔNG bị nhận nhầm thành số Việt', () => {
    // +1 (Mỹ) và +65 (Singapore) — không được âm thầm quy về +84.
    expect(chuanHoaSoVN('+12025550123')).toBeNull();
    expect(chuanHoaSoVN('+6598765432')).toBeNull();
  });
});

describe('cheSo · hiện lại cho người dùng mà không phơi cả số', () => {
  it('7. giấu phần giữa, giữ đầu và đuôi để người dùng nhận ra số của mình', () => {
    const che = cheSo('+84901234567');
    expect(che).toBe('+84901****567');
    expect(che).not.toContain('1234');
  });
});
