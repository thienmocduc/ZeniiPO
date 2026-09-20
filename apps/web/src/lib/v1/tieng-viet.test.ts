/**
 * GIAO DIỆN PHẢI LÀ TIẾNG VIỆT — canh để tiếng Anh không lẻn vào lại.
 *
 * Chairman 20/09/2026: *"hiện tại tiếng Anh tiếng Việt lẫn lộn, mình đang cấp
 * dịch vụ cho người Việt mà"*. Lúc đó đếm được **203 chỗ** chữ tiếng Anh hiện
 * ra màn hình — chủ yếu trong bản dựng V1 (`source.html`): Export, Board,
 * Status, Team, Burn, Runway, Data Room, Cap Table…
 *
 * Việt hoá một lần thì dễ; giữ cho nó đừng quay lại mới khó, vì mỗi lần thêm
 * một khối giao diện là một lần chữ tiếng Anh có thể lọt vào. Nên test này canh
 * thường trực.
 *
 * KHÔNG dịch và KHÔNG tính là lỗi: thuật ngữ ngành đã dùng nguyên gốc trong
 * giới tài chính Việt Nam (IPO, KPI, OKR, ARR, EBITDA, SGX, ESOP, NDA…) và
 * những từ mượn đã thành tiếng Việt thông dụng (Email).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Từ tiếng Anh KHÔNG được hiện ra màn hình. */
const TU_CAM = [
  'Dashboard', 'Settings', 'Overview', 'Summary', 'Details', 'Search', 'Filter',
  'Export', 'Import', 'Save', 'Cancel', 'Delete', 'Edit', 'Create', 'Remove',
  'Submit', 'Loading', 'Warning', 'Download', 'Upload', 'Refresh', 'Continue',
  'Confirm', 'Apply', 'Reset', 'Select', 'Choose', 'Update', 'Manage', 'Status',
  'Actions', 'Action', 'Password', 'Revenue', 'Growth', 'Runway', 'Report',
  'Timeline', 'Board', 'Tasks', 'Task', 'Users', 'Metrics', 'Insights',
  'Activity', 'History', 'Draft', 'Published', 'Pending', 'Completed', 'Progress',
];

/** Được phép: từ mượn đã thành tiếng Việt, và tên riêng. */
const CHO_PHEP = /^(Email|Zeni|ZeniIPO|Zeniipo|Google|GitHub|Noto Sans)$/;

const GOC_SRC = path.join(process.cwd(), 'src');

function docChuHienRa(html: string): string[] {
  // Bỏ hẳn <script> và <style> — chữ trong đó không hiện ra màn hình.
  const than = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  return [...than.matchAll(/>([^<>{}]{2,90})</g)].map((m) => m[1]);
}

describe('Giao diện phải là tiếng Việt', () => {
  it('1. bản dựng V1 không còn chữ tiếng Anh hiện ra màn hình', () => {
    const p = path.join(GOC_SRC, 'lib', 'v1', 'source.html');
    const chu = docChuHienRa(fs.readFileSync(p, 'utf8'));

    const hong: string[] = [];
    for (const doan of chu) {
      for (const tu of TU_CAM) {
        const re = new RegExp(`(?<![\\w-])${tu}(?![\\w-])`);
        if (re.test(doan) && !CHO_PHEP.test(doan.trim())) {
          hong.push(`"${tu}" trong: ${doan.trim().slice(0, 60)}`);
        }
      }
    }

    expect(
      [...new Set(hong)],
      `\nCòn ${hong.length} chỗ tiếng Anh trên giao diện — người dùng của mình là người Việt:\n  ` +
        [...new Set(hong)].slice(0, 25).join('\n  ') +
        '\n',
    ).toEqual([]);
  });

  it('2. component React không hiện chữ tiếng Anh ra màn hình', () => {
    const hong: string[] = [];

    const duyet = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          // Bỏ qua route API: chữ ở đó là thông điệp máy, không hiện ra màn hình.
          if (e.name === 'api') continue;
          duyet(p);
        } else if (e.name.endsWith('.tsx')) {
          const ma = fs.readFileSync(p, 'utf8');
          // Chữ nằm giữa hai thẻ JSX.
          for (const m of ma.matchAll(/>\s*([A-Z][A-Za-z ]{2,45})\s*</g)) {
            const doan = m[1].trim();
            if (CHO_PHEP.test(doan)) continue;
            for (const tu of TU_CAM) {
              if (new RegExp(`(?<![\\w-])${tu}(?![\\w-])`).test(doan)) {
                hong.push(`${path.relative(GOC_SRC, p).replace(/\\/g, '/')}: "${doan}"`);
              }
            }
          }
        }
      }
    };
    duyet(GOC_SRC);

    expect(
      [...new Set(hong)],
      `\nCòn chữ tiếng Anh trong component:\n  ${[...new Set(hong)].slice(0, 25).join('\n  ')}\n`,
    ).toEqual([]);
  });
});
