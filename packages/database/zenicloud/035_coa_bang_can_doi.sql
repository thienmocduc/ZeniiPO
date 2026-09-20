-- ============================================================================
-- 035 — NẠP TÀI KHOẢN BẢNG CÂN ĐỐI + KHẤU HAO VÀO NGÔN NGỮ CHUNG
--
-- BỐI CẢNH. Migration 029 khai `plan_coa_lines` với cột `statement` nhận ba
-- giá trị ('pnl','cf','bs') nhưng CHỈ nạp 13 mã lãi lỗ. Engine kế hoạch vừa
-- được nâng lên mô hình BA BÁO CÁO (lãi lỗ · lưu chuyển tiền · cân đối), sinh
-- ra số dư cho tiền, phải thu, tồn kho, tài sản cố định, phải trả, vốn góp,
-- lợi nhuận giữ lại — và chi phí khấu hao 6424.
--
-- Không nạp các mã này thì `plan_targets.coa_line` (có KHOÁ NGOẠI trỏ về bảng
-- này) từ chối ghi, nên bảng cân đối kế hoạch không bao giờ ra được tới ZeniOS
-- và ZeniERP. Hệ quả thật: ERP báo chi phí khấu hao thực tế trên 6424 mà kế
-- hoạch không có dòng 6424 nào để so ⇒ chênh lệch hiện 100% vượt dự toán trên
-- một khoản mà kế hoạch chưa từng bỏ sót.
--
-- ⚠ QUY ƯỚC DẤU CHO TÀI KHOẢN CÂN ĐỐI. Cột `sign` ở bảng này vốn nghĩa là
-- "làm tăng (+1) hay giảm (−1) lợi nhuận" — nghĩa đó KHÔNG áp cho tài khoản
-- cân đối. Với nhóm 'bs' ta đọc `sign` theo số dư tự nhiên của tài khoản:
--     +1 = dư NỢ  (tài sản)
--     −1 = dư CÓ  (nợ phải trả · vốn chủ sở hữu)
-- Riêng 214 "hao mòn luỹ kế" là tài khoản ĐIỀU CHỈNH GIẢM tài sản (dư Có) nên
-- mang −1 dù nằm trong phần tài sản.
--
-- ⚠ SỐ PHÁT SINH ≠ SỐ DƯ. Dòng 'pnl' trong `plan_targets` là số PHÁT SINH
-- trong tháng — cộng 12 tháng ra số năm. Dòng 'bs' là số DƯ CUỐI THÁNG —
-- cộng dồn là VÔ NGHĨA, lấy tháng cuối kỳ mới đúng. Bên tiêu thụ phân biệt
-- bằng đúng cột `statement` này; hợp đồng `/api/internal/plan-targets` phải
-- trả kèm cột đó (xem route.ts cùng lượt vá).
-- ============================================================================

INSERT INTO plan_coa_lines (code, label_vi, statement, sign, category, display_order) VALUES
-- ── Bổ sung nhóm LÃI LỖ ──
 ('6424','Chi phí quản lý — khấu hao TSCĐ','pnl',-1,'opex_ga',75),

-- ── TÀI SẢN (dư Nợ) ──
 ('111', 'Tiền và tương đương tiền',      'bs', 1,'asset_current',200),
 ('131', 'Phải thu khách hàng',           'bs', 1,'asset_current',210),
 ('156', 'Hàng tồn kho',                  'bs', 1,'asset_current',220),
 ('211', 'Tài sản cố định — nguyên giá',  'bs', 1,'asset_fixed',  230),
 ('214', 'Hao mòn luỹ kế TSCĐ',           'bs',-1,'asset_fixed',  240),

-- ── NỢ PHẢI TRẢ (dư Có) ──
 ('331', 'Phải trả người bán',            'bs',-1,'liability',    300),
 ('3334','Thuế TNDN phải nộp',            'bs',-1,'liability',    310),

-- ── VỐN CHỦ SỞ HỮU (dư Có) ──
 ('411', 'Vốn góp của chủ sở hữu',        'bs',-1,'equity',       400),
 ('421', 'Lợi nhuận sau thuế chưa phân phối','bs',-1,'equity',    410)
ON CONFLICT (code) DO UPDATE SET label_vi=EXCLUDED.label_vi, statement=EXCLUDED.statement,
  sign=EXCLUDED.sign, category=EXCLUDED.category, display_order=EXCLUDED.display_order;
