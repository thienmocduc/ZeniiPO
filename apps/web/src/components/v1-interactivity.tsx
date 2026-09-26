'use client';

/**
 * V1Interactivity — runs the v1_8_FULL `<script>` block in the browser so all
 * the inline `onclick="openAgentModal('strategy')"` / `onclick="toggleKP(...)"`
 * etc. handlers resolve at runtime. The script also wires up the role
 * dropdown, the command palette, the agent modal, the training drills, the
 * cascade input, and the keyboard shortcuts.
 *
 * Strategy:
 *   1) Server reads the script via `getV1Script()` and passes the raw text in.
 *   2) We run a small set of transforms here on the client:
 *        - skip the Stars block (CosmosBg already renders #stars + animates)
 *        - skip the auto-run `setRole` (we don't have the same login flow)
 *        - skip the `nav-it[data-page]` click wiring (Next router handles nav)
 *        - skip the loginBtn / loginCompany / role-pick wiring (LoginForm
 *          handles auth via Supabase)
 *        - hoist `function foo(...)` declarations onto `window.foo` so inline
 *          onclick attributes can resolve them
 *        - block any window.location reassignments (no full reloads)
 *   3) Execute via `new Function('window', cleaned).call(window, window)`.
 *      Errors are caught — a missing element on one page must not break the
 *      other handlers.
 *   4) Re-run on every pathname change so newly-mounted pages get their
 *      delegated handlers (the script attaches listeners to elements that
 *      may not have existed on previous mounts).
 *
 * SSR-safe: we are a Client Component and only touch `window` inside
 * `useEffect`.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trangCoHamVaThat } from '@/components/v1-data-bind';

type Props = { script: string };

let _executed = false;

function transformScript(raw: string): string {
  let s = raw;

  // 1) Skip the Stars init — CosmosBg already builds `.star` divs in #stars.
  //    The block is the very first thing in the script:
  //      const stars = document.getElementById('stars');
  //      for (let i = 0; i < 80; i++) { ... stars.appendChild(s); }
  s = s.replace(
    /const stars = document\.getElementById\('stars'\);[\s\S]*?stars\.appendChild\(s\);\s*\}/,
    '/* stars — handled by CosmosBg */',
  );

  // 2) Skip the loginCompany domain auto-fill listener (LoginForm handles it).
  s = s.replace(
    /document\.getElementById\('loginCompany'\)\.addEventListener[\s\S]*?\}\);/,
    '/* loginCompany — handled by LoginForm */',
  );

  // 3) Skip the role-pick click handler (LoginForm handles it).
  s = s.replace(
    /document\.querySelectorAll\('\.role-pick'\)\.forEach\(p => \{[\s\S]*?\}\);\s*\}\);/,
    '/* role-pick — handled by LoginForm */',
  );

  // 4) Skip the loginBtn click handler (LoginForm uses Supabase auth).
  s = s.replace(
    /document\.getElementById\('loginBtn'\)\.addEventListener[\s\S]*?\}\);/,
    '/* loginBtn — handled by LoginForm */',
  );

  // 5) Skip the nav-it click handler (Next router handles routing in Sidebar).
  s = s.replace(
    /document\.querySelectorAll\('\.nav-it\[data-page\]'\)\.forEach\(it => \{[\s\S]*?\}\);\s*\}\);/,
    '/* nav-it click — handled by Sidebar (Next router) */',
  );

  // 6) Block any window.location reassignment to prevent full page reloads.
  s = s.replace(/window\.location\s*=\s*[^;]+;/g, '/* nav blocked */;');

  // 7) Hoist top-level function declarations onto `window` so inline
  //    onclick="foo()" attributes resolve. We match `function NAME(args) {`
  //    only when it appears at the start of a line — top-level.
  //    (Inner functions inside another function won't match because they're
  //    indented.) JS hoists function decls inside `new Function(...)` to the
  //    top of the function's scope, so we can prepend `window.NAME = NAME;`
  //    even though the actual `function NAME() {}` appears later in the text.
  const FUNC_RE = /^function\s+([a-zA-Z_$][\w$]*)\s*\(/gm;
  const fnNames = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = FUNC_RE.exec(s)) !== null) {
    fnNames.add(m[1]);
  }
  // Same for `async function NAME(`.
  const AFN_RE = /^async\s+function\s+([a-zA-Z_$][\w$]*)\s*\(/gm;
  while ((m = AFN_RE.exec(s)) !== null) {
    fnNames.add(m[1]);
  }
  // Prepend a hoist block (BEFORE any imperative listener-attach lines that
  // could throw if their target element is missing — that way functions are
  // exposed on `window` even if a later attach fails).
  if (fnNames.size > 0) {
    const hoist = Array.from(fnNames)
      .map((n) => `try { window.${n} = ${n}; } catch(e) {}`)
      .join('\n');
    s = '/* hoist top-level fns onto window for inline onclick */\n' + hoist + '\n\n' + s;
  }

  // 8) Wrap risky top-level DOM-init lines that crash if a target element is
  //    missing. We turn each `document.getElementById(...).addEventListener`
  //    or `roleSw.addEventListener` style standalone statement (top-level
  //    only — i.e. starting at column 0) into a try/catch. This keeps later
  //    statements running if an earlier one throws.
  s = s.replace(
    /^(document\.getElementById\([^)]*\)\.addEventListener[\s\S]*?\}\);)$/gm,
    'try { $1 } catch(e) { console.warn("[v1] listener error:", e); }',
  );
  s = s.replace(
    /^(document\.querySelectorAll\([^)]*\)\.forEach[\s\S]*?\}\);\s*\}\);)$/gm,
    'try { $1 } catch(e) { console.warn("[v1] querySelectorAll error:", e); }',
  );
  s = s.replace(
    /^(roleSw\.addEventListener[\s\S]*?\}\);)$/gm,
    'try { $1 } catch(e) {}',
  );
  s = s.replace(
    /^(cmdInput\.addEventListener[\s\S]*?\}\);)$/gm,
    'try { $1 } catch(e) {}',
  );
  s = s.replace(
    /^(cmdPalette\.addEventListener[\s\S]*?\}\);)$/gm,
    'try { $1 } catch(e) {}',
  );

  // 9) VÔ HIỆU HOÁ ba hàm dựng minh hoạ, vì `setRole()` gọi THẲNG chúng.
  //
  // Chặn ở tầng React không đủ: `setRole` (dòng ~5985 của source.html) gọi
  // `renderOKRPage(role)` bằng chính binding cục bộ trong script, không qua
  // `window`. Nên mỗi lần người dùng đổi vai trên thanh trên, dữ liệu minh hoạ
  // CỨNG (`OKR_TREE`, `TASKS_BY_ROLE`) dựng lại DOM và ghi đè dữ liệu thật mà
  // hàm vá vừa nạp. Việc này vừa thành rủi ro cụ thể: chuỗi phân rã (migration
  // 046/047) nay sinh OKR thật cho từng vai và `/okr` là nơi nó phải hiện ra.
  //
  // ⚠ KHÔNG gọt thân hàm bằng regex — đã có bài học: regex gỡ nút SSO từng xoá
  // luôn nút Đăng nhập. Ở đây chỉ GÁN LẠI tên hàm ở cuối script. Khai báo hàm
  // trong phạm vi `new Function` là binding gán lại được, nên `setRole` sẽ gọi
  // vào hàm rỗng mà không cần sửa một ký tự nào trong thân hàm gốc.
  //
  // `renderDashboard` CỐ Ý GIỮ NGUYÊN: `page-dash` không có hàm vá thật nào, gỡ
  // nó đi là làm trắng bảng điều khiển.
  s +=
    '\n\n/* vô hiệu hoá hàm dựng minh hoạ trên trang đã có hàm vá thật */\n' +
    'try { renderOKRPage = function(){}; window.renderOKRPage = renderOKRPage; } catch(e) {}\n' +
    'try { renderTasksPage = function(){}; window.renderTasksPage = renderTasksPage; } catch(e) {}\n' +
    'try { filterAgentsPage = function(){}; window.filterAgentsPage = filterAgentsPage; } catch(e) {}\n';

  return s;
}

/** Lộ hàm biến đổi ra để test canh được — nó là chỗ dễ vỡ nhất của tệp này. */
export const _chiDungChoTest = { transformScript };

export function V1Interactivity({ script }: Props) {
  const pathname = usePathname();

  // First-execute the cleaned script (once per browser session).
  useEffect(() => {
    if (_executed) return;
    _executed = true;
    try {
      const cleaned = transformScript(script);
      // `new Function` runs in non-strict mode at function scope. We pass
      // `window` so the body can read it, and we call with `window` as
      // `this` so any `this.X` references resolve.
      const fn = new Function('window', cleaned);
      fn.call(window, window);
    } catch (err) {
      console.warn('[v1-interactivity] script execution error:', err);
    }
  }, [script]);

  // On every pathname change, run the per-page side-effects: the chairman's
  // script `setRole(...)` re-renders dashboard / OKR / tasks / agents and
  // re-applies the nav filter. Calling it again ensures pages mounted later
  // get re-rendered with current role data. We also re-inject knowledge
  // panels which depend on `.ph` headers existing in newly mounted pages.
  useEffect(() => {
    if (!_executed) return;
    const w = window as Window & {
      currentRole?: string;
      setRole?: (r: string) => void;
      injectKnowledgePanels?: () => void;
      renderTrainingHub?: () => void;
      renderDashboard?: (r: string) => void;
      renderOKRPage?: (r: string) => void;
      renderTasksPage?: (r: string) => void;
      filterAgentsPage?: (r: string) => void;
      applyNavFilter?: (r: string) => void;
      refreshKnowledgePanelDefaults?: () => void;
    };
    const role = w.currentRole || 'chr';

    /**
     * ⚠ KHÔNG chạy hàm dựng minh hoạ trên trang đã có hàm vá dữ liệu THẬT.
     *
     * `renderOKRPage` / `renderTasksPage` / `filterAgentsPage` trong `source.html`
     * DỰNG LẠI cả cấu trúc DOM từ dữ liệu minh hoạ CỨNG (`OKR_TREE`,
     * `TASKS_BY_ROLE`). Hàm vá thật nạp dữ liệu KHÔNG ĐỒNG BỘ nên thường về sau
     * và thắng — nhưng đó là thắng do may về thời điểm, không do thiết kế. Mỗi
     * lần hiệu ứng chạy lại (đổi trang rồi quay lại, đổi vai) là một lần dữ liệu
     * minh hoạ có thể ghi đè dữ liệu thật.
     *
     * Chuyện này vừa thành rủi ro cụ thể: chuỗi phân rã mục tiêu (migration
     * 046/047) nay sinh OKR thật cho từng vai, và `/okr` là nơi nó phải hiện ra.
     * Để `OKR_TREE` cứng ghi đè lên đó thì chủ tịch xem thấy cây của công ty mẫu.
     *
     * Danh sách trang lấy từ chính nơi khai hàm vá (`trangCoHamVaThat`), không gõ
     * lại — gõ lại là để hai danh sách lệch nhau về sau.
     */
    const coHamVaThat = new Set(trangCoHamVaThat());
    const boQua = (pageId: string) => coHamVaThat.has(`page-${pageId}`);

    [
      // `page-dash` KHÔNG có hàm vá thật, nên vẫn cần hàm dựng này.
      () => (boQua('dash') ? undefined : w.renderDashboard?.(role)),
      () => (boQua('okr') ? undefined : w.renderOKRPage?.(role)),
      () => (boQua('tasks') ? undefined : w.renderTasksPage?.(role)),
      () => (boQua('agents') ? undefined : w.filterAgentsPage?.(role)),
      () => w.applyNavFilter?.(role),
      () => w.injectKnowledgePanels?.(),
      () => w.refreshKnowledgePanelDefaults?.(),
      () => {
        if (pathname?.startsWith('/training')) w.renderTrainingHub?.();
      },
    ].forEach((fn) => {
      try {
        fn();
      } catch {
        /* missing element on this page — ignore */
      }
    });
  }, [pathname]);

  return null;
}
