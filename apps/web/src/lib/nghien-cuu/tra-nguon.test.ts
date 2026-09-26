import { describe, it, expect } from 'vitest'
import { soCoTrongTrichDan, urlAnToan, xacMinhTrichDan } from './tra-nguon'

const TRANG = `
Báo cáo ngành phần mềm Việt Nam 2026

Doanh thu toàn ngành đạt 148.500 tỷ đồng trong năm 2025, tăng 18,4% so với năm trước.
Số doanh nghiệp đang hoạt động là 12.450 đơn vị.
Tỷ lệ doanh nghiệp xuất khẩu chiếm 31.2% tổng số.
Giá trị thị trường nội địa khoảng 2,1 tỷ USD.
`

describe('Chống bịa số liệu — xác minh đoạn trích', () => {
  it('NHẬN dòng có đoạn trích thật và số thật', () => {
    const r = xacMinhTrichDan(TRANG, [
      {
        metric_type: 'doanh_thu_nganh',
        value_numeric: 148500,
        value_unit: 'tỷ đồng',
        trich_dan: 'Doanh thu toàn ngành đạt 148.500 tỷ đồng trong năm 2025',
      },
    ])
    expect(r.nhan).toHaveLength(1)
    expect(r.loai).toHaveLength(0)
  })

  it('LOẠI dòng mà đoạn trích KHÔNG có trong trang — đây là đòn chính', () => {
    // Đây đúng là hình dạng của số liệu lấy từ ký ức mô hình: nghe rất thật,
    // dẫn nguồn rất tự tin, nhưng trang không hề chứa câu đó.
    const r = xacMinhTrichDan(TRANG, [
      {
        metric_type: 'quy_mo_thi_truong',
        value_numeric: 5200,
        value_unit: 'triệu USD',
        trich_dan: 'Thị trường phần mềm Việt Nam đạt 5.200 triệu USD năm 2025 theo Gartner',
      },
    ])
    expect(r.nhan).toHaveLength(0)
    expect(r.loai[0].ly_do).toContain('KHÔNG có trong trang')
  })

  it('LOẠI dòng có đoạn trích thật nhưng số KHÔNG nằm trong đoạn trích đó', () => {
    // Kiểu lỗi tinh vi hơn: mô hình copy đúng một câu trong trang rồi gắn vào
    // một con số khác. Đoạn trích qua được bước một, nên phải có bước hai.
    const r = xacMinhTrichDan(TRANG, [
      {
        metric_type: 'doanh_thu_nganh',
        value_numeric: 999999,
        value_unit: 'tỷ đồng',
        trich_dan: 'Doanh thu toàn ngành đạt 148.500 tỷ đồng trong năm 2025',
      },
    ])
    expect(r.nhan).toHaveLength(0)
    expect(r.loai[0].ly_do).toContain('không xuất hiện trong chính đoạn trích')
  })

  it('LOẠI dòng không kèm đoạn trích', () => {
    const r = xacMinhTrichDan(TRANG, [
      { metric_type: 'x', value_numeric: 1, value_unit: 'u', trich_dan: '' },
      { metric_type: 'y', value_numeric: 2, value_unit: 'u', trich_dan: 'ngắn' },
    ])
    expect(r.nhan).toHaveLength(0)
    expect(r.loai).toHaveLength(2)
  })

  it('không bị lệ thuộc khoảng trắng và chữ hoa thường', () => {
    const r = xacMinhTrichDan(TRANG, [
      {
        metric_type: 'so_doanh_nghiep',
        value_numeric: 12450,
        value_unit: 'đơn vị',
        trich_dan: '  Số   DOANH NGHIỆP đang hoạt động là 12.450 đơn vị  ',
      },
    ])
    expect(r.nhan).toHaveLength(1)
  })
})

describe('So khớp số theo nhiều cách viết', () => {
  it('chịu được cách viết Việt và Anh của cùng một giá trị', () => {
    expect(soCoTrongTrichDan(148500, 'đạt 148.500 tỷ đồng')).toBe(true)   // chấm phân nhóm
    expect(soCoTrongTrichDan(148500, 'reached 148,500 billion')).toBe(true) // phẩy phân nhóm
    expect(soCoTrongTrichDan(18.4, 'tăng 18,4% so với năm trước')).toBe(true) // phẩy thập phân
    expect(soCoTrongTrichDan(31.2, 'chiếm 31.2% tổng số')).toBe(true)      // chấm thập phân
    expect(soCoTrongTrichDan(2.1, 'khoảng 2,1 tỷ USD')).toBe(true)
  })

  it('KHÔNG nhận con số không có trong đoạn trích', () => {
    expect(soCoTrongTrichDan(5200, 'đạt 148.500 tỷ đồng')).toBe(false)
    expect(soCoTrongTrichDan(0.184, 'tăng 18,4%')).toBe(false) // 18,4 không phải 0,184
  })

  it('chấp nhận lệch làm tròn rất nhỏ nhưng không nhiều hơn', () => {
    expect(soCoTrongTrichDan(18.4, 'tăng 18,42%')).toBe(true)   // lệch 0,1%
    expect(soCoTrongTrichDan(18.4, 'tăng 18,9%')).toBe(false)   // lệch 2,7% — quá nhiều
  })
})

describe('Chặn địa chỉ nội bộ (SSRF)', () => {
  it('nhận địa chỉ công khai', () => {
    expect(urlAnToan('https://gso.gov.vn/bao-cao').ok).toBe(true)
    expect(urlAnToan('http://vneconomy.vn/x').ok).toBe(true)
  })

  it('CHẶN loopback, mạng riêng và điểm metadata của nhà cung cấp mây', () => {
    for (const u of [
      'http://localhost:3000/',
      'http://127.0.0.1/',
      'http://10.0.0.5:5432/',
      'http://192.168.1.1/',
      'http://172.16.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/',
      'http://db.internal/',
      'http://may.local/',
    ]) {
      expect(urlAnToan(u).ok, `${u} phải bị chặn`).toBe(false)
    }
  })

  it('CHẶN giao thức không phải http/https', () => {
    for (const u of ['file:///etc/passwd', 'gopher://x/', 'ftp://x/']) {
      expect(urlAnToan(u).ok, `${u} phải bị chặn`).toBe(false)
    }
  })

  it('CHẶN địa chỉ không hợp lệ', () => {
    expect(urlAnToan('khong-phai-url').ok).toBe(false)
    expect(urlAnToan('').ok).toBe(false)
  })
})
