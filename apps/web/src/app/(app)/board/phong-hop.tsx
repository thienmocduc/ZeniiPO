'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * PHÒNG HỌP HỘI ĐỒNG QUẢN TRỊ.
 *
 * Bốn điều giao diện này phải nói thật, không được làm đẹp:
 *
 *  1. **Túc số là số dẫn ra.** Lấy từ `tinh_tuc_so()`, không có ô nhập. Khi tỷ
 *     lệ túc số còn là mặc định hệ thống thì hiện cảnh báo — vì điều lệ công ty
 *     mới là thứ quyết định con số đó, nền tảng không được đoán hộ.
 *  2. **Độc lập khai ≠ độc lập có căn cứ.** Hiện cả hai con số và khoảng cách
 *     giữa chúng. Tiêu chí `board_composition` chấm theo con số thứ hai.
 *  3. **Nút bị chặn phải nói vì sao bị chặn**, không ẩn đi. Ẩn nút làm người
 *     dùng tưởng tính năng chưa có; nói rõ "thiếu túc số" thì họ biết phải làm gì.
 *  4. **Ghế chưa có người** hiện thành con số riêng ở sổ phân phối. Đó thường là
 *     con số đau nhất: nghị quyết đã giao nhưng không ai nhận.
 */

type ThanhVien = {
  id: string
  full_name: string
  title_vi: string | null
  member_type: string
  is_chairman: boolean
  is_financial_expert: boolean
  co_so_doc_lap: unknown
  status: string
}
type ThongKeTV = {
  tong_thanh_vien: number
  khai_doc_lap: number
  doc_lap_co_can_cu: number
  chuyen_gia_tai_chinh: number
}
type UyBan = {
  id: string
  committee_code: string
  name_vi: string
  so_thanh_vien: number
  so_doc_lap_co_can_cu: number
  co_chuyen_gia_tai_chinh: boolean
  canh_bao: string | null
}
type KyHop = {
  id: string
  meeting_no: string
  title: string
  meeting_type: string
  scheduled_at: string
  status: string
  quorum_required_pct: number
  quorum_source: string
}
type TucSo = {
  tong_thanh_vien: number
  so_du_hop: number
  ty_le_du_hop: number
  ty_le_yeu_cau: number
  du_tuc_so: boolean
  canh_bao: string | null
}
type NghiQuyet = {
  id: string
  resolution_no: string
  title: string
  resolution_type: string
  status: string
  meeting_id: string | null
  plan_version_id: string | null
  votes_for: number | null
  votes_against: number | null
  votes_abstain: number | null
}
type BanGiao = {
  id: string
  resolution_id: string
  position_code: string | null
  status: string
  acknowledged_at: string | null
}

const LOAI_TV: Record<string, string> = {
  dieu_hanh: 'Điều hành',
  khong_dieu_hanh: 'Không điều hành',
  doc_lap: 'Độc lập',
}
const HINH_THUC: Record<string, string> = {
  truc_tiep: 'Trực tiếp',
  truc_tuyen: 'Trực tuyến',
  ket_hop: 'Kết hợp',
  lay_y_kien_van_ban: 'Lấy ý kiến bằng văn bản',
}
const TT_HOP: Record<string, string> = {
  du_kien: 'Dự kiến',
  da_trieu_tap: 'Đã triệu tập',
  dang_hop: 'Đang họp',
  da_hop: 'Đã họp',
  huy: 'Đã huỷ',
}
const TT_NQ: Record<string, string> = {
  draft: 'Bản nháp',
  voted: 'Đã biểu quyết',
  approved: 'Đã thông qua',
  rejected: 'Không thông qua',
  executed: 'Đã thực thi',
}
const LOAI_NQ: Record<string, string> = {
  funding: 'Gọi vốn',
  esop: 'ESOP',
  appointment: 'Bổ nhiệm',
  budget: 'Ngân sách / kế hoạch',
  m_and_a: 'Mua bán sáp nhập',
  policy: 'Quy chế',
  audit: 'Kiểm toán',
  ipo: 'Niêm yết',
  other: 'Khác',
}
const TT_GIAO: Record<string, string> = {
  da_giao: 'Đã giao',
  da_xac_nhan: 'Đã xác nhận',
  chua_co_nguoi: 'Chưa có người',
}

const coCanCu = (v: unknown) =>
  v != null && typeof v === 'object' && Object.keys(v as object).length > 0

type Tab = 'thanh-vien' | 'uy-ban' | 'ky-hop' | 'nghi-quyet' | 'so-giao'

export function PhongHopHoiDong() {
  const [tab, setTab] = useState<Tab>('thanh-vien')
  const [tv, setTv] = useState<ThanhVien[]>([])
  const [thongKe, setThongKe] = useState<ThongKeTV | null>(null)
  const [uyBan, setUyBan] = useState<UyBan[]>([])
  const [kyHop, setKyHop] = useState<KyHop[]>([])
  const [tucSo, setTucSo] = useState<Record<string, TucSo>>({})
  const [nq, setNq] = useState<NghiQuyet[]>([])
  const [giao, setGiao] = useState<BanGiao[]>([])
  const [dangTai, setDangTai] = useState(true)
  const [ban, setBan] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [tin, setTin] = useState<string | null>(null)

  const [fTv, setFTv] = useState({
    full_name: '',
    title_vi: '',
    member_type: 'doc_lap',
    is_chairman: false,
    is_financial_expert: false,
    can_cu: '',
  })
  const [fHop, setFHop] = useState({
    meeting_no: '',
    title: '',
    meeting_type: 'truc_tuyen',
    scheduled_at: '',
    location: '',
    meeting_url: '',
    quorum_required_pct: '75',
    quorum_source: 'mac_dinh_he_thong',
  })

  const tai = useCallback(async () => {
    try {
      const [rTv, rUb, rKh, rNq, rGiao] = await Promise.all([
        fetch('/api/board/members', { credentials: 'same-origin' }),
        fetch('/api/board/committees', { credentials: 'same-origin' }),
        fetch('/api/board/meetings', { credentials: 'same-origin' }),
        fetch('/api/board/resolutions', { credentials: 'same-origin' }),
        fetch('/api/board/distribution', { credentials: 'same-origin' }),
      ])
      const [jTv, jUb, jKh, jNq, jGiao] = await Promise.all([
        rTv.json(),
        rUb.json(),
        rKh.json(),
        rNq.json(),
        rGiao.json(),
      ])
      if (!rTv.ok) throw new Error(jTv?.error ?? 'Không tải được thành viên')
      setTv((jTv.data ?? []) as ThanhVien[])
      setThongKe((jTv.thong_ke ?? null) as ThongKeTV | null)
      setUyBan((jUb.data ?? []) as UyBan[])
      setKyHop((jKh.data ?? []) as KyHop[])
      setTucSo((jKh.tuc_so ?? {}) as Record<string, TucSo>)
      setNq((jNq.data ?? []) as NghiQuyet[])
      setGiao((jGiao.data ?? []) as BanGiao[])
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

  const goi = async (url: string, body: unknown, method = 'POST') => {
    setBan(true)
    setLoi(null)
    setTin(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(typeof j?.error === 'string' ? j.error : JSON.stringify(j?.error))
      await tai()
      return j
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Lỗi không rõ')
      return null
    } finally {
      setBan(false)
    }
  }

  if (dangTai) return <p className="text-sm text-ink-dim">Đang tải…</p>

  const khoangCachDocLap = thongKe ? thongKe.khai_doc_lap - thongKe.doc_lap_co_can_cu : 0

  return (
    <div className="space-y-5">
      {loi && (
        <div
          data-testid="board-loi"
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {loi}
        </div>
      )}
      {tin && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {tin}
        </div>
      )}

      {/* ── Bảng điểm quản trị: bốn tiêu chí đang được chấm ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Oo nhan="Thành viên hội đồng" so={thongKe?.tong_thanh_vien ?? 0} />
        <Oo
          nhan="Độc lập có căn cứ"
          so={thongKe?.doc_lap_co_can_cu ?? 0}
          phu={
            khoangCachDocLap > 0
              ? `${khoangCachDocLap} người khai độc lập nhưng CHƯA có căn cứ`
              : 'Tiêu chí niêm yết cần ≥3'
          }
          canh={khoangCachDocLap > 0 || (thongKe?.doc_lap_co_can_cu ?? 0) < 3}
        />
        <Oo
          nhan="Chuyên gia tài chính"
          so={thongKe?.chuyen_gia_tai_chinh ?? 0}
          phu="Uỷ ban kiểm toán cần ít nhất 1"
          canh={(thongKe?.chuyen_gia_tai_chinh ?? 0) < 1}
        />
        <Oo
          nhan="Uỷ ban đã lập"
          so={uyBan.length}
          phu={uyBan.some((u) => u.committee_code === 'audit') ? 'Có uỷ ban kiểm toán' : 'CHƯA có uỷ ban kiểm toán'}
          canh={!uyBan.some((u) => u.committee_code === 'audit')}
        />
      </section>

      <nav className="flex gap-1 flex-wrap border-b border-white/10">
        {(
          [
            ['thanh-vien', 'Thành viên'],
            ['uy-ban', 'Uỷ ban'],
            ['ky-hop', 'Kỳ họp'],
            ['nghi-quyet', 'Nghị quyết'],
            ['so-giao', 'Sổ phân phối'],
          ] as Array<[Tab, string]>
        ).map(([k, nhan]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm ${
              tab === k ? 'text-gold-light border-b-2 border-gold-light' : 'text-ink-dim'
            }`}
          >
            {nhan}
          </button>
        ))}
      </nav>

      {/* ══ THÀNH VIÊN ══ */}
      {tab === 'thanh-vien' && (
        <section className="space-y-3">
          <table className="w-full text-sm">
            <thead className="text-ink-dim text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left py-2">Họ tên</th>
                <th className="text-left">Loại</th>
                <th className="text-left">Căn cứ độc lập</th>
                <th className="text-left">Chuyên gia TC</th>
              </tr>
            </thead>
            <tbody>
              {tv.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-ink-dim">
                    Chưa khai thành viên nào. Chưa có thành viên thì không tính được túc số, và
                    không phiên họp nào ra được nghị quyết có hiệu lực.
                  </td>
                </tr>
              )}
              {tv.map((m) => (
                <tr key={m.id} className="border-t border-white/5">
                  <td className="py-2">
                    {m.full_name}
                    {m.is_chairman && <span className="ml-2 text-xs text-gold-light">· Chủ tịch</span>}
                    {m.title_vi && <div className="text-xs text-ink-dim">{m.title_vi}</div>}
                  </td>
                  <td>{LOAI_TV[m.member_type] ?? m.member_type}</td>
                  <td>
                    {m.member_type !== 'doc_lap' ? (
                      <span className="text-ink-dim">—</span>
                    ) : coCanCu(m.co_so_doc_lap) ? (
                      <span className="text-emerald-400">Có</span>
                    ) : (
                      <span className="text-amber-400">Thiếu — không được tính là độc lập</span>
                    )}
                  </td>
                  <td>{m.is_financial_expert ? 'Có' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="rounded border border-white/10 p-3">
            <summary className="text-sm text-gold-light cursor-pointer">Thêm thành viên</summary>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <O nhan="Họ tên" v={fTv.full_name} d={(v) => setFTv({ ...fTv, full_name: v })} />
              <O nhan="Chức danh" v={fTv.title_vi} d={(v) => setFTv({ ...fTv, title_vi: v })} />
              <label className="text-sm">
                <span className="block text-ink-dim mb-1">Loại thành viên</span>
                <select
                  value={fTv.member_type}
                  onChange={(e) => setFTv({ ...fTv, member_type: e.target.value })}
                  className="w-full bg-black/30 border border-white/15 rounded px-2 py-1.5"
                >
                  {Object.entries(LOAI_TV).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <O
                nhan="Căn cứ độc lập (pháp chế điền)"
                v={fTv.can_cu}
                d={(v) => setFTv({ ...fTv, can_cu: v })}
                goi="Ví dụ: không làm việc tại công ty 3 năm gần nhất, không sở hữu quá 1%"
              />
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fTv.is_chairman}
                  onChange={(e) => setFTv({ ...fTv, is_chairman: e.target.checked })}
                />
                Là chủ tịch hội đồng
              </label>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fTv.is_financial_expert}
                  onChange={(e) => setFTv({ ...fTv, is_financial_expert: e.target.checked })}
                />
                Là chuyên gia tài chính
              </label>
            </div>
            <button
              type="button"
              disabled={ban || fTv.full_name.trim().length < 2}
              onClick={async () => {
                const ok = await goi('/api/board/members', {
                  full_name: fTv.full_name.trim(),
                  title_vi: fTv.title_vi.trim() || undefined,
                  member_type: fTv.member_type,
                  is_chairman: fTv.is_chairman,
                  is_financial_expert: fTv.is_financial_expert,
                  co_so_doc_lap: fTv.can_cu.trim() ? { co_so: fTv.can_cu.trim() } : undefined,
                })
                if (ok)
                  setFTv({
                    full_name: '',
                    title_vi: '',
                    member_type: 'doc_lap',
                    is_chairman: false,
                    is_financial_expert: false,
                    can_cu: '',
                  })
              }}
              className="mt-3 px-3 py-1.5 text-sm rounded bg-gold-light/20 border border-gold-light/40 text-gold-light disabled:opacity-40"
            >
              Thêm thành viên
            </button>
            {fTv.member_type === 'doc_lap' && !fTv.can_cu.trim() && (
              <p className="text-xs text-amber-400 mt-2">
                Khai độc lập mà không có căn cứ thì hệ thống KHÔNG đếm vào tiêu chí niêm yết — và bên
                thẩm định cũng loại ngay.
              </p>
            )}
          </details>
        </section>
      )}

      {/* ══ UỶ BAN ══ */}
      {tab === 'uy-ban' && (
        <section className="space-y-3">
          {uyBan.length === 0 && (
            <p className="text-sm text-ink-dim">
              Chưa lập uỷ ban nào. Tiêu chí &ldquo;Đã lập uỷ ban kiểm toán&rdquo; trong điểm sẵn sàng
              niêm yết sẽ không đạt.
            </p>
          )}
          {uyBan.map((u) => (
            <div key={u.id} className="rounded border border-white/10 p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-gold-light">{u.name_vi}</div>
                  <div className="text-xs text-ink-dim">
                    {u.so_thanh_vien} thành viên · {u.so_doc_lap_co_can_cu} độc lập có căn cứ ·{' '}
                    {u.co_chuyen_gia_tai_chinh ? 'có chuyên gia tài chính' : 'KHÔNG có chuyên gia tài chính'}
                  </div>
                </div>
              </div>
              {u.canh_bao && <p className="text-xs text-amber-400 mt-2">{u.canh_bao}</p>}
            </div>
          ))}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                ['audit', 'Uỷ ban kiểm toán'],
                ['remuneration', 'Uỷ ban lương thưởng'],
                ['nomination', 'Uỷ ban nhân sự'],
                ['risk', 'Uỷ ban rủi ro'],
              ] as Array<[string, string]>
            )
              .filter(([k]) => !uyBan.some((u) => u.committee_code === k))
              .map(([k, n]) => (
                <button
                  key={k}
                  type="button"
                  disabled={ban}
                  onClick={() => void goi('/api/board/committees', { committee_code: k, name_vi: n })}
                  className="px-3 py-1.5 text-sm rounded border border-white/15 text-ink-dim disabled:opacity-40"
                >
                  + {n}
                </button>
              ))}
          </div>
        </section>
      )}

      {/* ══ KỲ HỌP ══ */}
      {tab === 'ky-hop' && (
        <section className="space-y-3">
          {kyHop.length === 0 && <p className="text-sm text-ink-dim">Chưa có phiên họp nào.</p>}
          {kyHop.map((k) => {
            const t = tucSo[k.id]
            return (
              <div key={k.id} className="rounded border border-white/10 p-3">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <div className="text-gold-light">
                      {k.meeting_no} · {k.title}
                    </div>
                    <div className="text-xs text-ink-dim">
                      {HINH_THUC[k.meeting_type] ?? k.meeting_type} ·{' '}
                      {new Date(k.scheduled_at).toLocaleString('vi-VN')} ·{' '}
                      {TT_HOP[k.status] ?? k.status}
                    </div>
                  </div>
                  {t && (
                    <div className="text-right text-xs">
                      <div
                        className={t.du_tuc_so ? 'text-emerald-400' : 'text-amber-400'}
                        data-testid={`tuc-so-${k.id}`}
                      >
                        Túc số {t.so_du_hop}/{t.tong_thanh_vien} = {t.ty_le_du_hop}% ·{' '}
                        {t.du_tuc_so ? 'ĐỦ' : `THIẾU (cần ${t.ty_le_yeu_cau}%)`}
                      </div>
                      <div className="text-ink-dim">tính từ điểm danh, không phải tự khai</div>
                    </div>
                  )}
                </div>
                {t?.canh_bao && <p className="text-xs text-amber-400 mt-2">{t.canh_bao}</p>}
                {tv.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-ink-dim cursor-pointer">Điểm danh</summary>
                    <div className="mt-2 space-y-1">
                      {tv.map((m) => (
                        <div key={m.id} className="flex gap-2 items-center text-xs">
                          <span className="w-40 truncate">{m.full_name}</span>
                          {(['co_mat', 'truc_tuyen', 'vang'] as const).map((a) => (
                            <button
                              key={a}
                              type="button"
                              disabled={ban}
                              onClick={() =>
                                void goi(
                                  '/api/board/meetings',
                                  { id: k.id, diem_danh: [{ member_id: m.id, attendance: a }] },
                                  'PATCH',
                                )
                              }
                              className="px-2 py-0.5 rounded border border-white/15 text-ink-dim disabled:opacity-40"
                            >
                              {a === 'co_mat' ? 'Có mặt' : a === 'truc_tuyen' ? 'Trực tuyến' : 'Vắng'}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          })}

          <details className="rounded border border-white/10 p-3">
            <summary className="text-sm text-gold-light cursor-pointer">Mở phiên họp</summary>
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <O nhan="Số kỳ họp" v={fHop.meeting_no} d={(v) => setFHop({ ...fHop, meeting_no: v })} goi="VD: 01/2026" />
              <O nhan="Tiêu đề" v={fHop.title} d={(v) => setFHop({ ...fHop, title: v })} />
              <label className="text-sm">
                <span className="block text-ink-dim mb-1">Hình thức</span>
                <select
                  value={fHop.meeting_type}
                  onChange={(e) => setFHop({ ...fHop, meeting_type: e.target.value })}
                  className="w-full bg-black/30 border border-white/15 rounded px-2 py-1.5"
                >
                  {Object.entries(HINH_THUC).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-ink-dim mb-1">Thời gian</span>
                <input
                  type="datetime-local"
                  value={fHop.scheduled_at}
                  onChange={(e) => setFHop({ ...fHop, scheduled_at: e.target.value })}
                  className="w-full bg-black/30 border border-white/15 rounded px-2 py-1.5"
                />
              </label>
              {fHop.meeting_type === 'truc_tiep' ? (
                <O nhan="Địa điểm" v={fHop.location} d={(v) => setFHop({ ...fHop, location: v })} />
              ) : (
                <O
                  nhan="Đường dẫn phòng họp"
                  v={fHop.meeting_url}
                  d={(v) => setFHop({ ...fHop, meeting_url: v })}
                  goi="https://…"
                />
              )}
              <label className="text-sm">
                <span className="block text-ink-dim mb-1">Tỷ lệ túc số theo điều lệ (%)</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={fHop.quorum_required_pct}
                  onChange={(e) =>
                    setFHop({ ...fHop, quorum_required_pct: e.target.value, quorum_source: 'dieu_le' })
                  }
                  className="w-full bg-black/30 border border-white/15 rounded px-2 py-1.5"
                />
                <span className="text-xs text-ink-dim">
                  {fHop.quorum_source === 'mac_dinh_he_thong'
                    ? 'Đang dùng mặc định hệ thống — sửa ô này để xác nhận theo điều lệ công ty.'
                    : 'Đã xác nhận theo điều lệ.'}
                </span>
              </label>
            </div>
            <button
              type="button"
              disabled={ban || !fHop.meeting_no.trim() || !fHop.title.trim() || !fHop.scheduled_at}
              onClick={async () => {
                const ok = await goi('/api/board/meetings', {
                  meeting_no: fHop.meeting_no.trim(),
                  title: fHop.title.trim(),
                  meeting_type: fHop.meeting_type,
                  scheduled_at: new Date(fHop.scheduled_at).toISOString(),
                  location: fHop.location.trim() || undefined,
                  meeting_url: fHop.meeting_url.trim() || undefined,
                  quorum_required_pct: Number(fHop.quorum_required_pct),
                  quorum_source: fHop.quorum_source,
                })
                if (ok) setFHop({ ...fHop, meeting_no: '', title: '', scheduled_at: '' })
              }}
              className="mt-3 px-3 py-1.5 text-sm rounded bg-gold-light/20 border border-gold-light/40 text-gold-light disabled:opacity-40"
            >
              Mở phiên họp
            </button>
          </details>
        </section>
      )}

      {/* ══ NGHỊ QUYẾT ══ */}
      {tab === 'nghi-quyet' && (
        <section className="space-y-3">
          {nq.length === 0 && <p className="text-sm text-ink-dim">Chưa có nghị quyết nào.</p>}
          {nq.map((r) => {
            const t = r.meeting_id ? tucSo[r.meeting_id] : null
            const chotDuoc = r.status === 'draft' || r.status === 'voted'
            const lyDoChan = !r.meeting_id
              ? 'Chưa gắn kỳ họp — không có căn cứ túc số'
              : t && !t.du_tuc_so
                ? `Thiếu túc số (${t.ty_le_du_hop}% / cần ${t.ty_le_yeu_cau}%)`
                : null
            return (
              <div key={r.id} className="rounded border border-white/10 p-3">
                <div className="flex justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-gold-light">
                      {r.resolution_no} · {r.title}
                    </div>
                    <div className="text-xs text-ink-dim">
                      {LOAI_NQ[r.resolution_type] ?? r.resolution_type} ·{' '}
                      {TT_NQ[r.status] ?? r.status}
                      {r.votes_for != null &&
                        ` · ${r.votes_for} thuận / ${r.votes_against ?? 0} chống / ${r.votes_abstain ?? 0} trắng`}
                    </div>
                    {r.plan_version_id && (
                      <div className="text-xs text-emerald-400 mt-1">
                        Cho phép thực thi một bản kế hoạch — ZeniOS đọc được thẩm quyền này
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-start">
                    {chotDuoc && (
                      <button
                        type="button"
                        disabled={ban || Boolean(lyDoChan)}
                        title={lyDoChan ?? 'Chốt nghị quyết'}
                        onClick={() =>
                          void goi('/api/board/resolutions', { id: r.id, hanh_dong: 'chot' }, 'PATCH')
                        }
                        className="px-3 py-1.5 text-sm rounded border border-gold-light/40 text-gold-light disabled:opacity-40"
                      >
                        Chốt nghị quyết
                      </button>
                    )}
                    {r.status === 'approved' && (
                      <button
                        type="button"
                        disabled={ban}
                        onClick={async () => {
                          const j = await goi(
                            '/api/board/resolutions',
                            { id: r.id, hanh_dong: 'phan_phoi' },
                            'PATCH',
                          )
                          if (j?.data)
                            setTin(
                              `Đã giao ${j.data.giao_moi} ghế · ${j.data.chua_co_nguoi} ghế chưa có người đảm nhiệm`,
                            )
                        }}
                        className="px-3 py-1.5 text-sm rounded bg-gold-light/20 border border-gold-light/40 text-gold-light disabled:opacity-40"
                      >
                        Phân phối xuống phòng ban
                      </button>
                    )}
                  </div>
                </div>
                {/* Nút bị chặn phải nói vì sao — ẩn đi thì người dùng tưởng chưa có tính năng. */}
                {chotDuoc && lyDoChan && <p className="text-xs text-amber-400 mt-2">{lyDoChan}</p>}
              </div>
            )
          })}
        </section>
      )}

      {/* ══ SỔ PHÂN PHỐI ══ */}
      {tab === 'so-giao' && (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Oo nhan="Đã giao" so={giao.filter((g) => g.status === 'da_giao').length} />
            <Oo nhan="Đã xác nhận" so={giao.filter((g) => g.status === 'da_xac_nhan').length} />
            <Oo
              nhan="Ghế chưa có người"
              so={giao.filter((g) => g.status === 'chua_co_nguoi').length}
              canh={giao.some((g) => g.status === 'chua_co_nguoi')}
              phu="nghị quyết đã giao nhưng không ai nhận"
            />
          </div>
          {giao.length === 0 ? (
            <p className="text-sm text-ink-dim">
              Chưa có nghị quyết nào được phân phối. Nghị quyết phải THÔNG QUA trước mới phân phối
              được — giao bản nháp xuống phòng ban là cách nhanh nhất để cả công ty làm theo một
              quyết định chưa tồn tại.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-ink-dim text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left py-2">Ghế</th>
                  <th className="text-left">Trạng thái</th>
                  <th className="text-left">Xác nhận lúc</th>
                </tr>
              </thead>
              <tbody>
                {giao.map((g) => (
                  <tr key={g.id} className="border-t border-white/5">
                    <td className="py-2">{g.position_code ?? '—'}</td>
                    <td className={g.status === 'chua_co_nguoi' ? 'text-amber-400' : ''}>
                      {TT_GIAO[g.status] ?? g.status}
                    </td>
                    <td className="text-ink-dim">
                      {g.acknowledged_at ? new Date(g.acknowledged_at).toLocaleString('vi-VN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}

function Oo({
  nhan,
  so,
  phu,
  canh,
}: {
  nhan: string
  so: number
  phu?: string
  canh?: boolean
}) {
  return (
    <div className="rounded border border-white/10 p-3">
      <div className="text-xs text-ink-dim">{nhan}</div>
      <div className={`text-2xl font-serif ${canh ? 'text-amber-400' : 'text-gold-light'}`}>{so}</div>
      {phu && <div className="text-xs text-ink-dim mt-0.5">{phu}</div>}
    </div>
  )
}

function O({
  nhan,
  v,
  d,
  goi,
}: {
  nhan: string
  v: string
  d: (v: string) => void
  goi?: string
}) {
  return (
    <label className="text-sm">
      <span className="block text-ink-dim mb-1">{nhan}</span>
      <input
        value={v}
        onChange={(e) => d(e.target.value)}
        placeholder={goi}
        className="w-full bg-black/30 border border-white/15 rounded px-2 py-1.5"
      />
    </label>
  )
}
