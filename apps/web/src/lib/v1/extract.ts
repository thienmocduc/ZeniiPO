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
  _topbarCache = stripInlineHandlers(src.slice(open, close));
  return _topbarCache;
}

// ─────────────────────────────────────────────────────────────
// Login — `<div class="login" id="login"> … </div>` (full element including wrapper)
// ─────────────────────────────────────────────────────────────
let _loginCache: string | null = null;

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
export function rewriteSidebarForNextLinks(inner: string): string {
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
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
