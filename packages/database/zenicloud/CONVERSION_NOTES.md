# ZIPO-001 — Supabase → Zeni Cloud Postgres conversion notes

Source: `packages/database/supabase/migrations/001..028` (untouched, read-only reference).
Output: `packages/database/zenicloud/00_zeni_stub.sql` + `001..028` (idempotency-hardened copies) + this file.
Business logic (table columns, CHECK constraints, RLS conditions, function bodies, seed data
values) was **never** changed. Every edit below is either (a) foundation/auth/extension layer,
per the ticket's rule 7, or (b) a DDL/DML idempotency guard needed to satisfy the "run the whole
chain twice successfully" requirement.

## 1. `00_zeni_stub.sql` (new file, runs before 001)

Contains exactly the literal spec given in the ticket (rule 1):
- `CREATE SCHEMA IF NOT EXISTS auth;`
- `auth.uid()` reading GUC `app.uid` (STABLE SQL function, `NULLIF(current_setting('app.uid', true), '')::uuid`)
- `auth.users (id uuid PK, email text, created_at timestamptz default now())` — IF NOT EXISTS
- `authenticated` role created idempotently (`IF NOT EXISTS (SELECT ... pg_roles)`), then
  `GRANT authenticated TO CURRENT_USER;`

Plus three additions **beyond the literal spec**, called out explicitly because the ticket's
rule 1 didn't ask for them but the 2x-successful-run requirement is not reachable without them:

| Addition | Why |
|---|---|
| `CREATE EXTENSION IF NOT EXISTS pgcrypto;` | `001_auth_rbac.sql` uses `gen_random_bytes()` in a column `DEFAULT` (`invitations.token`) — `DEFAULT` expressions are validated at `CREATE TABLE` time, so the function must exist before file 001 runs. The original migration set only does `CREATE EXTENSION IF NOT EXISTS pgcrypto;` in `019_captable_hashchain.sql`, 18 files later — that ordering only worked on Supabase because pgcrypto ships pre-installed on every Supabase project. Installing it in `00` fixes the ordering; `019`'s own `CREATE EXTENSION IF NOT EXISTS` is left untouched (harmless no-op on its 2nd install attempt). |
| `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` | Ticket rule 4 explicitly says to keep it available. Grepped the 28 files for `uuid_generate`/`uuid-ossp` — zero hits, so nothing actually calls it, but installed defensively per rule 4 (harmless if unused). |
| `CREATE ROLE anon NOLOGIN` / `CREATE ROLE service_role NOLOGIN` (both idempotent, `IF NOT EXISTS` guarded) | The 28 migrations `GRANT ... TO anon` (4 files: 005, 006, 016, 022) and `GRANT ... TO service_role` (12 files: 013,014,015,016,018,019,022,024,025,026,027,028) — ~40 statements. Without these roles existing, the chain fails at the very first such GRANT with "role does not exist". Neither role is ever referenced in a `CREATE POLICY ... TO anon/service_role` clause (every policy in this codebase is `TO authenticated` or unrestricted `USING(true)`), so no membership grant to `CURRENT_USER` was needed for either — they only need to *exist* for the GRANTs to succeed (table owners already bypass privilege checks on their own objects). Mirrors the same 3 roles `ops/db-setup/sql/01_init.sql` creates for the identical reason. |

Verified empirically (see §5): `auth.uid()` returns `NULL` with no GUC set and returns the UUID
correctly once `app.uid` is set via `set_config`.

**Known limitation, documented not silently dropped:** `001_auth_rbac.sql`'s `handle_new_user()`
trigger function reads `NEW.raw_user_meta_data->>'company_name'` etc. — a Supabase-Auth-specific
jsonb column that does not exist on the stub `auth.users` table (the ticket's literal column
list is `id/email/created_at` only). This is safe for *this* ticket: none of `001..028` INSERT
into `auth.users` (Supabase Auth does that at the platform layer, not via SQL migration), so the
trigger is created but never actually invoked during the chain replay — confirmed by the 2x clean
run. It will need attention only once real signup is wired to Zeni ID (separate ticket).

## 2. Removed — Supabase-only constructs

Searched all 28 files for: `supabase_functions`, `extensions.<obj>` (schema-qualified),
`pgsodium`, `vault.`, `graphql`, `realtime.`, `supabase_realtime` publication, `storage.`,
`auth.jwt()`, `auth.role()`. Only `storage.*` had real hits — everything else: **zero matches**,
nothing else to remove.

### `002_core_schema.sql` — STORAGE BUCKETS section deleted

Removed (was lines 310–343 of the original file):
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('data-room', 'data-room', false) ...
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ...
INSERT INTO storage.buckets (id, name, public) VALUES ('pitch-decks', 'pitch-decks', false) ...
CREATE POLICY "data_room_tenant_isolation" ON storage.objects ...
CREATE POLICY "pitch_decks_tenant_isolation" ON storage.objects ...
CREATE POLICY "avatars_public_read" ON storage.objects ...
CREATE POLICY "avatars_owner_write" ON storage.objects ...
```
Why: `storage.buckets` / `storage.objects` / `storage.foldername()` are Supabase Storage's
proprietary schema, not present on vanilla/Zeni Cloud Postgres — `CREATE TABLE`-less `INSERT INTO
storage.buckets` would fail immediately with "relation storage.buckets does not exist". Replaced
with a comment explaining the removal and that Zeni Cloud file uploads go through Zeni Cloud
object storage at the app layer, not a `storage.*` Postgres schema. Left a pointer to this file
in the replaced comment block so a future reader isn't surprised the section is gone.

### `020_fix_captable_hash_schema.sql` — left untouched (reviewed, not a bug)

This file sets `SET search_path = public, extensions, pg_temp` on two functions, because "on
Supabase pgcrypto installs into the `extensions` schema" (per the file's own header comment).
On Zeni Cloud / vanilla Postgres, `00_zeni_stub.sql`'s `CREATE EXTENSION IF NOT EXISTS pgcrypto`
(no `SCHEMA` clause) installs into `public`, so the `extensions` entry in that search_path list
is dead weight — but Postgres silently skips nonexistent schemas named in `search_path` (no
error), so it is a functional no-op, not a bug. Left byte-identical to minimize diff / avoid
touching a function body for a purely cosmetic reason (mind-map rule: don't edit what already
works). Confirmed harmless by the 2x clean chain run (`digest()` resolves fine via `public`).

## 3. Idempotency hardening (DDL) — mechanical, business-logic-untouched

Ran a scripted pass (regex + line-context, not hand-edited) over all 28 files:
- `CREATE TABLE <x>` → `CREATE TABLE IF NOT EXISTS <x>` where missing (39 statements, files 001–004, 010)
- `CREATE [UNIQUE] INDEX <x>` → `... IF NOT EXISTS <x>` where missing (58 statements, files 001–003, 010)
- `CREATE POLICY "<name>" ON <table>` → prefixed with `DROP POLICY IF EXISTS <name> ON <table>;` where the file didn't already use that pattern (49 statements, files 001–004, 010, 021)
- `CREATE TRIGGER <name> ... ON <table>` → prefixed with `DROP TRIGGER IF EXISTS <name> ON <table>;` where missing (16 statements across files 001, 003, 004, 010, 014, 018, 024, 025, 026, 027, 028)

Files that were **already fully idempotent** in the original (no changes needed):
005, 006, 007, 008, 009, 011, 012, 013, 015, 016, 017, 019, 020, 021 (after 1 cleanup, see below), 022, 023.

Verification after the scripted pass (see §5 for exact commands/output):
- `grep` confirms zero remaining `CREATE TABLE` / `CREATE [UNIQUE] INDEX` statements without `IF NOT EXISTS`.
- Per-file `CREATE POLICY` count == `DROP POLICY IF EXISTS` count, and `CREATE TRIGGER` count == `DROP TRIGGER IF EXISTS` count, for every file (exact 1:1 pairing).

**One script false-positive found and fixed by hand:** `021_academy_scaffold.sql` had
`DROP POLICY IF EXISTS assessments_public_read ON academy_assessments;` already present, but
separated from its `CREATE POLICY` by a 3-line comment block. The script's 3-line back-scan
stopped at the first non-blank line (a comment) and didn't see the real DROP further back, so it
inserted a second, redundant (but harmless — `DROP ... IF EXISTS` is idempotent by definition)
copy. Found via a duplicate-line scan across all output files (only this one instance existed)
and removed the redundant line by hand.

## 4. Idempotency hardening (seed DML) — `ON CONFLICT` added

5 seed `INSERT ... VALUES (...)` statements had no `ON CONFLICT` clause in the original files —
harmless on a single run, but re-running the exact same file a second time against a database
that already has that data throws a duplicate-key error on the table's `PRIMARY KEY`/`UNIQUE`
column. Fixed by adding `ON CONFLICT (<natural key>) DO NOTHING` (matching the style already used
by every other seed INSERT in this codebase, e.g. `006`, `007`, `014`, `021`, `025`, `026`, `027`):

| File | Table | Natural key used |
|---|---|---|
| `003_ipo_complete_flows.sql` | `ipo_readiness_criteria_template` (20 rows) | `criterion_code` |
| `003_ipo_complete_flows.sql` | `membership_tiers` (5 rows) | `tier_code` |
| `004_seed_content.sql` | `modules_catalog` (32 rows) | `module_code` |
| `004_seed_content.sql` | `agent_catalog` (108 rows) | `agent_code` |
| `004_seed_content.sql` | `glossary` (20 rows) | `term` |

All 5 keys are the table's actual `PRIMARY KEY`/`UNIQUE` column, confirmed from each table's own
`CREATE TABLE` statement earlier in the same file — no guessing.

## 5. Evidence — dev DB run, twice, idempotent

Environment: embedded Postgres 16.14 already running on `localhost:5433` (user/pass
`postgres`/`postgres`), same cluster `zenios/.devpg` uses for `zeni_dev`. Runner:
`cd zenios && DATABASE_URL=... npx tsx scripts/run-sql.ts <file>` (unmodified, per ticket).

**Database bootstrap** (one-time, not part of the repeated chain): `zeniipo_dev` was first
created with a bare `CREATE DATABASE zeniipo_dev;`, which inherited the cluster's `template1`
encoding — **WIN1252** (`English_world.1252` collate/ctype, the Windows-locale initdb default on
this machine) — not UTF8. Every file in this repo is UTF-8 (Vietnamese text + `═` box-drawing
comment borders), so run 1 failed immediately on every file with `character with byte sequence
0xe2 0x95 0x90 in encoding "UTF8" has no equivalent in encoding "WIN1252"`. Fixed by dropping and
recreating: `CREATE DATABASE zeniipo_dev WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE
template0;` — same pattern `zeni_dev` itself already uses (confirmed via `pg_database` query
before fixing). This is a one-time dev-environment fact, not a migration-file bug; noting it here
so the next person bootstrapping a fresh dev DB for this repo doesn't hit the same wall.

**RUN 1** — 29/29 files `EXIT_OK`, in order `00_zeni_stub, 001..028`. Zero `FAIL`.

**RUN 2** — same command, same database, **no reset in between**. 29/29 files `EXIT_OK` again.
Zero `FAIL`. This is the actual idempotency proof: every statement in every file tolerated being
re-run against a database that already had the full schema + seed data from RUN 1.

**Post-run sanity query** (ad hoc script, not committed — connects to `zeniipo_dev` after RUN 2):
```
COUNT modules_catalog: 32                COUNT ipo_benchmarks: 31
COUNT agent_catalog: 108                 COUNT journey_phase_specs: 10
COUNT glossary: 20                       COUNT training_drills: 16
COUNT ipo_readiness_criteria_template: 20  COUNT academy_lessons: 6
COUNT membership_tiers: 5                COUNT academy_assessments: 1
COUNT tenants: 8                         COUNT academy_deliverable_specs: 17
COUNT journey_levels: 7
COUNT org_units: 12
COUNT position_templates: 12
ROLES: anon,authenticated,service_role
EXTENSIONS: pgcrypto,uuid-ossp
auth.uid() with no GUC set: null
auth.uid() with GUC set: 11111111-1111-1111-1111-111111111111
storage schema present: false
auth.users columns: id,email,created_at
total base tables (public+auth): 71
total functions (public+auth): 76
```
Every seeded catalog table's row count matches its source count exactly (no doubling from the 2nd
run — confirms the `ON CONFLICT` fixes in §4 and the pre-existing `ON CONFLICT` clauses both
worked), all 3 roles exist, both extensions installed, `auth.uid()` behaves correctly with and
without the GUC, and the `storage` schema is cleanly absent.

## 6. Files NOT touched

- `supabase/migrations/*.sql` — read-only reference, byte-identical to before this ticket.
- `apps/web/*` — not opened.
- No `git add`/`git commit` performed.
- Only database touched by this ticket: `zeniipo_dev` on the local embedded Postgres
  (`localhost:5433`). `zeni_dev` was read once (`pg_database` encoding lookup for comparison) and
  never written to.

## 7. File manifest (29 files, 4430 lines total)

| File | Lines | Idempotency changes |
|---|---:|---|
| `00_zeni_stub.sql` | 76 | new file |
| `001_auth_rbac.sql` | 189 | 4 tables, 9 indexes, 8 policies, 1 trigger |
| `002_core_schema.sql` | 330 | 12 tables, 27 indexes, 12 policies (+4 removed w/ storage section), storage section removed |
| `003_ipo_complete_flows.sql` | 514 | 14 tables, 11 indexes, 14 policies, 1 trigger, 2 seed ON CONFLICT |
| `004_seed_content.sql` | 291 | 3 tables, 3 policies, 1 trigger, 3 seed ON CONFLICT |
| `005_catalog_public_read.sql` | 71 | none needed |
| `006_chairman_super_admin.sql` | 146 | none needed |
| `007_training_drills_seed.sql` | 148 | none needed |
| `008_fix_handle_new_user_slug.sql` | 84 | none needed |
| `009_fix_compute_readiness_secdef.sql` | 64 | none needed |
| `010_extended_resources.sql` | 188 | 6 tables, 11 indexes, 12 policies, 2 triggers |
| `011_subscriptions_extra_cols.sql` | 15 | none needed |
| `012_investor_pipeline_round_optional.sql` | 10 | none needed |
| `013_service_role_grants.sql` | 47 | none needed |
| `014_journey_engine.sql` | 257 | 1 trigger |
| `015_fix_advance_level_event.sql` | 58 | none needed |
| `016_certifications.sql` | 124 | none needed |
| `017_fix_master_cert_unique.sql` | 72 | none needed |
| `018_financial_models.sql` | 32 | 1 trigger |
| `019_captable_hashchain.sql` | 94 | none needed |
| `020_fix_captable_hash_schema.sql` | 62 | none needed (reviewed, see §2) |
| `021_academy_scaffold.sql` | 98 | 1 duplicate DROP POLICY removed (script false-positive, see §3) |
| `022_academy_grants.sql` | 15 | none needed |
| `023_holdings_parent.sql` | 26 | none needed |
| `024_agent_engine.sql` | 114 | 1 trigger |
| `025_business_spine.sql` | 240 | 2 triggers |
| `026_mba_ipo_engine.sql` | 383 | 3 triggers |
| `027_operating_brain.sql` | 358 | 3 triggers |
| `028_modes_and_connectors.sql` | 324 | 2 triggers |
