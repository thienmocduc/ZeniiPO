-- ═══════════════════════════════════════════════════════════════════
-- 030_runtime_roles_grants.sql · Quyền runtime cho tầng data Zeni (ZIPO P2)
-- ═══════════════════════════════════════════════════════════════════
-- App runtime kết nối bằng user owner (DATABASE_URL platform inject). Owner
-- BYPASS RLS → để RLS thật sự áp dụng, mỗi transaction người dùng sẽ
-- `SET LOCAL ROLE authenticated` (xem apps/web/src/lib/zeni/db.ts). File này
-- cấp đủ privilege cho authenticated/anon để chạy dưới role đó, vá stub
-- auth.users cho trigger signup, và dạy is_chairman_super() hiểu GUC
-- superadmin (ADMIN MODE — lệnh chairman 2026-08-10). Idempotent.
-- ═══════════════════════════════════════════════════════════════════

-- 1 · Vá stub auth.users: 001_auth_rbac.handle_new_user() đọc
--     NEW.raw_user_meta_data — cột chưa có trên stub (CONVERSION_NOTES đã cờ).
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2 · Schema usage
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA auth   TO authenticated, anon, service_role;

-- 3 · Privilege bảng/sequence/function — RLS mới là hàng rào dữ liệu
--     (mô phỏng đúng default-privilege mà Supabase từng cấp sẵn).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT USAGE,  SELECT                 ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT SELECT                         ON ALL TABLES    IN SCHEMA public TO anon;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,  SELECT                 ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE                        ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT                         ON TABLES    TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE                        ON FUNCTIONS TO anon;

-- 4 · ADMIN MODE: is_chairman_super() hiểu thêm GUC app.is_superadmin
--     (withUser(..., {superadmin:true}) set 'on' — chỉ server cấp sau khi
--     đối chiếu email Zeni ID với danh sách chủ nền tảng).
CREATE OR REPLACE FUNCTION public.is_chairman_super()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(current_setting('app.is_superadmin', true) = 'on', false)
      OR EXISTS(
           SELECT 1 FROM public.user_profiles
           WHERE id = auth.uid() AND is_chairman_super = true
         )
$$;
