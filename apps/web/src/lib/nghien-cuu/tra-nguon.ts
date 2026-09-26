/**
 * TRA NGUỒN THỊ TRƯỜNG — mô hình ngôn ngữ CHỈ được trích, không được nhớ.
 *
 * Chairman 26/09/2026: "lục tung mạng xã hội lấy hết nguồn dữ liệu chuẩn nhất
 * về làm" + dùng agent ZeniCloud tự tra web.
 *
 * ⚠ VẤN ĐỀ CỐT TỬ. Một mô hình ngôn ngữ hỏi về quy mô thị trường sẽ trả lời rất
 * trôi chảy từ ký ức huấn luyện — kèm cả con số và cả tên nguồn. Những con số đó
 * KHÔNG kiểm được, và `market_data.source_url` sẽ trỏ tới một trang có thể chưa
 * từng chứa con số đó. Đấy là bịa có vẻ thuyết phục, loại tệ nhất.
 *
 * ── CƠ CHẾ CHỐNG BỊA (đây là phần đáng giá của tệp này) ───────────────────
 * 1. Trang được TẢI THẬT qua `/api/v1/browser/render` của ZeniCloud → có văn bản.
 * 2. Mô hình chỉ được trích từ văn bản đó, và mỗi dòng phải kèm `trich_dan` —
 *    một đoạn NGUYÊN VĂN từ trang.
 * 3. `xacMinhTrichDan()` kiểm bằng máy: đoạn trích phải CÓ THẬT trong văn bản,
 *    và con số phải CÓ THẬT trong đoạn trích. Không thoả thì LOẠI dòng đó.
 * Nhờ bước 3, một con số nhớ từ ký ức không thể đi qua — vì nó không kèm được
 * đoạn trích có thật.
 */

/** Một dòng số liệu do mô hình đề xuất từ một trang. */
export type DongDeXuat = {
  metric_type: string
  value_numeric: number
  value_unit: string
  region?: string
  segment?: string
  /** Đoạn NGUYÊN VĂN từ trang, chứa con số. Đây là thứ được kiểm bằng máy. */
  trich_dan: string
  confidence?: number
}

export type KetQuaXacMinh = {
  nhan: DongDeXuat[]
  loai: Array<{ dong: DongDeXuat; ly_do: string }>
}

/** Gột chuỗi để so khớp: bỏ khoảng trắng thừa, hạ chữ, bỏ dấu câu hai đầu. */
const got = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Con số có xuất hiện trong đoạn trích không?
 *
 * Phải chịu được cách viết số khác nhau của cùng một giá trị: `1.234,5` (Việt) ·
 * `1,234.5` (Anh) · `1234.5` · `1 234,5`. So bằng chuỗi thô sẽ loại oan gần hết.
 */
export function soCoTrongTrichDan(so: number, trichDan: string): boolean {
  const t = trichDan.replace(/ /g, ' ')
  // Mọi chuỗi số trong đoạn trích, chuẩn hoá về số JS.
  for (const m of t.matchAll(/\d[\d.,\s]*\d|\d/g)) {
    const raw = m[0].replace(/\s/g, '')
    const nen: string[] = []
    // Dấu phẩy là thập phân (Việt), dấu chấm là phân nhóm.
    nen.push(raw.replace(/\./g, '').replace(',', '.'))
    // Dấu chấm là thập phân (Anh), dấu phẩy là phân nhóm.
    nen.push(raw.replace(/,/g, ''))
    // Bỏ hết dấu phân cách.
    nen.push(raw.replace(/[.,]/g, ''))
    for (const n of nen) {
      const v = Number(n)
      if (!Number.isFinite(v)) continue
      if (v === so) return true
      // Chấp nhận lệch do làm tròn khi hiển thị (ví dụ trang ghi 12,3 còn mô
      // hình trả 12.3). Ngưỡng tương đối rất chặt: 0,5%.
      if (so !== 0 && Math.abs(v - so) / Math.abs(so) < 0.005) return true
    }
  }
  return false
}

/**
 * Lọc những dòng KHÔNG chứng minh được.
 *
 * Trả về cả phần bị loại kèm lý do — im lặng bỏ bớt thì người dùng tưởng trang
 * đó không có gì, trong khi thật ra mô hình đã bịa và bị chặn.
 */
export function xacMinhTrichDan(vanBanTrang: string, dong: DongDeXuat[]): KetQuaXacMinh {
  const van = got(vanBanTrang)
  const nhan: DongDeXuat[] = []
  const loai: Array<{ dong: DongDeXuat; ly_do: string }> = []

  for (const d of dong) {
    if (!d.trich_dan || d.trich_dan.trim().length < 8) {
      loai.push({ dong: d, ly_do: 'Không kèm đoạn trích, hoặc đoạn trích quá ngắn để kiểm' })
      continue
    }
    if (!Number.isFinite(d.value_numeric)) {
      loai.push({ dong: d, ly_do: 'Giá trị không phải số' })
      continue
    }
    if (!van.includes(got(d.trich_dan))) {
      loai.push({
        dong: d,
        ly_do: 'Đoạn trích KHÔNG có trong trang đã tải — dấu hiệu số liệu lấy từ ký ức mô hình',
      })
      continue
    }
    if (!soCoTrongTrichDan(d.value_numeric, d.trich_dan)) {
      loai.push({
        dong: d,
        ly_do: `Con số ${d.value_numeric} không xuất hiện trong chính đoạn trích đã dẫn`,
      })
      continue
    }
    nhan.push(d)
  }
  return { nhan, loai }
}

/**
 * Chặn địa chỉ nội bộ.
 *
 * ⚠ Người dùng đưa URL, máy chủ đi tải — đó là định nghĩa của lỗ SSRF. Nếu
 * không chặn, một URL như `http://169.254.169.254/` hay `http://10.0.0.5:5432`
 * sẽ khiến lớp render đi đọc dịch vụ nội bộ trong cùng mạng, và trả nội dung về
 * cho người gọi. Lớp render nằm ở ZeniCloud, nhưng CSDL của chính ứng dụng cũng
 * ở đó — nên đây là rủi ro thật, không phải rủi ro lý thuyết.
 */
export function urlAnToan(url: string): { ok: true; url: string } | { ok: false; loi: string } {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { ok: false, loi: 'Địa chỉ không hợp lệ' }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, loi: `Chỉ nhận http và https, không nhận "${u.protocol}"` }
  }
  const h = u.hostname.toLowerCase()

  if (
    h === 'localhost' ||
    h === '[::1]' ||
    h === '::1' ||
    h.endsWith('.localhost') ||
    h.endsWith('.internal') ||
    h.endsWith('.local')
  ) {
    return { ok: false, loi: 'Không tải địa chỉ nội bộ' }
  }
  // IPv4 riêng tư, loopback, link-local (gồm cả 169.254.169.254 — điểm metadata
  // của mọi nhà cung cấp mây).
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    ) {
      return { ok: false, loi: `Không tải địa chỉ nội bộ (${h})` }
    }
  }
  // IPv6 riêng tư và loopback.
  if (h.startsWith('[') && /^\[(::1|fc|fd|fe80)/i.test(h)) {
    return { ok: false, loi: `Không tải địa chỉ nội bộ (${h})` }
  }
  return { ok: true, url: u.toString() }
}

type CauHinhZC = { api: string; ws: string; token: string }

export function cauHinhZeniCloud(): CauHinhZC | null {
  const api = (process.env.ZENICLOUD_API ?? '').replace(/\/$/, '')
  const ws = process.env.ZENICLOUD_WS ?? ''
  const token = process.env.ZENICLOUD_STORAGE_TOKEN ?? ''
  if (!api || !ws || !token) return null
  return { api, ws, token }
}

/** Tải một trang thật qua lớp browser-automation của ZeniCloud. */
export async function taiTrang(
  cau: CauHinhZC,
  url: string,
): Promise<{ ok: true; title: string; text: string } | { ok: false; loi: string }> {
  try {
    const res = await fetch(
      `${cau.api}/browser/render?ws=${encodeURIComponent(cau.ws)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cau.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, screenshot: false }),
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { ok: false, loi: `Lớp render trả ${res.status}: ${t.slice(0, 200)}` }
    }
    const j = (await res.json()) as { title?: string; text?: string; content?: string }
    const text = j.text ?? j.content ?? ''
    if (!text.trim()) return { ok: false, loi: 'Trang tải được nhưng không có văn bản nào' }
    return { ok: true, title: j.title ?? '', text }
  } catch (e) {
    return { ok: false, loi: `Không gọi được lớp render: ${(e as Error).message}` }
  }
}

/**
 * Lời nhắc hệ thống cho bước trích.
 *
 * Viết ở đây thay vì rải trong route để chỉ có MỘT bản: sửa luật trích mà sót
 * một chỗ thì hai đường trích ra hai kiểu dữ liệu.
 */
export const NHAC_TRICH_SO = `Bạn là trợ lý trích số liệu. Bạn CHỈ được trích những con số CÓ THẬT trong đoạn văn bản được cung cấp.

LUẬT TUYỆT ĐỐI:
- KHÔNG dùng kiến thức sẵn có. Nếu văn bản không có con số, trả mảng rỗng.
- Mỗi dòng PHẢI kèm "trich_dan": một đoạn copy NGUYÊN VĂN từ văn bản, chứa chính con số đó. Không tóm tắt, không dịch, không sửa dấu.
- Con số trong "value_numeric" phải xuất hiện trong "trich_dan".
- Hệ thống sẽ kiểm lại bằng máy và LOẠI mọi dòng không thoả. Bịa là vô ích.

Trả về DUY NHẤT một mảng JSON, không kèm lời dẫn:
[{"metric_type":"...","value_numeric":123,"value_unit":"...","region":"...","segment":"...","trich_dan":"...","confidence":0.0-1.0}]`
