-- ═══════════════════════════════════════════════════════════════════
-- Migration 017 · Fix duplicate master certificate
-- ═══════════════════════════════════════════════════════════════════
-- Bug: UNIQUE(tenant_id, kind, level_num) does NOT dedupe master certs
-- because level_num is NULL for them and Postgres treats NULL <> NULL in
-- unique constraints — so issue_certificates could mint a new master each run.
-- Fix: a partial unique index keyed only on (tenant_id) where kind='master'.
-- (Level certs keep the existing composite unique — level_num is never null
-- there.) De-dupe any existing masters first, keeping the earliest.
-- ═══════════════════════════════════════════════════════════════════

DELETE FROM certificates c
USING certificates c2
WHERE c.kind = 'master' AND c2.kind = 'master'
  AND c.tenant_id = c2.tenant_id
  AND c.issued_at > c2.issued_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cert_master_per_tenant
  ON certificates (tenant_id) WHERE kind = 'master';

-- Rewrite the master-cert branch to use an explicit EXISTS guard instead of
-- ON CONFLICT (which can't target a partial index cleanly).
CREATE OR REPLACE FUNCTION public.issue_certificates(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_lvl RECORD;
  v_holder text;
  v_company text;
  v_unlocked int;
  v_issued int := 0;
BEGIN
  IF NOT public.is_chairman_super()
     AND p_tenant_id NOT IN (SELECT id FROM public.list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT name INTO v_company FROM tenants WHERE id = p_tenant_id;
  SELECT full_name INTO v_holder FROM user_profiles
    WHERE tenant_id = p_tenant_id AND role IN ('chr','ceo')
    ORDER BY (role='chr') DESC LIMIT 1;

  FOR v_lvl IN
    SELECT p.level_num, l.name_vi, l.name_en
    FROM tenant_level_progress p JOIN journey_levels l ON l.level_num = p.level_num
    WHERE p.tenant_id = p_tenant_id AND p.state = 'unlocked'
  LOOP
    INSERT INTO certificates (tenant_id, kind, level_num, cert_code, title_vi, title_en, holder_name, company_name)
    VALUES (p_tenant_id, 'level', v_lvl.level_num, public.gen_cert_code(),
            'Hoàn thành Cấp ' || v_lvl.level_num || ' · ' || v_lvl.name_vi,
            'Level ' || v_lvl.level_num || ' Certified · ' || v_lvl.name_en,
            v_holder, v_company)
    ON CONFLICT (tenant_id, kind, level_num) DO NOTHING;
    IF FOUND THEN v_issued := v_issued + 1; END IF;
    UPDATE tenant_level_progress SET certified_at = COALESCE(certified_at, now())
      WHERE tenant_id = p_tenant_id AND level_num = v_lvl.level_num;
  END LOOP;

  SELECT count(*) INTO v_unlocked FROM tenant_level_progress
    WHERE tenant_id = p_tenant_id AND state = 'unlocked';
  IF v_unlocked >= 7 AND NOT EXISTS (
    SELECT 1 FROM certificates WHERE tenant_id = p_tenant_id AND kind = 'master'
  ) THEN
    INSERT INTO certificates (tenant_id, kind, level_num, cert_code, title_vi, title_en, holder_name, company_name)
    VALUES (p_tenant_id, 'master', NULL, public.gen_cert_code(),
            'Zeniipo Certified — Nhà sáng lập sẵn sàng IPO',
            'Zeniipo Certified — IPO-Ready Founder',
            v_holder, v_company);
    v_issued := v_issued + 1;
  END IF;

  RETURN jsonb_build_object('issued', v_issued, 'unlocked_levels', v_unlocked);
END $fn$;
