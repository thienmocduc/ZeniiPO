'use client';

/**
 * Ô CHỌN CÔNG TY — nằm ở ĐẦU THANH BÊN, ngay trên "Bảng điều khiển".
 *
 * Trước đây ô này nằm trên thanh trên cùng, chen giữa logo và ô tìm kiếm, và
 * cái mũi tên xuống chỉ là hình vẽ — bấm vào không mở ra gì. Chairman yêu cầu
 * đưa xuống thanh bên và giữ được cấu trúc đóng/mở để nhìn thấy các công ty
 * trong hệ sinh thái.
 *
 * Danh sách lấy từ `/api/tenants/switchable`, vốn gọi hàm CSDL
 * `list_accessible_tenants()`: chủ nền tảng thấy mọi công ty, người dùng
 * thường chỉ thấy công ty của mình. Quyền quyết định nằm ở CSDL, không phải ở
 * đây — đúng nguyên tắc cách ly tuyệt đối.
 */

import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';

type CongTy = { id: string; name: string; slug: string; plan: string | null };

export function TenantSwitcher() {
  const [ds, setDs] = useState<CongTy[] | null>(null);
  const [hienTai, setHienTai] = useState<string | null>(null);
  const [mo, setMo] = useState(false);
  const [loi, setLoi] = useState(false);
  const boc = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let huy = false;
    (async () => {
      try {
        const res = await fetch('/api/tenants/switchable');
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { data?: CongTy[]; hien_tai?: string | null };
        if (huy) return;
        setDs(j.data ?? []);
        setHienTai(j.hien_tai ?? null);
      } catch {
        if (!huy) setLoi(true);
      }
    })();
    return () => {
      huy = true;
    };
  }, []);

  // Bấm ra ngoài thì đóng — nếu không, danh sách che mất menu bên dưới.
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => {
      if (boc.current && !boc.current.contains(e.target as Node)) setMo(false);
    };
    const phim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMo(false);
    };
    document.addEventListener('mousedown', ngoai);
    document.addEventListener('keydown', phim);
    return () => {
      document.removeEventListener('mousedown', ngoai);
      document.removeEventListener('keydown', phim);
    };
  }, [mo]);

  const dangXem = ds?.find((t) => t.id === hienTai) ?? ds?.[0] ?? null;
  const nhieuHonMot = (ds?.length ?? 0) > 1;

  return (
    <div ref={boc} className="zi-tenant" data-testid="chon-cong-ty">
      <button
        type="button"
        className="zi-tenant-btn"
        aria-haspopup="listbox"
        aria-expanded={mo}
        disabled={!nhieuHonMot}
        onClick={() => setMo((v) => !v)}
        title={nhieuHonMot ? 'Chuyển công ty' : 'Bạn đang ở công ty duy nhất mình có quyền'}
      >
        <span className="zi-tenant-ic">
          {dangXem ? dangXem.name.trim()[0]?.toUpperCase() : <Building2 size={13} />}
        </span>
        <span className="zi-tenant-txt">
          <b>{ds === null && !loi ? 'Đang tải…' : (dangXem?.name ?? 'Chưa có công ty')}</b>
          <span>
            {loi
              ? 'không tải được danh sách'
              : dangXem
                ? `gói ${dangXem.plan ?? 'free'}`
                : '—'}
          </span>
        </span>
        {ds === null && !loi ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          nhieuHonMot && <ChevronDown size={14} className={mo ? 'zi-xoay' : undefined} />
        )}
      </button>

      {mo && ds && (
        <ul className="zi-tenant-menu" role="listbox">
          <li className="zi-tenant-head">Công ty trong hệ sinh thái · {ds.length}</li>
          {ds.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                role="option"
                aria-selected={t.id === hienTai}
                className={`zi-tenant-item${t.id === hienTai ? ' zi-dang-xem' : ''}`}
                onClick={() => {
                  setMo(false);
                  if (t.id === hienTai) return;
                  // Chuyển công ty đổi ngữ cảnh dữ liệu của toàn bộ màn hình,
                  // nên nạp lại trang thay vì vá từng chỗ — chắc chắn không còn
                  // số liệu của công ty cũ nằm lại đâu đó.
                  window.location.href = `/dashboard?ws=${encodeURIComponent(t.slug)}`;
                }}
              >
                <span className="zi-tenant-ic sm">{t.name.trim()[0]?.toUpperCase()}</span>
                <span className="zi-tenant-txt">
                  <b>{t.name}</b>
                  <span>gói {t.plan ?? 'free'}</span>
                </span>
                {t.id === hienTai && <Check size={13} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
