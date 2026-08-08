-- ═══════════════════════════════════════════════════════════════════
-- 00_zeni_stub.sql · Zeni Cloud Postgres foundation stub for ZeniIPO
-- ZIPO-001 — Supabase -> Zeni Cloud Postgres conversion
-- ═══════════════════════════════════════════════════════════════════
-- Runs BEFORE 001..028. Provides the pieces Supabase's platform used to
-- supply automatically (auth schema/functions, roles, extensions) so the
-- 28 business migrations below can run UNCHANGED in business logic.
-- Idempotent — safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────
-- pgcrypto installed HERE (not just in 019_captable_hashchain.sql) because
-- 001_auth_rbac.sql already calls gen_random_bytes() in a column DEFAULT
-- (invitations.token) — DEFAULT expressions are validated at CREATE TABLE
-- time, so the function must exist before file 001 runs. On Supabase this
-- was a non-issue because pgcrypto ships pre-installed on every project.
-- uuid-ossp is not actually called anywhere in 001..028 (checked via grep
-- for uuid_generate/uuid-ossp — zero hits) but rule 4 asks to keep it
-- available, so it is installed defensively; harmless if unused.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── auth schema + auth.uid() (GUC-based, per ZIPO-001 spec) ─────────
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
'SELECT NULLIF(current_setting(''app.uid'', true), '''')::uuid';

-- auth.users stub — exact shape from ZIPO-001 spec (id/email/created_at).
-- Every `REFERENCES auth.users(id)` FK across 001..028 resolves against
-- this table unchanged (rule 2 — no per-file edits needed for FKs).
-- NOTE: Supabase's real auth.users also carries raw_user_meta_data (jsonb).
-- 001_auth_rbac.sql's handle_new_user() trigger reads NEW.raw_user_meta_data
-- — that column does not exist on this stub. This is safe for THIS ticket
-- (schema-only conversion: none of 001..028 INSERT into auth.users, so the
-- trigger body is created but never actually invoked during the chain run).
-- It only matters once real signup is wired to Zeni ID — out of scope here,
-- flagged in CONVERSION_NOTES.md.
CREATE TABLE IF NOT EXISTS auth.users (
  id          uuid PRIMARY KEY,
  email       text,
  created_at  timestamptz DEFAULT now()
);

-- ── Roles ────────────────────────────────────────────────────────────
-- `authenticated` — exact block from ZIPO-001 spec. RLS policies across
-- 001..028 are written `... TO authenticated`; granting membership to
-- CURRENT_USER (Postgres never errors re-granting an existing membership)
-- makes the single connecting app/admin role satisfy those policies.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;
GRANT authenticated TO CURRENT_USER;

-- `anon` and `service_role` — ADDED BEYOND THE LITERAL TICKET SPEC.
-- Reason: 001..028 GRANT table/function privileges TO anon (4 files:
-- 005, 006, 016, 022) and TO service_role (12 files: 013,014,015,016,018,
-- 019,022,024,025,026,027,028) — ~40 statements total. None of these roles
-- are ever used in a `CREATE POLICY ... TO anon/service_role` clause (only
-- `TO authenticated` or unrestricted policies exist in this codebase), so
-- the role only needs to EXIST for the GRANT statements to succeed — no
-- membership grant to CURRENT_USER is needed (table owners already bypass
-- privilege checks on their own objects). Mirrors the same 3 roles Zeni
-- Cloud's own ops/db-setup/sql/01_init.sql creates for identical reasons.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;
