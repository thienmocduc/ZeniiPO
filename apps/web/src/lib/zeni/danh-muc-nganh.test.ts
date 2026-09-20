/**
 * DANH MỤC NGÀNH CÓ ĐÚNG CHUẨN KHÔNG — canh một LỚP sai, không phải một dòng sai.
 *
 * Trước migration 033, cột `industry` là chữ tự do ở 4 bảng: người gõ "SaaS",
 * người gõ "Phần mềm", người gõ "Software" thì hệ thống coi là ba ngành khác
 * nhau và mọi phép so sánh theo ngành sai IM LẶNG — không có lỗi nào nổ ra,
 * chỉ có số vô nghĩa hiện trên màn hình. Danh mục chuẩn chỉ chữa được bệnh đó
 * khi bản thân nó không thủng: thiếu một ngành cấp 1, trùng một mã, hoặc có
 * ngành không kèm chỉ số nào thì lỗ hổng lại quay về đúng chỗ cũ.
 *
 * Test này đọc THẲNG tệp SQL (không cần CSDL) để mỗi lần ai đó thêm ngành mới
 * là biết ngay ngành đó có đủ mã VSIC, nhóm GICS và bộ chỉ số hay không.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const GOC = path.resolve(process.cwd(), '..', '..');
const THU_MUC_SQL = path.join(GOC, 'packages', 'database', 'zenicloud');
const TEP_033 = path.join(THU_MUC_SQL, '033_danh_muc_nganh.sql');
const TEP_032 = path.join(THU_MUC_SQL, '032_nguong_chuan_von.sql');

const sql033 = fs.readFileSync(TEP_033, 'utf8');
const sql032 = fs.readFileSync(TEP_032, 'utf8');

/** 21 ngành cấp 1 của VSIC 2018 (Quyết định 27/2018/QĐ-TTg). */
const NGANH_CAP_1 = 'ABCDEFGHIJKLMNOPQRSTU'.split('');

/** 22 ngành của kho tri thức Wits — danh sách chốt, thiếu một khoá là hỏng cầu nối. */
const KHOA_WITS = [
  'nghien_cuu', 'giao_duc', 'tai_chinh', 'f_and_b', 'ban_le', 'bat_dong_san',
  'xay_dung', 'y_te', 'san_xuat', 'logistics', 'du_lich', 'nong_nghiep',
  'thoi_trang', 'marketing', 'cong_nghe', 'ngan_hang', 'bao_hiem', 'nang_luong',
  'vien_thong', 'xuat_nhap_khau', 'truyen_thong', 'luat',
];

/** 11 nhóm GICS + nhãn trung thực cho khu vực GICS không phân loại. */
const NHOM_GICS = [
  'Energy', 'Materials', 'Industrials', 'Consumer Discretionary', 'Consumer Staples',
  'Health Care', 'Financials', 'Information Technology', 'Communication Services',
  'Utilities', 'Real Estate', 'Không áp dụng',
];

/**
 * Ba ngành cấp 1 KHÔNG có bộ chỉ số, và đó là chủ ý chứ không phải bỏ sót:
 * O là quản lý nhà nước, T là hộ gia đình tự tiêu dùng, U là tổ chức quốc tế —
 * không có doanh nghiệp đi gọi vốn hay niêm yết ở ba khu vực này. Gán chỉ số
 * cho chúng là gán cho đủ ô, đúng cái thói quen mà danh mục này sinh ra để bỏ.
 */
const KHONG_CAN_CHI_SO = ['O', 'T', 'U'];

/** Tách một dòng VALUES thành từng trường, tôn trọng dấu nháy (tên ngành có chứa dấu ngoặc). */
function tachTruong(dong: string): (string | null)[] {
  const dau = dong.indexOf('(');
  const cuoi = dong.lastIndexOf(')');
  const than = dong.slice(dau + 1, cuoi);
  const ra: (string | null)[] = [];
  let hienTai = '';
  let trongNhay = false;
  for (const c of than) {
    if (c === "'") { trongNhay = !trongNhay; hienTai += c; continue; }
    if (c === ',' && !trongNhay) { ra.push(chuanHoa(hienTai)); hienTai = ''; continue; }
    hienTai += c;
  }
  ra.push(chuanHoa(hienTai));
  return ra;
}

function chuanHoa(v: string): string | null {
  const t = v.trim();
  if (t === 'NULL') return null;
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
  return t;
}

/** Đọc mọi dòng dữ liệu của các câu INSERT INTO <bảng> trong tệp SQL. */
function docSeed(sql: string, bang: string): Record<string, string | null>[] {
  const ra: Record<string, string | null>[] = [];
  let cot: string[] | null = null;

  for (const dong of sql.split('\n')) {
    const dau = new RegExp(`^INSERT INTO ${bang} \\(([^)]*)\\) VALUES`).exec(dong);
    if (dau) { cot = dau[1].split(',').map((c) => c.trim()); continue; }
    if (/^INSERT INTO /.test(dong) || /^ON CONFLICT/.test(dong)) { cot = null; continue; }
    if (!cot) continue;
    if (!/^ {2}\(/.test(dong)) continue;

    const truong = tachTruong(dong);
    expect(
      truong.length,
      `Dòng seed sai số trường (${truong.length}/${cot.length}) ở bảng ${bang}: ${dong.slice(0, 80)}`,
    ).toBe(cot.length);
    const ban: Record<string, string | null> = {};
    cot.forEach((c, i) => { ban[c] = truong[i]; });
    ra.push(ban);
  }
  return ra;
}

const nganh = docSeed(sql033, 'industries');
const boChiSo = docSeed(sql033, 'industry_metric_sets');
const nguongDe = docSeed(sql033, 'ipo_benchmarks_by_industry');

/** Chuỗi có dấu tiếng Việt thật, không phải chữ không dấu viết cho nhanh. */
const CO_DAU = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂÂÈÉÊÌÍÒÓÔƠÙÚƯỲĐ]/;

describe('Danh mục ngành 033 — VSIC 2018 · GICS · kho tri thức Wits', () => {
  it('0. đọc được seed từ tệp SQL (không đọc được thì mọi khẳng định dưới đều vô nghĩa)', () => {
    expect(nganh.length).toBeGreaterThan(40);
    expect(boChiSo.length).toBeGreaterThan(100);
    expect(nguongDe.length).toBeGreaterThan(0);
  });

  it('1. đủ 21 ngành cấp 1 VSIC 2018, đúng A đến U', () => {
    const capMot = nganh.filter((n) => n.parent_code === null).map((n) => n.code);
    expect([...capMot].sort()).toEqual([...NGANH_CAP_1].sort());
    expect(capMot.length).toBe(21);
  });

  it('2. mỗi ngành cấp 1 tự là section của chính nó; ngành cấp 2 khớp section của cha', () => {
    const theoMa = new Map(nganh.map((n) => [n.code, n]));
    const hong: string[] = [];
    for (const n of nganh) {
      if (n.parent_code === null) {
        if (n.vsic_section !== n.code) hong.push(`${n.code} cấp 1 nhưng section lại là ${n.vsic_section}`);
        continue;
      }
      const cha = theoMa.get(n.parent_code);
      if (!cha) { hong.push(`${n.code} trỏ tới ngành cha ${n.parent_code} KHÔNG tồn tại`); continue; }
      if (n.vsic_section !== cha.code) {
        hong.push(`${n.code} thuộc section ${n.vsic_section} nhưng cha là ${cha.code}`);
      }
    }
    expect(hong, `\nCây ngành sai:\n  ${hong.join('\n  ')}\n`).toEqual([]);
  });

  it('3. đủ 22 ngành kho tri thức Wits, mỗi khoá ánh xạ được đúng một mã VSIC', () => {
    const anhXa = new Map<string, string>();
    for (const n of nganh) if (n.wits_key) anhXa.set(n.wits_key, n.code!);

    const thieu = KHOA_WITS.filter((k) => !anhXa.has(k));
    expect(thieu, `\nKhoá Wits chưa có mã VSIC: ${thieu.join(', ')}\n`).toEqual([]);

    const thua = [...anhXa.keys()].filter((k) => !KHOA_WITS.includes(k));
    expect(thua, `\nKhoá Wits lạ không có trong danh sách 22 ngành: ${thua.join(', ')}\n`).toEqual([]);
    expect(anhXa.size).toBe(22);
  });

  it('4. không trùng mã ngành, không trùng khoá Wits, không trùng cặp ngành-chỉ số', () => {
    const ma = nganh.map((n) => n.code!);
    const maTrung = ma.filter((m, i) => ma.indexOf(m) !== i);
    expect(maTrung, `\nMã ngành bị trùng: ${maTrung.join(', ')}\n`).toEqual([]);

    const khoa = nganh.map((n) => n.wits_key).filter(Boolean) as string[];
    const khoaTrung = khoa.filter((k, i) => khoa.indexOf(k) !== i);
    expect(khoaTrung, `\nKhoá Wits bị trùng: ${khoaTrung.join(', ')}\n`).toEqual([]);

    const cap = boChiSo.map((c) => `${c.industry_code}·${c.metric_code}`);
    const capTrung = cap.filter((c, i) => cap.indexOf(c) !== i);
    expect(capTrung, `\nCặp ngành-chỉ số bị trùng: ${capTrung.join(', ')}\n`).toEqual([]);
  });

  it('5. mỗi ngành có ÍT NHẤT 1 chỉ số cốt lõi (trừ O/T/U — khu vực không có doanh nghiệp gọi vốn)', () => {
    const cotLoi = new Set(boChiSo.filter((c) => c.is_primary === 'true').map((c) => c.industry_code));
    const thieu = nganh
      .map((n) => n.code!)
      .filter((m) => !KHONG_CAN_CHI_SO.includes(m) && !cotLoi.has(m));
    expect(
      thieu,
      `\n${thieu.length} ngành không có chỉ số is_primary nào ⇒ không đọc được sức khoẻ ngành đó: ${thieu.join(', ')}\n`,
    ).toEqual([]);

    const thuaChiSo = KHONG_CAN_CHI_SO.filter((m) => cotLoi.has(m));
    expect(
      thuaChiSo,
      `\nNgành ${thuaChiSo.join(', ')} được gán chỉ số — nếu có căn cứ thật thì bỏ khỏi danh sách loại trừ của test này\n`,
    ).toEqual([]);
  });

  it('6. mỗi ngành đều có nhóm GICS hợp lệ và mọi chỉ số đều trỏ tới ngành có thật', () => {
    const gicsLa = nganh.filter((n) => !NHOM_GICS.includes(n.gics_sector!))
      .map((n) => `${n.code} → ${n.gics_sector}`);
    expect(gicsLa, `\nNhóm GICS không tồn tại:\n  ${gicsLa.join('\n  ')}\n`).toEqual([]);

    const co = new Set(nganh.map((n) => n.code!));
    const mocoi = boChiSo.filter((c) => !co.has(c.industry_code!))
      .map((c) => `${c.industry_code}·${c.metric_code}`);
    expect(mocoi, `\nChỉ số gắn vào ngành không tồn tại:\n  ${mocoi.join('\n  ')}\n`).toEqual([]);
  });

  it('7. tiếng Việt CÓ DẤU ở mọi tên ngành và mọi câu giải thích vì sao', () => {
    const khongDau = [
      ...nganh.filter((n) => !CO_DAU.test(n.name_vi ?? '')).map((n) => `industries.${n.code}.name_vi`),
      ...boChiSo.filter((c) => !CO_DAU.test(c.name_vi ?? '')).map((c) => `metric.${c.industry_code}.${c.metric_code}.name_vi`),
      ...boChiSo.filter((c) => !CO_DAU.test(c.why_vi ?? '')).map((c) => `metric.${c.industry_code}.${c.metric_code}.why_vi`),
    ];
    expect(khongDau, `\nThiếu dấu tiếng Việt:\n  ${khongDau.join('\n  ')}\n`).toEqual([]);

    // why_vi phải là một CÂU giải thích, không phải nhắc lại tên chỉ số.
    const quaNgan = boChiSo.filter((c) => (c.why_vi ?? '').length < 30)
      .map((c) => `${c.industry_code}·${c.metric_code}`);
    expect(quaNgan, `\nCâu vì sao quá ngắn để giải thích được điều gì: ${quaNgan.join(', ')}\n`).toEqual([]);
  });

  it('8. ngưỡng đè theo ngành: có ngành thật, có nguồn, có ít nhất một chiều ngưỡng', () => {
    const co = new Set(nganh.map((n) => n.code!));
    const hong: string[] = [];
    for (const d of nguongDe) {
      const ten = `${d.metric_code}·${d.stage}·${d.industry_code}`;
      if (!co.has(d.industry_code!)) hong.push(`${ten}: ngành không tồn tại`);
      if (!d.source_note || d.source_note.length < 20) hong.push(`${ten}: thiếu dẫn nguồn`);
      if (d.good_min === null && d.good_max === null) hong.push(`${ten}: không có ngưỡng nào`);
    }
    expect(hong, `\nNgưỡng đè hỏng:\n  ${hong.join('\n  ')}\n`).toEqual([]);
  });

  it('9. KHÔNG đụng vào 31 dòng ngưỡng đã nạp ở 032', () => {
    // 033 chỉ được THÊM. Xoá khoá chính hay xoá dữ liệu của ipo_benchmarks sẽ
    // làm câu ON CONFLICT (metric_code, stage) của 026 và 032 chết ngay vòng
    // chạy lại thứ hai của cả chuỗi migration.
    expect(sql033).not.toMatch(/DELETE\s+FROM\s+ipo_benchmarks/i);
    expect(sql033).not.toMatch(/DROP\s+TABLE[^;]*ipo_benchmarks\b/i);
    expect(sql033).not.toMatch(/ALTER\s+TABLE\s+ipo_benchmarks\s+DROP/i);

    const dong032 = (sql032.match(/^ {2}\('/gm) ?? []).length;
    expect(dong032, 'Tệp 032 phải còn nguyên 31 dòng ngưỡng chung').toBe(31);
  });

  it('10. migration chạy lại được: bảng có IF NOT EXISTS, mọi INSERT có ON CONFLICT', () => {
    const soBang = (sql033.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length;
    expect(soBang).toBe(3);
    expect(sql033).not.toMatch(/CREATE TABLE(?! IF NOT EXISTS)/);

    const soInsert = (sql033.match(/^INSERT INTO /gm) ?? []).length;
    const soOnConflict = (sql033.match(/^ON CONFLICT /gm) ?? []).length;
    expect(soOnConflict, 'Mỗi INSERT phải có ON CONFLICT của riêng nó').toBe(soInsert);
  });
});
