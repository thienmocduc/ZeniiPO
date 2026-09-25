/**
 * v1-extract: read the chairman's authoritative v1_8_FULL.html at build/runtime
 * and expose the raw HTML fragments needed by the app (sidebar, topbar, login,
 * cosmic bg, and each of the 43 page sections).
 *
 * We intentionally pass the raw HTML straight through `dangerouslySetInnerHTML`
 * so the rendered markup is byte-for-byte identical to v1_8_FULL. That keeps
 * the design 100% fidelity without hand-converting HTML→JSX (the chairman's
 * explicit requirement).
 *
 * Source file: src/lib/v1/source.html — copied from _source/zeniipo_ui_product_v1_8_FULL.html
 *
 * Usage in a server component:
 *
 *     import { getPageInner } from '@/lib/v1/extract';
 *     const html = getPageInner('dash');
 *     return <div className="page act" id="page-dash"
 *       dangerouslySetInnerHTML={{__html: html}} />;
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Cache — readFileSync happens once per Node process.
let _source: string | null = null;

function loadSource(): string {
  if (_source == null) {
    // On Vercel the working directory varies; prefer a path relative to the
    // compiled module location (__dirname is polyfilled by Next for server
    // components). Fall back to process.cwd()/src/lib/v1/source.html for
    // local dev where __dirname points into .next/server/app/... and the
    // relative resolve still lands on src/lib/v1/source.html (copied during
    // build). As a last resort also try <cwd>/apps/web/src/lib/v1/source.html
    // for mono-repo root invocations.
    const candidates = [
      resolve(process.cwd(), 'src', 'lib', 'v1', 'source.html'),
      resolve(process.cwd(), 'apps', 'web', 'src', 'lib', 'v1', 'source.html'),
    ];
    let lastErr: unknown = null;
    for (const p of candidates) {
      try {
        _source = readFileSync(p, 'utf8');
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (_source == null) {
      throw new Error(
        `v1/source.html not found. Tried: ${candidates.join(', ')}. Last error: ${String(lastErr)}`,
      );
    }
  }
  return _source;
}

// ─────────────────────────────────────────────────────────────
// CSS — returned as string so layout can inject into a <style>.
// ─────────────────────────────────────────────────────────────
export function getCss(): string {
  const src = loadSource();
  const a = src.indexOf('<style>');
  const b = src.indexOf('</style>', a);
  if (a < 0 || b < 0) return '';
  return src.slice(a + '<style>'.length, b);
}

// ─────────────────────────────────────────────────────────────
// Shared helper: find the END of a <div> opened at `start`
// (position of the `<` character). Accounts for nested <div>s and
// skips over quoted attribute values. Returns index AFTER `</div>`.
// ─────────────────────────────────────────────────────────────
function findMatchingDivEnd(body: string, start: number): number {
  let i = start;
  let depth = 0;
  let inQuote: string | null = null;
  let inTag = false;
  let tagStart = -1;

  const n = body.length;
  while (i < n) {
    const c = body[i];
    if (inQuote) {
      if (c === inQuote) inQuote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      if (inTag) inQuote = c;
      i++;
      continue;
    }
    if (!inTag) {
      if (c === '<') {
        inTag = true;
        tagStart = i;
      }
      i++;
      continue;
    }
    if (c === '>') {
      const tagText = body.slice(tagStart, i + 1);
      if (/^<div\b/i.test(tagText)) {
        if (!/\/\s*>$/.test(tagText)) depth++;
      } else if (/^<\/div\b/i.test(tagText)) {
        depth--;
        if (depth === 0) return i + 1;
      }
      inTag = false;
      tagStart = -1;
      i++;
      continue;
    }
    i++;
  }
  throw new Error('Unterminated <div> starting at ' + start);
}

// ─────────────────────────────────────────────────────────────
// Pages — `<div class="page[ act]?" id="page-X">`
// Returns INNER HTML (no wrapping <div>).
// ─────────────────────────────────────────────────────────────
const _pageCache = new Map<string, string>();

export function getPageInner(pageId: string): string {
  if (_pageCache.has(pageId)) return _pageCache.get(pageId) as string;

  const src = loadSource();
  const mainOpen = src.indexOf('<main class="main">');
  const mainInnerStart =
    mainOpen < 0 ? 0 : mainOpen + '<main class="main">'.length;
  const mainClose = src.indexOf('</main>', mainInnerStart);
  const main = src.slice(
    mainInnerStart,
    mainClose < 0 ? src.length : mainClose,
  );

  // Tolerate `<div class="page act" id="page-X">` and `<div class="page" id="page-X">`.
  const openTag = new RegExp(
    `<div\\s+class="page(?:\\s+act)?"\\s+id="page-${escapeRegExp(pageId)}">`,
  );
  const m = openTag.exec(main);
  if (!m) {
    _pageCache.set(
      pageId,
      `<div style="padding:40px;color:#94A3B8"><h2>Missing page</h2><p>page-${pageId} not found in source.html</p></div>`,
    );
    return _pageCache.get(pageId) as string;
  }
  const openStart = m.index;
  const openEnd = m.index + m[0].length;
  const absEnd = findMatchingDivEnd(main, openStart);
  // Inner HTML (strip outer <div> + </div>). Keep inline `on*=` handlers —
  // V1Interactivity injects the v1_8 script as window-level functions so the
  // inline `onclick="openAgentModal('strategy')"` etc. resolve at runtime.
  const inner = main.slice(openEnd, absEnd - '</div>'.length).trim();
  _pageCache.set(pageId, inner);
  return inner;
}

// ─────────────────────────────────────────────────────────────
// Sidebar — `<aside class="nav" id="sidebar"> … </aside>`
// Returns INNER HTML.
// ─────────────────────────────────────────────────────────────
let _sidebarCache: string | null = null;

export function getSidebarInner(): string {
  if (_sidebarCache != null) return _sidebarCache;
  const src = loadSource();
  const open = src.indexOf('<aside class="nav" id="sidebar">');
  const close = src.indexOf('</aside>', open);
  _sidebarCache = stripInlineHandlers(
    src.slice(open + '<aside class="nav" id="sidebar">'.length, close).trim(),
  );
  return _sidebarCache;
}

// ─────────────────────────────────────────────────────────────
// Topbar — `<header class="tb"> … </header>` (full element)
// ─────────────────────────────────────────────────────────────
let _topbarCache: string | null = null;

export function getTopbarHtml(): string {
  if (_topbarCache != null) return _topbarCache;
  const src = loadSource();
  const open = src.indexOf('<header class="tb">');
  const close = src.indexOf('</header>', open) + '</header>'.length;
  let tb = stripInlineHandlers(src.slice(open, close));

  // GỠ ô chọn công ty khỏi thanh trên — nay nó nằm ở đầu THANH BÊN
  // (`components/tenant-switcher.tsx`), theo lệnh chairman 20/09/2026.
  //
  // Khối này có div lồng nhau, nên KHÔNG đếm `</div>` kiểu lười — cách đó cắt
  // sót giữa chừng (bài học 19/09: một biểu thức lười đã xoá nhầm cả nút Đăng
  // nhập thật). Neo bằng lookahead tới mốc đứng NGAY SAU nó là ô tìm kiếm.
  const truoc = tb;
  tb = tb.replace(/<div class="entity-switch"[\s\S]*?(?=<div class="search">)/, '');

  // Kiểm CẢ HAI chiều: thứ phải MẤT đã mất, và thứ phải CÒN vẫn còn.
  // Chỉ kiểm "đã mất" là đúng cái lỗ hổng đã làm hỏng màn hình đăng nhập.
  if (tb.includes('entity-switch')) {
    throw new Error('[extract] Không gỡ được ô chọn công ty khỏi thanh trên — mẫu neo đã lệch.');
  }
  for (const phaiCon of ['class="search"', 'class="tb-r"', 'class="logo"', 'id="roleSw"']) {
    if (!tb.includes(phaiCon)) {
      throw new Error(`[extract] Cắt hỏng thanh trên: mất "${phaiCon}" (dài ${truoc.length} → ${tb.length}).`);
    }
  }

  _topbarCache = tb;
  return _topbarCache;
}

// ─────────────────────────────────────────────────────────────
// ⛔ KHÔNG DÙNG NỮA — getLoginHtml (giữ tạm, sẽ xoá)
//
// Hàm này lấy khối `<div class="login">` của BẢN DỰNG DEMO rồi gọt bằng biểu
// thức tìm-thay. Ngày 19/09/2026 cách đó đã cắt nhầm **chính nút Đăng nhập**
// trên bản chạy thật (nút thật và nút SSO demo cùng tên lớp, nút thật đứng
// trước) ⇒ cửa vào sản phẩm không còn nút nào để bấm.
//
// Màn hình đăng nhập nay viết bằng React tại `app/(auth)/login/login-form.tsx`:
// muốn bỏ gì thì không render, gõ Enter cũng gửi được, kiểm thử được.
//
// KHÔNG gọi lại hàm này. KHÔNG thêm bước gọt mới vào đây.
// ─────────────────────────────────────────────────────────────
let _loginCache: string | null = null;

/** @deprecated Không còn được dùng — xem ghi chú ở trên. Sẽ xoá. */
export function getLoginHtml(): string {
  if (_loginCache != null) return _loginCache;
  const src = loadSource();
  const open = src.indexOf('<div class="login" id="login">');
  const end = findMatchingDivEnd(src, open);
  let html = stripInlineHandlers(src.slice(open, end));
  // Strip the embedded "Z" mark + "Zeniipo IPO Journey Platform v1.7" brand
  // block at the top of the login card — it duplicates the auth layout chrome
  // and the chairman flagged it as visually noisy.
  html = html.replace(/<div class="login-brand">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '');
  // Strip pre-filled `value="duc@anima.vn"` and password "Zeniipo@2026" from
  // the demo seed so the form opens blank like a real login screen.
  html = html.replace(/(<input[^>]*\bid="loginEmail"[^>]*?)\s+value="[^"]*"/, '$1');
  html = html.replace(/(<input[^>]*\bid="loginPassword"[^>]*?)\s+value="[^"]*"/, '$1');

  // ── Vá 3 chỗ chết trên màn hình đăng nhập (kiểm kê 18/09/2026) ──
  // `stripInlineHandlers` ở trên đã gỡ mọi `onclick` demo, nên các nút dưới đây
  // trở thành nút bấm-không-phản-ứng. Người dùng thật gặp ngõ cụt ngay cửa vào.

  // 1. "Quên mật khẩu?" đang trỏ href="#" → trỏ về trang thật.
  html = html.replace(
    /<a href="#"([^>]*)>Quên mật khẩu\?<\/a>/,
    '<a href="/forgot-password"$1>Quên mật khẩu?</a>',
  );

  // 2. Nút "Đăng nhập bằng Google / Microsoft SSO": Zeni ID hiện CHƯA mở OAuth
  //    (đã dò: /auth/google, /auth/oauth/google, /auth/providers đều 404).
  //    Gỡ hẳn nút còn hơn để người dùng bấm vào chỗ không dẫn đi đâu.
  //    ⚠ BÀI HỌC 19/09/2026 — regex cũ viết `<button class="login-btn"[^>]*>`
  //    rồi quét lười tới chữ "SSO". Nhưng NÚT ĐĂNG NHẬP THẬT (`id="loginBtn"`)
  //    cũng mang `class="login-btn"` và ĐỨNG TRƯỚC nút SSO ⇒ khớp từ nút đăng
  //    nhập, nuốt luôn cả nó. Kết quả trên bản chạy thật: màn hình đăng nhập
  //    KHÔNG CÒN NÚT NÀO để bấm. Nay neo vào `style="background:var(--w4)` —
  //    dấu hiệu CHỈ nút SSO mới có.
  html = html.replace(
    /<button class="login-btn" style="background:var\(--w4\)[\s\S]*?<\/button>/,
    '',
  );
  // …và gỡ luôn dải phân cách "HOẶC" của nút đó, không để đứng trơ một mình.
  html = html.replace(
    /<div style="display:flex;align-items:center;gap:12px;margin:14px 0 10px">[\s\S]*?HOẶC[\s\S]*?<\/div>\s*<\/div>/,
    '',
  );

  // ── Dọn tàn dư BẢN DỰNG DEMO trên màn hình đăng nhập thật ──
  // Ba thứ dưới đây khiến người dùng hiểu sai hoàn toàn cách đăng nhập.

  // 2a. Ô "Công ty": bản dựng cho chọn trong 8 công ty mẫu. Đăng nhập thật KHÔNG
  //     dùng ô này — tổ chức lấy từ hồ sơ người dùng trong dữ liệu. Để lại thì
  //     người dùng tưởng chọn sai công ty là không vào được.
  html = html.replace(
    /<label class="login-label">Công ty[\s\S]*?<\/select>/,
    '',
  );

  // 2b. Bộ chọn "Vai trò" (CHR-001 · CEO-001 · …): cũng của bản dựng. Vai trò
  //     thật do dữ liệu quyết định, bấm ở đây không đổi được quyền gì — để lại
  //     là hứa hão, tệ hơn nữa là gợi ý người dùng tự nhận quyền Chairman.
  //     Neo vào mốc CHẮC CHẮN đứng ngay sau khối vai trò (hàng "Giữ đăng nhập /
  //     Quên mật khẩu") thay vì đếm thẻ đóng — khối này có 8 ô lồng nhau, đếm
  //     `</div>` kiểu lười sẽ cắt sót 7 ô, để lại giao diện vỡ.
  html = html.replace(
    /<label class="login-label">Vai trò[\s\S]*?(?=<div style="display:flex;justify-content:space-between)/,
    '',
  );

  // 2c. Dòng "DEMO credentials: mọi field đều có default value…" — SAI SỰ THẬT
  //     trên bản chạy thật (không còn giá trị mặc định nào). Thay bằng câu nói
  //     đúng: đây là đăng nhập bằng tài khoản Zeni ID dùng chung hệ sinh thái.
  html = html.replace(
    /<div class="login-hint"[^>]*>[\s\S]*?DEMO credentials:[\s\S]*?<\/div>/,
    '<div class="login-hint" style="margin-top:14px">' +
      'Đăng nhập bằng <b style="color:var(--gold-b)">tài khoản Zeni ID</b> — một tài khoản dùng chung ' +
      'cho mọi sản phẩm Zeni Holdings (zenicloud.io · ZeniIPO · Zeni Digital).<br/>' +
      'Tổ chức và vai trò của bạn được lấy tự động từ hồ sơ, không cần chọn ở đây.' +
      '</div>',
  );

  // 2d. Câu phụ đề cũ nói về "tenant/RLS policy cấp row" — ngôn ngữ kỹ thuật nội
  //     bộ, người dùng thật không hiểu. Nói đúng việc họ cần làm.
  html = html.replace(
    /<p class="login-sub">[\s\S]*?<\/p>/,
    '<p class="login-sub">Dùng tài khoản Zeni ID của bạn. Dữ liệu mỗi tổ chức tách biệt hoàn toàn.</p>',
  );

  // (Liên kết sang trang đăng ký nằm ở `app/(auth)/login/login-form.tsx` —
  //  nút đăng nhập thật là component React, không phải nút tĩnh trong bản dựng.)

  return (_loginCache = html);
}

// Strip inline event handler attributes (onclick, onchange, onmouseover, etc.)
// We keep the HTML but remove any `on\w+="..."` attribute — our React wrappers
// attach real listeners via useEffect.
function stripInlineHandlers(html: string): string {
  return html.replace(/\s+on[a-z]+="[^"]*"/gi, '');
}

// ─────────────────────────────────────────────────────────────
// Modals / overlays — block AFTER `</main>` AFTER outer `</div>` and BEFORE
// `<script>`. Includes: trOvl, trDone (drill overlay + completion modal),
// agentModal, cmdPalette, flash, cmd-hint. Keeps inline handlers because
// V1Interactivity exposes the matching functions on `window`.
// ─────────────────────────────────────────────────────────────
let _modalsCache: string | null = null;

export function getModalsHtml(): string {
  if (_modalsCache != null) return _modalsCache;
  const src = loadSource();
  const mainClose = src.indexOf('</main>');
  if (mainClose < 0) {
    _modalsCache = '';
    return _modalsCache;
  }
  // Skip past `</main>\n\n</div>` to land on the first modal opener.
  const afterMain = src.indexOf('</div>', mainClose);
  const startSearch = afterMain >= 0 ? afterMain + '</div>'.length : mainClose + '</main>'.length;
  const scriptOpen = src.indexOf('<script>', startSearch);
  if (scriptOpen < 0) {
    _modalsCache = '';
    return _modalsCache;
  }
  _modalsCache = src.slice(startSearch, scriptOpen).trim();
  return _modalsCache;
}

// ─────────────────────────────────────────────────────────────
// Cosmic background — `<div class="cosmic"> … </div>` + SVG gradient defs
// ─────────────────────────────────────────────────────────────
let _cosmicCache: string | null = null;

export function getCosmicHtml(): string {
  if (_cosmicCache != null) return _cosmicCache;
  const src = loadSource();
  const cOpen = src.indexOf('<div class="cosmic">');
  const cEnd = findMatchingDivEnd(src, cOpen);
  const cosmic = src.slice(cOpen, cEnd);
  const svgOpen = src.indexOf('<svg width="0" height="0"', cEnd);
  let svg = '';
  if (svgOpen > 0) {
    const svgClose = src.indexOf('</svg>', svgOpen);
    svg = src.slice(svgOpen, svgClose + '</svg>'.length);
  }
  _cosmicCache = `${cosmic}\n${svg}`;
  return _cosmicCache;
}

// ─────────────────────────────────────────────────────────────
// Route map — pageId → Next.js route (under /(app)/)
// ─────────────────────────────────────────────────────────────
export const ROUTE_MAP: Record<string, string> = {
  dash: 'dashboard',
  northstar: 'northstar',
  okr: 'okrs',
  kpi: 'kpi-matrix',
  tasks: 'task-cascade',
  fundraise: 'governance',
  captable: 'cap-table',
  agents: 'users',
  schema: 'workflow',
  dataroom: 'data-room',
  council: 'council',
  roadmap: 'milestones',
  datafow: 'dataflow',
  team: 'team',
  sops: 'sops',
  investors: 'investors',
  pitch: 'pitch-deck',
  terms: 'terms',
  pnl: 'financials',
  burn: 'burn',
  unit: 'clv-cac',
  forecast: 'forecast',
  playbook: 'playbook',
  compliance: 'compliance',
  legal: 'legal',
  ipo: 'ipo-execution',
  board: 'board',
  audit: 'audit',
  training: 'training',
  sensitivity: 'sensitivity',
  vh: 'valuation',
  token: 'tokenomics',
  comparables: 'comparables',
  mktdata: 'market-data',
  mktintel: 'market-intel',
  nlq: 'nl-query',
  sales: 'sales',
  plv: 'billing',
  fclb: 'feedback',
  gvdoc: 'governance-docs',
  tcdoc: 'terms-docs',
  admin: 'admin',
  vault: 'vault',
  settings: 'settings',
};

// ─────────────────────────────────────────────────────────────
// Convert the sidebar HTML so `<div class="nav-it" data-page="X">...</div>`
// becomes `<a class="nav-it" href="/route">...</a>`. Used by Sidebar client
// component after it dangerously injects innerHTML (we pre-transform here
// instead of rewiring via JS listeners).
// ─────────────────────────────────────────────────────────────
export function rewriteSidebarForNextLinks(
  inner: string,
  opts?: { showConsole?: boolean },
): string {
  let out = inner;
  // Replace nav-it divs with <a> tags pointing at routes.
  out = out.replace(
    /<div\s+class="(nav-it(?:\s+act)?)"\s+data-page="([a-zA-Z0-9_-]+)"([^>]*)>([\s\S]*?)<\/div>/g,
    (match, cls, pageId, rest, body) => {
      const route = ROUTE_MAP[pageId as string];
      if (!route) return match;
      return `<a class="${cls}" data-page="${pageId}" data-route="/${route}" href="/${route}"${rest}>${body}</a>`;
    },
  );
  // Inject the new operating-system pages (no entry in v1 source.html) right
  // after Dashboard: Command Cockpit (unified) + the 7-chakra spine + core caps.
  const newLinks = [
    // Zeni Console — platform operator + holdings cockpit. Chairman-super only.
    ...(opts?.showConsole
      ? [{ route: 'console', page: 'console', ic: '⬡', tx: 'Zeni Console', pill: '<span class="pill new">ADMIN</span>' }]
      : []),
    { route: 'cockpit', page: 'cockpit', ic: '◉', tx: 'Command Cockpit', pill: '<span class="pill new">LIVE</span>' },
    { route: 'journey', page: 'journey', ic: '✦', tx: 'Hành trình 7 tầng', pill: '<span class="pill new">CORE</span>' },
    // Mô hình kinh doanh — màn hình của BƯỚC 1 theo `journey_phase_specs`.
    // API /api/canvas có từ lâu nhưng trước lần này KHÔNG trang nào gọi tới,
    // nên doanh nghiệp vào ZeniIPO không có đường đóng khung mô hình của mình.
    { route: 'bmc', page: 'bmc', ic: '▦', tx: 'Mô hình kinh doanh', pill: '<span class="pill new">BƯỚC 1</span>' },
    // Kế hoạch tài chính — cửa vào engine ba báo cáo. Trước lần này /api/plan,
    // /api/plan/run và /api/plan/publish KHÔNG có dòng giao diện nào gọi tới,
    // nên trên production `plan_versions` = 0: engine chưa chạy thật lần nào
    // và hợp đồng ba tầng gửi ZeniOS/ZeniERP chưa có gì để gửi.
    { route: 'plan', page: 'plan', ic: '▤', tx: 'Kế hoạch tài chính', pill: '<span class="pill new">3 BÁO CÁO</span>' },
    // Sẵn sàng niêm yết — nơi đính hồ sơ bằng chứng. Migration 038 đã tách
    // điểm "đã xác minh" khỏi điểm "tự khai" và chặn ở CSDL, nhưng
    // /api/readiness/compute và /api/readiness/criteria/[id] chưa có dòng giao
    // diện nào gọi tới, nên cả cơ chế đó nằm im không ai dùng được.
    { route: 'readiness', page: 'readiness', ic: '◎', tx: 'Sẵn sàng niêm yết', pill: '<span class="pill new">BƯỚC 8</span>' },
    // Vòng gọi vốn — cổng bước 6. /api/rounds trước đây mồ côi và trang mockup
    // hiện số tĩnh, nên doanh nghiệp không có cách nào tạo vòng, và cổng
    // `round_linked` không bao giờ qua được.
    { route: 'rounds', page: 'rounds', ic: '◈', tx: 'Vòng gọi vốn', pill: '<span class="pill new">BƯỚC 6</span>' },
    // Hai trang này có chức năng thật (xuất nhật ký kiểm toán, đổi mật khẩu &
    // xác thực hai bước) nhưng KHÔNG có href nào trỏ tới — người dùng chỉ vào
    // được nếu gõ tay URL.
    { route: 'audit-log', page: 'auditlog', ic: '☰', tx: 'Nhật ký kiểm toán', pill: '' },
    { route: 'settings-security', page: 'secset', ic: '⚿', tx: 'Bảo mật tài khoản', pill: '' },
    { route: 'financial-model', page: 'finmodel', ic: '∿', tx: 'Financial Model', pill: '<span class="pill">MC</span>' },
    { route: 'certificates', page: 'certs', ic: '🎓', tx: 'Chứng nhận', pill: '' },
  ]
    .map(
      (l) =>
        `<a class="nav-it" data-page="${l.page}" data-route="/${l.route}" href="/${l.route}">` +
        `<span class="ic">${l.ic}</span><span class="tx">${l.tx}</span>${l.pill}</a>`,
    )
    .join('');
  out = out.replace(/(<a class="nav-it act" data-page="dash"[\s\S]*?<\/a>)/, `$1${newLinks}`);
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
