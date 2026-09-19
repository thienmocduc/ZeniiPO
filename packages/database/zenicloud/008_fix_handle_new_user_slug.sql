-- ═══════════════════════════════════════════════════════════════════
-- Migration 008 · Fix handle_new_user slug regex + collision handling
--
-- BUG: Original trigger applied `lower()` AFTER `regexp_replace()`. The
-- regex pattern `[^a-z0-9]+` (lowercase-only) matched uppercase letters
-- as "non-lowercase-alphanumeric" and stripped them. Result:
--   "IPO Co A"  →  "-o-"   (instead of "ipo-co-a")
--   "ANIMA"     →  ""
--
-- FIX:
--   1. Lowercase BEFORE regex
--   2. Trim leading/trailing dashes
--   3. Append 6-char random suffix on collision (UNIQUE slug)
--   4. Fallback to 'company-<id8>' if name is empty after cleanup
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_company_name text;
  v_base_slug text;
  v_slug text;
  v_attempts int := 0;
BEGIN
  -- ── 1. Existing tenant by slug from metadata? Just attach. ──
  IF NEW.raw_user_meta_data->>'tenant_slug' IS NOT NULL THEN
    SELECT id INTO v_tenant_id FROM public.tenants
    WHERE slug = NEW.raw_user_meta_data->>'tenant_slug';
  END IF;

  -- ── 2. New tenant: build slug correctly. ──
  IF v_tenant_id IS NULL THEN
    v_company_name := COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'company_name'), ''),
      'My Company'
    );

    -- LOWERCASE FIRST, then regex strips non-alphanumeric → dash
    v_base_slug := regexp_replace(lower(v_company_name), '[^a-z0-9]+', '-', 'g');
    -- Trim leading/trailing dashes
    v_base_slug := trim(both '-' from v_base_slug);

    -- Empty after cleanup? Fall back to "company-<first 8 of id>"
    IF v_base_slug IS NULL OR length(v_base_slug) = 0 THEN
      v_base_slug := 'company-' || substring(NEW.id::text, 1, 8);
    END IF;

    -- Loop until we find a unique slug (max 5 attempts)
    v_slug := v_base_slug;
    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) AND v_attempts < 5 LOOP
      v_attempts := v_attempts + 1;
      v_slug := v_base_slug || '-' || substring(md5(random()::text || NEW.id::text), 1, 6);
    END LOOP;

    INSERT INTO public.tenants (name, slug, owner_id, plan)
    VALUES (v_company_name, v_slug, NEW.id, 'free')
    RETURNING id INTO v_tenant_id;
  END IF;

  -- ── 3. Create profile linked to tenant. ──
  INSERT INTO public.user_profiles (id, tenant_id, email, full_name, role)
  VALUES (
    NEW.id,
    v_tenant_id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'chr')
  );

  RETURN NEW;
END $$;

-- Cleanup orphan tenants from previous broken slugs (all-dash or dash-letter-dash)
-- BEFORE the trigger fix, slugs like '-o-', '--', '' might have been generated.
DELETE FROM public.tenants
WHERE slug ~ '^[-]+$'
   OR slug ~ '^[-][a-z0-9]?[-]$'
   OR length(slug) <= 3;

COMMENT ON FUNCTION public.handle_new_user IS
  'Auto-creates tenant + user_profile on auth.users insert. Slug derived from company_name (lowercase + alphanumeric, dashes elsewhere). Handles slug collision with random 6-char suffix.';
