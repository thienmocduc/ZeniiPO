'use client';

/**
 * CHÚ NGHĨA THUẬT NGỮ — hiện nghĩa tiếng Việt NGAY BÊN CẠNH thuật ngữ chuyên ngành.
 *
 * Chairman 20/09/2026: *"còn nhiều tiếng Anh quá, có thể đó là thuật ngữ chuyên
 * môn nên ta cần có song ngữ bên cạnh để người dùng hiểu các thuật ngữ, còn
 * tiếng Anh thì 100% không cần dịch song ngữ"*.
 *
 * Nên chia đôi: chữ tiếng Anh THƯỜNG đã dịch hẳn sang tiếng Việt (2 đợt, 599
 * chỗ). Còn THUẬT NGỮ thì giữ nguyên — giới làm nghề ở Việt Nam vẫn gọi ARR là
 * ARR, gọi term sheet là term sheet; dịch ép thành "bảng điều khoản sơ bộ" ở
 * mọi chỗ chỉ làm người đọc phải dịch ngược lại trong đầu.
 *
 * Cách làm: sau khi trang dựng xong, đi qua các nút chữ trong vùng nội dung,
 * tìm thuật ngữ đã khai trong `thuat-ngu.ts` và bọc lại thành
 *   <abbr>ARR<span>doanh thu định kỳ năm</span></abbr>
 * — nghĩa ngắn hiện ngay cạnh, rê chuột ra câu giải thích đầy đủ.
 *
 * BỐN RÀNG BUỘC để không phá giao diện:
 *  1. CHỈ chú lần XUẤT HIỆN ĐẦU TIÊN của mỗi thuật ngữ trên một trang. Lặp lại
 *     ở mọi ô trong bảng thì bảng vỡ và người đọc bị nhiễu.
 *  2. Không đụng vào ô nhập, nút, mã nguồn, đường dẫn, hay chỗ đã chú rồi.
 *  3. Không đụng vào phần tử chỉ chứa CON SỐ hoặc nằm trong biểu đồ (svg).
 *  4. Chạy lại mỗi khi đổi trang, và tự dọn khi rời trang.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { THUAT_NGU } from '@/lib/v1/thuat-ngu';

/** Thẻ không được chạm vào — chạm là hỏng chức năng hoặc hỏng bố cục. */
const THE_CAM = new Set([
  'SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'CODE', 'PRE',
  'SVG', 'PATH', 'TEXT', 'CANVAS', 'ABBR', 'BUTTON', 'A',
]);

/** Thuật ngữ dài đặt trước để "Burn multiple" không bị khớp mất chữ "Burn". */
const DANH_SACH = [...THUAT_NGU].sort((a, b) => b.tu.length - a.tu.length);

const BIEU_THUC = new RegExp(
  `(?<![\\w-])(${DANH_SACH.map((t) => t.tu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`,
);

const TRA = new Map(DANH_SACH.map((t) => [t.tu.toLowerCase(), t]));

export function ChuThuatNgu() {
  const pathname = usePathname();

  useEffect(() => {
    const goc = document.querySelector('.main');
    if (!goc) return;

    const daChu = new Set<string>();
    const daTao: HTMLElement[] = [];

    /**
     * Quét và chú nghĩa. Gọi lại được nhiều lần: `daChu` nhớ thuật ngữ đã chú
     * nên lần sau chỉ xử phần nội dung mới.
     */
    const quet = () => {
      const diBo = document.createTreeWalker(goc, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const cha = node.parentElement;
          if (!cha) return NodeFilter.FILTER_REJECT;
          if (THE_CAM.has(cha.tagName)) return NodeFilter.FILTER_REJECT;
          if (cha.closest('abbr.zi-tn, svg, button, a, input, .ph-r')) {
            return NodeFilter.FILTER_REJECT;
          }
          const t = node.nodeValue ?? '';
          if (t.trim().length < 2) return NodeFilter.FILTER_REJECT;
          return BIEU_THUC.test(t) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });

      const canXu: Text[] = [];
      let n = diBo.nextNode();
      while (n) {
        canXu.push(n as Text);
        n = diBo.nextNode();
      }

      for (const nut of canXu) {
        const chu = nut.nodeValue ?? '';
        const khop = BIEU_THUC.exec(chu);
        if (!khop) continue;

        const tu = khop[1];
        const khoa = tu.toLowerCase();
        if (daChu.has(khoa)) continue; // chỉ chú lần đầu tiên trên trang
        const muc = TRA.get(khoa);
        if (!muc) continue;
        daChu.add(khoa);

        const vt = khop.index;
        const sau = nut.splitText(vt);
        sau.splitText(tu.length);

        const boc = document.createElement('abbr');
        boc.className = 'zi-tn';
        boc.title = `${muc.nghia} — ${muc.giai_thich}`;
        boc.textContent = tu;

        const nghia = document.createElement('span');
        nghia.className = 'zi-tn-nghia';
        nghia.textContent = muc.nghia;
        boc.appendChild(nghia);

        sau.parentNode?.replaceChild(boc, sau);
        daTao.push(boc);
      }
    };

    /**
     * VÌ SAO THEO DÕI THAY ĐỔI, KHÔNG HẸN GIỜ CỨNG (sửa 20/09/2026):
     * bản đầu chỉ hẹn 450ms rồi quét một lần. Nhưng nội dung trang do bộ đổ dữ
     * liệu nạp về SAU đó — lúc quét thì vùng nội dung còn rỗng, nên không chú
     * được chữ nào, và nó không bao giờ chạy lại. Đo trên bản chạy thật:
     * `abbr.zi-tn` = 0. Nay quét lại mỗi khi nội dung đổi.
     */
    let hen: number | undefined;
    const hoan = () => {
      window.clearTimeout(hen);
      hen = window.setTimeout(quet, 250);
    };

    hoan();
    const theoDoi = new MutationObserver((thayDoi) => {
      // Bỏ qua chính những thay đổi do mình vừa tạo ra, nếu không sẽ tự kích
      // hoạt mình vô hạn.
      const cuaNguoiKhac = thayDoi.some((t) =>
        !(t.target instanceof Element && t.target.closest('abbr.zi-tn')),
      );
      if (cuaNguoiKhac) hoan();
    });
    theoDoi.observe(goc, { childList: true, subtree: true, characterData: true });

    return () => {
      window.clearTimeout(hen);
      theoDoi.disconnect();
      // Dọn sạch khi rời trang: trả chữ về nguyên trạng, tránh chồng lớp chú
      // giải qua nhiều lần điều hướng.
      for (const el of daTao) {
        const cha = el.parentNode;
        if (!cha) continue;
        cha.replaceChild(document.createTextNode(el.firstChild?.nodeValue ?? el.textContent ?? ''), el);
        cha.normalize();
      }
    };
  }, [pathname]);

  return null;
}
