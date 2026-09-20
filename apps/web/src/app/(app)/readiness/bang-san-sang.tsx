'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * SẴN SÀNG NIÊM YẾT — nơi đính HỒ SƠ cho từng tiêu chí.
 *
 * Migration 038 đã tách điểm "đã xác minh" khỏi điểm "tự khai" và chặn ở CSDL:
 * đặt trạng thái đã xác minh mà thiếu hồ sơ thì bị từ chối. Nhưng
 * `/api/readiness/compute` và `/api/readiness/criteria/[id]` KHÔNG có một dòng
 * giao diện nào gọi tới — nên toàn bộ cơ chế đó nằm im, không ai dùng được.
 *
 * Màn hình này hiện HAI con số cạnh nhau có chủ ý. Điểm tự khai luôn đẹp hơn;
 * khoảng cách giữa hai con số chính là phần bên thẩm định sẽ moi ra. Thấy
 * trước thì còn kịp chuẩn bị, giấu đi thì tới lúc due diligence mới vỡ.
 */

type TieuChi = {
  id: string
  criterion_code: string
  category: string | null
  name_vi: string
  status: string
  score_pct: number
  weight: number
  evidence_file_id: string | null
  verified_by: string | null
  verified_at: string | null
  notes: string | null
}
type HoSo = { id: string; title: string; created_at: string }
type Diem = {
  total_score: number
  diem_da_xac_minh: number
  diem_tu_khai: number
  khoang_cach_bang_chung: number
  tong_tieu_chi: number
  so_tieu_chi_co_ho_so: number
  grade: string
  ghi_chu: string
}

const TEN_NHOM: Record<string, string> = {
  audit: 'Kiểm toán', financial: 'Tài chính', legal: 'Pháp lý',
  governance: 'Quản trị', operations: 'Vận hành', disclosure: 'Công bố',
  team: 'Nhân sự', risk: 'Rủi ro',
}
const TEN_TRANG_THAI: Record<string, string> = {
  not_started: 'Chưa bắt đầu', in_progress: 'Đang làm', ready: 'Sẵn sàng',
  verified: 'Đã xác minh', blocked: 'Đang tắc',
}

export function BangSanSang({ journeyId }: { journeyId: string }) {
  const [ds, setDs] = useState<TieuChi[]>([])
  const [hoSo, setHoSo] = useState<HoSo[]>([])
  const [diem, setDiem] = useState<Diem | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [ban, setBan] = useState<string | null>(null)
  const [loi, setLoi] = useState<string | null>(null)

  const tai = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/readiness?journey_id=${journeyId}`, { credentials: 'same-origin' }),
        fetch('/api/vault', { credentials: 'same-origin' }),
      ])
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1?.error ?? 'Không tải được tiêu chí')
      setDs((j1.data?.criteria ?? j1.criteria ?? []) as TieuChi[])
      if (r2.ok) {
        const j2 = await r2.json()
        setHoSo((j2.data?.docs ?? []) as HoSo[])
      }
      setLoi(null)
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Lỗi không rõ')
    } finally {
      setDangTai(false)
    }
  }, [journeyId])

  useEffect(() => { void tai() }, [tai])

  const goi = async (url: string, init: RequestInit) => {
    const res = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...init })
    const j = await res.json()
    if (!res.ok) throw new Error(typeof j?.error === 'string' ? j.error : JSON.stringify(j?.error ?? 'Lỗi'))
    return j
  }

  const sua = async (id: string, than: Record<string, unknown>) => {
    setBan(id); setLoi(null)
    try {
      await goi(`/api/readiness/criteria/${id}`, { method: 'PATCH', body: JSON.stringify(than) })
      await tai()
      setDiem(null)   // điểm cũ không còn đúng
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Cập nhật thất bại')
    } finally { setBan(null) }
  }

  const tinhDiem = async () => {
    setBan('tinh'); setLoi(null)
    try {
      const j = await goi('/api/readiness/compute', { method: 'POST', body: JSON.stringify({ journey_id: journeyId }) })
      setDiem(j.data as Diem)
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Tính điểm thất bại')
    } finally { setBan(null) }
  }

  if (dangTai) return <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim">Đang tải tiêu chí…</div>

  const coHoSo = ds.filter((c) => c.evidence_file_id).length
  const nhom = [...new Set(ds.map((c) => c.category ?? 'khac'))]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-w8 bg-bg-2 p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px]">
          <div className="text-xs text-ink-dim">Tiêu chí có hồ sơ đính kèm</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-w8 overflow-hidden">
              <div className="h-full rounded-full bg-gold-light" style={{ width: `${ds.length ? (coHoSo / ds.length) * 100 : 0}%` }} />
            </div>
            <span className="text-sm text-ink tabular-nums">{coHoSo}/{ds.length}</span>
          </div>
        </div>
        <button onClick={tinhDiem} disabled={ban !== null}
          className="rounded border border-gold/50 px-3 py-1.5 text-xs text-gold-light hover:bg-gold/10 disabled:opacity-40">
          {ban === 'tinh' ? 'Đang tính…' : 'Tính lại điểm sẵn sàng'}
        </button>
      </div>

      {loi && <div className="rounded-xl border border-red-700 bg-red-900/30 p-3 text-xs text-red-200 whitespace-pre-wrap">{loi}</div>}

      {diem && (
        <div className="rounded-xl border border-w8 bg-bg-2 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="rounded border border-gold/40 p-3">
              <div className="text-2xs text-ink-dim">Điểm ĐÃ XÁC MINH</div>
              <div className="text-lg text-gold-light tabular-nums mt-0.5">{Math.round(diem.diem_da_xac_minh)}</div>
              <div className="text-2xs text-ink-dim">con số đem đi đàm phán · hạng {diem.grade}</div>
            </div>
            <div className="rounded border border-w8 p-3">
              <div className="text-2xs text-ink-dim">Điểm tự khai</div>
              <div className="text-lg text-ink tabular-nums mt-0.5">{Math.round(diem.diem_tu_khai)}</div>
              <div className="text-2xs text-ink-dim">dùng để lập kế hoạch</div>
            </div>
            <div className="rounded border border-w8 p-3">
              <div className="text-2xs text-ink-dim">Khoảng cách bằng chứng</div>
              <div className={`text-lg tabular-nums mt-0.5 ${diem.khoang_cach_bang_chung >= 20 ? 'text-red-300' : 'text-ink'}`}>
                {diem.khoang_cach_bang_chung}
              </div>
              <div className="text-2xs text-ink-dim">phần bên thẩm định sẽ hỏi</div>
            </div>
          </div>
          <p className="mt-3 text-2xs text-ink-dim">{diem.ghi_chu}</p>
        </div>
      )}

      {nhom.map((n) => (
        <div key={n} className="rounded-xl border border-w8 bg-bg-2 p-4">
          <div className="font-medium text-ink text-sm mb-2">{TEN_NHOM[n] ?? n}</div>
          <ul className="space-y-2">
            {ds.filter((c) => (c.category ?? 'khac') === n).map((c) => {
              const daXacMinh = c.status === 'verified'
              return (
                <li key={c.id} className="rounded border border-w8 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs flex-1 min-w-[180px] ${daXacMinh ? 'text-gold-light' : 'text-ink'}`}>
                      {c.name_vi}
                    </span>
                    <span className="text-2xs text-ink-dim">trọng số {c.weight}</span>
                    <select
                      value={c.status}
                      disabled={ban === c.id}
                      onChange={(e) => sua(c.id, { status: e.target.value })}
                      className="rounded border border-w8 bg-transparent px-1.5 py-0.5 text-2xs text-ink"
                    >
                      {Object.entries(TEN_TRANG_THAI).map(([k, v]) => (
                        <option key={k} value={k} className="bg-bg-2">{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-2xs text-ink-dim" htmlFor={`hs-${c.id}`}>Hồ sơ:</label>
                    <select
                      id={`hs-${c.id}`}
                      value={c.evidence_file_id ?? ''}
                      disabled={ban === c.id}
                      onChange={(e) => sua(c.id, { evidence_file_id: e.target.value || null })}
                      className="flex-1 min-w-[200px] rounded border border-w8 bg-transparent px-1.5 py-0.5 text-2xs text-ink"
                    >
                      <option value="" className="bg-bg-2">— chưa đính hồ sơ —</option>
                      {hoSo.map((h) => (
                        <option key={h.id} value={h.id} className="bg-bg-2">{h.title}</option>
                      ))}
                    </select>
                    {!c.evidence_file_id && (
                      <span className="text-2xs text-ink-dim italic">không hồ sơ ⇒ tính 0 điểm khi thẩm định</span>
                    )}
                    {c.verified_at && (
                      <span className="text-2xs text-gold-light">
                        đã xác minh {new Date(c.verified_at).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {ds.length === 0 && (
        <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim text-sm">
          Chưa có tiêu chí nào. Bộ 20 tiêu chí chuẩn được tạo tự động khi khởi tạo hành trình IPO.
        </div>
      )}
    </div>
  )
}
