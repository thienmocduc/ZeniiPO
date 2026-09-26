import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  GIOI_HAN_BYTE_CSDL,
  duongDanLuuTru,
  kiemTep,
} from './ho-so'

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0x20)])
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
const DOCX = Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(32)])
const HAN = GIOI_HAN_BYTE_CSDL

describe('Kiểm hồ sơ tải lên', () => {
  it('nhận PDF thật', () => {
    const r = kiemTep('application/pdf', PDF, HAN)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.duoi).toBe('pdf')
  })

  it('nhận PNG và DOCX thật', () => {
    expect(kiemTep('image/png', PNG, HAN).ok).toBe(true)
    expect(
      kiemTep(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        DOCX,
        HAN,
      ).ok,
    ).toBe(true)
  })

  it('bỏ được tham số charset trong content-type', () => {
    // Trình duyệt gửi `text/csv; charset=utf-8`. So chuỗi nguyên bản là từ chối oan.
    expect(kiemTep('text/csv; charset=utf-8', Buffer.from('a,b\n1,2'), HAN).ok).toBe(true)
  })

  it('CHẶN tệp HTML khai là application/pdf — đây là đòn chính', () => {
    // Loại tấn công: `content-type` là chuỗi do phía gọi đặt, đổi được tự do.
    // Nếu chỉ so chuỗi thì một trang HTML có mã chèn sẽ được lưu thành "bằng
    // chứng PDF", và người mở nó là người có quyền cao nhất trong doanh nghiệp.
    const html = Buffer.from('<html><script>fetch("/api/admin/cap-goi")</script></html>')
    const r = kiemTep('application/pdf', html, HAN)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.loi).toContain('không khớp loại đã khai')
  })

  it('CHẶN text/html và image/svg+xml ngay từ danh sách cho phép', () => {
    for (const mime of ['text/html', 'image/svg+xml', 'application/xhtml+xml']) {
      const r = kiemTep(mime, Buffer.from('<svg onload="alert(1)"/>'), HAN)
      expect(r.ok, `${mime} phải bị từ chối`).toBe(false)
    }
  })

  it('CHẶN tệp thực thi và loại không khai', () => {
    expect(kiemTep('application/x-msdownload', Buffer.from('MZ'), HAN).ok).toBe(false)
    expect(kiemTep('', PDF, HAN).ok).toBe(false)
    expect(kiemTep('application/octet-stream', PDF, HAN).ok).toBe(false)
  })

  it('CHẶN tệp rỗng và tệp vượt hạn mức', () => {
    expect(kiemTep('application/pdf', Buffer.alloc(0), HAN).ok).toBe(false)
    const to = Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(HAN + 1)])
    const r = kiemTep('application/pdf', to, HAN)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.loi).toContain('vượt hạn mức')
  })

  it('băm SHA-256 đúng nội dung — nền của việc chứng minh tệp chưa bị tráo', () => {
    const r = kiemTep('application/pdf', PDF, HAN)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.sha256).toBe(createHash('sha256').update(PDF).digest('hex'))
      expect(r.sha256).toHaveLength(64)
    }
  })

  it('băm phân biệt được hai tệp khác nhau một byte', () => {
    const a = kiemTep('application/pdf', PDF, HAN)
    const khac = Buffer.from(PDF)
    khac[khac.length - 1] = 0x21
    const b = kiemTep('application/pdf', khac, HAN)
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) expect(a.sha256).not.toBe(b.sha256)
  })
})

describe('Đường dẫn lưu trữ', () => {
  const TENANT = '450427e3-4bec-4380-8664-830ef494ff97'

  it('luôn mở đầu bằng tiền tố doanh nghiệp', () => {
    expect(duongDanLuuTru(TENANT, 'pdf')).toMatch(
      new RegExp(`^ho-so/${TENANT}/\\d{4}-\\d{2}/[0-9a-f-]{36}\\.pdf$`),
    )
  })

  it('hai lần gọi cho hai đường khác nhau — tệp sau không đè tệp trước', () => {
    expect(duongDanLuuTru(TENANT, 'pdf')).not.toBe(duongDanLuuTru(TENANT, 'pdf'))
  })

  it('KHÔNG lấy tên tệp người dùng làm đường dẫn', () => {
    // Hàm không nhận tên tệp làm tham số — đó là thiết kế, không phải thiếu sót.
    // Tên tệp là dữ liệu do người ngoài đặt: chứa được `../`, chứa được ký tự
    // làm vỡ đường dẫn, và hai người tải cùng tên thì tệp sau đè tệp trước.
    const d = duongDanLuuTru(TENANT, 'pdf')
    expect(d).not.toContain('..')
    expect(d.split('/')).toHaveLength(4)
    expect(duongDanLuuTru.length).toBe(2) // (tenantId, duoi) — không có tham số tên tệp
  })
})
