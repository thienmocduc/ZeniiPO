-- ═══════════════════════════════════════════════════════════════════
-- Migration 006 · Chairman Super Admin · Cross-tenant access
-- Adds:
--   1. is_chairman_super flag on user_profiles
--   2. Seed 8 Zeni ecosystem tenants (anima, zeni, biotea, wellkoc,
--      zenidigital, zenichain, bthome, nexbuild)
--   3. Chairman tenant memberships (super admin is member of all 8
--      as 'chr' role)
--   4. is_chairman_super() helper (SECURITY DEFINER, search_path pinned)
--   5. Bypass RLS policies for super admin on ALL tenant-scoped tables
--      (adds a SECOND policy; Postgres OR's multiple policies so normal
--      tenant isolation still applies to non-super users)
--   6. UX support: get_tenant_list() for super admin's tenant switcher
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. FLAG + SEED TENANTS
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_chairman_super boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_profiles_super ON public.user_profiles(is_chairman_super)
  WHERE is_chairman_super = true;

-- 8 Zeni ecosystem tenants (upsert by slug)
INSERT INTO public.tenants (name, slug, plan) VALUES
  ('ANIMA Care Global',          'anima',        'enterprise'),
  ('Zeni Holdings',              'zeni',         'enterprise'),
  ('Biotea84',                   'biotea',       'enterprise'),
  ('WellKOC',                    'wellkoc',      'enterprise'),
  ('Zeni Digital',               'zenidigital',  'enterprise'),
  ('Zeni Chain',                 'zenichain',    'enterprise'),
  ('bthome',                     'bthome',       'enterprise'),
  ('NexBuild Holdings',          'nexbuild',     'enterprise')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  plan = EXCLUDED.plan;

-- ─────────────────────────────────────────────────────────────────
-- 2. HELPER FUNCTION
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_chairman_super()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_chairman_super = true
  )
$$;

-- ─────────────────────────────────────────────────────────────────
-- 3. TENANT LIST RPC (for super admin tenant switcher)
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_accessible_tenants()
RETURNS TABLE(id uuid, name text, slug text, plan text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id, t.name, t.slug, t.plan
  FROM public.tenants t
  WHERE
    -- Super admin sees all tenants
    public.is_chairman_super()
    OR
    -- Regular user sees only their own tenant
    t.id = public.current_tenant_id()
  ORDER BY t.name
$$;

GRANT EXECUTE ON FUNCTION public.is_chairman_super() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.list_accessible_tenants() TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- 4. BYPASS RLS POLICIES FOR SUPER ADMIN
-- Adds `super_admin_bypass` policy on all tenant-scoped tables.
-- Postgres OR's multiple permissive policies → super admin can read/
-- write ANY tenant's data, normal users still constrained to own tenant.
-- ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tenants',
    'user_profiles',
    'invitations',
    'audit_logs',
    'ipo_journeys',
    'okr_objectives',
    'okr_krs',
    'tasks',
    'events',
    'agents',
    'agent_runs',
    'data_room_folders',
    'data_room_docs',
    'subscriptions',
    'kpi_metrics',
    'phase_gates',
    'fundraise_rounds',
    'investor_pipeline',
    'cap_table_snapshots',
    'dd_investor_access',
    'dd_access_logs',
    'dd_qa_threads',
    'ipo_readiness_criteria',
    'readiness_score_history',
    'external_stakeholders',
    'external_access_logs',
    'academy_progress',
    'case_studies'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "super_admin_bypass" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "super_admin_bypass" ON public.%I FOR ALL '
        'USING (public.is_chairman_super()) '
        'WITH CHECK (public.is_chairman_super())',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 5. PROMOTE CHAIRMAN ACCOUNT
-- (Updates the admin created earlier — safe to re-run)
-- ─────────────────────────────────────────────────────────────────

UPDATE public.user_profiles
SET
  is_chairman_super = true,
  role = 'chr',
  tenant_id = (SELECT id FROM public.tenants WHERE slug = 'zeni')
WHERE email = 'doanhnhancaotuan@gmail.com';

COMMENT ON COLUMN public.user_profiles.is_chairman_super IS
  'Chairman super admin flag — bypasses tenant RLS, can access all 8 Zeni tenants';
