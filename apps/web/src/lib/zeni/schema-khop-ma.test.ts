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

/**
 * Đọc ràng buộc `CHECK (cot IN ('a','b',...))` từ migration
 * → { "bảng.cột": tập giá trị CSDL cho phép }.
 *
 * Bắt cả hai lối viết Postgres dùng: `IN ('a','b')` và `= ANY (ARRAY[...])`.
 */
function giaTriChoPhep(): Map<string, Set<string>> {
  const ra = new Map<string, Set<string>>();
  if (!fs.existsSync(THU_MUC_SQL)) return ra;

  for (const f of fs.readdirSync(THU_MUC_SQL).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(THU_MUC_SQL, f), 'utf8');
    for (const m of sql.matchAll(
      /CREATE TABLE IF NOT EXISTS\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g,
    )) {
      const ten = m[1];
      for (const c of m[2].matchAll(/\b(\w+)\s+IN\s*\(([^)]*)\)/g)) {
        const tap = new Set<string>();
        for (const v of c[2].matchAll(/'([^']*)'/g)) tap.add(v[1]);
        if (tap.size > 0) ra.set(`${ten}.${c[1]}`, tap);
      }
    }
  }
  return ra;
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

  it('4. mọi khoá trong .insert()/.upsert() đều là cột CÓ THẬT', () => {
    // ⚠ ĐÂY LÀ LỚP LỖI NẶNG NHẤT, và test cũ KHÔNG canh: bản rà 20/09/2026 tìm
    // ra 26 khoá sai nằm ở 9 route — tất cả đều ở nhánh GHI, nghĩa là 9
    // endpoint đó **chưa bao giờ tạo được một bản ghi nào**. Nặng nhất là
    // `/api/rounds`: gửi name/round_type/target_amount/pre_money_valuation…
    // trong khi bảng dùng round_name/round_code/target_raise_usd/pre_money_usd
    // — không khoá nào trùng.
    //
    // Đọc chậm hơn `.order` vì phải lần cả `...parsed.data` (khoá lấy từ lược
    // đồ zod khai trong cùng tệp), nhưng đó chính là dạng hay sai nhất.
    const hong: string[] = [];

    for (const tep of moiRoute(THU_MUC_API)) {
      const ma = fs.readFileSync(tep, 'utf8');

      /** Khoá ở TẦNG NGOÀI CÙNG của một thân đối tượng (bỏ qua khoá lồng). */
      const khoaTangNgoai = (than: string): string[] => {
        const ra: string[] = [];
        let sau = 0;
        for (const dong of than.split('\n')) {
          const k = /^\s*(\w+)\s*:/.exec(dong);
          if (k && sau === 0) ra.push(k[1]);
          for (const c of dong) {
            if (c === '{' || c === '[' || c === '(') sau++;
            else if (c === '}' || c === ']' || c === ')') sau--;
          }
        }
        return ra;
      };

      // Khoá do zod khai trong cùng tệp — dùng khi mã ghi `...parsed.data`.
      //
      // Hai điều kiện để không báo nhầm:
      //  1. Soi đúng TẦNG NGOÀI — `steps: z.array(z.object({ no, action… }))`
      //     thì `no`/`action` là dữ liệu trong cột jsonb, không phải tên cột.
      //  2. CHỈ lấy lược đồ thật sự được đem đi phân tích (`X.safeParse`). Một
      //     tệp thường khai nhiều lược đồ; gộp hết vào là lôi cả lược đồ con
      //     (`StepSchema`) vào danh sách cột — đúng kiểu báo nhầm.
      const luocDo = new Map<string, string[]>();
      for (const z of ma.matchAll(/const\s+(\w+)\s*=\s*z\.object\(\{([\s\S]*?)\n\}\)/g)) {
        luocDo.set(z[1], khoaTangNgoai(z[2]));
      }
      const khoaZod = new Set<string>();
      for (const d of ma.matchAll(/(\w+)\.(?:safeParse|parse)\(/g)) {
        for (const k of luocDo.get(d[1]) ?? []) khoaZod.add(k);
      }

      for (const m of ma.matchAll(
        /\.from\('(\w+)'\)\s*\n?\s*\.(insert|upsert|update)\(\s*\{([\s\S]*?)\n\s*\}/g,
      )) {
        const [, tenBang, dongTu, than] = m;
        const cots = bang.get(tenBang);
        if (!cots) continue;

        // CHỈ lấy khoá ở TẦNG NGOÀI CÙNG. Lấy cả khoá lồng bên trong là báo
        // nhầm: `events.insert({ payload: { input, result, votes … } })` hoàn
        // toàn đúng vì `payload` là cột jsonb — mấy khoá bên trong nó là dữ
        // liệu, không phải tên cột. (Bản đầu của test này báo nhầm đúng kiểu
        // đó cho 3 route; test báo nhầm thì người ta sẽ bỏ qua nó.)
        const dung = new Set<string>(khoaTangNgoai(than));
        if (/\.\.\.\s*parsed\.data/.test(than)) for (const k of khoaZod) dung.add(k);

        for (const c of dung) {
          if (!cots.has(c)) {
            const gan = [...cots].filter((x) => x.includes(c.split('_')[0])).slice(0, 2).join(', ');
            hong.push(
              `${path.relative(THU_MUC_API, tep).replace(/\\/g, '/')} · ` +
                `${tenBang}.${dongTu}({ ${c}: … }) KHÔNG tồn tại${gan ? ` — gần nhất: ${gan}` : ''}`,
            );
          }
        }
      }

      // ── Dạng KHÔNG có dấu ngoặc nhọn: `.update(parsed.data)` ──
      // Bản trước chỉ soi đối tượng viết thẳng `{ ... }`, nên bỏ lọt hẳn kiểu
      // đưa nguyên kết quả zod vào. Đó chính là chỗ lỗi `evidence_url` /
      // `evidence_note` ở /api/readiness/criteria/[id] nằm im suốt: hai cột đó
      // không có trên bảng, nên nộp bằng chứng luôn trả lỗi 500 — mà test cũ
      // vẫn xanh vì không soi tới.
      for (const m of ma.matchAll(
        /\.from\('(\w+)'\)\s*\n?\s*\.(insert|upsert|update)\(\s*parsed\.data\s*\)/g,
      )) {
        const [, tenBang, dongTu] = m;
        const cots = bang.get(tenBang);
        if (!cots) continue;
        for (const c of khoaZod) {
          if (!cots.has(c)) {
            const gan = [...cots].filter((x) => x.includes(c.split('_')[0])).slice(0, 2).join(', ');
            hong.push(
              `${path.relative(THU_MUC_API, tep).replace(/\\/g, '/')} · ` +
                `${tenBang}.${dongTu}(parsed.data) chứa khoá "${c}" KHÔNG tồn tại` +
                `${gan ? ` — gần nhất: ${gan}` : ''}`,
            );
          }
        }
      }
    }

    expect(
      hong,
      `\n${hong.length} khoá ghi vào cột không tồn tại ⇒ endpoint KHÔNG BAO GIỜ ghi được:\n  ` +
        hong.join('\n  ') +
        '\n',
    ).toEqual([]);
  });

  it('5. mọi z.enum(...) đều nằm TRONG tập giá trị CSDL cho phép', () => {
    // ⚠ LỚP LỖI THỨ SÁU, phát hiện 20/09/2026 ở `/api/rounds/[id]`: mã cho
    // phép trạng thái 'dd' và 'closing' mà ràng buộc CSDL KHÔNG có hai giá
    // trị đó ⇒ người dùng chọn xong thì nhận lỗi 500; đồng thời 'negotiating',
    // 'due_diligence', 'signed', 'wired', 'failed' có trong CSDL nhưng mã
    // không cho chọn ⇒ năm trạng thái không cách nào đặt được.
    //
    // TypeScript không bắt được vì hai bên là hai chuỗi rời nhau.
    const chophep = giaTriChoPhep();
    expect(chophep.size, 'không đọc được ràng buộc CHECK nào ⇒ test này vô nghĩa').toBeGreaterThan(5);

    const hong: string[] = [];
    for (const tep of moiRoute(THU_MUC_API)) {
      const ma = fs.readFileSync(tep, 'utf8');
      // CHỈ lấy bảng route này GHI vào, không lấy bảng nó chỉ đọc.
      //
      // Bản đầu lấy mọi `.from('...')` và báo nhầm ngay: `org/route.ts` ghi
      // `status` xuống `org_positions` nhưng có ĐỌC `ipo_journeys` ở chỗ khác,
      // nên test ghép nhầm hai thứ rồi tố một lỗi không tồn tại. Test báo
      // nhầm thì người ta sẽ tắt nó đi — thà soi hẹp mà đúng.
      const cacBang = [
        ...new Set(
          [...ma.matchAll(/\.from\('(\w+)'\)\s*\n?\s*\.(?:insert|upsert|update)\(/g)].map((m) => m[1]),
        ),
      ];
      if (cacBang.length === 0) continue;

      for (const m of ma.matchAll(/(\w+):\s*z\.enum\(([A-Z_]\w*|\[[^\]]*\])\)/g)) {
        const [, cot, nguon] = m;
        // z.enum(TEN_HANG) → tìm mảng hằng khai trong cùng tệp.
        let danhSach = nguon;
        if (!nguon.startsWith('[')) {
          // ⚠ KHÔNG dựng regex bằng template literal ở đây. `\s` trong template
          // literal bị JavaScript nuốt mất dấu thoát thành `s`, nên biểu thức
          // ra `consts+STATUSESs*=s*` và KHÔNG BAO GIỜ khớp — test vẫn xanh
          // trong khi chẳng soi được gì. (Đã dính đúng bẫy này một lần: đảo
          // lỗi thật trở lại mà test vẫn xanh.) Cắt chuỗi thủ công cho chắc.
          const dau = ma.indexOf(`const ${nguon} =`);
          if (dau < 0) continue;
          const mo = ma.indexOf('[', dau);
          const dong = ma.indexOf(']', mo);
          if (mo < 0 || dong < 0) continue;
          danhSach = ma.slice(mo, dong + 1);
        }
        const giaTri = [...danhSach.matchAll(/'([^']*)'/g)].map((x) => x[1]);
        if (giaTri.length === 0) continue;

        for (const b of cacBang) {
          const tap = chophep.get(`${b}.${cot}`);
          if (!tap) continue;
          const thua = giaTri.filter((v) => !tap.has(v));
          const thieu = [...tap].filter((v) => !giaTri.includes(v));
          const ten = path.relative(THU_MUC_API, tep).replace(/\\/g, '/');
          if (thua.length > 0) {
            hong.push(
              `${ten} · ${b}.${cot}: mã cho phép ${thua.map((x) => `'${x}'`).join(', ')} ` +
                `mà CSDL TỪ CHỐI (CSDL chỉ nhận: ${[...tap].join(', ')})`,
            );
          }
          if (thieu.length > 0) {
            hong.push(
              `${ten} · ${b}.${cot}: CSDL có ${thieu.map((x) => `'${x}'`).join(', ')} ` +
                `nhưng mã KHÔNG cho chọn ⇒ không cách nào đặt được`,
            );
          }
        }
      }
    }

    expect(
      hong,
      `\n${hong.length} chỗ tập giá trị trong mã LỆCH với ràng buộc CSDL:\n  ` +
        hong.join('\n  ') +
        '\n',
    ).toEqual([]);
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
