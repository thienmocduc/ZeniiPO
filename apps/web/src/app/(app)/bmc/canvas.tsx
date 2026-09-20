'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * MÔ HÌNH KINH DOANH 9 KHỐI — màn hình của bước 1 hành trình Idea → IPO.
 *
 * `journey_phase_specs` bước 1 khai rõ màn hình phải là "Business Model Canvas
 * + Council verdict", và cổng qua bước là `canvas_5_blocks`. API `/api/canvas`
 * đã có từ lâu nhưng KHÔNG có trang nào gọi tới — doanh nghiệp vào ZeniIPO
 * không có đường nào để đóng khung mô hình kinh doanh của mình.
 *
 * Bố cục giữ đúng thứ tự Osterwalder (đối tác → hoạt động/nguồn lực → giá trị
 * → quan hệ/kênh → khách hàng, rồi chi phí đối xứng doanh thu) vì người học
 * MBA đọc canvas theo đúng chiều đó; xếp lại cho "đẹp" là bắt họ đọc lại từ đầu.
 */

type Khoi = {
  block_key: string
  items: string[]
  updated_at: string | null
  nguon: 'nguoi' | 'ai' | 'ai_duyet' | null
  ai_model: string | null
  ai_luc: string | null
}
type DoDay = {
  so_khoi_co_noi_dung: number
  tong_khoi: number
  so_khoi_may_soan: number
  dat_cong_buoc_1: boolean
}

const NHAN: Record<string, { ten: string; en: string; hoi: string }> = {
  key_partnerships: { ten: 'Đối tác chính', en: 'Key Partners', hoi: 'Ai làm hộ phần mình không nên tự làm?' },
  key_activities: { ten: 'Hoạt động chính', en: 'Key Activities', hoi: 'Việc gì làm mỗi ngày mới tạo ra giá trị?' },
  key_resources: { ten: 'Nguồn lực chính', en: 'Key Resources', hoi: 'Mất thứ gì thì mô hình sụp?' },
  value_propositions: { ten: 'Giá trị mang lại', en: 'Value Propositions', hoi: 'Giải quyết nỗi đau nào, hơn giải pháp hiện tại ở đâu?' },
  customer_relationships: { ten: 'Quan hệ khách hàng', en: 'Customer Relationships', hoi: 'Giữ chân bằng cách nào?' },
  channels: { ten: 'Kênh tiếp cận', en: 'Channels', hoi: 'Khách biết tới, mua và được phục vụ qua đường nào?' },
  customer_segments: { ten: 'Phân khúc khách hàng', en: 'Customer Segments', hoi: 'Ai trả tiền, và họ khác nhau ở điểm nào?' },
  cost_structure: { ten: 'Cơ cấu chi phí', en: 'Cost Structure', hoi: 'Tiền đi đâu nhiều nhất, cố định hay biến đổi?' },
  revenue_streams: { ten: 'Dòng doanh thu', en: 'Revenue Streams', hoi: 'Thu tiền theo cách nào?' },
}

export function CanvasBoard() {
  const [khoi, setKhoi] = useState<Record<string, Khoi>>({})
  const [doDay, setDoDay] = useState<DoDay | null>(null)
  const [ghiChu, setGhiChu] = useState<string>('')
  const [dangTai, setDangTai] = useState(true)
  const [dangSoan, setDangSoan] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [nhap, setNhap] = useState<Record<string, string>>({})
  const [dangLuu, setDangLuu] = useState<string | null>(null)

  const tai = useCallback(async () => {
    try {
      const res = await fetch('/api/canvas', { credentials: 'same-origin' })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error ?? 'Không tải được mô hình kinh doanh')
      const m: Record<string, Khoi> = {}
      for (const b of j.data.blocks as Khoi[]) m[b.block_key] = b
      setKhoi(m)
      setDoDay(j.data.do_day ?? null)
      setGhiChu(j.data.ghi_chu ?? '')
      setLoi(null)
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Lỗi không rõ')
    } finally {
      setDangTai(false)
    }
  }, [])

  useEffect(() => {
    void tai()
  }, [tai])

  const luuKhoi = async (key: string, items: string[]) => {
    setDangLuu(key)
    try {
      const res = await fetch('/api/canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ block_key: key, items }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Lưu thất bại')
      await tai()
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setDangLuu(null)
    }
  }

  const themY = (key: string) => {
    const t = (nhap[key] ?? '').trim()
    if (!t) return
    const items = [...(khoi[key]?.items ?? []), t].slice(0, 20)
    setNhap((n) => ({ ...n, [key]: '' }))
    void luuKhoi(key, items)
  }

  const xoaY = (key: string, i: number) => {
    const items = (khoi[key]?.items ?? []).filter((_, idx) => idx !== i)
    void luuKhoi(key, items)
  }

  const soanNhap = async () => {
    setDangSoan(true)
    setLoi(null)
    try {
      const res = await fetch('/api/canvas/draft', { method: 'POST', credentials: 'same-origin' })
      const j = await res.json()
      if (!res.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'Soạn nháp thất bại')
      await tai()
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Soạn nháp thất bại')
    } finally {
      setDangSoan(false)
    }
  }

  if (dangTai) {
    return <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim">Đang tải mô hình kinh doanh…</div>
  }

  const O = ({ k, className = '' }: { k: string; className?: string }) => {
    const b = khoi[k]
    const n = NHAN[k]
    const maySoan = b?.nguon === 'ai'
    return (
      <div className={`rounded-xl border bg-bg-2 p-4 flex flex-col ${maySoan ? 'border-gold/40' : 'border-w8'} ${className}`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="font-medium text-ink text-sm leading-tight">{n.ten}</div>
            <div className="text-2xs text-ink-dim uppercase tracking-wider">{n.en}</div>
          </div>
          {maySoan && (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-2xs border border-gold/50 text-gold-light"
              title={`Máy soạn bằng ${b?.ai_model ?? 'AI'}. Sửa hoặc lưu lại để nhận trách nhiệm về nội dung này.`}
            >
              máy soạn
            </span>
          )}
        </div>

        {(b?.items?.length ?? 0) === 0 ? (
          <p className="text-2xs text-ink-dim italic mb-2">{n.hoi}</p>
        ) : (
          <ul className="space-y-1 mb-2">
            {b!.items.map((it, i) => (
              <li key={`${k}-${i}`} className="group flex items-start gap-1.5 text-xs text-ink">
                <span className="text-gold-light mt-0.5">·</span>
                <span className="flex-1">{it}</span>
                <button
                  onClick={() => xoaY(k, i)}
                  className="opacity-0 group-hover:opacity-100 text-ink-dim hover:text-red-300 text-2xs px-1"
                  aria-label={`Xoá ý: ${it}`}
                  title="Xoá ý này"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex gap-1">
          <input
            value={nhap[k] ?? ''}
            onChange={(e) => setNhap((n2) => ({ ...n2, [k]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                themY(k)
              }
            }}
            placeholder="Thêm một ý…"
            maxLength={300}
            className="flex-1 min-w-0 rounded border border-w8 bg-transparent px-2 py-1 text-xs text-ink placeholder:text-ink-dim/60 focus:border-gold/50 focus:outline-none"
          />
          <button
            onClick={() => themY(k)}
            disabled={dangLuu === k}
            className="rounded border border-w8 px-2 py-1 text-2xs text-ink-dim hover:text-gold-light hover:border-gold/50 disabled:opacity-40"
          >
            {dangLuu === k ? '…' : '+'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Thanh trạng thái: nói thẳng còn thiếu gì để qua cổng bước 1 */}
      <div className="rounded-xl border border-w8 bg-bg-2 p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px]">
          <div className="text-xs text-ink-dim">Độ đầy mô hình kinh doanh</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-w8 overflow-hidden">
              <div
                className={`h-full rounded-full ${doDay?.dat_cong_buoc_1 ? 'bg-gold-light' : 'bg-ink-dim'}`}
                style={{ width: `${((doDay?.so_khoi_co_noi_dung ?? 0) / 9) * 100}%` }}
              />
            </div>
            <span className="text-sm text-ink tabular-nums">{doDay?.so_khoi_co_noi_dung ?? 0}/9</span>
          </div>
          {ghiChu && <p className="mt-1.5 text-2xs text-ink-dim">{ghiChu}</p>}
        </div>
        <button
          onClick={soanNhap}
          disabled={dangSoan}
          className="rounded border border-gold/50 px-3 py-1.5 text-xs text-gold-light hover:bg-gold/10 disabled:opacity-40"
          title="Máy soạn bản nháp cho những khối bạn CHƯA viết. Khối bạn đã viết không bị đè."
        >
          {dangSoan ? 'Đang soạn…' : 'AI soạn nháp những khối còn trống'}
        </button>
      </div>

      {loi && (
        <div className="rounded-xl border border-red-700 bg-red-900/30 p-3 text-xs text-red-200">{loi}</div>
      )}

      {/* Bố cục Osterwalder: 5 cột trên, chi phí ↔ doanh thu ở dưới */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <O k="key_partnerships" className="lg:row-span-2" />
        <div className="lg:row-span-2 grid grid-rows-2 gap-3">
          <O k="key_activities" />
          <O k="key_resources" />
        </div>
        <O k="value_propositions" className="lg:row-span-2" />
        <div className="lg:row-span-2 grid grid-rows-2 gap-3">
          <O k="customer_relationships" />
          <O k="channels" />
        </div>
        <O k="customer_segments" className="lg:row-span-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <O k="cost_structure" />
        <O k="revenue_streams" />
      </div>
    </div>
  )
}
