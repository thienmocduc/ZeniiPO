'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * PHÒNG LÀM VIỆC KẾ HOẠCH TÀI CHÍNH — cửa vào engine ba báo cáo.
 *
 * Trước trang này, `/api/plan`, `/api/plan/run` và `/api/plan/publish` KHÔNG
 * có một dòng giao diện nào gọi tới. Engine tài chính — thứ sinh ra chỉ tiêu
 * gửi sang ZeniOS/ZeniERP qua hợp đồng ba tầng — chưa chạy thật lần nào, và
 * trên production `plan_versions` = 0.
 *
 * Luồng đúng, đi từ trái sang phải:
 *   1. Tạo bản kế hoạch (tầm nhìn + tháng bắt đầu)
 *   2. Khai giả định (tiền đầu kỳ, vòng quay vốn lưu động, khấu hao)
 *   3. Thêm dòng doanh thu / chi phí / mua tài sản
 *   4. Chạy engine → xem ba báo cáo + ba kịch bản
 *   5. Chốt bản → sinh chỉ tiêu, KHOÁ VĨNH VIỄN
 */

type Version = {
  id: string
  version_no: number
  name: string
  status: string
  horizon_months: number
  start_period: string
}
type CoaLine = { code: string; label_vi: string; statement: string; category: string | null }
type Line = { id: string; coa_line: string; label_vi: string; driver_type: string; driver_config: Record<string, unknown> }
type Assumption = { key: string; label_vi: string; unit: string; value_base: number }
type DanhMucGiaDinh = { key: string; nhan: string; donVi: string; min: number; max: number }
type KetQua = {
  scenario: string
  summary: {
    total_revenue: number
    total_ebitda: number
    ebitda_positive_month: number | null
    cash_negative_month: number | null
    closing_cash: number
    peak_funding_need: number
  }
  yearly: Array<{ year: number; revenue: number; cogs: number; ebitda: number; net_income: number; closing_cash: number }>
  months: Array<{
    month: number
    period: string
    total_assets: number
    total_liabilities: number
    total_equity: number
    cash: number
  }>
  scenarios: Record<string, { total_revenue: number; closing_cash: number; peak_funding_need: number }>
  source: string
}

const tien = (v: number) => new Intl.NumberFormat('vi-VN').format(Math.round(v)) + ' đ'

/** Trường nhập của từng kiểu động lực — khớp union `Driver` của engine. */
const DONG_LUC: Record<string, { nhan: string; truong: Array<{ k: string; nhan: string; mac_dinh: number }> }> = {
  fixed_schedule: { nhan: 'Cố định hằng tháng', truong: [
    { k: 'monthly_vnd', nhan: 'Số tiền mỗi tháng (đ)', mac_dinh: 0 },
    { k: 'growth_pct_m', nhan: 'Tăng trưởng %/tháng', mac_dinh: 0 },
  ] },
  pct_of_revenue: { nhan: '% doanh thu', truong: [{ k: 'pct', nhan: 'Phần trăm doanh thu', mac_dinh: 0 }] },
  price_volume: { nhan: 'Giá × sản lượng', truong: [
    { k: 'price_vnd', nhan: 'Đơn giá (đ)', mac_dinh: 0 },
    { k: 'volume_month1', nhan: 'Sản lượng tháng 1', mac_dinh: 0 },
    { k: 'growth_pct_m', nhan: 'Tăng trưởng %/tháng', mac_dinh: 0 },
  ] },
  saas_mrr: { nhan: 'Doanh thu định kỳ', truong: [
    { k: 'mrr_month1_vnd', nhan: 'Doanh thu định kỳ tháng 1 (đ)', mac_dinh: 0 },
    { k: 'new_rate_pct', nhan: 'Tỷ lệ thêm mới %/tháng', mac_dinh: 0 },
    { k: 'churn_rate_pct', nhan: 'Tỷ lệ rời bỏ %/tháng', mac_dinh: 0 },
  ] },
  headcount: { nhan: 'Theo nhân sự', truong: [
    { k: 'headcount_month1', nhan: 'Số người tháng 1', mac_dinh: 0 },
    { k: 'salary_vnd', nhan: 'Lương bình quân (đ)', mac_dinh: 0 },
    { k: 'insurance_pct', nhan: 'Bảo hiểm %', mac_dinh: 21.5 },
    { k: 'hires_per_month', nhan: 'Tuyển thêm mỗi tháng', mac_dinh: 0 },
  ] },
  cac_driven: { nhan: 'Theo chi phí thu hút khách', truong: [
    { k: 'cac_vnd', nhan: 'Chi phí có 1 khách (đ)', mac_dinh: 0 },
    { k: 'new_customers_month1', nhan: 'Khách mới tháng 1', mac_dinh: 0 },
    { k: 'growth_pct_m', nhan: 'Tăng trưởng %/tháng', mac_dinh: 0 },
  ] },
}

export function PlanStudio() {
  const [versions, setVersions] = useState<Version[]>([])
  const [hienTai, setHienTai] = useState<string | null>(null)
  const [coa, setCoa] = useState<CoaLine[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [assum, setAssum] = useState<Assumption[]>([])
  const [danhMuc, setDanhMuc] = useState<DanhMucGiaDinh[]>([])
  const [ketQua, setKetQua] = useState<KetQua | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [ban, setBan] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)

  const [dongMoi, setDongMoi] = useState({ coa_line: '', label_vi: '', driver_type: 'fixed_schedule' })
  const [cauHinh, setCauHinh] = useState<Record<string, string>>({})

  const banHienTai = versions.find((v) => v.id === hienTai) ?? null
  const daChot = banHienTai?.status === 'published'

  const tai = useCallback(async (versionId?: string) => {
    try {
      const q = versionId ? `?version_id=${versionId}` : ''
      const res = await fetch(`/api/plan${q}`, { credentials: 'same-origin' })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error ?? 'Không tải được kế hoạch')
      setVersions(j.data.versions ?? [])
      setCoa(j.data.coa_lines ?? [])
      setLines(j.data.lines ?? [])
      const cur = j.data.current ?? versionId ?? j.data.versions?.[0]?.id ?? null
      setHienTai(cur)
      if (cur) {
        const ra = await fetch(`/api/plan/assumptions?version_id=${cur}`, { credentials: 'same-origin' })
        const ja = await ra.json()
        if (ra.ok) {
          setAssum(ja.data.assumptions ?? [])
          setDanhMuc(ja.data.danh_muc ?? [])
        }
      }
      setLoi(null)
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Lỗi không rõ')
    } finally {
      setDangTai(false)
    }
  }, [])

  useEffect(() => { void tai() }, [tai])

  const goi = async (url: string, init: RequestInit) => {
    const res = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...init })
    const j = await res.json()
    if (!res.ok) throw new Error(typeof j?.error === 'string' ? j.error : JSON.stringify(j?.error ?? 'Lỗi'))
    return j
  }

  const taoBan = async () => {
    setBan(true); setLoi(null)
    try {
      const nay = new Date()
      const j = await goi('/api/plan', {
        method: 'POST',
        body: JSON.stringify({
          horizon_months: 36,
          start_period: `${nay.getFullYear()}-${String(nay.getMonth() + 1).padStart(2, '0')}`,
          clone_from: hienTai && daChot ? hienTai : undefined,
        }),
      })
      setKetQua(null)
      await tai(j.data?.id ?? j.data?.version?.id)
      setThongBao('Đã tạo bản kế hoạch mới.')
    } catch (e) { setLoi(e instanceof Error ? e.message : 'Tạo thất bại') } finally { setBan(false) }
  }

  const themDong = async () => {
    if (!hienTai || !dongMoi.coa_line || !dongMoi.label_vi) return
    setBan(true); setLoi(null)
    try {
      const truong = DONG_LUC[dongMoi.driver_type].truong
      const driver: Record<string, unknown> = { type: dongMoi.driver_type }
      for (const t of truong) {
        const v = cauHinh[t.k]
        if (v === undefined || v === '') { if (t.k === 'growth_pct_m' || t.k === 'hires_per_month') continue; driver[t.k] = t.mac_dinh }
        else driver[t.k] = Number(v)
      }
      await goi('/api/plan/lines', {
        method: 'POST',
        body: JSON.stringify({ plan_version_id: hienTai, coa_line: dongMoi.coa_line, label_vi: dongMoi.label_vi, driver }),
      })
      setDongMoi({ coa_line: '', label_vi: '', driver_type: 'fixed_schedule' })
      setCauHinh({})
      setKetQua(null)
      await tai(hienTai)
    } catch (e) { setLoi(e instanceof Error ? e.message : 'Thêm dòng thất bại') } finally { setBan(false) }
  }

  const xoaDong = async (id: string) => {
    setBan(true); setLoi(null)
    try { await goi(`/api/plan/lines?id=${id}`, { method: 'DELETE' }); setKetQua(null); await tai(hienTai ?? undefined) }
    catch (e) { setLoi(e instanceof Error ? e.message : 'Xoá thất bại') } finally { setBan(false) }
  }

  const luuGiaDinh = async (key: string, giaTri: string) => {
    if (!hienTai || giaTri === '') return
    setBan(true); setLoi(null)
    try {
      await goi('/api/plan/assumptions', {
        method: 'PUT',
        body: JSON.stringify({ plan_version_id: hienTai, key, value_base: Number(giaTri) }),
      })
      setKetQua(null)
      await tai(hienTai)
    } catch (e) { setLoi(e instanceof Error ? e.message : 'Lưu giả định thất bại') } finally { setBan(false) }
  }

  const chay = async () => {
    if (!hienTai) return
    setBan(true); setLoi(null); setThongBao(null)
    try {
      const j = await goi('/api/plan/run', { method: 'POST', body: JSON.stringify({ version_id: hienTai, scenario: 'base' }) })
      setKetQua(j.data)
    } catch (e) { setLoi(e instanceof Error ? e.message : 'Chạy engine thất bại'); setKetQua(null) } finally { setBan(false) }
  }

  const chot = async () => {
    if (!hienTai) return
    setBan(true); setLoi(null)
    try {
      const j = await goi('/api/plan/publish', { method: 'POST', body: JSON.stringify({ version_id: hienTai, scenario: 'base' }) })
      setThongBao(`Đã chốt bản v${j.data.version_no} · ${j.data.targets_written} chỉ tiêu gửi sang ZeniOS/ZeniERP. Bản này KHOÁ vĩnh viễn.`)
      await tai(hienTai)
    } catch (e) { setLoi(e instanceof Error ? e.message : 'Chốt bản thất bại') } finally { setBan(false) }
  }

  if (dangTai) return <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim">Đang tải kế hoạch…</div>

  // Bảng cân đối có cân không — engine đã ném lỗi nếu lệch, nhưng hiện ra để
  // người dùng TIN được, chứ không phải tin vì hệ thống bảo thế.
  const thangCuoi = ketQua?.months?.[ketQua.months.length - 1]
  const lech = thangCuoi ? thangCuoi.total_assets - (thangCuoi.total_liabilities + thangCuoi.total_equity) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-w8 bg-bg-2 p-4 flex flex-wrap items-center gap-3">
        <select
          value={hienTai ?? ''}
          onChange={(e) => { setKetQua(null); void tai(e.target.value) }}
          className="rounded border border-w8 bg-transparent px-2 py-1.5 text-sm text-ink"
        >
          {versions.length === 0 && <option value="">(chưa có bản nào)</option>}
          {versions.map((v) => (
            <option key={v.id} value={v.id} className="bg-bg-2">
              v{v.version_no} · {v.name} · {v.status === 'published' ? 'đã chốt' : 'bản nháp'}
            </option>
          ))}
        </select>
        {banHienTai && (
          <span className="text-2xs text-ink-dim">
            {banHienTai.horizon_months} tháng từ {String(banHienTai.start_period).slice(0, 7)}
          </span>
        )}
        <div className="flex-1" />
        <button onClick={taoBan} disabled={ban} className="rounded border border-w8 px-3 py-1.5 text-xs text-ink-dim hover:text-gold-light hover:border-gold/50 disabled:opacity-40">
          {daChot ? 'Tạo bản mới (sao chép)' : 'Tạo bản kế hoạch'}
        </button>
        <button onClick={chay} disabled={ban || !hienTai} className="rounded border border-gold/50 px-3 py-1.5 text-xs text-gold-light hover:bg-gold/10 disabled:opacity-40">
          {ban ? '…' : 'Chạy engine'}
        </button>
        <button
          onClick={chot}
          disabled={ban || !ketQua || daChot}
          title={daChot ? 'Bản này đã chốt' : !ketQua ? 'Chạy engine trước khi chốt' : 'Chốt và sinh chỉ tiêu gửi ZeniOS/ZeniERP'}
          className="rounded border border-gold px-3 py-1.5 text-xs text-gold-light hover:bg-gold/20 disabled:opacity-30"
        >
          Chốt bản
        </button>
      </div>

      {loi && <div className="rounded-xl border border-red-700 bg-red-900/30 p-3 text-xs text-red-200 whitespace-pre-wrap">{loi}</div>}
      {thongBao && <div className="rounded-xl border border-gold/40 bg-gold/5 p-3 text-xs text-gold-light">{thongBao}</div>}

      {!hienTai ? (
        <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim text-sm">
          Chưa có bản kế hoạch nào. Bấm “Tạo bản kế hoạch” để bắt đầu — mọi chỉ tiêu gửi sang
          ZeniOS và ZeniERP đều sinh ra từ đây.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* ── Trái: giả định + dòng kế hoạch ── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-w8 bg-bg-2 p-4">
              <div className="font-medium text-ink text-sm mb-1">Giả định</div>
              <p className="text-2xs text-ink-dim mb-3">
                Không khai thì kế hoạch chạy với tiền mặt đầu kỳ 0 đồng — tháng nào cũng âm.
              </p>
              <div className="space-y-2">
                {danhMuc.map((d) => {
                  const cur = assum.find((a) => a.key === d.key)
                  return (
                    <div key={d.key} className="flex items-center gap-2">
                      <label className="flex-1 text-2xs text-ink-dim" htmlFor={`gd-${d.key}`}>
                        {d.nhan} <span className="opacity-60">({d.donVi})</span>
                      </label>
                      <input
                        id={`gd-${d.key}`}
                        defaultValue={cur?.value_base ?? ''}
                        disabled={daChot}
                        onBlur={(e) => { if (e.target.value !== String(cur?.value_base ?? '')) void luuGiaDinh(d.key, e.target.value) }}
                        inputMode="decimal"
                        className="w-32 rounded border border-w8 bg-transparent px-2 py-1 text-xs text-ink text-right disabled:opacity-50"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-w8 bg-bg-2 p-4">
              <div className="font-medium text-ink text-sm mb-2">Dòng kế hoạch ({lines.length})</div>
              {lines.length === 0 ? (
                <p className="text-2xs text-ink-dim italic mb-3">
                  Chưa có dòng nào. Engine cần tối thiểu một dòng doanh thu hoặc chi phí.
                </p>
              ) : (
                <ul className="space-y-1 mb-3">
                  {lines.map((l) => (
                    <li key={l.id} className="group flex items-center gap-2 text-xs">
                      <span className="rounded bg-w8 px-1 text-2xs text-ink-dim tabular-nums">{l.coa_line}</span>
                      <span className="flex-1 text-ink truncate">{l.label_vi}</span>
                      <span className="text-2xs text-ink-dim">{DONG_LUC[l.driver_type]?.nhan ?? l.driver_type}</span>
                      {!daChot && (
                        <button onClick={() => xoaDong(l.id)} className="opacity-0 group-hover:opacity-100 text-ink-dim hover:text-red-300 text-2xs px-1" title="Xoá dòng">✕</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {!daChot && (
                <div className="space-y-2 border-t border-w8 pt-3">
                  <div className="flex gap-2">
                    <select
                      value={dongMoi.coa_line}
                      onChange={(e) => setDongMoi({ ...dongMoi, coa_line: e.target.value })}
                      className="w-36 rounded border border-w8 bg-transparent px-2 py-1 text-2xs text-ink"
                    >
                      <option value="">— mã COA —</option>
                      {coa.map((c) => (
                        <option key={c.code} value={c.code} className="bg-bg-2">{c.code} · {c.label_vi}</option>
                      ))}
                    </select>
                    <input
                      value={dongMoi.label_vi}
                      onChange={(e) => setDongMoi({ ...dongMoi, label_vi: e.target.value })}
                      placeholder="Tên dòng…"
                      className="flex-1 min-w-0 rounded border border-w8 bg-transparent px-2 py-1 text-2xs text-ink placeholder:text-ink-dim/60"
                    />
                  </div>
                  <select
                    value={dongMoi.driver_type}
                    onChange={(e) => { setDongMoi({ ...dongMoi, driver_type: e.target.value }); setCauHinh({}) }}
                    className="w-full rounded border border-w8 bg-transparent px-2 py-1 text-2xs text-ink"
                  >
                    {Object.entries(DONG_LUC).map(([k, v]) => (
                      <option key={k} value={k} className="bg-bg-2">{v.nhan}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    {DONG_LUC[dongMoi.driver_type].truong.map((t) => (
                      <input
                        key={t.k}
                        value={cauHinh[t.k] ?? ''}
                        onChange={(e) => setCauHinh({ ...cauHinh, [t.k]: e.target.value })}
                        placeholder={t.nhan}
                        inputMode="decimal"
                        className="rounded border border-w8 bg-transparent px-2 py-1 text-2xs text-ink placeholder:text-ink-dim/60"
                      />
                    ))}
                  </div>
                  <button onClick={themDong} disabled={ban || !dongMoi.coa_line || !dongMoi.label_vi}
                    className="w-full rounded border border-w8 px-2 py-1.5 text-2xs text-ink-dim hover:text-gold-light hover:border-gold/50 disabled:opacity-40">
                    Thêm dòng
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Phải: kết quả engine ── */}
          <div className="lg:col-span-3 space-y-4">
            {!ketQua ? (
              <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim text-sm">
                Bấm <span className="text-gold-light">Chạy engine</span> để xem lãi lỗ, lưu chuyển tiền và bảng cân đối.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-w8 bg-bg-2 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-ink text-sm">Tóm tắt · kịch bản cơ sở</div>
                    <span className="text-2xs text-ink-dim">{ketQua.source}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    {[
                      { n: 'Doanh thu cả kỳ', v: tien(ketQua.summary.total_revenue) },
                      { n: 'EBITDA cả kỳ', v: tien(ketQua.summary.total_ebitda) },
                      { n: 'Tiền cuối kỳ', v: tien(ketQua.summary.closing_cash) },
                      { n: 'Đỉnh nhu cầu vốn', v: tien(ketQua.summary.peak_funding_need) },
                    ].map((x) => (
                      <div key={x.n} className="rounded border border-w8 p-2">
                        <div className="text-2xs text-ink-dim">{x.n}</div>
                        <div className="text-xs text-ink mt-0.5 tabular-nums">{x.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-2xs text-ink-dim space-y-0.5">
                    <div>
                      EBITDA dương từ tháng:{' '}
                      <span className="text-ink">{ketQua.summary.ebitda_positive_month ?? 'chưa bao giờ trong tầm nhìn này'}</span>
                    </div>
                    <div>
                      Tiền âm lần đầu ở tháng:{' '}
                      <span className={ketQua.summary.cash_negative_month ? 'text-red-300' : 'text-ink'}>
                        {ketQua.summary.cash_negative_month ?? 'không tháng nào'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-w8 bg-bg-2 p-4">
                  <div className="font-medium text-ink text-sm mb-2">Theo năm</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-2xs tabular-nums">
                      <thead>
                        <tr className="text-ink-dim text-left">
                          <th className="py-1 pr-2 font-normal">Năm</th>
                          <th className="py-1 px-2 font-normal text-right">Doanh thu</th>
                          <th className="py-1 px-2 font-normal text-right">Giá vốn</th>
                          <th className="py-1 px-2 font-normal text-right">EBITDA</th>
                          <th className="py-1 px-2 font-normal text-right">Lãi sau thuế</th>
                          <th className="py-1 pl-2 font-normal text-right">Tiền cuối năm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ketQua.yearly.map((y) => (
                          <tr key={y.year} className="border-t border-w8 text-ink">
                            <td className="py-1 pr-2">Năm {y.year}</td>
                            <td className="py-1 px-2 text-right">{tien(y.revenue)}</td>
                            <td className="py-1 px-2 text-right">{tien(y.cogs)}</td>
                            <td className="py-1 px-2 text-right">{tien(y.ebitda)}</td>
                            <td className={`py-1 px-2 text-right ${y.net_income < 0 ? 'text-red-300' : ''}`}>{tien(y.net_income)}</td>
                            <td className="py-1 pl-2 text-right">{tien(y.closing_cash)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-w8 bg-bg-2 p-4">
                  <div className="font-medium text-ink text-sm mb-2">Bảng cân đối cuối kỳ</div>
                  {thangCuoi && (
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded border border-w8 p-2">
                        <div className="text-2xs text-ink-dim">Tài sản</div>
                        <div className="text-xs text-ink mt-0.5 tabular-nums">{tien(thangCuoi.total_assets)}</div>
                      </div>
                      <div className="rounded border border-w8 p-2">
                        <div className="text-2xs text-ink-dim">Nợ phải trả</div>
                        <div className="text-xs text-ink mt-0.5 tabular-nums">{tien(thangCuoi.total_liabilities)}</div>
                      </div>
                      <div className="rounded border border-w8 p-2">
                        <div className="text-2xs text-ink-dim">Vốn chủ sở hữu</div>
                        <div className="text-xs text-ink mt-0.5 tabular-nums">{tien(thangCuoi.total_equity)}</div>
                      </div>
                    </div>
                  )}
                  <p className={`mt-2 text-2xs ${lech === 0 ? 'text-ink-dim' : 'text-red-300'}`}>
                    {lech === 0
                      ? 'Tài sản = Nợ + Vốn chủ, khớp đến từng đồng. Engine từ chối xuất bản nếu lệch dù chỉ 1 đồng.'
                      : `LỆCH ${tien(lech)} — báo ngay, đây là lỗi hệ thống.`}
                  </p>
                </div>

                <div className="rounded-xl border border-w8 bg-bg-2 p-4">
                  <div className="font-medium text-ink text-sm mb-2">Ba kịch bản</div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {(['bear', 'base', 'bull'] as const).map((k) => {
                      const s = ketQua.scenarios?.[k]
                      const ten = k === 'bear' ? 'Xấu' : k === 'base' ? 'Cơ sở' : 'Tốt'
                      return (
                        <div key={k} className={`rounded border p-2 ${k === 'base' ? 'border-gold/40' : 'border-w8'}`}>
                          <div className="text-2xs text-ink-dim">{ten}</div>
                          <div className="text-xs text-ink mt-0.5 tabular-nums">{s ? tien(s.total_revenue) : '—'}</div>
                          <div className="text-2xs text-ink-dim mt-0.5">tiền cuối: {s ? tien(s.closing_cash) : '—'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
