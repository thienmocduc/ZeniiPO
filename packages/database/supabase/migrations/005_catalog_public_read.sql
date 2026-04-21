-- ═══════════════════════════════════════════════════════════════════
-- Migration 005 · Public read on catalog tables
-- modules_catalog, agent_catalog, glossary, case_studies, membership_tiers,
-- training_drills, ipo_readiness_criteria_template: all SELECT public.
-- These are reference/catalog data — safe to expose to anon users.
-- ═══════════════════════════════════════════════════════════════════

-- Enable RLS + public SELECT policy on each catalog table
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'modules_catalog',
    'agent_catalog',
    'glossary',
    'case_studies',
    'membership_tiers',
    'training_drills',
    'ipo_readiness_criteria_template'
  ])
  LOOP
    -- Only if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- Drop existing policy if same name
      EXECUTE format('DROP POLICY IF EXISTS "public_read_%I" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "public_read_%I" ON public.%I FOR SELECT USING (true)', t, t);
    END IF;
  END LOOP;
END $$;

-- phase_content is also public-read (content for handbook UI)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='phase_content') THEN
    ALTER TABLE public.phase_content ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "phase_content_public_read" ON public.phase_content;
    CREATE POLICY "phase_content_public_read" ON public.phase_content FOR SELECT USING (true);
  END IF;
END $$;

-- Set search_path on SECURITY DEFINER functions so they can find public tables
-- when invoked by supabase_auth_admin (default search_path doesn't include public)
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_tenant_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.has_role(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_chr_or_ceo() SET search_path = public, pg_temp;

-- GRANT SELECT to anon + authenticated on catalog tables
-- (RLS policy gates row-level, GRANT gates schema-level table access)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'modules_catalog',
    'agent_catalog',
    'glossary',
    'case_studies',
    'membership_tiers',
    'training_drills',
    'ipo_readiness_criteria_template',
    'phase_content'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    END IF;
  END LOOP;
END $$;
