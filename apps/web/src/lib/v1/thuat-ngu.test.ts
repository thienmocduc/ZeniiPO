/**
 * TEST CHẤT LƯỢNG TỪ ĐIỂN THUẬT NGỮ.
 *
 * Bộ này được hiện THẲNG ra màn hình bên cạnh thuật ngữ, nên một mục viết ẩu
 * là người dùng thấy ngay. Ba thứ dễ hỏng nhất khi thêm mục mới:
 *  · quên bỏ dấu tiếng Việt (bảng `glossary` trong CSDL đang mắc đúng lỗi này)
 *  · `nghia` viết dài thành cả câu → vỡ hàng, vỡ ô bảng
 *  · trùng `tu` → chú hai nghĩa khác nhau cho cùng một từ
 */
import { describe, expect, it } from 'vitest';
import { THUAT_NGU } from './thuat-ngu';

const CO_DAU = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

describe('Từ điển thuật ngữ', () => {
  it('1. có đủ số mục để phủ được giao diện', () => {
    expect(THUAT_NGU.length).toBeGreaterThanOrEqual(120);
  });

  it('2. không trùng thuật ngữ (kể cả khác hoa thường)', () => {
    const thay = new Map<string, string>();
    const trung: string[] = [];
    for (const m of THUAT_NGU) {
      const k = m.tu.toLowerCase();
      if (thay.has(k)) trung.push(`${m.tu} (đã có: ${thay.get(k)})`);
      thay.set(k, m.tu);
    }
    expect(trung, `Trùng: ${trung.join(', ')}`).toEqual([]);
  });

  it('3. mọi mục đều có đủ ba phần, không bỏ trống', () => {
    const thieu = THUAT_NGU.filter(
      (m) => !m.tu?.trim() || !m.nghia?.trim() || !m.giai_thich?.trim(),
    ).map((m) => m.tu);
    expect(thieu, `Thiếu nội dung: ${thieu.join(', ')}`).toEqual([]);
  });

  it('4. `nghia` phải NGẮN — tối đa 6 từ, vì nó nằm ngay cạnh thuật ngữ', () => {
    const dai = THUAT_NGU.filter((m) => m.nghia.trim().split(/\s+/).length > 6).map(
      (m) => `${m.tu} → "${m.nghia}"`,
    );
    expect(dai, `Nghĩa quá dài, sẽ vỡ hàng:\n  ${dai.join('\n  ')}`).toEqual([]);
  });

  it('5. phần tiếng Việt PHẢI CÓ DẤU', () => {
    // Bảng `glossary` trong CSDL viết "doanh thu dinh ky hang nam" — mất dấu
    // hết. Đó chính là lỗi không được lặp lại ở đây.
    const khongDau = THUAT_NGU.filter((m) => !CO_DAU.test(m.giai_thich)).map((m) => m.tu);
    expect(khongDau, `Giải thích không có dấu tiếng Việt: ${khongDau.join(', ')}`).toEqual([]);
  });

  it('6. KHÔNG chứa tên riêng hay từ tiếng Anh thường (những thứ đó phải dịch hẳn)', () => {
    const camKhau = ['zeni', 'anima', 'sgx', 'hose', 'days', 'target', 'review', 'active', 'year'];
    const lot = THUAT_NGU.filter((m) => camKhau.includes(m.tu.toLowerCase())).map((m) => m.tu);
    expect(lot, `Không thuộc từ điển thuật ngữ: ${lot.join(', ')}`).toEqual([]);
  });
});
