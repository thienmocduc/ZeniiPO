-- ═══════════════════════════════════════════════════════════════════
-- Migration 013 · GRANT table privileges to service_role for cron jobs
-- ═══════════════════════════════════════════════════════════════════
-- Root cause: core-schema migrations only ran
--   GRANT ... TO authenticated
-- so the `service_role` DB role had ZERO privileges on these tables.
-- Vercel cron handlers use the service-role key (auth.role()='service_role',
-- BYPASSRLS) — but BYPASSRLS only skips RLS *policies*, it does NOT grant
-- table-level privileges. So every cron query hit "permission denied for
-- table ipo_journeys".
--
-- Fix: GRANT the needed privileges to service_role. service_role already
-- has BYPASSRLS, so no RLS policy is required for it. We GRANT only the
-- tables the cron handlers actually touch (least privilege).
-- ═══════════════════════════════════════════════════════════════════

-- audit-retention cron: SELECT + DELETE on audit_logs
GRANT SELECT, DELETE ON public.audit_logs TO service_role;

-- readiness-recalc cron: SELECT journeys, EXECUTE compute RPC (writes history)
GRANT SELECT ON public.ipo_journeys TO service_role;
GRANT SELECT, INSERT ON public.readiness_score_history TO service_role;
GRANT SELECT ON public.ipo_readiness_criteria TO service_role;

-- weekly-digest cron: SELECT across reporting tables
GRANT SELECT ON public.tenants TO service_role;
GRANT SELECT ON public.user_profiles TO service_role;
GRANT SELECT ON public.kpi_metrics TO service_role;
GRANT SELECT ON public.tasks TO service_role;
GRANT SELECT ON public.events TO service_role;

-- Future-proof: default privileges so new tables created by postgres are
-- readable by service_role automatically (cron + webhooks).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO service_role;

-- Drop the now-redundant service_role_bypass RLS policies from the earlier
-- 013 attempt (service_role bypasses RLS via role attribute, policy is moot).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_logs','ipo_journeys','kpi_metrics','tasks',
    'readiness_score_history','events','user_profiles','tenants']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_role_bypass ON public.%I;', t);
  END LOOP;
END $$;
