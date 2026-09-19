-- 023_holdings_parent.sql
-- Holdings relationship: a tenant may belong to a parent holding tenant.
-- Powers the Zeni Console "Holdings Cockpit" view (group rollup across
-- subsidiaries). Membership is chairman-controlled via /api/console (set_parent).
--
-- Seed: attach the clear Zeni/Anima-family brands to Zeni Holdings.
-- We intentionally DO NOT touch bthome / nexbuild — those are independent
-- customer tenants, not Zeni Holdings subsidiaries.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS parent_tenant_id uuid
  REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_parent ON public.tenants(parent_tenant_id);

COMMENT ON COLUMN public.tenants.parent_tenant_id IS
  'If set, this tenant is a subsidiary of the referenced holding tenant. Drives Zeni Console Holdings rollup.';

-- Seed subsidiaries → Zeni Holdings (by slug, idempotent, self-exclusion guard).
UPDATE public.tenants sub
SET parent_tenant_id = parent.id
FROM public.tenants parent
WHERE parent.slug = 'zeni'
  AND sub.slug IN ('anima', 'zenidigital', 'zenichain')
  AND sub.id <> parent.id
  AND sub.parent_tenant_id IS DISTINCT FROM parent.id;
