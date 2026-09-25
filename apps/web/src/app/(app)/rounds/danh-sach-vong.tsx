'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * VÒNG GỌI VỐN — cổng bước 6 của hành trình Idea → IPO.
 *
 * `/api/roadmap` chấm cổng `round_linked` bằng "có vòng nào đang mở không", và
 * cổng `runway_9m` cũng coi một vòng đang mở là hợp lệ. Nhưng `/api/rounds`
 * KHÔNG có một dòng giao diện nào gọi tới, và trang mockup hiện số tĩnh —
 * nên doanh nghiệp không có cách nào tạo vòng gọi vốn, và bước 6 không bao
 * giờ qua được.
 *
 * ⚠ TIỀN Ở ĐÂY YẾT BẰNG ĐÔ LA. Vòng gọi vốn quốc tế yết theo USD nên bảng
 * `fundraise_rounds` dùng cột `*_usd` — ngoại lệ có chủ đích so với quy ước
 * "tiền là số nguyên VND". Ghi rõ đơn vị trên từng ô để không ai gõ nhầm
 * đồng thành đô.
 */

type Vong = {
  id: string
  round_name: string
  round_code: string
  status: string
  target_raise_usd: number | null
  actual_raise_usd: number | null
  pre_money_usd: number | null
  post_money_usd: number | null
  lead_investor: string | null
  target_close_date: string | null
}

const MA_VONG: Record<string, string> = {
  pre_seed: 'Tiền hạt giống', seed: 'Hạt giống', angel: 'Thiên thần',
  series_a: 'Series A', series_b: 'Series B', series_c: 'Series C',
  series_d: 'Series D', bridge: 'Vòng cầu', pre_ipo: 'Tiền niêm yết', ipo: 'Niêm yết',
}
const TRANG_THAI: Record<string, string> = {
  planning: 'Đang chuẩn bị', outreach: 'Đang tiếp cận', negotiating: 'Đang đàm phán',
  term_sheet: 'Có điều khoản', due_diligence: 'Đang thẩm định', signed: 'Đã ký',
  wired: 'Đã chuyển tiền', closed: 'Đã chốt', failed: 'Không thành',
}
/** Vòng "đang mở" theo đúng cách `/api/roadmap` chấm cổng bước 6. */
const DANG_MO = new Set(['planning', 'outreach', 'negotiating', 'term_sheet', 'due_diligence'])

const usd = (v: number | null) =>
  v == null ? '—' : '$' + new Intl.NumberFormat('vi-VN').format(v)

export function DanhSachVong() {
  const [ds, setDs] = useState<Vong[]>([])
  const [dangTai, setDangTai] = useState(true)
  const [ban, setBan] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [moForm, setMoForm] = useState(false)
  const [f, setF] = useState({
    round_name: '', round_code: 'seed', target_raise_usd: '',
    pre_money_usd: '', lead_investor: '', target_close_date: '',
  })

  const tai = useCallback(async () => {
    try {
      const res = await fetch('/api/rounds', { credentials: 'same-origin' })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error ?? 'Không tải được vòng gọi vốn')
      setDs((j.data ?? []) as Vong[])
      setLoi(null)
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Lỗi không rõ')
    } finally {
      setDangTai(false)
    }
  }, [])

  useEffect(() => { void tai() }, [tai])

  const tao = async () => {
    setBan(true); setLoi(null)
    try {
      const than: Record<string, unknown> = {
        round_name: f.round_name.trim(),
        round_code: f.round_code,
        target_raise_usd: Number(f.target_raise_usd),
      }
      if (f.pre_money_usd) than.pre_money_usd = Number(f.pre_money_usd)
      if (f.lead_investor.trim()) than.lead_investor = f.lead_investor.trim()
      if (f.target_close_date) than.target_close_date = f.target_close_date

      const res = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(than),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(typeof j?.error === 'string' ? j.error : JSON.stringify(j?.error))
      setMoForm(false)
      setF({ round_name: '', round_code: 'seed', target_raise_usd: '', pre_money_usd: '', lead_investor: '', target_close_date: '' })
      await tai()
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Tạo vòng thất bại')
    } finally { setBan(false) }
  }

  if (dangTai) return <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim">Đang tải vòng gọi vốn…</div>

  const soDangMo = ds.filter((v) => DANG_MO.has(v.status)).length

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-w8 bg-bg-2 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] text-xs text-ink-dim">
          {soDangMo > 0 ? (
            <>
              <span className="text-gold-light">{soDangMo}</span> vòng đang mở — cổng bước 6 của hành trình đã đạt.
            </>
          ) : (
            'Chưa có vòng nào đang mở. Cổng bước 6 (Tài chính &amp; chiến lược vốn) cần ít nhất một vòng đang mở.'
          )}
        </div>
        <button onClick={() => setMoForm((v) => !v)}
          className="rounded border border-gold/50 px-3 py-1.5 text-xs text-gold-light hover:bg-gold/10">
          {moForm ? 'Đóng' : 'Mở vòng gọi vốn'}
        </button>
      </div>

      {loi && <div className="rounded-xl border border-red-700 bg-red-900/30 p-3 text-xs text-red-200 whitespace-pre-wrap">{loi}</div>}

      {moForm && (
        <div className="rounded-xl border border-w8 bg-bg-2 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-2xs text-ink-dim">
              Tên vòng
              <input value={f.round_name} onChange={(e) => setF({ ...f, round_name: e.target.value })}
                placeholder="Vòng hạt giống 2027"
                className="mt-1 w-full rounded border border-w8 bg-transparent px-2 py-1 text-xs text-ink" />
            </label>
            <label className="text-2xs text-ink-dim">
              Loại vòng
              <select value={f.round_code} onChange={(e) => setF({ ...f, round_code: e.target.value })}
                className="mt-1 w-full rounded border border-w8 bg-transparent px-2 py-1 text-xs text-ink">
                {Object.entries(MA_VONG).map(([k, v]) => (
                  <option key={k} value={k} className="bg-bg-2">{v}</option>
                ))}
              </select>
            </label>
            <label className="text-2xs text-ink-dim">
              Mục tiêu huy động <span className="text-gold-light">(đô la)</span>
              <input value={f.target_raise_usd} onChange={(e) => setF({ ...f, target_raise_usd: e.target.value })}
                inputMode="numeric" placeholder="2000000"
                className="mt-1 w-full rounded border border-w8 bg-transparent px-2 py-1 text-xs text-ink" />
            </label>
            <label className="text-2xs text-ink-dim">
              Định giá trước tiền <span className="text-gold-light">(đô la)</span>
              <input value={f.pre_money_usd} onChange={(e) => setF({ ...f, pre_money_usd: e.target.value })}
                inputMode="numeric" placeholder="10000000"
                className="mt-1 w-full rounded border border-w8 bg-transparent px-2 py-1 text-xs text-ink" />
            </label>
            <label className="text-2xs text-ink-dim">
              Nhà đầu tư dẫn dắt
              <input value={f.lead_investor} onChange={(e) => setF({ ...f, lead_investor: e.target.value })}
                className="mt-1 w-full rounded border border-w8 bg-transparent px-2 py-1 text-xs text-ink" />
            </label>
            <label className="text-2xs text-ink-dim">
              Ngày dự kiến chốt
              <input type="date" value={f.target_close_date} onChange={(e) => setF({ ...f, target_close_date: e.target.value })}
                className="mt-1 w-full rounded border border-w8 bg-transparent px-2 py-1 text-xs text-ink" />
            </label>
          </div>
          <button onClick={tao} disabled={ban || !f.round_name.trim() || !f.target_raise_usd}
            className="rounded border border-gold px-3 py-1.5 text-xs text-gold-light hover:bg-gold/20 disabled:opacity-40">
            {ban ? 'Đang tạo…' : 'Tạo vòng'}
          </button>
        </div>
      )}

      {ds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim text-sm">
          Chưa có vòng gọi vốn nào.
        </div>
      ) : (
        <div className="rounded-xl border border-w8 bg-bg-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-dim text-left border-b border-w8">
                <th className="p-3 font-normal">Vòng</th>
                <th className="p-3 font-normal">Loại</th>
                <th className="p-3 font-normal">Trạng thái</th>
                <th className="p-3 font-normal text-right">Mục tiêu</th>
                <th className="p-3 font-normal text-right">Đã huy động</th>
                <th className="p-3 font-normal text-right">Trước tiền</th>
                <th className="p-3 font-normal">Dẫn dắt</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((v) => (
                <tr key={v.id} className="border-b border-w8/50 text-ink">
                  <td className="p-3">{v.round_name}</td>
                  <td className="p-3 text-ink-dim">{MA_VONG[v.round_code] ?? v.round_code}</td>
                  <td className="p-3">
                    <span className={DANG_MO.has(v.status) ? 'text-gold-light' : 'text-ink-dim'}>
                      {TRANG_THAI[v.status] ?? v.status}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{usd(v.target_raise_usd)}</td>
                  <td className="p-3 text-right tabular-nums">{usd(v.actual_raise_usd)}</td>
                  <td className="p-3 text-right tabular-nums">{usd(v.pre_money_usd)}</td>
                  <td className="p-3 text-ink-dim">{v.lead_investor ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
