'use client'

import { useEffect, useState } from 'react'

/**
 * GÓI DỊCH VỤ — gói hiện tại, mức đã dùng, và các gói cao hơn.
 *
 * Trang cũ là HTML tĩnh lấy từ mockup: không đấu dữ liệu, không nút mua, và
 * ba endpoint thanh toán (`checkout`, `portal`, `webhook`) không một dòng giao
 * diện nào gọi tới. Khách vào đây thấy bảng giá đẹp nhưng không mua được gì.
 *
 * ⚠ KHÔNG DỰNG NÚT MUA GIẢ. Cổng thanh toán trực tuyến chưa mở, và đường đang
 * có trong mã viết theo Stripe trực tiếp — trái quy tắc chỉ dùng Zeni Cloud.
 * Một nút bấm vào báo lỗi còn tệ hơn không có nút: khách mất niềm tin ngay ở
 * bước trả tiền. Nói thẳng tình trạng và mở đường liên hệ.
 */

type Tier = {
  tier_code: string
  name_vi: string
  price_vnd_month: number
  max_journey_count: number
  max_seats: number
  academy_access: boolean
  training_drills_access: boolean
  handbook_access_phases: number[]
  display_order: number
}
type HanMuc = {
  goi: string
  ten_goi: string
  gioi_han_hanh_trinh: number
  da_dung_hanh_trinh: number
  gioi_han_ghe: number
  da_dung_ghe: number
  duoc_hoc_vien: boolean
  duoc_thao_truong: boolean
}

const tien = (v: number) => (v === 0 ? 'Miễn phí' : new Intl.NumberFormat('vi-VN').format(v) + ' đ/tháng')

export function BangGoi() {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [hm, setHm] = useState<HanMuc | null>(null)
  const [ghiChu, setGhiChu] = useState<string>('')
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/billing', { credentials: 'same-origin' })
        const j = await res.json()
        if (!res.ok) throw new Error(j?.error ?? 'Không tải được gói dịch vụ')
        setTiers((j.data.tiers ?? []) as Tier[])
        setHm((j.data.han_muc ?? null) as HanMuc | null)
        setGhiChu(j.data.thanh_toan?.ghi_chu ?? '')
      } catch (e) {
        setLoi(e instanceof Error ? e.message : 'Lỗi không rõ')
      } finally {
        setDangTai(false)
      }
    })()
  }, [])

  if (dangTai) return <div className="rounded-xl border border-dashed border-w8 bg-bg-2 p-10 text-center text-ink-dim">Đang tải gói dịch vụ…</div>
  if (loi) return <div className="rounded-xl border border-red-700 bg-red-900/30 p-3 text-xs text-red-200">{loi}</div>

  const Thanh = ({ nhan, dung, tran }: { nhan: string; dung: number; tran: number }) => (
    <div>
      <div className="flex justify-between text-2xs">
        <span className="text-ink-dim">{nhan}</span>
        <span className={`tabular-nums ${dung >= tran ? 'text-red-300' : 'text-ink'}`}>{dung}/{tran}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-w8 overflow-hidden">
        <div
          className={`h-full rounded-full ${dung >= tran ? 'bg-red-400' : 'bg-gold-light'}`}
          style={{ width: `${Math.min(100, tran > 0 ? (dung / tran) * 100 : 0)}%` }}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {hm && (
        <div className="rounded-xl border border-gold/40 bg-bg-2 p-4">
          <div className="flex flex-wrap items-baseline gap-2 mb-3">
            <span className="text-xs text-ink-dim">Gói hiện tại</span>
            <span className="font-serif text-lg text-gold-light">{hm.ten_goi}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Thanh nhan="Hành trình IPO" dung={hm.da_dung_hanh_trinh} tran={hm.gioi_han_hanh_trinh} />
            <Thanh nhan="Người dùng" dung={hm.da_dung_ghe} tran={hm.gioi_han_ghe} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-2xs">
            <span className={hm.duoc_hoc_vien ? 'text-gold-light' : 'text-ink-dim'}>
              {hm.duoc_hoc_vien ? '✓' : '✕'} Học viện
            </span>
            <span className={hm.duoc_thao_truong ? 'text-gold-light' : 'text-ink-dim'}>
              {hm.duoc_thao_truong ? '✓' : '✕'} Thao trường
            </span>
          </div>
        </div>
      )}

      {ghiChu && (
        <div className="rounded-xl border border-w8 bg-bg-2 p-3 text-xs text-ink-dim">
          {ghiChu}{' '}
          <a href="mailto:cto@zeniipo.com" className="text-gold-light underline">
            cto@zeniipo.com
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {tiers.map((t) => {
          const dangDung = hm?.goi === t.tier_code
          return (
            <div key={t.tier_code} className={`rounded-xl border p-4 flex flex-col ${dangDung ? 'border-gold/60 bg-gold/5' : 'border-w8 bg-bg-2'}`}>
              <div className="font-medium text-ink text-sm">{t.name_vi}</div>
              <div className={`mt-1 text-sm tabular-nums ${dangDung ? 'text-gold-light' : 'text-ink'}`}>
                {tien(t.price_vnd_month)}
              </div>
              <ul className="mt-3 space-y-1 text-2xs text-ink-dim flex-1">
                <li>{t.max_journey_count >= 999 ? 'Không giới hạn' : t.max_journey_count} hành trình IPO</li>
                <li>{t.max_seats >= 999 ? 'Không giới hạn' : t.max_seats} người dùng</li>
                <li>{t.academy_access ? '✓' : '✕'} Học viện</li>
                <li>{t.training_drills_access ? '✓' : '✕'} Thao trường</li>
                <li>Cẩm nang tới bước {Math.max(...(t.handbook_access_phases ?? [1]))}</li>
              </ul>
              {dangDung && <div className="mt-3 text-2xs text-gold-light">Đang dùng</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
