-- ============================================================================
-- 031 — CỬA HẸP ĐỂ GHI DANH NGƯỜI DÙNG MỚI
--
-- BỐI CẢNH (20/09/2026). Zeni Cloud cấp vai chạy `zeniipo_com_runtime` KHÔNG sở
-- hữu bảng, để Postgres thực sự áp RLS (trước đó ứng dụng nối bằng vai chủ nên
-- RLS bị bỏ qua hoàn toàn). Đổi vai xong thì lộ ngay một chỗ vỡ:
--
--   `ensureProvisioned()` chèn thẳng vào `auth.users` để kích hoạt trigger
--   `handle_new_user` (trigger này tạo tổ chức + hồ sơ cho người mới). Vai chạy
--   KHÔNG có quyền đụng vào schema `auth` (đúng như thiết kế), nên lệnh chèn
--   thất bại — mà lỗi lại bị nuốt trong khối `catch` "best-effort". Hệ quả:
--   người dùng đăng ký xong KHÔNG có tổ chức, mọi trang trả 403 "No tenant for
--   user". Đăng ký hỏng trong im lặng.
--
-- CÁCH SỬA. Không nới quyền cho vai chạy đụng vào `auth.users` — như vậy là mở
-- toang một bảng nhạy cảm chỉ để làm một việc. Thay vào đó mở đúng MỘT cửa:
-- một hàm SECURITY DEFINER thuộc vai chủ, làm đúng việc ghi danh, và vai chạy
-- chỉ được quyền GỌI nó.
--
-- CHỐNG TỰ NÂNG QUYỀN. Cờ `is_chairman_super` quyết định một tài khoản có nhìn
-- xuyên mọi tổ chức hay không. Nếu để phía gọi truyền cờ đó vào thì bất kỳ ai
-- gọi được hàm cũng tự phong mình làm chủ nền tảng. Nên danh sách chủ nền tảng
-- nằm trong BẢNG dưới đây, và hàm tự tra — phía gọi chỉ đưa email, không đưa
-- quyền.
-- ============================================================================

-- ─── Danh sách chủ nền tảng (nguồn sự thật phía CSDL) ───────────────────────
CREATE TABLE IF NOT EXISTS public.platform_superadmins (
  email      text PRIMARY KEY,
  ghi_chu    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bật RLS và CỐ TÌNH không tạo chính sách nào: không vai thường nào đọc được
-- bảng này. Hàm SECURITY DEFINER chạy bằng vai chủ nên vẫn tra được.
ALTER TABLE public.platform_superadmins ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_superadmins (email, ghi_chu) VALUES
  ('doanhnhancaotuan@gmail.com', 'Chairman Zeni Holdings'),
  ('caotuanphat581@gmail.com',   'Chairman - email phụ'),
  ('cto@zeniipo.com',            'CTO ZeniIPO'),
  ('ceo@zeniipo.com',            'CEO ZeniIPO'),
  ('admin@zenidigital.com',      'Quản trị Zeni Digital'),
  ('wellnexusvn@gmail.com',      'Wellnexus')
ON CONFLICT (email) DO NOTHING;

-- ─── Cửa ghi danh ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zeni_provision_user(
  p_uid       uuid,
  p_email     text,
  p_full_name text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- Cố định search_path: hàm SECURITY DEFINER mà để search_path tự do thì người
-- gọi có thể trỏ nó sang bảng giả của mình.
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email text := lower(nullif(trim(p_email), ''));
  v_super boolean;
BEGIN
  IF p_uid IS NULL THEN
    RAISE EXCEPTION 'zeni_provision_user: thiếu uid';
  END IF;

  -- Chèn vào auth.users để trigger handle_new_user tạo tổ chức + hồ sơ.
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (
    p_uid,
    v_email,
    jsonb_build_object('full_name', COALESCE(nullif(trim(p_full_name), ''), v_email, 'Zeni User'))
  )
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, auth.users.email);

  -- Cờ chủ nền tảng: HÀM tự tra danh sách, phía gọi không quyết định được.
  SELECT EXISTS (SELECT 1 FROM public.platform_superadmins s WHERE s.email = v_email)
    INTO v_super;

  IF v_super THEN
    UPDATE public.user_profiles
       SET is_chairman_super = true
     WHERE id = p_uid AND is_chairman_super IS DISTINCT FROM true;
  END IF;
END;
$$;

-- Mặc định Postgres cho PUBLIC chạy hàm mới — thu lại rồi cấp đúng vai cần.
REVOKE ALL ON FUNCTION public.zeni_provision_user(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zeni_provision_user(uuid, text, text)
  TO authenticated, service_role;
