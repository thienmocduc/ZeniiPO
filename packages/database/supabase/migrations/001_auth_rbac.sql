-- ═══════════════════════════════════════════════════════════════════
-- Migration 001 · Auth + RBAC + Multi-Tenant · v1.0
-- Based on Agent 3 spec (AGENT_3_AUTH.md)
-- Tables: tenants, user_profiles, invitations, audit_logs
-- Functions: auth.current_tenant_id, auth.has_role, auth.is_chr_or_ceo
-- Trigger: handle_new_user → auto-create profile + tenant
-- RLS: tenant isolation on all 4 tables
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────────

-- Tenants (companies)
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','explorer','pro','elite','enterprise')),
  owner_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  settings jsonb DEFAULT '{}'::jsonb
);

-- User profiles (extended from auth.users)
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'emp' CHECK (role IN ('chr','ceo','cfo','coo','cto','cmo','clo','emp')),
  avatar_url text,
  locale text DEFAULT 'vi',
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz
);

-- Invitations
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  invited_by uuid REFERENCES auth.users(id),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Audit log for sensitive actions
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_table text,
  target_id text,
  before jsonb,
  after jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────
-- INDEXES (on FKs + lookups)
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_user_profiles_tenant ON user_profiles(tenant_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_tenants_owner ON tenants(owner_id);

-- ─────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS (auth schema)
-- ─────────────────────────────────────────────────────────────────

-- Get current user's tenant_id
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT tenant_id FROM user_profiles WHERE id = auth.uid() $$;

-- Check current user's role
CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = required_role) $$;

-- Check if current user is CHR or CEO
CREATE OR REPLACE FUNCTION public.is_chr_or_ceo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('chr','ceo')) $$;

-- ─────────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ─────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenants: users see only their own tenant
CREATE POLICY "tenant_isolation_select" ON tenants
  FOR SELECT USING (id = public.current_tenant_id());

CREATE POLICY "tenant_owner_update" ON tenants
  FOR UPDATE USING (owner_id = auth.uid());

-- User profiles: see everyone in same tenant
CREATE POLICY "profile_same_tenant_select" ON user_profiles
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "profile_self_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Only CHR/CEO can update roles within tenant
CREATE POLICY "profile_role_admin_update" ON user_profiles
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id() AND public.is_chr_or_ceo()
  );

-- Invitations: only CHR/CEO can create, same tenant can view
CREATE POLICY "invitation_admin_create" ON invitations
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id() AND public.is_chr_or_ceo()
  );

CREATE POLICY "invitation_same_tenant_select" ON invitations
  FOR SELECT USING (tenant_id = public.current_tenant_id());

-- Audit logs: read-only for same tenant
CREATE POLICY "audit_same_tenant_read" ON audit_logs
  FOR SELECT USING (tenant_id = public.current_tenant_id());

-- ─────────────────────────────────────────────────────────────────
-- TRIGGER: auto-create profile + tenant on auth.users insert
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- If signup has tenant_slug in metadata, join existing tenant
  -- Otherwise create a new tenant
  IF NEW.raw_user_meta_data->>'tenant_slug' IS NOT NULL THEN
    SELECT id INTO new_tenant_id FROM tenants
    WHERE slug = NEW.raw_user_meta_data->>'tenant_slug';
  ELSE
    INSERT INTO tenants (name, slug, owner_id)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
      lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'company_name', 'company-' || substring(NEW.id::text, 1, 8)), '[^a-z0-9]+', '-', 'g')),
      NEW.id
    ) RETURNING id INTO new_tenant_id;
  END IF;

  INSERT INTO user_profiles (id, tenant_id, email, full_name, role)
  VALUES (
    NEW.id,
    new_tenant_id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'chr')
  );
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

COMMENT ON SCHEMA public IS 'Zeniipo · Auth + RBAC + Multi-tenant · v1.0 · April 2026';
