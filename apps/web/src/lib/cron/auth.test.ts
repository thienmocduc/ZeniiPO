import { describe, expect, it, afterEach } from 'vitest'
import { isAuthorizedCron } from './auth'

const req = (h: Record<string, string>) => new Request('https://zeniipo.com/api/cron/x', { headers: h })
const secretGoc = process.env.CRON_SECRET
afterEach(() => {
  if (secretGoc === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = secretGoc
})

describe('Xác thực lịch chạy định kỳ', () => {
  it('1. header x-vercel-cron KHÔNG còn mở được cửa', () => {
    // Đây chính là lỗ hổng cũ: ứng dụng không còn chạy trên Vercel nên không
    // có gì lọc header này, ai gửi cũng được.
    process.env.CRON_SECRET = 'bi-mat-that'
    expect(isAuthorizedCron(req({ 'x-vercel-cron': '1' }))).toBe(false)
  })

  it('2. chưa cấu hình CRON_SECRET thì TỪ CHỐI HẾT, không mở toang', () => {
    delete process.env.CRON_SECRET
    expect(isAuthorizedCron(req({ authorization: 'Bearer bat-ky' }))).toBe(false)
    expect(isAuthorizedCron(req({ 'x-vercel-cron': '1' }))).toBe(false)
  })

  it('3. đúng bí mật thì qua', () => {
    process.env.CRON_SECRET = 'bi-mat-that'
    expect(isAuthorizedCron(req({ authorization: 'Bearer bi-mat-that' }))).toBe(true)
  })

  it('4. sai bí mật, thiếu tiền tố, hoặc rỗng đều bị chặn', () => {
    process.env.CRON_SECRET = 'bi-mat-that'
    expect(isAuthorizedCron(req({ authorization: 'Bearer sai' }))).toBe(false)
    expect(isAuthorizedCron(req({ authorization: 'bi-mat-that' }))).toBe(false)
    expect(isAuthorizedCron(req({ authorization: '' }))).toBe(false)
    expect(isAuthorizedCron(req({}))).toBe(false)
  })

  it('5. bí mật dài hơn nhưng bắt đầu giống KHÔNG lọt', () => {
    process.env.CRON_SECRET = 'bi-mat'
    expect(isAuthorizedCron(req({ authorization: 'Bearer bi-mat-them' }))).toBe(false)
  })
})
