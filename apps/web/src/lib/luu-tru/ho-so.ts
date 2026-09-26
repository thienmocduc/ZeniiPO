import { createHash, randomUUID } from 'node:crypto'

/**
 * LƯU TRỮ HỒ SƠ — ZeniCloud Lớp 02 là chính, CSDL là chỗ giữ tạm.
 *
 * Trước tệp này, `data_room_docs` chỉ được ĐỌC ở mọi nơi trong mã — không một
 * route nào ghi vào. Nên toàn bộ chuỗi bằng chứng của điểm sẵn sàng niêm yết
 * (migration 038 chỉ tính tiêu chí CÓ hồ sơ đính kèm) là bất khả thi: điểm đã
 * xác minh không bao giờ vượt được 0.
 *
 * ⚠ CẢ HAI NƠI GIỮ BYTE ĐỀU LÀ HẠ TẦNG ZENICLOUD. Nơi chính là lớp lưu trữ
 * (`/api/v1/storage/buckets/...`), nơi giữ tạm là chính CSDL Postgres của
 * ZeniCloud. Không có nền tảng thứ ba nào, và `storage_path` luôn ghi rõ byte
 * nằm ở đâu để sau này chuyển được.
 */

/**
 * ⚠ DANH SÁCH CHO PHÉP, KHÔNG PHẢI DANH SÁCH CHẶN.
 *
 * `text/html` · `image/svg+xml` · `application/xhtml+xml` CỐ Ý KHÔNG có mặt.
 * Ba loại này chạy mã khi trình duyệt mở, nên một tệp "bằng chứng" tải lên rồi
 * tải về là một đường chèn mã ngay trong phiên của người xem — mà người xem hồ
 * sơ thẩm định thường là người có quyền cao nhất.
 */
const CHO_PHEP: Record<string, { duoi: string; dau?: Buffer[] }> = {
  'application/pdf': { duoi: 'pdf', dau: [Buffer.from('%PDF')] },
  'image/png': { duoi: 'png', dau: [Buffer.from([0x89, 0x50, 0x4e, 0x47])] },
  'image/jpeg': { duoi: 'jpg', dau: [Buffer.from([0xff, 0xd8, 0xff])] },
  'image/webp': { duoi: 'webp', dau: [Buffer.from('RIFF')] },
  // Định dạng Office hiện đại là zip — byte đầu luôn là PK.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    duoi: 'docx',
    dau: [Buffer.from('PK')],
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    duoi: 'xlsx',
    dau: [Buffer.from('PK')],
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    duoi: 'pptx',
    dau: [Buffer.from('PK')],
  },
  'text/csv': { duoi: 'csv' },
  'text/plain': { duoi: 'txt' },
}

/** Hạn mức. Lớp lưu trữ chịu được tệp lớn; CSDL thì không nên. */
export const GIOI_HAN_BYTE_ZENICLOUD = 25 * 1024 * 1024
export const GIOI_HAN_BYTE_CSDL = 8 * 1024 * 1024

export type KetQuaKiem =
  | { ok: true; mime: string; duoi: string; sha256: string }
  | { ok: false; loi: string }

/**
 * Kiểm tệp trước khi nhận.
 *
 * ⚠ KHÔNG TIN `content-type` NGƯỜI GỬI KHAI. Nó là một chuỗi do phía gọi đặt,
 * đổi được tự do. Một tệp HTML khai là `application/pdf` sẽ lọt qua nếu chỉ so
 * chuỗi — nên phải đối chiếu BYTE ĐẦU TỆP với chữ ký định dạng.
 */
export function kiemTep(mimeKhai: string, byte: Buffer, gioiHan: number): KetQuaKiem {
  const mime = (mimeKhai || '').split(';')[0].trim().toLowerCase()
  const dinhDang = CHO_PHEP[mime]
  if (!dinhDang) {
    return {
      ok: false,
      loi:
        `Không nhận loại tệp "${mime || 'không khai'}". Chỉ nhận: ` +
        `${Object.keys(CHO_PHEP).join(', ')}. ` +
        'HTML và SVG bị từ chối có chủ đích vì chúng chạy mã khi người khác mở hồ sơ.',
    }
  }
  if (byte.length === 0) return { ok: false, loi: 'Tệp rỗng' }
  if (byte.length > gioiHan) {
    return {
      ok: false,
      loi: `Tệp ${(byte.length / 1048576).toFixed(1)} MB, vượt hạn mức ${(gioiHan / 1048576).toFixed(0)} MB`,
    }
  }
  if (dinhDang.dau && !dinhDang.dau.some((d) => byte.subarray(0, d.length).equals(d))) {
    return {
      ok: false,
      loi: `Nội dung tệp không khớp loại đã khai (${mime}). Đổi phần mở rộng không đổi được định dạng thật.`,
    }
  }
  return {
    ok: true,
    mime,
    duoi: dinhDang.duoi,
    sha256: createHash('sha256').update(byte).digest('hex'),
  }
}

/**
 * Đường dẫn lưu trữ.
 *
 * ⚠ KHÔNG BAO GIỜ dùng tên tệp người dùng đặt làm đường dẫn. Tên tệp là dữ liệu
 * do người ngoài đặt: nó chứa được `../`, chứa được ký tự làm vỡ đường dẫn, và
 * hai người tải hai tệp cùng tên thì tệp sau đè tệp trước. Tên gốc chỉ lưu ở cột
 * `ten_tep_goc` để hiển thị.
 *
 * Tiền tố theo doanh nghiệp để một doanh nghiệp không dò được khoá của doanh
 * nghiệp khác — dù quyền đọc vẫn do RLS canh ở tầng CSDL.
 */
export function duongDanLuuTru(tenantId: string, duoi: string): string {
  const ky = new Date().toISOString().slice(0, 7) // yyyy-mm theo UTC
  return `ho-so/${tenantId}/${ky}/${randomUUID()}.${duoi}`
}

type CauHinh = { api: string; ws: string; token: string; bucket: string }

/** Cấu hình lớp lưu trữ ZeniCloud, hoặc null khi chưa nạp khoá. */
export function cauHinhLuuTru(): CauHinh | null {
  const api = (process.env.ZENICLOUD_API ?? '').replace(/\/$/, '')
  const ws = process.env.ZENICLOUD_WS ?? ''
  const token = process.env.ZENICLOUD_STORAGE_TOKEN ?? ''
  const bucket = process.env.ZENICLOUD_STORAGE_BUCKET ?? ''
  if (!api || !ws || !token || !bucket) return null
  return { api, ws, token, bucket }
}

export type KetQuaTaiLen =
  | { ok: true; nha_cung_cap: 'zenicloud'; storage_path: string }
  | { ok: false; loi: string }

/** Đẩy byte lên lớp lưu trữ ZeniCloud. */
export async function taiLenZeniCloud(
  cau: CauHinh,
  key: string,
  byte: Buffer,
  mime: string,
): Promise<KetQuaTaiLen> {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(byte)], { type: mime }), key.split('/').pop())
  form.append('key', key)
  form.append('content_type', mime)

  try {
    const res = await fetch(
      `${cau.api}/storage/buckets/${encodeURIComponent(cau.bucket)}/objects?ws=${encodeURIComponent(cau.ws)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cau.token}` },
        body: form,
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { ok: false, loi: `Lớp lưu trữ ZeniCloud trả ${res.status}: ${t.slice(0, 200)}` }
    }
    return { ok: true, nha_cung_cap: 'zenicloud', storage_path: `zenicloud://${cau.bucket}/${key}` }
  } catch (e) {
    return { ok: false, loi: `Không gọi được lớp lưu trữ ZeniCloud: ${(e as Error).message}` }
  }
}

/**
 * Xin đường tải về có hạn dùng ngắn.
 *
 * Không trả byte qua máy chủ ứng dụng: tệp thẩm định có thể lớn, và đi qua
 * Cloud Run thì mỗi lần tải chiếm một tiến trình. Đường có chữ ký để trình
 * duyệt tải trực tiếp.
 */
export async function duongTaiVe(
  cau: CauHinh,
  storagePath: string,
  giay = 300,
): Promise<{ ok: true; url: string } | { ok: false; loi: string }> {
  const m = /^zenicloud:\/\/([^/]+)\/(.+)$/.exec(storagePath)
  if (!m) return { ok: false, loi: `Đường dẫn không thuộc lớp lưu trữ ZeniCloud: ${storagePath}` }
  const [, bucket, key] = m
  try {
    const res = await fetch(
      `${cau.api}/storage/buckets/${encodeURIComponent(bucket)}/signed-url?ws=${encodeURIComponent(cau.ws)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cau.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, method: 'GET', expires_in_seconds: giay }),
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { ok: false, loi: `Xin đường tải về thất bại (${res.status}): ${t.slice(0, 200)}` }
    }
    const j = (await res.json()) as { url?: string; signed_url?: string }
    const url = j.url ?? j.signed_url
    if (!url) return { ok: false, loi: 'Lớp lưu trữ không trả về đường dẫn' }
    return { ok: true, url }
  } catch (e) {
    return { ok: false, loi: `Không gọi được lớp lưu trữ: ${(e as Error).message}` }
  }
}

/**
 * ĐƯỜNG DỰ PHÒNG: lấy thẳng byte qua lớp lưu trữ, không cần đường có chữ ký.
 *
 * ⚠ VÌ SAO CẦN. Đo trên production 26/09/2026: `POST .../signed-url` trả 500
 *     "Failed to generate signed URL: Project was not passed and could not be
 *      determined from the environment."
 * Tải LÊN chạy tốt, chỉ ký đường tải về là hỏng — lỗi phía nền tảng, không phải
 * phía ứng dụng. Nhưng tệp tải lên mà không tải về được thì tính năng vô dụng.
 *
 * Đây KHÔNG phải đổi nền tảng: vẫn đúng lớp lưu trữ ZeniCloud, chỉ dùng endpoint
 * proxy (`GET .../objects/{key}`) mà chính tài liệu của nó nêu là đường hợp lệ
 * ("for high-traffic use signed-url instead"). Đổi lại là byte đi qua ứng dụng,
 * nên phải để lộ ra rằng đang chạy đường dự phòng — che đi thì lỗi nền tảng
 * không bao giờ được sửa.
 */
export async function taiByteZeniCloud(
  cau: CauHinh,
  storagePath: string,
): Promise<{ ok: true; byte: Buffer } | { ok: false; loi: string }> {
  const m = /^zenicloud:\/\/([^/]+)\/(.+)$/.exec(storagePath)
  if (!m) return { ok: false, loi: `Đường dẫn không thuộc lớp lưu trữ ZeniCloud: ${storagePath}` }
  const [, bucket, key] = m
  try {
    const res = await fetch(
      `${cau.api}/storage/buckets/${encodeURIComponent(bucket)}/objects/${encodeURIComponent(key)}` +
        `?ws=${encodeURIComponent(cau.ws)}`,
      { headers: { Authorization: `Bearer ${cau.token}` }, cache: 'no-store' },
    )
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { ok: false, loi: `Lớp lưu trữ trả ${res.status}: ${t.slice(0, 200)}` }
    }
    return { ok: true, byte: Buffer.from(await res.arrayBuffer()) }
  } catch (e) {
    return { ok: false, loi: `Không lấy được byte: ${(e as Error).message}` }
  }
}
