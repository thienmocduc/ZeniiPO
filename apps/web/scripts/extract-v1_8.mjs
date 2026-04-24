#!/usr/bin/env node
/**
 * extract-v1_8.mjs
 *
 * Refresh the local copy of the chairman's authoritative v1_8_FULL.html and
 * regenerate the 43 route page.tsx wrappers under apps/web/src/app/(app)/.
 *
 * The actual HTML / CSS extraction happens at request time inside
 * src/lib/v1/extract.ts (via readFileSync on src/lib/v1/source.html). This
 * script's job is simply to:
 *   1) copy _source/zeniipo_ui_product_v1_8_FULL.html → src/lib/v1/source.html
 *   2) write a tiny `export default () => <V1Page pageId="..." />` wrapper
 *      for every route in ROUTE_MAP (idempotent).
 *   3) Optionally emit a static src/app/v1-styles.css (if --emit-css passed)
 *      by slicing the first <style>..</style> block out of source.html.
 *
 * Invocation: node apps/web/scripts/extract-v1_8.mjs [--emit-css]
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');            // apps/web
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');      // repo root
const SRC_HTML = resolve(REPO_ROOT, '_source', 'zeniipo_ui_product_v1_8_FULL.html');
const DEST_HTML = resolve(WEB_ROOT, 'src', 'lib', 'v1', 'source.html');

// Route map — page-id in v1_8_FULL.html → Next.js (app) route folder.
const ROUTE_MAP = {
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

function step(n, msg) {
  console.log(`[${n}] ${msg}`);
}

// 1) Copy source HTML
mkdirSync(dirname(DEST_HTML), { recursive: true });
copyFileSync(SRC_HTML, DEST_HTML);
step(1, `copied ${SRC_HTML} → ${DEST_HTML}`);

// 2) Write per-route page.tsx wrappers
const pageTemplate = (pageId) => `import { V1Page } from '@/lib/v1/Page';

export default function Page() {
  return <V1Page pageId="${pageId}" />;
}
`;

let written = 0;
for (const [pageId, route] of Object.entries(ROUTE_MAP)) {
  const dir = resolve(WEB_ROOT, 'src', 'app', '(app)', route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'page.tsx'), pageTemplate(pageId), 'utf8');
  written++;
}
step(2, `wrote ${written} page.tsx wrappers under src/app/(app)/`);

// 3) Optional: emit src/app/v1-styles.css static file
if (process.argv.includes('--emit-css')) {
  const src = readFileSync(DEST_HTML, 'utf8');
  const a = src.indexOf('<style>');
  const b = src.indexOf('</style>', a);
  const css = src.slice(a + '<style>'.length, b);
  const out = resolve(WEB_ROOT, 'src', 'app', 'v1-styles.css');
  writeFileSync(out, css, 'utf8');
  step(3, `emitted CSS (${css.split('\n').length} lines) → ${out}`);
}

console.log('\nDone. No build step needed — src/lib/v1/extract.ts reads the');
console.log('source HTML at request time, so the app renders v1_8_FULL markup');
console.log('byte-for-byte without any conversion pass.');
