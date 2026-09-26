-- ============================================================================
-- 050 — CỔNG KHẢ THI: chiến lược chủ tịch có chống được phép chia hay không
--
-- VẤN ĐỀ. `cascade_chairman_event` nhận "định giá 50.000.000 · HOSE · 2031" rồi
-- ghi thẳng xuống, KHÔNG một phép thử nào. Cả nền tảng phía sau chạy theo một
-- con số chưa ai kiểm — và đó là con số nhà đầu tư hỏi đầu tiên.
--
-- ── KHÔNG BỊA NGƯỠNG PHÁN XÉT ─────────────────────────────────────────────
-- Hàm này KHÔNG nói "khả thi" hay "không khả thi" theo một ngưỡng tự đặt kiểu
-- "tăng quá 2 lần là bất khả thi". Ngưỡng đó không có nguồn.
--
-- Nó nói đúng MỘT sự thật số học, và sự thật đó đủ nặng:
--     "Mục tiêu này đòi mức tăng trưởng gấp N lần chính bản kế hoạch mà doanh
--      nghiệp vừa cam kết."
-- Bản kế hoạch là cam kết của chính doanh nghiệp. Mục tiêu đòi nhiều hơn cam
-- kết của chính mình là một mâu thuẫn nội tại, không phải một ý kiến.
--
-- ── THIẾU DỮ LIỆU THÌ NÓI THIẾU GÌ, KHÔNG ĐOÁN ────────────────────────────
-- Giải ngược từ định giá về doanh thu cần hai thứ mà hôm nay ĐỀU TRỐNG:
--     `comparables.ev_revenue_multiple`  → 0 dòng (bội số ngành)
--     `fx_rates` USD→VND                 → 0 dòng (mục tiêu yết USD, kế hoạch VND)
-- Thiếu thì trả `chua_do_duoc` kèm danh sách `thieu` gọi đúng tên bảng và cột.
-- Đoán tỷ giá hay đoán bội số là cách nhanh nhất biến cổng kiểm thành cái máy
-- sinh số đẹp.
--
-- ⚠ TRỘN ĐƠN VỊ TIỀN LÀ LỖI NGẦM NGUY HIỂM NHẤT Ở ĐÂY. `ipo_journeys
-- .valuation_target` yết USD (cửa vào onboarding tên `valuation_target_usd`),
-- còn `plan_targets.amount` là VND nguyên. So trực tiếp hai con số đó lệch
-- 25.000 lần mà không có lỗi nào được ném ra.
-- ============================================================================

CREATE OR REPLACE FUNCTION kiem_kha_thi_chien_luoc(p_journey uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $fn$
DECLARE
  v_tenant uuid; v_dinh_gia_usd numeric; v_nam_muc_tieu int; v_nganh text; v_san text;
  v_ban_ke_hoach uuid; v_bat_dau date; v_chan_troi int;
  v_dt_nam_dau numeric; v_dt_nam_cuoi numeric; v_so_nam numeric;
  v_cagr_ke_hoach numeric;
  v_nam_ke_hoach_cuoi int; v_nam_khong_ke_hoach int;
  v_ty_gia numeric; v_nguon_ty_gia text;
  v_boi_so numeric; v_so_cty_so_sanh int;
  v_dt_can_vnd numeric; v_cagr_can numeric; v_ty_le numeric;
  v_thieu text[] := ARRAY[]::text[];
  v_ket_luan text; v_giai_thich text;
BEGIN
  SELECT j.tenant_id, j.valuation_target, j.target_year, j.industry, j.exit_venue
    INTO v_tenant, v_dinh_gia_usd, v_nam_muc_tieu, v_nganh, v_san
    FROM ipo_journeys j WHERE j.id = p_journey;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hành trình %', p_journey; END IF;

  IF NOT la_ngu_canh_he_thong() AND NOT is_chairman_super()
     AND v_tenant NOT IN (SELECT id FROM list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Không có quyền với doanh nghiệp này';
  END IF;

  -- ── 1 · BẢN KẾ HOẠCH ĐÃ CHỐT ──────────────────────────────────────────
  SELECT pv.id, pv.start_period::date, pv.horizon_months
    INTO v_ban_ke_hoach, v_bat_dau, v_chan_troi
    FROM plan_versions pv
   WHERE pv.tenant_id = v_tenant AND pv.status = 'published'
   ORDER BY pv.version_no DESC LIMIT 1;

  IF v_ban_ke_hoach IS NULL THEN
    v_thieu := v_thieu || 'plan_versions: chưa có bản kế hoạch nào được chốt'::text;
  ELSE
    -- Doanh thu 12 kỳ ĐẦU và 12 kỳ CUỐI của bản kế hoạch, kịch bản gốc.
    -- Mã 5113 là doanh thu thuần theo hệ thống tài khoản đang dùng.
    SELECT sum(amount) INTO v_dt_nam_dau FROM (
      SELECT amount FROM plan_targets
       WHERE plan_version_id = v_ban_ke_hoach AND coa_line = '5113' AND scenario = 'base'
       ORDER BY period LIMIT 12) x;
    SELECT sum(amount) INTO v_dt_nam_cuoi FROM (
      SELECT amount FROM plan_targets
       WHERE plan_version_id = v_ban_ke_hoach AND coa_line = '5113' AND scenario = 'base'
       ORDER BY period DESC LIMIT 12) x;

    v_so_nam := GREATEST(v_chan_troi, 12)::numeric / 12 - 1;   -- số năm giữa đầu và cuối
    IF v_dt_nam_dau IS NULL OR v_dt_nam_dau <= 0 THEN
      v_thieu := v_thieu || 'plan_targets: bản kế hoạch không có dòng doanh thu (mã 5113)'::text;
    ELSIF v_so_nam > 0 THEN
      v_cagr_ke_hoach := (power(v_dt_nam_cuoi / v_dt_nam_dau, 1 / v_so_nam) - 1) * 100;
    END IF;

    v_nam_ke_hoach_cuoi := EXTRACT(YEAR FROM (v_bat_dau + (v_chan_troi || ' months')::interval))::int;
    v_nam_khong_ke_hoach := GREATEST(v_nam_muc_tieu - v_nam_ke_hoach_cuoi, 0);
  END IF;

  -- ── 2 · TỶ GIÁ — mục tiêu yết USD, kế hoạch ghi VND ────────────────────
  SELECT f.rate, f.source INTO v_ty_gia, v_nguon_ty_gia
    FROM fx_rates f
   WHERE f.base_ccy = 'USD' AND f.quote_ccy = 'VND' AND f.effective_from <= CURRENT_DATE
   ORDER BY f.effective_from DESC LIMIT 1;
  IF v_ty_gia IS NULL THEN
    v_thieu := v_thieu || 'fx_rates: chưa có tỷ giá USD→VND (mục tiêu định giá yết USD, kế hoạch ghi VND)'::text;
  END IF;

  -- ── 3 · BỘI SỐ NGÀNH — từ công ty so sánh, có dẫn nguồn ───────────────
  -- Trung vị chứ không trung bình: một công ty ngoại lệ kéo trung bình đi rất xa.
  SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY cp.ev_revenue_multiple)
    INTO v_so_cty_so_sanh, v_boi_so
    FROM comparables cp
   WHERE cp.tenant_id = v_tenant
     AND cp.ev_revenue_multiple IS NOT NULL AND cp.ev_revenue_multiple > 0
     AND (v_nganh IS NULL OR cp.industry IS NULL OR cp.industry = v_nganh);
  IF v_boi_so IS NULL THEN
    v_thieu := v_thieu ||
      'comparables: chưa có công ty so sánh nào có bội số EV/Doanh thu — không giải ngược được từ định giá về doanh thu'::text;
  END IF;

  -- ── 4 · GIẢI NGƯỢC ────────────────────────────────────────────────────
  IF v_ty_gia IS NOT NULL AND v_boi_so IS NOT NULL AND v_dt_nam_cuoi IS NOT NULL AND v_dt_nam_cuoi > 0 THEN
    v_dt_can_vnd := v_dinh_gia_usd * v_ty_gia / v_boi_so;
    IF v_nam_muc_tieu > v_nam_ke_hoach_cuoi THEN
      v_cagr_can := (power(v_dt_can_vnd / v_dt_nam_cuoi,
                           1::numeric / (v_nam_muc_tieu - v_nam_ke_hoach_cuoi)) - 1) * 100;
    END IF;
    IF v_cagr_ke_hoach IS NOT NULL AND v_cagr_ke_hoach > 0 AND v_cagr_can IS NOT NULL THEN
      v_ty_le := round(v_cagr_can / v_cagr_ke_hoach, 2);
    END IF;
  END IF;

  -- ── 5 · KẾT LUẬN — chỉ phát biểu điều số học nói ───────────────────────
  IF array_length(v_thieu, 1) > 0 THEN
    v_ket_luan := 'chua_do_duoc';
    v_giai_thich := 'Chưa đủ dữ liệu để giải ngược. Thiếu: ' || array_to_string(v_thieu, ' · ');
  ELSIF v_ty_le IS NULL THEN
    v_ket_luan := 'chua_do_duoc';
    v_giai_thich := 'Có đủ dữ liệu nhưng không tính được nhịp tăng trưởng — kiểm lại chân trời kế hoạch và năm mục tiêu.';
  ELSIF v_ty_le <= 1 THEN
    v_ket_luan := 'khop_ke_hoach';
    v_giai_thich := format(
      'Bản kế hoạch đã chốt tự nó đạt tới mục tiêu: cần %s%%/năm sau khi kế hoạch kết thúc, trong khi kế hoạch đang chạy %s%%/năm.',
      round(v_cagr_can, 1), round(v_cagr_ke_hoach, 1));
  ELSE
    v_ket_luan := 'vuot_ke_hoach';
    v_giai_thich := format(
      'Mục tiêu đòi %s%%/năm, gấp %s lần nhịp %s%%/năm mà chính bản kế hoạch đã chốt cam kết. Đây là mâu thuẫn nội tại, không phải ý kiến: hoặc sửa mục tiêu, hoặc sửa kế hoạch.',
      round(v_cagr_can, 1), v_ty_le, round(v_cagr_ke_hoach, 1));
  END IF;

  RETURN jsonb_build_object(
    'ket_luan', v_ket_luan,
    'giai_thich', v_giai_thich,
    'thieu', to_jsonb(v_thieu),
    'muc_tieu', jsonb_build_object(
      'dinh_gia_usd', v_dinh_gia_usd, 'nam', v_nam_muc_tieu,
      'san', v_san, 'nganh', v_nganh),
    'ke_hoach', jsonb_build_object(
      'ban_da_chot', v_ban_ke_hoach,
      'chan_troi_thang', v_chan_troi,
      'nam_ket_thuc', v_nam_ke_hoach_cuoi,
      'doanh_thu_nam_dau_vnd', v_dt_nam_dau,
      'doanh_thu_nam_cuoi_vnd', v_dt_nam_cuoi,
      'cagr_ke_hoach_pct', round(v_cagr_ke_hoach, 2),
      'so_nam_khong_co_ke_hoach', v_nam_khong_ke_hoach),
    'giai_nguoc', jsonb_build_object(
      'ty_gia_usd_vnd', v_ty_gia,
      'nguon_ty_gia', v_nguon_ty_gia,
      'boi_so_ev_doanh_thu', round(v_boi_so, 2),
      'so_cong_ty_so_sanh', v_so_cty_so_sanh,
      'doanh_thu_can_vnd', round(v_dt_can_vnd),
      'cagr_can_pct', round(v_cagr_can, 2),
      'gap_bao_nhieu_lan_ke_hoach', v_ty_le),
    'canh_bao', CASE
      WHEN v_nam_khong_ke_hoach >= 2 THEN format(
        'Kế hoạch kết thúc năm %s nhưng mục tiêu ở năm %s — có %s năm hoàn toàn không có kế hoạch nào.',
        v_nam_ke_hoach_cuoi, v_nam_muc_tieu, v_nam_khong_ke_hoach)
      ELSE NULL END,
    'ghi_chu', 'Hàm này KHÔNG phán xét theo ngưỡng tự đặt. Nó so mục tiêu với chính cam kết trong bản kế hoạch đã chốt.'
  );
END $fn$;
COMMENT ON FUNCTION kiem_kha_thi_chien_luoc(uuid) IS
  'Giải ngược định giá mục tiêu → doanh thu cần → nhịp tăng trưởng cần, rồi so với nhịp trong bản kế hoạch đã chốt. Thiếu tỷ giá hoặc bội số ngành thì trả chua_do_duoc kèm tên bảng còn trống, KHÔNG đoán.';
REVOKE ALL ON FUNCTION kiem_kha_thi_chien_luoc(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kiem_kha_thi_chien_luoc(uuid) TO authenticated;
