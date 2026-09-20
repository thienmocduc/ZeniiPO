/**
 * MÃ CÓ KHỚP LƯỢC ĐỒ CSDL KHÔNG — canh cả một LỚP lỗi, không phải từng lỗi lẻ.
 *
 * Ngày 20/09/2026 phát hiện **14 endpoint chết** vì cùng một kiểu sai: route
 * gọi `.order('created_at')` trên bảng KHÔNG có cột `created_at` (bảng dùng
 * `captured_at`, `issued_at`, `started_at`…). Postgres trả lỗi, route trả 500,
 * và trang tương ứng **chưa từng chạy được lần nào** kể từ khi viết.
 *
 * Kiểu sai này không có gì chặn: TypeScript không biết lược đồ CSDL, còn tên
 * cột chỉ là chuỗi. Vá 14 chỗ rồi thì ngày mai viết route thứ 15 vẫn sai lại.
 * Nên test này đọc THẲNG file migration để biết bảng có cột gì, rồi soi mọi
 * route — sai một chỗ là đỏ ngay, kèm gợi ý cột đúng.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const GOC = path.resolve(process.cwd(), '..', '..');
const THU_MUC_SQL = path.join(GOC, 'packages', 'database', 'zenicloud');
const THU_MUC_API = path.join(process.cwd(), 'src', 'app', 'api');

/** Đọc migration → { tên bảng: tập cột }. */
function cotThatCuaBang(): Map<string, Set<string>> {
  const bang = new Map<string, Set<string>>();
  if (!fs.existsSync(THU_MUC_SQL)) return bang;

  for (const f of fs.readdirSync(THU_MUC_SQL).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(THU_MUC_SQL, f), 'utf8');

    for (const m of sql.matchAll(
      /CREATE TABLE IF NOT EXISTS\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g,
    )) {
      const ten = m[1];
      const than = m[2];
      const tap = bang.get(ten) ?? new Set<string>();
      // Cột khai ở đầu dòng, thụt đúng 2 dấu cách — bỏ qua CHECK/FOREIGN KEY.
      for (const c of than.matchAll(/^ {2}(\w+)\s/gm)) {
        if (!['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK'].includes(c[1].toUpperCase())) {
          tap.add(c[1]);
        }
      }
      bang.set(ten, tap);
    }

    // Cột thêm sau bằng ALTER TABLE cũng là cột thật.
    for (const m of sql.matchAll(
      /ALTER TABLE\s+(?:public\.)?(\w+)\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+(\w+)/g,
    )) {
      const tap = bang.get(m[1]) ?? new Set<string>();
      tap.add(m[2]);
      bang.set(m[1], tap);
    }
  }
  return bang;
}

/** Mọi tệp route.ts dưới src/app/api. */
function moiRoute(dir: string, ra: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) moiRoute(p, ra);
    else if (e.name === 'route.ts') ra.push(p);
  }
  return ra;
}

describe('Mã phải khớp lược đồ CSDL', () => {
  const bang = cotThatCuaBang();

  it('0. đọc được lược đồ từ migration (nếu không thì test dưới vô nghĩa)', () => {
    expect(bang.size).toBeGreaterThan(30);
    expect(bang.get('kpi_metrics')?.has('captured_at')).toBe(true);
    // Chính cột đã gây ra 14 lỗi 500 — phải chắc là nó THẬT SỰ không tồn tại.
    expect(bang.get('kpi_metrics')?.has('created_at')).toBe(false);
  });

  it('1. mọi .order(cột) đều trỏ tới cột CÓ THẬT', () => {
    const hong: string[] = [];

    for (const tep of moiRoute(THU_MUC_API)) {
      const ma = fs.readFileSync(tep, 'utf8');
      // `.from('bang')` … `.order('cot')` trong CÙNG một truy vấn.
      // `[^]*?` kèm chặn `.from('` ở giữa: không cho cửa sổ dò bắc cầu sang
      // truy vấn kế tiếp rồi ghép nhầm bảng này với cột của bảng kia — đó là
      // cách sinh ra báo nhầm, mà test báo nhầm thì người ta sẽ bỏ qua nó.
      for (const m of ma.matchAll(/\.from\('(\w+)'\)((?:(?!\.from\(')[\s\S]){0,600}?)\.order\('(\w+)'/g)) {
        const [, tenBang, , cot] = m;
        const cots = bang.get(tenBang);
        if (!cots) continue; // bảng khai ở nơi khác — không kết luận vội
        if (!cots.has(cot)) {
          const goiY = [...cots].filter((c) => /_at$|date/.test(c)).slice(0, 3).join(', ');
          hong.push(
            `${path.relative(THU_MUC_API, tep).replace(/\\/g, '/')} · ` +
              `${tenBang}.order('${cot}') KHÔNG tồn tại — cột thời gian có thật: ${goiY || '(không có)'}`,
          );
        }
      }
    }

    expect(
      hong,
      `\n${hong.length} route sắp xếp theo cột không tồn tại ⇒ endpoint trả 500:\n  ` +
        hong.join('\n  ') +
        '\n',
    ).toEqual([]);
  });

  it('2. mọi .eq(cột) trong route đều trỏ tới cột CÓ THẬT', () => {
    const hong: string[] = [];
    for (const tep of moiRoute(THU_MUC_API)) {
      const ma = fs.readFileSync(tep, 'utf8');
      for (const m of ma.matchAll(/\.from\('(\w+)'\)((?:(?!\.from\(')[\s\S]){0,400}?)\.eq\('(\w+)'/g)) {
        const [, tenBang, , cot] = m;
        const cots = bang.get(tenBang);
        if (!cots) continue;
        if (!cots.has(cot)) {
          hong.push(
            `${path.relative(THU_MUC_API, tep).replace(/\\/g, '/')} · ${tenBang}.eq('${cot}') KHÔNG tồn tại`,
          );
        }
      }
    }
    expect(hong, `\nLọc theo cột không tồn tại:\n  ${hong.join('\n  ')}\n`).toEqual([]);
  });

  it('3. mọi .select(danh sách cột) đều trỏ tới cột CÓ THẬT', () => {
    const hong: string[] = [];
    for (const tep of moiRoute(THU_MUC_API)) {
      const ma = fs.readFileSync(tep, 'utf8');
      for (const m of ma.matchAll(/\.from\('(\w+)'\)\s*\n?\s*\.select\('([^']*)'\)/g)) {
        const [, tenBang, dsCot] = m;
        const cots = bang.get(tenBang);
        if (!cots) continue;
        // Chỉ xét danh sách cột đơn giản. Bỏ qua `*`, đếm, và cú pháp lồng
        // bảng quan hệ (`a:b(...)`) — chỗ đó đoán sai thì thành báo nhầm.
        if (/[*(:]/.test(dsCot)) continue;
        for (const c of dsCot.split(',').map((x) => x.trim()).filter(Boolean)) {
          if (!/^\w+$/.test(c)) continue;
          if (!cots.has(c)) {
            hong.push(
              `${path.relative(THU_MUC_API, tep).replace(/\\/g, '/')} · ${tenBang}.select('… ${c} …') KHÔNG tồn tại`,
            );
          }
        }
      }
    }
    expect(hong, `\nĐọc cột không tồn tại ⇒ endpoint trả 500:\n  ${hong.join('\n  ')}\n`).toEqual([]);
  });
});
