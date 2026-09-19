/**
 * TEST CHUẨN HOÁ SỐ LIỆU VIỆT NAM
 *
 * Đây là khâu nguy hiểm nhất của việc đấu nối dữ liệu: đọc sai dấu chấm là sai
 * tiền 1.000 lần. "1.500.000" ở Việt Nam là một triệu rưỡi, nhưng "1500.75" lại
 * là số thập phân. Hai trường hợp nhìn giống nhau với máy.
 */
import { describe, expect, it } from 'vitest'
import { toDate, toMonthDate, toNumber } from './ingest'

describe('Đọc số tiền kiểu Việt Nam', () => {
  it('1. dấu chấm ngăn hàng nghìn: "1.500.000" = một triệu rưỡi', () => {
    expect(toNumber('1.500.000')).toBe(1_500_000)
  })

  it('2. nhiều nhóm nghìn: "1.234.567.890" đọc đúng', () => {
    expect(toNumber('1.234.567.890')).toBe(1_234_567_890)
  })

  it('3. dấu chấm thập phân: "1500.75" KHÔNG phải 150075', () => {
    expect(toNumber('1500.75')).toBe(1500.75)
  })

  it('4. dấu phẩy thập phân kiểu Việt Nam: "1.500,25"', () => {
    expect(toNumber('1.500,25')).toBe(1500.25)
  })

  it('5. ngoặc đơn trong kế toán nghĩa là số ÂM: "(500)" = −500', () => {
    expect(toNumber('(500)')).toBe(-500)
  })

  it('6. ngoặc đơn kèm nhóm nghìn: "(1.200.000)" = −1.200.000', () => {
    expect(toNumber('(1.200.000)')).toBe(-1_200_000)
  })

  it('7. bỏ ký hiệu tiền tệ và khoảng trắng', () => {
    expect(toNumber(' 1.500.000 ₫ ')).toBe(1_500_000)
    expect(toNumber('đ 250.000')).toBe(250_000)
  })

  it('8. số thuần và số âm thường', () => {
    expect(toNumber(42)).toBe(42)
    expect(toNumber('-750')).toBe(-750)
  })

  it('9. ô trống / không đọc được thì trả undefined, KHÔNG trả 0 (0 là con số có nghĩa)', () => {
    expect(toNumber('')).toBeUndefined()
    expect(toNumber(null)).toBeUndefined()
    expect(toNumber(undefined)).toBeUndefined()
    expect(toNumber('không phải số')).toBeUndefined()
  })
})

describe('Chuẩn hoá ngày tháng', () => {
  it('10. ngày Việt Nam "15/06/2026" là 15 tháng 6, không phải 6 tháng 15', () => {
    expect(toDate('15/06/2026')).toBe('2026-06-15')
  })

  it('11. kỳ báo cáo luôn quy về ngày đầu tháng (để ghép nhiều nguồn)', () => {
    expect(toMonthDate('2026-06')).toBe('2026-06-01')
    expect(toMonthDate('06/2026')).toBe('2026-06-01')
  })

  it('12. ngày không hợp lệ trả undefined thay vì đoán bừa (fail-closed)', () => {
    expect(toDate('32/13/2026')).toBeUndefined()
    expect(toDate('')).toBeUndefined()
  })
})
