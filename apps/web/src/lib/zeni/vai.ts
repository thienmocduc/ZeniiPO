/**
 * MỘT CHỖ KHAI DANH SÁCH VAI VÀ CÁC GIÁ TRỊ CÓ RÀNG BUỘC CỦA KHỐI QUẢN TRỊ.
 *
 * Vì sao tập trung: danh sách tier trước đây được gõ lại ở từng cửa vào. Khi
 * migration 046/047 nới thêm `cro · cpo · chro · ciso · gov`, `okrs/route.ts`
 * vẫn giữ 8 giá trị cũ ⇒ cửa vào từ chối đúng những vai mà CSDL đã cho phép,
 * và lỗi hiện ra là 400 chứ không phải chỗ thật sự sai.
 *
 * ⚠ Danh sách ở đây PHẢI trùng CHECK constraint trong CSDL. Bộ canh
 * `schema-khop-ma.test.ts` soi điều đó — sửa một bên mà quên bên kia là đỏ test.
 */

/** `okr_objectives.tier` và `user_profiles.role` — cùng một danh sách. */
export const MA_VAI = [
  'chr',
  'ceo',
  'cfo',
  'coo',
  'cto',
  'cmo',
  'clo',
  'cro',
  'cpo',
  'chro',
  'ciso',
  'gov',
  'emp',
] as const
export type MaVai = (typeof MA_VAI)[number]

/** Nhãn tiếng Việt, dùng khi hiển thị. */
export const TEN_VAI: Record<MaVai, string> = {
  chr: 'Chủ tịch HĐQT',
  ceo: 'Tổng giám đốc',
  cfo: 'Giám đốc tài chính',
  coo: 'Giám đốc vận hành',
  cto: 'Giám đốc công nghệ',
  cmo: 'Giám đốc marketing',
  clo: 'Giám đốc pháp chế',
  cro: 'Giám đốc kinh doanh',
  cpo: 'Giám đốc sản phẩm',
  chro: 'Giám đốc nhân sự',
  ciso: 'Giám đốc an ninh thông tin',
  gov: 'Thư ký công ty',
  emp: 'Quản lý / nhân sự',
}

// ── Khối hội đồng quản trị (migration 048) ─────────────────────────────────

/** `board_members.member_type` */
export const LOAI_THANH_VIEN = ['dieu_hanh', 'khong_dieu_hanh', 'doc_lap'] as const

/** `board_members.status` */
export const TRANG_THAI_THANH_VIEN = ['active', 'resigned', 'removed', 'term_ended'] as const

/** `board_committees.committee_code` */
export const MA_UY_BAN = ['audit', 'remuneration', 'nomination', 'risk', 'other'] as const

/** `board_committee_members.vai` */
export const VAI_UY_BAN = ['chair', 'member'] as const

/**
 * `board_meetings.meeting_type` — lấy ý kiến bằng văn bản là hình thức HỢP PHÁP,
 * không phải đường tắt; ghi đúng thì biên bản mới đúng.
 */
export const HINH_THUC_HOP = ['truc_tiep', 'truc_tuyen', 'ket_hop', 'lay_y_kien_van_ban'] as const

/** `board_meetings.status` */
export const TRANG_THAI_HOP = ['du_kien', 'da_trieu_tap', 'dang_hop', 'da_hop', 'huy'] as const

/** `board_meetings.quorum_source` — `mac_dinh_he_thong` nghĩa là CHƯA ai xác nhận theo điều lệ. */
export const NGUON_TUC_SO = ['dieu_le', 'luat', 'mac_dinh_he_thong'] as const

/** `board_attendance.attendance` — `vang` không tính vào túc số. */
export const HINH_THUC_DU_HOP = ['co_mat', 'truc_tuyen', 'uy_quyen', 'vang'] as const

/** `board_votes.vote` */
export const PHIEU = ['tan_thanh', 'khong_tan_thanh', 'khong_y_kien', 'khong_bieu_quyet'] as const

/** `board_minutes.nguon` */
export const NGUON_BIEN_BAN = ['nguoi_soan', 'ai_de_xuat'] as const

/** `board_resolutions.resolution_type` */
export const LOAI_NGHI_QUYET = [
  'funding',
  'esop',
  'appointment',
  'budget',
  'm_and_a',
  'policy',
  'audit',
  'ipo',
  'other',
] as const

/** `board_resolutions.status` */
export const TRANG_THAI_NGHI_QUYET = ['draft', 'voted', 'approved', 'rejected', 'executed'] as const

/** `resolution_distribution.status` */
export const TRANG_THAI_PHAN_PHOI = ['da_giao', 'da_xac_nhan', 'chua_co_nguoi'] as const
