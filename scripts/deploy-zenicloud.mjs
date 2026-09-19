/**
 * Deploy Zeni-iPO → ZeniCloud Compute via API (POST /deploy/quick).
 * Builds from the public GitHub repo using the repo-root Dockerfile.
 * Reads token + env from .env.local. Run: node scripts/deploy-zenicloud.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

// `.env.local` chỉ có trên máy lập trình viên. Trên CI biến đến từ secrets của
// kho và job deploy KHÔNG cài node_modules — nên `dotenv` phải là TUỲ CHỌN.
// Trước đây nó là `import` cứng ở đầu tệp: thiếu gói là hỏng ngay dòng đầu,
// chưa kịp chạy gì (lần chạy 19/09 chết đúng kiểu này sau 10 giây).
try {
  const { default: dotenv } = await import('dotenv')
  dotenv.config({ path: '.env.local' })
} catch {
  // Không có dotenv → đọc thẳng process.env. Bình thường trên CI.
}

const API = process.env.ZENICLOUD_API
const WS = process.env.ZENICLOUD_WS
const TOK = process.env.ZENICLOUD_API_TOKEN

// Fail-closed: thiếu biến thì dừng với thông báo rõ, đừng gửi request tới
// `undefined/deploy/quick` rồi báo một lỗi mạng khó hiểu.
const thieu = Object.entries({ ZENICLOUD_API: API, ZENICLOUD_WS: WS, ZENICLOUD_API_TOKEN: TOK })
  .filter(([, v]) => !v)
  .map(([k]) => k)
if (thieu.length) {
  console.error(`⛔ Thiếu biến môi trường: ${thieu.join(', ')}`)
  console.error('   Máy cá nhân: khai trong .env.local · CI: khai ở Settings → Secrets của kho.')
  process.exit(1)
}

const hdr = { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' }

// Env vars the app needs to boot (Supabase backend kept for now).
const pick = (k) => process.env[k]
// PUBLIC env + AI gateway config. The AI key is a TEMPORARY ZeniCloud PAT the
// chairman explicitly authorized shipping for build-test (2026-06-22, "cài tạm
// để dùng build test, xong dự án sẽ cài key mới đúng luật"). Rotate later.
// SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL still go via env UI only.
const env_vars = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: pick('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: pick('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  AI_BASE_URL: pick('AI_BASE_URL'),
  AI_API_KEY: pick('AI_API_KEY'),
  AI_MODEL_DEEP: pick('AI_MODEL_DEEP'),
  AI_MODEL_FAST: pick('AI_MODEL_FAST'),
}
for (const k of Object.keys(env_vars)) if (!env_vars[k]) delete env_vars[k]

/**
 * Tự đóng gói mã nguồn trước khi gửi.
 *
 * Trước đây phải gõ tay một đoạn PowerShell dài (git archive + chèn
 * `.env.production` vào zip) rồi mới chạy script này. Bước thủ công đó dễ quên
 * và dễ gõ sai — đã có lần zip thiếu file, có lần sai thư mục gốc. Nay script tự
 * làm, chỉ cần `node scripts/deploy-zenicloud.mjs`.
 *
 * `.env.production` KHÔNG nằm trong git (chứa biến môi trường công khai cần
 * inline lúc build) nên phải chèn thêm vào zip sau khi `git archive`.
 */
/**
 * CỔNG CHẶN: GIT TRƯỚC, DEPLOY SAU.
 *
 * Git là nguồn sự thật; bản đang chạy phải luôn truy ngược được về một commit
 * ĐÃ có trên GitHub. Trước đây push là bước rời nên đã có lúc production chạy
 * bản mà GitHub chưa có — 27 commit nằm một chỗ trên máy suốt nhiều tuần, mất
 * máy là mất sạch và không ai biết web đang chạy commit nào.
 *
 * Nay deploy sẽ TỪ CHỐI nếu: còn thay đổi chưa commit, hoặc commit chưa push.
 * Đặt ZENI_DEPLOY_SKIP_GIT_CHECK=1 để bỏ qua — chỉ dùng khi thật sự cần gấp.
 */
function kiemTraGitTruocKhiDeploy() {
  if (process.env.ZENI_DEPLOY_SKIP_GIT_CHECK === '1') {
    console.warn('⚠ BỎ QUA cổng chặn git — bản chạy có thể không truy ngược được về GitHub.')
    return
  }
  const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()

  // 1. Còn sửa dở? Deploy lúc này thì thứ đang chạy không khớp commit nào.
  const ban = sh('git status --porcelain -- apps packages scripts')
  if (ban) {
    console.error('\n⛔ Còn thay đổi CHƯA COMMIT:\n' + ban)
    console.error('\n→ Chạy: git add -A && git commit -m "..." && git push origin <nhánh>')
    process.exit(1)
  }

  // 2. Commit đã có trên GitHub chưa?
  const nhanh = sh('git rev-parse --abbrev-ref HEAD')
  let chuaPush = ''
  try {
    chuaPush = sh('git log --oneline HEAD --not --remotes')
  } catch {
    /* không có remote — bỏ qua */
  }
  if (chuaPush) {
    const soCommit = chuaPush.split('\n').length
    console.error(`\n⛔ Có ${soCommit} commit CHƯA ĐẨY lên GitHub:\n${chuaPush}`)
    console.error(`\n→ Chạy: git push origin ${nhanh}`)
    console.error('   (Git trước, deploy sau — để bản đang chạy luôn truy ngược được.)')
    process.exit(1)
  }

  console.log(`◇ git sạch · nhánh ${nhanh} · HEAD ${sh('git rev-parse --short HEAD')} đã có trên GitHub`)
}

function dongGoiMaNguon() {
  kiemTraGitTruocKhiDeploy()
  const zip = 'zeniipo-src.zip'
  execSync(`git archive HEAD --format=zip -o ${zip}`, { stdio: 'inherit' })

  const envFile = 'apps/web/.env.production'
  if (!fs.existsSync(envFile)) {
    console.warn(`⚠ Thiếu ${envFile} — app sẽ lỗi 500 ở middleware vì biến công khai không được inline lúc build.`)
    return zip
  }
  // Node không có sẵn thư viện zip. Chạy được cả trên máy Windows của đội lẫn
  // trên CI (Linux) — nếu không, CI sẽ hỏng ở đúng bước cuối.
  if (process.platform === 'win32') {
    const ps = [
      'Add-Type -AssemblyName System.IO.Compression.FileSystem;',
      `$z=[System.IO.Compression.ZipFile]::Open('${path.resolve(zip)}','Update');`,
      'try {',
      "  $e=$z.Entries | Where-Object { $_.FullName -eq 'apps/web/.env.production' };",
      '  if ($e) { $e.Delete() };',
      `  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z,'${path.resolve(envFile)}','apps/web/.env.production')`,
      '} finally { $z.Dispose() }',
    ].join(' ')
    execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { stdio: 'inherit' })
  } else {
    // `zip` giữ nguyên đường dẫn tương đối, nên chèn đúng vào apps/web/.
    execSync(`zip -q "${zip}" "${envFile}"`, { stdio: 'inherit' })
  }

  const kb = Math.round(fs.statSync(zip).size / 1024)
  console.log(`◇ đã đóng gói ${zip} (${kb} KB, kèm .env.production)`)
  return zip
}

const zipPath = dongGoiMaNguon()

const payload = {
  name: 'zeniipo',
  type: 'web',
  runtime: 'container',
  size: 's',
  region: 'asia-southeast1',
  zip_base64: fs.readFileSync(zipPath).toString('base64'),
  port: 3000,
  allow_unauthenticated: true,
  env_vars,
}

console.log('→ POST /deploy/quick (repo_url build, ' + Object.keys(env_vars).length + ' env vars)')
const res = await fetch(`${API}/deploy/quick?ws=${WS}`, { method: 'POST', headers: hdr, body: JSON.stringify(payload) })
const text = await res.text()
console.log('status', res.status)
console.log(text.slice(0, 800))

// Try to extract a deploy/project id for polling.
let id
try { const j = JSON.parse(text); id = j.id || j.deploy_id || j.project_id || j.deployment_id || j.data?.id } catch {}
if (!id) process.exit(res.ok ? 0 : 1)

console.log('\nDEPLOY_ID=' + id + ' — đang theo dõi tới khi xong…')

/**
 * Tự theo dõi thay vì bắt người chạy gõ thêm lệnh poll.
 * Lưu ý thực tế: worker của nền tảng có lúc dừng ở `built` mà không tung ra
 * (đã gặp 18-19/09). Nên coi `built` là CHƯA xong, và sau khi hết giờ chờ thì
 * nói thẳng là chưa tung ra — đừng báo thành công nhầm.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let status = ''
for (let i = 0; i < 24; i++) {
  await sleep(20_000)
  try {
    const r = await fetch(`${API}/upload/source/${id}?ws=${WS}`, { headers: hdr })
    const j = await r.json()
    status = String(j.status ?? '')
  } catch {
    status = 'lỗi mạng'
  }
  console.log(`  [${String(i + 1).padStart(2)}] ${status}`)
  if (/success|fail|error/i.test(status)) break
}

if (/success/i.test(status)) {
  console.log('\n✅ ĐÃ TUNG RA. Kiểm: https://zeniipo.com/login')
  process.exit(0)
}
if (/fail|error/i.test(status)) {
  console.log('\n❌ BUILD HỎNG — worker nền tảng hay chập chờn, chạy lại lệnh này thường là được.')
  process.exit(1)
}
console.log(`\n⚠ Dừng ở trạng thái "${status}" — build xong nhưng CHƯA tung ra.`)
console.log('   Đây là lỗi phía nền tảng (đã báo ở ticket, mục "built → deploying").')
console.log('   Bản đang chạy vẫn là bản cũ, không bị ảnh hưởng.')
process.exit(2)
