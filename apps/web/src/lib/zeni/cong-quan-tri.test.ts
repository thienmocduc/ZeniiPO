import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * CANH BỐN CỬA SAU CỦA KHỐI QUẢN TRỊ.
 *
 * Bối cảnh: `chot_nghi_quyet()` (migration 048) kiểm túc số rất nghiêm — thiếu
 * túc số thì ném lỗi, vì nghị quyết thiếu túc số là vô hiệu. Nhưng khi vừa dựng
 * xong, cửa `PATCH /api/board/resolutions/[id]` dùng khung CRUD chung với lược
 * đồ cho phép sửa thẳng `status: 'approved'` và gõ tay `votes_for` — đi vòng qua
 * toàn bộ hàng rào. **Một hàng rào có cửa sau thì không phải hàng rào.**
 *
 * Bốn bất biến dưới đây là thứ dễ bị mở lại nhất khi ai đó thêm một route mới
 * bằng khung CRUD chung cho nhanh. Chúng canh Ý NGHĨA, không canh cú pháp.
 */

const GOC_API = path.join(process.cwd(), 'src', 'app', 'api', 'board')
const GOC_MIG = path.join(process.cwd(), '..', '..', 'packages', 'database', 'zenicloud')

const doTep = (goc: string): string[] => {
  const ra: string[] = []
  const di = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) di(p)
      else if (e.name.endsWith('.ts')) ra.push(p)
    }
  }
  di(goc)
  return ra
}

const ten = (p: string) => path.relative(path.join(process.cwd(), 'src'), p).replace(/\\/g, '/')

describe('Cổng quản trị không được có cửa sau', () => {
  const tep = doTep(GOC_API)

  it('1. số phiếu là số DẪN RA — không cửa vào nào nhận votes_for/against/abstain', () => {
    const hong: string[] = []
    for (const t of tep) {
      const ma = fs.readFileSync(t, 'utf8')
      // Chỉ soi phần khai lược đồ zod: `votes_for` xuất hiện trong kiểu TypeScript
      // để ĐỌC ra và hiển thị là hoàn toàn đúng — cái sai là NHẬN nó từ người gọi.
      for (const m of ma.matchAll(/(votes_for|votes_against|votes_abstain)\s*:\s*z\./g)) {
        hong.push(`${ten(t)} · nhận "${m[1]}" từ người gọi`)
      }
    }
    expect(
      hong,
      '\nSố phiếu phải đếm từ bảng `board_votes` qua `chot_nghi_quyet()`. Cho gõ tay là ' +
        'cho phép công bố một cuộc biểu quyết chưa từng diễn ra:\n  ' +
        hong.join('\n  ') +
        '\n',
    ).toEqual([])
  })

  it('2. không cửa vào nào cho đặt thẳng board_resolutions.status = approved/executed', () => {
    const hong: string[] = []
    for (const t of tep) {
      const ma = fs.readFileSync(t, 'utf8')
      // `status: z.enum([...])` mà trong danh sách có approved hoặc executed ⇒
      // người gọi tự thông qua nghị quyết được.
      for (const m of ma.matchAll(/status\s*:\s*z\.enum\(\s*\[([^\]]*)\]/g)) {
        if (/'(approved|executed)'/.test(m[1])) {
          hong.push(`${ten(t)} · status z.enum có approved/executed`)
        }
      }
    }
    expect(
      hong,
      '\nThông qua nghị quyết chỉ được đi qua `chot_nghi_quyet()` — nơi túc số tính từ ' +
        'điểm danh thật. Cho đặt trạng thái trực tiếp là vô hiệu hoá cổng túc số:\n  ' +
        hong.join('\n  ') +
        '\n',
    ).toEqual([])
  })

  it('3. khối quản trị KHÔNG dùng khung CRUD chung (khung đó không có móc chặn)', () => {
    const hong: string[] = []
    for (const t of tep) {
      const ma = fs.readFileSync(t, 'utf8')
      if (/createCrud(Item)?Handler/.test(ma)) hong.push(ten(t))
    }
    expect(
      hong,
      '\n`createCrudHandler`/`createCrudItemHandler` ghi thẳng `parsed.data` vào bảng và ' +
        'KHÔNG có chỗ cài điều kiện nghiệp vụ. Bảng quản trị cần chặn theo trạng thái ' +
        '(chỉ sửa khi còn bản nháp, không xoá nghị quyết đã thông qua) nên phải viết tay:\n  ' +
        hong.join('\n  ') +
        '\n',
    ).toEqual([])
  })

  it('4. túc số không có cửa vào — không route nào nhận du_tuc_so / quorum_met', () => {
    const hong: string[] = []
    for (const t of tep) {
      const ma = fs.readFileSync(t, 'utf8')
      for (const m of ma.matchAll(/(du_tuc_so|quorum_met|quorum_achieved|da_du_tuc_so)\s*:\s*z\./g)) {
        hong.push(`${ten(t)} · nhận "${m[1]}" từ người gọi`)
      }
    }
    expect(
      hong,
      '\nTúc số do `tinh_tuc_so()` tính từ `board_attendance`. Một ô tích "đã đủ túc số" ' +
        'là lời khai và vô giá trị khi thẩm định:\n  ' +
        hong.join('\n  ') +
        '\n',
    ).toEqual([])
  })

  it('5. ba hàm quản trị phải tồn tại trong migration, không chỉ trong lời hứa', () => {
    // Bài học từ 026: đầu tệp ghi có `run_valuation()` nhưng hàm chưa bao giờ
    // được tạo — chú thích không phải bằng chứng.
    const sql = fs
      .readdirSync(GOC_MIG)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => fs.readFileSync(path.join(GOC_MIG, f), 'utf8'))
      .join('\n')

    const thieu = ['tinh_tuc_so', 'chot_nghi_quyet', 'phan_phoi_nghi_quyet', 'dem_thanh_vien_doc_lap']
      .filter((h) => !new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+(public\\.)?${h}\\s*\\(`, 'i').test(sql))

    expect(thieu, `\nHàm được nhắc tới nhưng KHÔNG có lệnh tạo: ${thieu.join(', ')}\n`).toEqual([])
  })

  it('6. bảng quản trị mới phải có RLS — thiếu là lộ dữ liệu chéo doanh nghiệp', () => {
    const sql = fs
      .readdirSync(GOC_MIG)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => fs.readFileSync(path.join(GOC_MIG, f), 'utf8'))
      .join('\n')

    const bang = [
      'board_members',
      'board_committees',
      'board_committee_members',
      'board_meetings',
      'board_attendance',
      'board_minutes',
      'board_votes',
      'resolution_distribution',
    ]
    // RLS có thể bật bằng lệnh thẳng hoặc bằng vòng lặp `format(...)`; chấp nhận cả hai,
    // nhưng bảng phải được NHẮC TỚI ở một trong hai chỗ.
    const thieu = bang.filter((b) => {
      const thang = new RegExp(`ALTER\\s+TABLE\\s+${b}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i').test(sql)
      const trongVongLap = new RegExp(`'${b}'`).test(sql) && /ENABLE ROW LEVEL SECURITY', t/i.test(sql)
      return !thang && !trongVongLap
    })
    expect(thieu, `\nBảng chưa bật RLS: ${thieu.join(', ')}\n`).toEqual([])
  })
})
