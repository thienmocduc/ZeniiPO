'use client';

/**
 * NÚT CHUYỂN SÁNG / TỐI.
 *
 * Hai bộ màu khai độc lập trong `globals.css` (`:root` = tối, `[data-theme="sang"]`
 * = sáng). Nút này chỉ đổi đúng một thuộc tính trên thẻ <html> — không đụng vào
 * lớp CSS nào, nên không có chuyện đổi chế độ mà sót màu.
 *
 * Nút được chèn vào `.tb-r` của thanh trên (khối do bản dựng V1 sinh ra bằng
 * HTML thô) — cùng cách làm với nút Đăng xuất.
 */

import { useEffect, useState } from 'react';
import { KHOA_CHE_DO, docCheDo, datCheDo, type CheDo } from '@/lib/zeni/che-do';

const ID_NUT = 'zi-doi-che-do';

export function DoiCheDo() {
  const [cheDo, setCheDoState] = useState<CheDo>('toi');

  useEffect(() => {
    setCheDoState(docCheDo());
  }, []);

  useEffect(() => {
    const host = document.querySelector<HTMLElement>('.tb-r');
    if (!host) return;

    let nut = document.getElementById(ID_NUT) as HTMLButtonElement | null;
    if (!nut) {
      nut = document.createElement('button');
      nut.id = ID_NUT;
      nut.className = 'tb-btn';
      nut.type = 'button';
      // Chèn lên ĐẦU `.tb-r` để nó không chen vào giữa cụm hồ sơ người dùng.
      host.insertBefore(nut, host.firstChild);
    }

    const ve = (c: CheDo) => {
      nut!.textContent = c === 'sang' ? '☀' : '☾';
      nut!.title = c === 'sang' ? 'Đang ở chế độ sáng — bấm để chuyển tối' : 'Đang ở chế độ tối — bấm để chuyển sáng';
      nut!.setAttribute('aria-label', nut!.title);
    };
    ve(cheDo);

    const bam = () => {
      const moi: CheDo = document.documentElement.dataset.theme === 'sang' ? 'toi' : 'sang';
      datCheDo(moi);
      setCheDoState(moi);
      ve(moi);
    };
    nut.addEventListener('click', bam);
    return () => nut?.removeEventListener('click', bam);
  }, [cheDo]);

  return null;
}

export { KHOA_CHE_DO };
