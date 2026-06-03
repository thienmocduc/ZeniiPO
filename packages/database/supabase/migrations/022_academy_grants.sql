-- ═══════════════════════════════════════════════════════════════════
-- Migration 022 · GRANT read on academy curriculum tables
-- ═══════════════════════════════════════════════════════════════════
-- 021 enabled RLS with USING(true) public-read policies but never granted
-- table-level SELECT, so reads returned nothing. Curriculum is global content
-- → grant SELECT to authenticated (the API gates auth) + anon (public SEO/
-- preview of lesson titles). service_role full.
-- ═══════════════════════════════════════════════════════════════════

GRANT SELECT ON public.academy_lessons TO anon, authenticated;
GRANT SELECT ON public.academy_assessments TO anon, authenticated;
GRANT SELECT ON public.academy_deliverable_specs TO anon, authenticated;
GRANT ALL ON public.academy_lessons TO service_role;
GRANT ALL ON public.academy_assessments TO service_role;
GRANT ALL ON public.academy_deliverable_specs TO service_role;
