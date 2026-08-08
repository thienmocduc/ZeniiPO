-- ═══════════════════════════════════════════════════════════════════
-- Migration 019 · Cap Table hash chain (spec: append-only + hash, niêm yết-grade)
-- ═══════════════════════════════════════════════════════════════════
-- Each snapshot is chained: hash = sha256(prev_hash || immutable content).
-- Any tampering of an earlier snapshot breaks every subsequent hash →
-- auditors can prove the cap table was never silently rewritten.
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE cap_table_snapshots
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS row_hash text;

-- Compute the chained hash on insert. Snapshot content is treated as
-- immutable: tenant_id + journey_id + snapshot_date + type + total_shares +
-- holders. prev_hash = most recent snapshot's row_hash for the same tenant.
CREATE OR REPLACE FUNCTION public.cap_table_hash_chain()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
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

DROP TRIGGER IF EXISTS trg_cap_table_hash ON cap_table_snapshots;
CREATE TRIGGER trg_cap_table_hash BEFORE INSERT ON cap_table_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.cap_table_hash_chain();

-- Block UPDATE on snapshots — historical rows are immutable (the real tamper
-- threat). DELETE is intentionally allowed so tenant offboarding / ON DELETE
-- CASCADE from tenants still works; a deleted tail is detectable by chain
-- length, and wiping a whole tenant's history is a tenant-level decision.
CREATE OR REPLACE FUNCTION public.cap_table_no_update()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'cap_table_snapshots is append-only (hash chain) — create a NEW snapshot instead of editing %', OLD.id;
END $fn$;
DROP TRIGGER IF EXISTS trg_cap_table_no_update ON cap_table_snapshots;
CREATE TRIGGER trg_cap_table_no_update BEFORE UPDATE ON cap_table_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.cap_table_no_update();

-- Verify the whole chain for a tenant by recomputing every hash in order.
CREATE OR REPLACE FUNCTION public.verify_cap_table_chain(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
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
  RETURN jsonb_build_object(
    'valid', v_broken IS NULL,
    'snapshots', v_count,
    'broken_at', v_broken
  );
END $fn$;
REVOKE ALL ON FUNCTION public.verify_cap_table_chain(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_cap_table_chain(uuid) TO authenticated, service_role;
