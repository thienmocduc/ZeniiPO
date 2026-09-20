-- ============================================================================
-- 032 — NGƯỠNG CHUẨN VỐN (nạp từ kho tri thức Wits, KHÔNG bịa)
--
-- BỐI CẢNH. Bảng `ipo_benchmarks` dựng từ migration 026 có thiết kế đúng chuẩn
-- nghề — khoá (mã chỉ số × giai đoạn), ngưỡng hai chiều, có cột ghi xuất xứ —
-- nhưng chỉ nạp được **2 dòng**, đúng 1 chỉ số. Ba giai đoạn `series_b`,
-- `growth`, `pre_ipo` trống hoàn toàn. Nghĩa là mọi phép chấm điểm doanh nghiệp
-- so với chuẩn ngành đều không có chuẩn để so.
--
-- NGUỒN. Không tự nghĩ ra con số. Lấy từ bộ "ngưỡng chuẩn vốn (máy đọc được)"
-- trong kho tri thức Wits — bộ này được kiểm kê đánh dấu **tất định**, tức là
-- máy đọc và tái lập được, không phải văn xuôi diễn giải.
--   Nguồn: D:/WitsAGI-Data/wits-llm/du-lieu-nganh/nguong-von.json
--   Sinh bằng: scratchpad/sinh_nguong.py (sinh máy, không gõ tay — 31 dòng gõ
--   tay là 31 cơ hội sai một chữ số)
--
-- QUY ƯỚC. `good_min` cho chỉ số CÀNG CAO CÀNG TỐT (LTV:CAC, biên lợi nhuận…);
-- `good_max` cho chỉ số CÀNG THẤP CÀNG TỐT (số tháng hoàn vốn, bội số đốt tiền).
--
-- CÒN THIẾU — ghi ra để không ai tưởng đã đủ: bộ ngưỡng này CHƯA chia theo
-- NGÀNH. Một công ty phần mềm và một công ty sản xuất đang dùng chung ngưỡng
-- biên lợi nhuận gộp, điều đó không đúng về nghiệp vụ. Phải bổ sung chiều ngành
-- (neo theo VSIC 2018 và bắc cầu GICS) ở bước sau.
-- ============================================================================

INSERT INTO ipo_benchmarks (metric_code, stage, name_vi, good_min, good_max, category, source_note) VALUES
  ('ltv_cac_ratio','seed','LTV:CAC', 3, NULL, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Chuẩn kinh điển: dưới 3 thì chưa nên mở rộng'),
  ('ltv_cac_ratio','series_a','LTV:CAC', 3, NULL, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Dưới 1 là đốt tiền mua khách lỗ'),
  ('ltv_cac_ratio','series_b','LTV:CAC', 3.5, NULL, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Mở rộng phải chứng minh hiệu quả tăng'),
  ('ltv_cac_ratio','growth','LTV:CAC', 4, NULL, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Giai đoạn này đòi hỏi cao hơn'),
  ('ltv_cac_ratio','pre_ipo','LTV:CAC', 4, NULL, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Ngân hàng đầu tư soi kỹ chất lượng tăng trưởng'),
  ('cac_payback_months','seed','Hoàn vốn khách (tháng)', NULL, 18, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Giai đoạn sớm cho phép dài hơn'),
  ('cac_payback_months','series_a','Hoàn vốn khách (tháng)', NULL, 15, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Bộ ngưỡng chuẩn vốn Wits'),
  ('cac_payback_months','series_b','Hoàn vốn khách (tháng)', NULL, 12, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Chuẩn tốt của mô hình thuê bao'),
  ('cac_payback_months','growth','Hoàn vốn khách (tháng)', NULL, 12, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Bộ ngưỡng chuẩn vốn Wits'),
  ('cac_payback_months','pre_ipo','Hoàn vốn khách (tháng)', NULL, 12, 'unit_economics', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Để câu chuyện niêm yết thuyết phục'),
  ('gross_margin_pct','series_a','Biên lợi nhuận gộp (%)', 60, NULL, 'profitability', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Phần mềm ≥70% · dịch vụ ≥40% · ăn uống 55–65%'),
  ('gross_margin_pct','series_b','Biên lợi nhuận gộp (%)', 65, NULL, 'profitability', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Biên phải mở rộng theo quy mô'),
  ('gross_margin_pct','pre_ipo','Biên lợi nhuận gộp (%)', 70, NULL, 'profitability', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Chuẩn công ty đại chúng ngành công nghệ'),
  ('nrr_pct','series_a','Giữ chân doanh thu ròng (%)', 100, NULL, 'growth', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Bằng 100% nghĩa là khách cũ tự bù phần rời bỏ'),
  ('nrr_pct','series_b','Giữ chân doanh thu ròng (%)', 110, NULL, 'growth', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Chuẩn tốt'),
  ('nrr_pct','pre_ipo','Giữ chân doanh thu ròng (%)', 120, NULL, 'growth', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Nhóm dẫn đầu khi niêm yết'),
  ('grr_pct','series_b','Giữ chân doanh thu gộp (%)', 85, NULL, 'growth', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Khách doanh nghiệp lớn nên ≥90%'),
  ('grr_pct','pre_ipo','Giữ chân doanh thu gộp (%)', 90, NULL, 'growth', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Bộ ngưỡng chuẩn vốn Wits'),
  ('rule_of_40','series_b','Quy tắc 40', 40, NULL, 'growth', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Tăng trưởng% + biên EBITDA%'),
  ('rule_of_40','growth','Quy tắc 40', 40, NULL, 'growth', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Chuẩn vàng công ty phần mềm'),
  ('rule_of_40','pre_ipo','Quy tắc 40', 40, NULL, 'growth', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Gần như bắt buộc khi niêm yết công nghệ'),
  ('burn_multiple','series_a','Bội số đốt tiền', NULL, 2, 'efficiency', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Dưới 1 là xuất sắc · 1–1.5 tốt · trên 2 xấu'),
  ('burn_multiple','series_b','Bội số đốt tiền', NULL, 1.5, 'efficiency', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Bộ ngưỡng chuẩn vốn Wits'),
  ('burn_multiple','pre_ipo','Bội số đốt tiền', NULL, 1, 'efficiency', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Phải đốt tiền hiệu quả'),
  ('magic_number','series_b','Hệ số kỳ diệu', 0.75, NULL, 'efficiency', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Đạt ngưỡng này mới nên tăng chi bán hàng'),
  ('quick_ratio','series_a','Tỷ số nhanh', 4, NULL, 'efficiency', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Thêm gấp 4 lần mất'),
  ('runway_months','seed','Số tháng sống (tháng)', 12, NULL, 'efficiency', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Dưới mức này là gọi vốn ở thế yếu'),
  ('runway_months','series_a','Số tháng sống (tháng)', 18, NULL, 'efficiency', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Chuẩn an toàn'),
  ('runway_months','series_b','Số tháng sống (tháng)', 18, NULL, 'efficiency', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Bộ ngưỡng chuẩn vốn Wits'),
  ('ccc_days','growth','Vòng quay tiền mặt (ngày)', NULL, 45, 'efficiency', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Càng thấp càng khoẻ; âm là tuyệt vời'),
  ('ipo_readiness_score','pre_ipo','Điểm sẵn sàng niêm yết (/100)', 85, NULL, 'governance', 'Kho tri thức Wits · bộ ngưỡng chuẩn vốn (tất định) · Mới nên nộp hồ sơ')
ON CONFLICT (metric_code, stage) DO UPDATE SET
  name_vi     = EXCLUDED.name_vi,
  good_min    = EXCLUDED.good_min,
  good_max    = EXCLUDED.good_max,
  category    = EXCLUDED.category,
  source_note = EXCLUDED.source_note;
