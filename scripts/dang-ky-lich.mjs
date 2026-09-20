#!/usr/bin/env node
/**
 * ĐĂNG KÝ LỊCH CHẠY ĐỊNH KỲ LÊN ZENICLOUD.
 *
 * Đọc `lich-chay-dinh-ky.json` rồi gọi `/api/v1/automation/crons` của ZeniCloud.
 * Chạy lại được: công việc đã có thì bỏ qua, không tạo trùng.
 *
 * Cần hai biến môi trường (KHÔNG hardcode, KHÔNG in ra):
 *   ZENI_PAT     — khoá truy cập ZeniCloud
 *   CRON_SECRET  — bí mật mà `/api/cron/*` đòi ở header Authorization
 *
 *   node scripts/dang-ky-lich.mjs            # đăng ký
 *   node scripts/dang-ky-lich.mjs --xem      # chỉ xem, không đổi gì
 */
import fs from 'node:fs'

const WS = process.env.ZENI_WS ?? 'zeniipo-com'
const GOC_API = 'https://zenicloud.io/api/v1/automation/crons'
const chiXem = process.argv.includes('--xem')

const pat = process.env.ZENI_PAT
const secret = process.env.CRON_SECRET
if (!pat) {
  console.error('Thiếu ZENI_PAT. Đặt biến môi trường rồi chạy lại — đừng gắn khoá vào mã.')
  process.exit(1)
}
if (!secret && !chiXem) {
  console.error('Thiếu CRON_SECRET. Không có nó thì lịch gọi tới sẽ bị /api/cron/* từ chối (403).')
  process.exit(1)
}

const cauHinh = JSON.parse(fs.readFileSync(new URL('../lich-chay-dinh-ky.json', import.meta.url), 'utf8'))

async function chay() {

const goi = async (duongDan, tuyChon = {}) => {
  const res = await fetch(`${GOC_API}${duongDan}${duongDan.includes('?') ? '&' : '?'}ws=${WS}`, {
    ...tuyChon,
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', ...(tuyChon.headers ?? {}) },
  })
  let than
  try { than = await res.json() } catch { than = { detail: await res.text() } }
  return { ma: res.status, than }
}

const hienCo = await goi('')
if (hienCo.ma === 503) {
  // Ngày 20/09/2026 ZeniCloud trả đúng lỗi này. Đây KHÔNG phải lỗi của ZeniIPO.
  console.error('ZeniCloud tạm ngưng dịch vụ lịch (503):', hienCo.than?.detail ?? '')
  console.error('Lịch chưa đăng ký được. Mã phía ZeniIPO đã sẵn sàng — chạy lại script này khi dịch vụ mở lại.')
  // Dùng exitCode chứ không process.exit(): Node trên Windows ném
  // "Assertion failed ... UV_HANDLE_CLOSING" khi thoát lúc fetch còn treo.
  process.exitCode = 2
  return
}
if (hienCo.ma !== 200) {
  console.error(`Không đọc được danh sách lịch (HTTP ${hienCo.ma}):`, JSON.stringify(hienCo.than).slice(0, 300))
  process.exitCode = 1
  return
}

const ds = Array.isArray(hienCo.than) ? hienCo.than : (hienCo.than.items ?? hienCo.than.crons ?? [])
const daCo = new Set(ds.map((x) => x.name ?? x.ten))
console.log(`ZeniCloud đang có ${daCo.size} lịch: ${[...daCo].join(', ') || '(chưa có)'}`)

for (const cv of cauHinh.cong_viec) {
  if (daCo.has(cv.ten)) { console.log(`· ${cv.ten}: đã có, bỏ qua`); continue }
  if (chiXem) { console.log(`· ${cv.ten}: SẼ tạo — ${cv.lich} → ${cv.duong_dan}`); continue }
  const { ma, than } = await goi('', {
    method: 'POST',
    body: JSON.stringify({
      name: cv.ten,
      schedule: cv.lich,
      target_url: `${cauHinh.goc}${cv.duong_dan}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      timezone: cauHinh.mui_gio,
      description: cv.mo_ta.slice(0, 255),
    }),
  })
  console.log(ma >= 200 && ma < 300
    ? `✔ ${cv.ten}: đã tạo (${cv.lich})`
    : `✘ ${cv.ten}: HTTP ${ma} — ${JSON.stringify(than).slice(0, 200)}`)
}
}

await chay()
