-- ============================================================================
-- 044 — KHOÁ TÍNH NĂNG THEO GÓI: gói đã khai giới hạn, nay mới có ai đọc
--
-- BỐI CẢNH ĐO ĐƯỢC. `membership_tiers` khai 5 gói với giới hạn THẬT:
--     free        0đ          1 hành trình ·  1 ghế · không Học viện · cẩm nang bước 1
--     explorer    1.200.000đ  1 hành trình ·  3 ghế · có Học viện   · cẩm nang bước 1-2
--     pro        12.000.000đ  3 hành trình · 10 ghế · thêm thao trường
--     elite      48.000.000đ 10 hành trình · 30 ghế
--     enterprise 120.000.000đ 999          · 999
--
-- Rà toàn bộ mã: KHÔNG một chỗ nào đọc những giới hạn đó. Trả 120 triệu cũng
-- không mở thêm gì, mà không trả đồng nào cũng không bị chặn gì. Bảng
-- `subscriptions` = 0 dòng, và cũng chẳng ai hỏi tới nó.
--
-- ── ĐẶT LUẬT Ở CSDL, KHÔNG RẢI RA TỪNG ROUTE ──
-- Giới hạn gói là luật kinh doanh, và luật kinh doanh rải ra 130 route thì
-- sớm muộn có route quên kiểm. Đặt ở đây thì mọi cửa vào hỏi chung một chỗ,
-- và đổi chính sách giá chỉ phải sửa một nơi.
--
-- ── FAIL-OPEN CÓ CHỦ Ý CHO CHỦ TỊCH, FAIL-CLOSED CHO PHẦN CÒN LẠI ──
-- `is_chairman_super()` đi qua mọi giới hạn: chủ tịch vận hành nền tảng, chặn
-- ông ấy là tự khoá mình. Ngoài ra không có ngoại lệ nào.
--
-- ── CẤP GÓI KHÔNG CẦN THANH TOÁN ──
-- Cổng thanh toán chưa nối (xem ghi chú dưới), nhưng khách thí điểm thì phải
-- vào được ngay. `cap_goi()` ghi một dòng `subscriptions` với nhãn nguồn rõ
-- ràng — KHÔNG giả vờ là đã thanh toán. Doanh thu và quà tặng phải tách được
-- nhau, nếu không thì báo cáo doanh thu thành số bịa.
--
-- ⚠ CỔNG THANH TOÁN. Mã hiện có viết theo Stripe trực tiếp, trái quy tắc "chỉ
-- dùng Zeni Cloud". Danh mục connector của ZeniCloud đã có sẵn VNPay, MoMo,
-- ZaloPay. Chưa nối vì cần chủ tịch chọn cổng và cấp thông tin đơn vị bán —
-- KHÔNG tự chọn hộ. Tầng khoá tính năng này không phụ thuộc cổng nào, nối
-- cổng xong chỉ việc gọi `cap_goi()` từ webhook.
-- ============================================================================

-- ── Gói đang hiệu lực của một doanh nghiệp ──
-- Không có đăng ký nào còn hiệu lực ⇒ 'free'. KHÔNG trả NULL: NULL bắt mọi
-- bên gọi tự đoán, và mỗi bên sẽ đoán một kiểu.
CREATE OR REPLACE FUNCTION goi_hien_tai(p_tenant uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(
    (SELECT s.tier_code
       FROM subscriptions s
      WHERE s.tenant_id = p_tenant
        AND s.status IN ('trialing','active')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
        AND s.tier_code IS NOT NULL
      ORDER BY s.current_period_end DESC NULLS LAST
      LIMIT 1),
    'free')
$$;
COMMENT ON FUNCTION goi_hien_tai(uuid) IS
  'Gói còn hiệu lực, mặc định "free". Không trả NULL — NULL bắt mỗi bên gọi tự đoán một kiểu.';

-- ── Hạn mức + mức dùng hiện tại, một lần đọc ──
CREATE OR REPLACE FUNCTION han_muc_goi(p_tenant uuid)
RETURNS TABLE (
  goi text, ten_goi text, gia_vnd_thang bigint,
  gioi_han_hanh_trinh int, da_dung_hanh_trinh int,
  gioi_han_ghe int, da_dung_ghe int,
  duoc_hoc_vien boolean, duoc_thao_truong boolean, cac_buoc_cam_nang int[],
  la_chu_tich boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    t.tier_code, t.name_vi, t.price_vnd_month,
    t.max_journey_count,
    (SELECT count(*)::int FROM ipo_journeys j WHERE j.tenant_id = p_tenant AND j.status <> 'abandoned'),
    t.max_seats,
    (SELECT count(*)::int FROM user_profiles u WHERE u.tenant_id = p_tenant),
    t.academy_access, t.training_drills_access, t.handbook_access_phases,
    is_chairman_super()
  FROM membership_tiers t
  WHERE t.tier_code = goi_hien_tai(p_tenant)
$$;
COMMENT ON FUNCTION han_muc_goi(uuid) IS
  'Hạn mức gói kèm mức đã dùng. Một lần đọc cho cả giao diện lẫn cửa vào API.';

-- ── Được làm việc này không, và nếu không thì VÌ SAO ──
-- Trả kèm lý do bằng tiếng Việt: chặn mà không nói vì sao thì người dùng
-- tưởng hệ thống hỏng, rồi gọi hỗ trợ thay vì nâng gói.
CREATE OR REPLACE FUNCTION duoc_dung(p_tenant uuid, p_viec text)
RETURNS TABLE (cho_phep boolean, ly_do text, goi text, can_goi text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE h record;
BEGIN
  SELECT * INTO h FROM han_muc_goi(p_tenant);
  IF h IS NULL THEN
    RETURN QUERY SELECT false, 'Không xác định được gói dịch vụ của doanh nghiệp này.'::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Chủ tịch vận hành nền tảng: đi qua mọi giới hạn.
  IF h.la_chu_tich THEN
    RETURN QUERY SELECT true, NULL::text, h.goi, NULL::text;
    RETURN;
  END IF;

  IF p_viec = 'tao_hanh_trinh' THEN
    IF h.da_dung_hanh_trinh >= h.gioi_han_hanh_trinh THEN
      RETURN QUERY SELECT false,
        format('Gói %s cho tối đa %s hành trình IPO, hiện đã dùng %s. Nâng gói để mở thêm.',
               h.ten_goi, h.gioi_han_hanh_trinh, h.da_dung_hanh_trinh)::text,
        h.goi,
        (SELECT m.tier_code FROM membership_tiers m
          WHERE m.max_journey_count > h.da_dung_hanh_trinh
          ORDER BY m.price_vnd_month LIMIT 1)::text;
      RETURN;
    END IF;

  ELSIF p_viec = 'them_ghe' THEN
    IF h.da_dung_ghe >= h.gioi_han_ghe THEN
      RETURN QUERY SELECT false,
        format('Gói %s cho tối đa %s người dùng, hiện đã có %s.', h.ten_goi, h.gioi_han_ghe, h.da_dung_ghe)::text,
        h.goi,
        (SELECT m.tier_code FROM membership_tiers m
          WHERE m.max_seats > h.da_dung_ghe ORDER BY m.price_vnd_month LIMIT 1)::text;
      RETURN;
    END IF;

  ELSIF p_viec = 'hoc_vien' THEN
    IF NOT h.duoc_hoc_vien THEN
      RETURN QUERY SELECT false,
        format('Gói %s chưa mở Học viện.', h.ten_goi)::text, h.goi,
        (SELECT m.tier_code FROM membership_tiers m WHERE m.academy_access ORDER BY m.price_vnd_month LIMIT 1)::text;
      RETURN;
    END IF;

  ELSIF p_viec = 'thao_truong' THEN
    IF NOT h.duoc_thao_truong THEN
      RETURN QUERY SELECT false,
        format('Gói %s chưa mở Thao trường.', h.ten_goi)::text, h.goi,
        (SELECT m.tier_code FROM membership_tiers m WHERE m.training_drills_access ORDER BY m.price_vnd_month LIMIT 1)::text;
      RETURN;
    END IF;

  ELSE
    -- Việc lạ: CHO PHÉP. Tầng này chỉ chặn đúng những gì gói đã khai giới hạn;
    -- chặn mọi thứ chưa khai thì thêm một tính năng mới là khoá cả nền tảng.
    RETURN QUERY SELECT true, NULL::text, h.goi, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, h.goi, NULL::text;
END $$;
COMMENT ON FUNCTION duoc_dung(uuid, text) IS
  'Cho phép hay không, kèm LÝ DO tiếng Việt và gói cần nâng lên. Việc chưa khai giới hạn thì mặc định cho phép.';

-- ── Bước cẩm nang này có mở cho gói hiện tại không ──
CREATE OR REPLACE FUNCTION mo_buoc_cam_nang(p_tenant uuid, p_buoc int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT is_chairman_super() OR EXISTS (
    SELECT 1 FROM han_muc_goi(p_tenant) h
     WHERE p_buoc = ANY (h.cac_buoc_cam_nang)
  )
$$;

-- ── Cấp gói KHÔNG qua thanh toán (khách thí điểm, đối tác) ──
-- Ghi nhãn nguồn thẳng vào `stripe_customer_id` là chỗ duy nhất còn trống để
-- đánh dấu — cố ý ghi chuỗi 'cap-tay:<lý do>' chứ không để trống, vì một dòng
-- đăng ký không rõ từ đâu ra sẽ bị tính vào doanh thu ở báo cáo sau này.
CREATE OR REPLACE FUNCTION cap_goi(p_tenant uuid, p_tier text, p_so_thang int DEFAULT 12, p_ly_do text DEFAULT 'khach thi diem')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_chairman_super() THEN
    RAISE EXCEPTION 'Chỉ chủ tịch nền tảng mới cấp gói không qua thanh toán được.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM membership_tiers WHERE tier_code = p_tier) THEN
    RAISE EXCEPTION 'Gói không tồn tại: %', p_tier;
  END IF;

  INSERT INTO subscriptions (tenant_id, tier_code, plan, status,
                             current_period_start, current_period_end, stripe_customer_id)
  VALUES (p_tenant, p_tier,
          CASE WHEN p_tier = 'free' THEN 'explorer' ELSE p_tier END,  -- cột `plan` cũ không nhận 'free'
          'active', now(), now() + make_interval(months => p_so_thang),
          'cap-tay:' || coalesce(p_ly_do, ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'subscription_id', v_id, 'tier', p_tier,
    'ghi_chu', 'Cấp tay, KHÔNG phải doanh thu. Nhãn nguồn nằm ở stripe_customer_id.');
END $$;

REVOKE ALL ON FUNCTION cap_goi(uuid,text,int,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cap_goi(uuid,text,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION goi_hien_tai(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION han_muc_goi(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION duoc_dung(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION mo_buoc_cam_nang(uuid,int) TO authenticated;
