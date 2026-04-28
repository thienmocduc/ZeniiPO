-- ═══════════════════════════════════════════════════════════════════
-- Migration 012 · investor_pipeline.round_id → nullable
-- Investors enter the pipeline at "sourcing" stage long before any round
-- exists. The original NOT NULL constraint forced API consumers to invent
-- a placeholder round, which polluted fundraise_rounds. Making round_id
-- nullable matches reality (sourcing → meeting → soft commit → assigned
-- to a round only when one is ready).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE investor_pipeline ALTER COLUMN round_id DROP NOT NULL;
