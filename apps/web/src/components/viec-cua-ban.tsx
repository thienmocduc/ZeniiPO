'use client';

/**
 * "VIỆC CỦA BẠN" — khối đầu thanh bên, gom những mục đúng vai người đang dùng.
 *
 * Chairman hỏi: *"C-level sẽ đăng nhập cổng nào và giao diện của từng vị trí
 * C-level thấy dashboard thế nào?"*
 *
 * Cổng thì chỉ có MỘT (`zeniipo.com/login`) — tách cổng cho mỗi vai là chẻ danh
 * tính ra nhiều chỗ và đến lúc một người kiêm hai vai thì vỡ. Cái phải đổi là
 * MÀN HÌNH TỰ LẮP theo vai.
 *
 * Trước đây 8 vai thấy y hệt nhau, phải lội qua 51 mục menu. Nay mở lên là thấy
 * ngay 5–9 mục đúng việc của mình, kèm MỘT CÂU nói rõ vì sao vai đó cần nhìn
 * thứ đó trước — để người mới vào hiểu công việc chứ không chỉ thấy cái menu.
 *
 * ⚠ Khối này KHÔNG giấu mục nào. Menu đầy đủ vẫn nằm nguyên bên dưới. Giấu mục
 * đi không phải là phân quyền — quyền do RLS ở CSDL giữ; nhầm hai thứ đó là tự
 * tạo ra cảm giác an toàn giả.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Khoi = { block_key: string; title_vi: string; why_vi: string | null };

const TEN_VAI: Record<string, string> = {
  chr: 'Chủ tịch',
  ceo: 'Tổng giám đốc',
  cfo: 'Giám đốc tài chính',
  coo: 'Giám đốc vận hành',
  cto: 'Giám đốc công nghệ',
  cmo: 'Giám đốc tiếp thị',
  clo: 'Giám đốc pháp chế',
  emp: 'Nhân viên',
};

export function ViecCuaBan() {
  const [khoi, setKhoi] = useState<Khoi[] | null>(null);
  const [vai, setVai] = useState<string>('emp');
  const duongDan = usePathname();

  useEffect(() => {
    let huy = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/layout');
        if (!res.ok) return;
        const j = (await res.json()) as { vai?: string; data?: Khoi[] };
        if (huy) return;
        setVai(j.vai ?? 'emp');
        setKhoi(j.data ?? []);
      } catch {
        /* không lấy được bố cục thì thôi — menu đầy đủ vẫn nằm bên dưới */
      }
    })();
    return () => {
      huy = true;
    };
  }, []);

  // Chưa tải xong, hoặc vai chưa có bố cục ⇒ không hiện gì. Thà không có khối
  // này còn hơn hiện một khối rỗng trông như hỏng.
  if (!khoi || khoi.length === 0) return null;

  return (
    <nav className="zi-viec" aria-label="Việc của bạn" data-testid="viec-cua-ban">
      <div className="zi-viec-dau">
        <span>Việc của bạn</span>
        <b>{TEN_VAI[vai] ?? vai}</b>
      </div>
      <ul>
        {khoi.map((k) => {
          const dangXem = duongDan === k.block_key;
          return (
            <li key={k.block_key}>
              <Link
                href={k.block_key}
                className={`zi-viec-muc${dangXem ? ' zi-dang-xem' : ''}`}
                title={k.why_vi ?? undefined}
              >
                <span className="zi-viec-ten">{k.title_vi}</span>
                {k.why_vi && <span className="zi-viec-vi-sao">{k.why_vi}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
