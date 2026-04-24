/**
 * v1/getScript — server helper that reads the inline `<script>` block from
 * v1_8_FULL.html and returns it as a string. Cached per-process.
 *
 * The block contains all the interactivity (drills, role switcher, agent
 * modals, command palette, knowledge panels, cascade input, etc.). We hand
 * the raw text off to a client component (`V1Interactivity`) that pre-cleans
 * it (removes pieces handled by Next/React: routing, login auth, stars
 * generation) and executes the rest in the browser via `new Function(...)`
 * so the wired-up onclick handlers and global functions become live.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let _cached: string | null = null;

export function getV1Script(): string {
  if (_cached != null) return _cached;
  const candidates = [
    resolve(process.cwd(), 'src', 'lib', 'v1', 'source.html'),
    resolve(process.cwd(), 'apps', 'web', 'src', 'lib', 'v1', 'source.html'),
  ];
  let html: string | null = null;
  let lastErr: unknown = null;
  for (const p of candidates) {
    try {
      html = readFileSync(p, 'utf8');
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (html == null) {
    throw new Error(
      `v1/source.html not found for getV1Script. Tried: ${candidates.join(', ')}. Last error: ${String(lastErr)}`,
    );
  }
  // Find the LAST <script>...</script> block — there's only one but use last
  // for safety. Skip the opening tag (8 chars) to capture pure JS body.
  const start = html.indexOf('<script>');
  const end = html.lastIndexOf('</script>');
  if (start < 0 || end < 0 || end < start) {
    throw new Error('v1/source.html missing <script> block');
  }
  _cached = html.slice(start + '<script>'.length, end);
  return _cached;
}
