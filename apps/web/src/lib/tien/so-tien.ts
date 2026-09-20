import { z } from 'zod'

/**
 * SỐ TIỀN — một định nghĩa duy nhất cho toàn hệ thống.
 *
 * Trước file này, ba route tự khai riêng `z.number().finite().min(-1e15).max(1e15)`
 * và hơn mười route khác chỉ dùng `z.number()` trần. Hệ quả: cùng một khái
 * niệm "số tiền" mà mỗi cửa vào lại chấp nhận một tập giá trị khác nhau.
 *
 * ── VÌ SAO BẮT BUỘC SỐ NGUYÊN ──
 * Migration 037 đã đưa 39 cột tiền trong CSDL về `bigint`. Nếu API vẫn nhận
 * 1.234,56 thì Postgres LÀM TRÒN im lặng khi ghi: người dùng gõ một số, hệ
 * thống lưu một số khác, và không ai được báo. Chặn ngay ở cửa vào thì người
 * dùng biết mình gõ sai; chặn ở CSDL thì họ không bao giờ biết.
 *
 * VND không có đơn vị nhỏ hơn đồng nên số nguyên là đúng bản chất. Với ngoại
 * tệ có xu, quy ước của hệ thống là lưu ĐƠN VỊ NGUYÊN (đô la nguyên) — xem
 * COMMENT trên từng cột `*_usd` trong migration 037.
 *
 * ── VÌ SAO TRẦN 1e15 ──
 * JSON không có kiểu số nguyên lớn: PostgREST trả `bigint` ra JSON dạng số,
 * và JavaScript chỉ giữ nguyên vẹn số nguyên tới 2^53 ≈ 9,007e15. Vượt mốc đó
 * là mất chữ số cuối mà không có lỗi nào được ném. Trần 1e15 (một triệu tỷ
 * đồng — lớn hơn GDP Việt Nam) nằm an toàn dưới mốc ấy.
 *
 * ⚠ Đừng dùng cho TỶ LỆ, BỘI SỐ, ĐIỂM, hay GIÁ MỖI CỔ PHẦN — những thứ đó có
 * phần lẻ hợp lệ và vẫn để `numeric` trong CSDL. Dùng `SoThapPhan` bên dưới.
 */
export const GIOI_HAN_TIEN = 1e15

export const SoTien = z
  .number()
  .int({ message: 'Số tiền phải là số nguyên — VND không có đơn vị nhỏ hơn đồng' })
  .finite()
  .min(-GIOI_HAN_TIEN, { message: `Số tiền vượt ngưỡng an toàn ±${GIOI_HAN_TIEN}` })
  .max(GIOI_HAN_TIEN, { message: `Số tiền vượt ngưỡng an toàn ±${GIOI_HAN_TIEN}` })

/** Số tiền không âm (doanh thu, chi phí, giá bán…). */
export const SoTienKhongAm = SoTien.nonnegative({ message: 'Số tiền không được âm' })

/** Số tiền phải dương (giá gói, quy mô vòng gọi vốn…). */
export const SoTienDuong = SoTien.positive({ message: 'Số tiền phải lớn hơn 0' })

/**
 * SỐ CÓ PHẦN LẺ hợp lệ — tỷ lệ %, bội số so sánh (P/E, EV/EBITDA), trọng số,
 * điểm, giá mỗi cổ phần. Những cột này CỐ Ý giữ `numeric` trong CSDL.
 */
export const SoThapPhan = z.number().finite()

/** Tỷ lệ phần trăm 0–100. */
export const PhanTram = z.number().finite().min(0).max(100)
