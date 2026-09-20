/**
 * TEST LỘ TRÌNH TÀI CHÍNH — canh mối nối giữa MỐC và NGƯỠNG CHUẨN.
 *
 * Lộ trình khai mốc nào "chặn" bằng chỉ số nào (`chi_so_chan`). Nếu một mốc trỏ
 * tới mã chỉ số KHÔNG có ngưỡng trong `032_nguong_chuan_von.sql`, thì cổng đó
 * **không bao giờ chặn được gì** — mốc trông như có điều kiện nhưng thực ra
 * luôn mở. Đó là kiểu hỏng âm thầm tệ nhất: người dùng tưởng hệ thống đang canh.
 *
 * Kiểu `MaChiSoChuan` đã bắt được phần lớn ở khâu biên dịch, nhưng nó KHÔNG
 * biết ngưỡng có tồn tại ở ĐÚNG GIAI ĐOẠN hay không — đó là việc của test này.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LO_TRINH_TAI_CHINH } from './lo-trinh-tai-chinh';

const SQL = path.resolve(
  process.cwd(),
  '..',
  '..',
  'packages',
  'database',
  'zenicloud',
  '032_nguong_chuan_von.sql',
);

/** Giai đoạn trong lộ trình → giá trị cột `stage` của `ipo_benchmarks`. */
const SANG_STAGE: Record<string, string | null> = {
  'hat-giong': 'seed',
  'vong-a': 'series_a',
  'vong-b': 'series_b',
  'tang-truong': 'growth',
  'tien-niem-yet': 'pre_ipo',
  // Sau niêm yết: kho tri thức KHÔNG có ngưỡng nào. Ánh xạ null để test không
  // đòi hỏi thứ chưa tồn tại — nhưng ghi lại đây để không ai quên là còn thiếu.
  'niem-yet': null,
};

function nguongCoThat(): Set<string> {
  const sql = fs.readFileSync(SQL, 'utf8');
  const ra = new Set<string>();
  for (const m of sql.matchAll(/\('([a-z_0-9]+)','([a-z_]+)'/g)) ra.add(`${m[1]}|${m[2]}`);
  return ra;
}

describe('Lộ trình tài chính', () => {
  const nguong = nguongCoThat();

  it('1. đọc được bộ ngưỡng (nếu không thì test dưới vô nghĩa)', () => {
    expect(nguong.size).toBeGreaterThanOrEqual(31);
  });

  it('2. mã mốc không trùng nhau', () => {
    const dem = new Map<string, number>();
    for (const m of LO_TRINH_TAI_CHINH) dem.set(m.ma, (dem.get(m.ma) ?? 0) + 1);
    const trung = [...dem.entries()].filter(([, n]) => n > 1).map(([k]) => k);
    expect(trung, `Mã mốc trùng: ${trung.join(', ')}`).toEqual([]);
  });

  it('3. mọi chỉ số chặn PHẢI có ngưỡng ở ĐÚNG giai đoạn của mốc', () => {
    const hong: string[] = [];
    for (const m of LO_TRINH_TAI_CHINH) {
      const stage = SANG_STAGE[m.giai_doan];
      if (stage === null) continue; // giai đoạn chưa có ngưỡng — xem test 5
      for (const c of m.chi_so_chan) {
        if (!nguong.has(`${c}|${stage}`)) {
          hong.push(`${m.ma} (${m.giai_doan}) chặn bằng "${c}" nhưng không có ngưỡng ở "${stage}"`);
        }
      }
    }
    expect(
      hong,
      `\nCổng khai có điều kiện nhưng KHÔNG BAO GIỜ chặn được gì:\n  ${hong.join('\n  ')}\n`,
    ).toEqual([]);
  });

  it('4. mọi mốc đều nói rõ đạt thế nào là xong và rủi ro nếu bỏ qua', () => {
    const so = LO_TRINH_TAI_CHINH.filter(
      (m) => !m.muc_tieu?.trim() || !m.rui_ro?.trim() || !m.nguon?.trim(),
    ).map((m) => m.ma);
    expect(so, `Mốc thiếu mục tiêu / rủi ro / nguồn: ${so.join(', ')}`).toEqual([]);
  });

  it('5. GHI NHẬN lỗ hổng: giai đoạn sau niêm yết chưa có ngưỡng nào', () => {
    // Đây KHÔNG phải test đòi sửa — là mốc ghi nhận để lỗ hổng không bị quên.
    // Kho tri thức dừng ở `pre_ipo`; 6 mốc sau niêm yết đủ định hướng nhưng
    // chưa đủ làm hồ sơ. Khi bổ sung được ngưỡng sau niêm yết, đổi ánh xạ
    // `niem-yet` sang 'listed' và test 3 sẽ tự canh.
    const sauNiemYet = LO_TRINH_TAI_CHINH.filter((m) => m.giai_doan === 'niem-yet');
    expect(sauNiemYet.length).toBeGreaterThan(0);
    expect(
      sauNiemYet.every((m) => m.chi_so_chan.length === 0),
      'Đã có ngưỡng sau niêm yết — hãy cập nhật SANG_STAGE để test 3 canh được.',
    ).toBe(true);
  });
});
