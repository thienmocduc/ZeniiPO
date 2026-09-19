-- ═══════════════════════════════════════════════════════════════════
-- Migration 020 · Fix cap-table hash: pgcrypto digest() lives in `extensions`
-- ═══════════════════════════════════════════════════════════════════
-- On Supabase pgcrypto installs into the `extensions` schema, so digest()
-- was unresolved under search_path=public,pg_temp → the hash-chain trigger
-- raised and every snapshot insert silently failed. Add `extensions` to the
-- search_path of both functions.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cap_table_hash_chain()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $fn$
DECLARE
  v_prev text;
  v_payload text;
BEGIN
  SELECT row_hash INTO v_prev
  FROM cap_table_snapshots
  WHERE tenant_id = NEW.tenant_id
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT 1;
  v_prev := COALESCE(v_prev, 'GENESIS');

  v_payload := v_prev || '|' || NEW.tenant_id::text || '|' || COALESCE(NEW.journey_id::text,'') || '|'
             || COALESCE(NEW.snapshot_date::text,'') || '|' || COALESCE(NEW.snapshot_type,'') || '|'
             || COALESCE(NEW.total_shares::text,'') || '|' || COALESCE(NEW.holders::text,'');

  NEW.prev_hash := v_prev;
  NEW.row_hash := encode(digest(v_payload, 'sha256'), 'hex');
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.verify_cap_table_chain(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $fn$
DECLARE
  v_row RECORD;
  v_prev text := 'GENESIS';
  v_calc text;
  v_payload text;
  v_count int := 0;
  v_broken uuid;
BEGIN
  IF NOT public.is_chairman_super()
     AND p_tenant_id NOT IN (SELECT id FROM public.list_accessible_tenants()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  FOR v_row IN
    SELECT * FROM cap_table_snapshots WHERE tenant_id = p_tenant_id
    ORDER BY created_at ASC NULLS FIRST, id ASC
  LOOP
    v_count := v_count + 1;
    v_payload := v_prev || '|' || v_row.tenant_id::text || '|' || COALESCE(v_row.journey_id::text,'') || '|'
               || COALESCE(v_row.snapshot_date::text,'') || '|' || COALESCE(v_row.snapshot_type,'') || '|'
               || COALESCE(v_row.total_shares::text,'') || '|' || COALESCE(v_row.holders::text,'');
    v_calc := encode(digest(v_payload, 'sha256'), 'hex');
    IF v_row.row_hash IS DISTINCT FROM v_calc THEN
      v_broken := v_row.id;
      EXIT;
    END IF;
    v_prev := v_row.row_hash;
  END LOOP;
  RETURN jsonb_build_object('valid', v_broken IS NULL, 'snapshots', v_count, 'broken_at', v_broken);
END $fn$;
