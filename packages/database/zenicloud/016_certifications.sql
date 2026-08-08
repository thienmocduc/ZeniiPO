-- ═══════════════════════════════════════════════════════════════════
-- Migration 016 · Certifications (spec Part III — chứng nhận 7 cấp)
-- ═══════════════════════════════════════════════════════════════════
-- Mỗi cấp hoàn thành → 1 chứng nhận. Trọn 7 cấp → "IPO-Ready Founder".
-- Mỗi cert có cert_code công khai để verify (tín hiệu uy tín + lan truyền).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  kind text NOT NULL CHECK (kind IN ('level','master')),
  level_num int REFERENCES journey_levels(level_num),
  cert_code text UNIQUE NOT NULL,          -- ZENI-XXXX-XXXX, public verify
  title_vi text NOT NULL,
  title_en text NOT NULL,
  holder_name text,
  company_name text,
  issued_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, kind, level_num)
);
CREATE INDEX IF NOT EXISTS idx_cert_tenant ON certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cert_code ON certificates(cert_code);
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Tenant reads own certs; super admin all.
DROP POLICY IF EXISTS super_admin_bypass ON certificates;
CREATE POLICY super_admin_bypass ON certificates FOR ALL USING (is_chairman_super()) WITH CHECK (is_chairman_super());
DROP POLICY IF EXISTS tenant_isolation ON certificates;
CREATE POLICY tenant_isolation ON certificates FOR SELECT USING (tenant_id = current_tenant_id());
GRANT SELECT ON certificates TO authenticated;
GRANT ALL ON certificates TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- short random cert code: ZENI-XXXX-XXXX (no ambiguous chars)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gen_cert_code()
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  s text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    s := s || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1);
    IF i = 4 THEN s := s || '-'; END IF;
  END LOOP;
  RETURN 'ZENI-' || s;
END $fn$;

-- ─────────────────────────────────────────────────────────────────
-- issue_certificates — idempotent; scans unlocked levels + 7/7 master
-- ─────────────────────────────────────────────────────────────────
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

  -- per-level certs for every unlocked level
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
    -- stamp certified_at on the level
    UPDATE tenant_level_progress SET certified_at = COALESCE(certified_at, now())
      WHERE tenant_id = p_tenant_id AND level_num = v_lvl.level_num;
  END LOOP;

  -- master cert when all 7 levels unlocked
  SELECT count(*) INTO v_unlocked FROM tenant_level_progress
    WHERE tenant_id = p_tenant_id AND state = 'unlocked';
  IF v_unlocked >= 7 THEN
    INSERT INTO certificates (tenant_id, kind, level_num, cert_code, title_vi, title_en, holder_name, company_name)
    VALUES (p_tenant_id, 'master', NULL, public.gen_cert_code(),
            'Zeniipo Certified — Nhà sáng lập sẵn sàng IPO',
            'Zeniipo Certified — IPO-Ready Founder',
            v_holder, v_company)
    ON CONFLICT (tenant_id, kind, level_num) DO NOTHING;
    IF FOUND THEN v_issued := v_issued + 1; END IF;
  END IF;

  RETURN jsonb_build_object('issued', v_issued, 'unlocked_levels', v_unlocked);
END $fn$;
REVOKE ALL ON FUNCTION public.issue_certificates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_certificates(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────
-- verify_certificate — PUBLIC (no auth): anyone with the code can verify
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT CASE WHEN c.id IS NULL THEN jsonb_build_object('valid', false)
    ELSE jsonb_build_object(
      'valid', true, 'cert_code', c.cert_code, 'kind', c.kind,
      'title_vi', c.title_vi, 'title_en', c.title_en,
      'holder_name', c.holder_name, 'company_name', c.company_name,
      'issued_at', c.issued_at)
  END
  FROM (SELECT 1) dummy
  LEFT JOIN certificates c ON c.cert_code = upper(trim(p_code));
$fn$;
REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated, service_role;
