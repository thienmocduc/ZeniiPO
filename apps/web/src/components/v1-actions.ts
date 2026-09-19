/**
 * v1-actions.ts — shared client helpers so V1 (static-HTML) pages get REAL
 * create/edit/delete actions. The patchers in v1-data-bind.tsx import these to
 * turn demo buttons into working CRUD: open a themed modal form → POST/PATCH/
 * DELETE a real API → refresh the page's data.
 *
 * Pure DOM (no React) so it composes with the dangerouslySetInnerHTML pages.
 * Styling uses the v1 CSS variables so modals match the app theme.
 */

export type Field = {
  name: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select'
  options?: Array<{ value: string; label: string }>
  required?: boolean
  value?: string | number | null
  placeholder?: string
  step?: string
}

const css = `
.za-overlay{position:fixed;inset:0;z-index:9999;background:rgba(3,6,14,.66);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}
.za-modal{width:min(520px,94vw);max-height:88vh;overflow:auto;background:var(--panel,#11151f);border:1px solid var(--w8,rgba(180,190,220,.14));border-radius:14px;padding:22px 24px;box-shadow:0 24px 64px rgba(0,0,0,.5)}
.za-modal h3{font-family:var(--fb,inherit);font-size:1.05rem;color:var(--ink,#ece9e0);margin:0 0 14px}
.za-f{margin-bottom:12px}
.za-f label{display:block;font-size:.7rem;letter-spacing:.04em;text-transform:uppercase;color:var(--dim,#737b8e);margin-bottom:4px}
.za-f input,.za-f textarea,.za-f select{width:100%;background:var(--bg,#0a0e18);border:1px solid var(--w8,rgba(180,190,220,.14));border-radius:8px;padding:9px 11px;color:var(--ink,#ece9e0);font-size:.86rem;outline:none}
.za-f input:focus,.za-f textarea:focus,.za-f select:focus{border-color:var(--gold,#e4c16e)}
.za-f textarea{min-height:78px;resize:vertical}
.za-err{color:var(--err,#e0685f);font-size:.76rem;margin:6px 0 0}
.za-row{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
.za-btn{border-radius:8px;padding:9px 16px;font-size:.84rem;font-weight:600;cursor:pointer;border:1px solid var(--w8,rgba(180,190,220,.14));background:transparent;color:var(--ink-2,#b3b2aa)}
.za-btn.pri{background:var(--gold,#e4c16e);color:#0c0a08;border-color:transparent}
.za-btn[disabled]{opacity:.5;cursor:not-allowed}
.za-toast{position:fixed;bottom:22px;right:22px;z-index:10000;padding:11px 16px;border-radius:9px;font-size:.84rem;color:#0c0a08;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.4);animation:zaIn .2s ease}
.za-toast.ok{background:var(--ok,#4fc79a)}.za-toast.err{background:var(--err,#e0685f);color:#fff}
@keyframes zaIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`

function ensureStyles() {
  if (document.getElementById('za-styles')) return
  const s = document.createElement('style')
  s.id = 'za-styles'
  s.textContent = css
  document.head.appendChild(s)
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Open a themed modal form. Resolves with the entered values, or null if cancelled. */
export function openFormModal(opts: { title: string; fields: Field[]; submitLabel?: string }): Promise<Record<string, string> | null> {
  ensureStyles()
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'za-overlay'
    const fieldsHtml = opts.fields
      .map((f) => {
        const id = `za-${f.name}`
        const req = f.required ? ' required' : ''
        let control: string
        if (f.type === 'textarea') {
          control = `<textarea id="${id}" name="${f.name}" placeholder="${esc(f.placeholder)}"${req}>${esc(f.value)}</textarea>`
        } else if (f.type === 'select') {
          const opts2 = (f.options ?? []).map((o) => `<option value="${esc(o.value)}"${String(f.value) === o.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')
          control = `<select id="${id}" name="${f.name}"${req}>${opts2}</select>`
        } else {
          const step = f.type === 'number' ? ` step="${f.step ?? 'any'}"` : ''
          control = `<input id="${id}" name="${f.name}" type="${f.type ?? 'text'}"${step} placeholder="${esc(f.placeholder)}" value="${esc(f.value)}"${req}/>`
        }
        return `<div class="za-f"><label for="${id}">${esc(f.label)}</label>${control}</div>`
      })
      .join('')
    overlay.innerHTML = `<div class="za-modal" role="dialog" aria-modal="true">
      <h3>${esc(opts.title)}</h3>
      <form class="za-form">${fieldsHtml}<div class="za-err" style="display:none"></div>
        <div class="za-row">
          <button type="button" class="za-btn" data-act="cancel">Huỷ</button>
          <button type="submit" class="za-btn pri">${esc(opts.submitLabel ?? 'Lưu')}</button>
        </div>
      </form></div>`

    const close = (val: Record<string, string> | null) => {
      overlay.remove()
      document.removeEventListener('keydown', onKey)
      resolve(val)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null) }
    document.addEventListener('keydown', onKey)
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null) })
    overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', () => close(null))

    const form = overlay.querySelector('form') as HTMLFormElement
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const values: Record<string, string> = {}
      for (const f of opts.fields) {
        const el = overlay.querySelector<HTMLInputElement>(`#za-${f.name}`)
        const v = (el?.value ?? '').trim()
        if (f.required && !v) {
          const errEl = overlay.querySelector('.za-err') as HTMLElement
          errEl.textContent = `Thiếu: ${f.label}`
          errEl.style.display = 'block'
          el?.focus()
          return
        }
        values[f.name] = v
      }
      close(values)
    })

    document.body.appendChild(overlay)
    overlay.querySelector<HTMLElement>('input,textarea,select')?.focus()
  })
}

/** fetch wrapper returning {ok,data,error}. Never throws. */
export async function apiSend(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    })
    const j = (await res.json().catch(() => ({}))) as { data?: unknown; error?: unknown }
    if (!res.ok) {
      const err = typeof j.error === 'string' ? j.error : j.error ? JSON.stringify(j.error) : `HTTP ${res.status}`
      return { ok: false, error: err }
    }
    return { ok: true, data: j.data ?? j }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export function toast(msg: string, type: 'ok' | 'err' = 'ok') {
  ensureStyles()
  const t = document.createElement('div')
  t.className = `za-toast ${type}`
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

/** Attach a click handler once (idempotent — safe to call on every patch). */
export function wireClick(root: ParentNode, selector: string, handler: (e: Event) => void | Promise<void>) {
  const el = root.querySelector<HTMLElement>(selector)
  if (el && el.dataset.zaWired !== '1') {
    el.dataset.zaWired = '1'
    el.addEventListener('click', (e) => { void handler(e) })
  }
  return Boolean(el)
}

/** Find a button/link whose visible text contains `text` and wire a click handler once. */
export function wireButtonByText(root: ParentNode, text: string, handler: (e: Event) => void | Promise<void>): boolean {
  const cands = Array.from(root.querySelectorAll<HTMLElement>('button, a.btn, .btn, .mhead-r button, .card-h button'))
  const needle = text.toLowerCase()
  const el = cands.find((b) => (b.textContent ?? '').toLowerCase().includes(needle))
  if (el && el.dataset.zaWired !== '1') {
    el.dataset.zaWired = '1'
    el.addEventListener('click', (e) => { e.preventDefault(); void handler(e) })
    return true
  }
  return Boolean(el)
}

/** Wire all elements matching selector (idempotent). Handler gets the element. */
export function wireEach(root: ParentNode, selector: string, handler: (el: HTMLElement, e: Event) => void | Promise<void>) {
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (el.dataset.zaWired === '1') return
    el.dataset.zaWired = '1'
    el.addEventListener('click', (e) => { e.preventDefault(); void handler(el, e) })
  })
}

/** Convenience numeric coerce for modal string values. */
export const num = (v: string | undefined): number | undefined => {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Guarantee an action button exists in the page header (`.ph-r`), regardless
 * of what demo buttons the static HTML shipped with. Idempotent by id —
 * re-patching only rebinds the handler onto the same element.
 */
export function ensureHeaderButton(
  root: ParentNode,
  id: string,
  label: string,
  handler: () => void | Promise<void>,
): void {
  let btn = (root as HTMLElement).querySelector<HTMLButtonElement>(`#${id}`)
  if (!btn) {
    btn = document.createElement('button')
    btn.id = id
    btn.className = 'btn btn-pri'
    btn.textContent = label
    // Bản dựng có HAI kiểu khung tiêu đề: `.ph/.ph-r` (trang đời đầu) và
    // `.mhead/.mhead-r` (nhóm trang làm sau). Trước đây chỉ tìm `.ph-r`/`.ph`
    // nên ở 7 trang dùng khung mới (token, plv, mktdata, mktintel, nlq, sales,
    // fclb) nút bị rơi xuống CUỐI TRANG, người dùng không thấy đâu mà bấm.
    const host =
      (root as HTMLElement).querySelector('.ph-r') ??
      (root as HTMLElement).querySelector('.mhead-r') ??
      (root as HTMLElement).querySelector('.ph') ??
      (root as HTMLElement).querySelector('.mhead') ??
      (root as HTMLElement)
    host.appendChild(btn)
  }
  if (btn.dataset.zaWired !== '1') {
    btn.dataset.zaWired = '1'
    btn.addEventListener('click', (e) => { e.preventDefault(); void handler() })
  }
}
