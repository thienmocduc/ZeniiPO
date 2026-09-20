import { describe, expect, it } from 'vitest'
import { GIOI_HAN_TIEN, PhanTram, SoThapPhan, SoTien, SoTienDuong, SoTienKhongAm } from './so-tien'

describe('Số tiền: một định nghĩa duy nhất', () => {
  it('1. TỪ CHỐI số lẻ — nếu không CSDL bigint sẽ làm tròn im lặng', () => {
    const r = SoTien.safeParse(1234.56)
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].message).toContain('số nguyên')
  })

  it('2. nhận số nguyên, cả âm (lỗ, điều chỉnh giảm)', () => {
    expect(SoTien.parse(120_000_000)).toBe(120_000_000)
    expect(SoTien.parse(-45_000_000)).toBe(-45_000_000)
    expect(SoTien.parse(0)).toBe(0)
  })

  it('3. chặn ở ngưỡng JavaScript còn giữ nguyên vẹn được số nguyên', () => {
    // Quá 2^53 là JS mất chữ số cuối mà KHÔNG ném lỗi — bằng chứng ngay đây:
    expect(9_007_199_254_740_993).toBe(9_007_199_254_740_992)
    expect(GIOI_HAN_TIEN).toBeLessThan(Number.MAX_SAFE_INTEGER)
    expect(SoTien.safeParse(GIOI_HAN_TIEN).success).toBe(true)
    expect(SoTien.safeParse(GIOI_HAN_TIEN + 1).success).toBe(false)
  })

  it('4. loại NaN và vô cực — hai thứ lọt qua z.number() trần', () => {
    expect(SoTien.safeParse(NaN).success).toBe(false)
    expect(SoTien.safeParse(Infinity).success).toBe(false)
  })

  it('5. biến thể không âm / phải dương chặn đúng phía', () => {
    expect(SoTienKhongAm.safeParse(0).success).toBe(true)
    expect(SoTienKhongAm.safeParse(-1).success).toBe(false)
    expect(SoTienDuong.safeParse(0).success).toBe(false)
    expect(SoTienDuong.safeParse(1).success).toBe(true)
  })

  it('6. tỷ lệ và bội số VẪN được có phần lẻ — không bị số tiền ép nhầm', () => {
    expect(SoThapPhan.parse(18.6)).toBe(18.6) // bội số EV/EBITDA
    expect(PhanTram.parse(62.5)).toBe(62.5)
    expect(PhanTram.safeParse(101).success).toBe(false)
    expect(PhanTram.safeParse(-1).success).toBe(false)
  })
})
