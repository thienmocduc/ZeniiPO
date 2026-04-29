-- ═══════════════════════════════════════════════════════════════════
-- Migration 011 · subscriptions extra columns for Stripe webhook
-- Webhook needs price_id (to detect plan changes via Price object) and
-- canceled_at (for analytics + grace period). tier_code FK ties subscription
-- to membership_tiers for join queries.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS price_id text,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS tier_code text REFERENCES membership_tiers(tier_code);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(tenant_id, status);
