-- ═══════════════════════════════════════════════════════════════════
-- Migration 007 · Training drills seed (16 base × 8 roles)
-- Drill catalog for /training (Thao trường) — sandbox practice scenarios
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.training_drills
  (drill_code, title_vi, title_en, description_vi, description_en,
   target_role, difficulty, estimated_minutes, scenario, steps,
   success_criteria, min_tier, display_order) VALUES

-- ─── 16 base drills (5 phổ thông cho mọi role · 11 chuyên môn) ───

-- 1. Morning routine (all roles)
('morning-routine', N'Thói quen buổi sáng Chairman', 'Morning Chairman Routine',
 N'15 phút sáng review North Star · KPI · 3 priorities', 'Daily morning review',
 'all', 'bronze', 15,
 '{"context":"Chairman wakes 5:30am. KPI dashboard, 3 priorities, journal."}'::jsonb,
 '[{"n":1,"action":"Open KPI Matrix","time":60},{"n":2,"action":"Review North Star score","time":120},{"n":3,"action":"Pick top 3 priorities","time":300}]'::jsonb,
 '{"complete_ratio":0.9,"max_time_min":18}'::jsonb, 'pro', 1),

-- 2. OKR cascade (all roles)
('okr-cascade', N'Cascade OKR từ Chairman xuống team', 'OKR Cascade Chairman → Team',
 N'Chairman đặt 1 objective · cascade xuống 3 C-level · ra 12 KR', 'Cascade flow',
 'all', 'silver', 30,
 '{"objective":"Đạt MRR $50K Q4 2026"}'::jsonb,
 '[{"n":1,"action":"Define CHR objective"},{"n":2,"action":"CEO breakdown to 3 sub-obj"},{"n":3,"action":"Each sub → 4 KR"}]'::jsonb,
 '{"min_krs":12,"all_measurable":true}'::jsonb, 'pro', 2),

-- 3. Cap table dilution (CFO + CEO)
('cap-table-dilution', N'Pha loãng cap table sau Seed round', 'Cap Table Dilution Post-Seed',
 N'Tính dilution founder/ESOP/investor sau seed $500K @ $4.5M pre', 'Dilution math',
 'cfo', 'silver', 25,
 '{"pre_money":4500000,"raise":500000,"esop_carve":0.10}'::jsonb,
 '[{"n":1,"action":"Compute post-money"},{"n":2,"action":"ESOP top-up pre-money"},{"n":3,"action":"Snapshot cap table"}]'::jsonb,
 '{"founder_pct_post":0.51,"esop_pct_post":0.10}'::jsonb, 'pro', 3),

-- 4. Pitch deck dry-run (CEO)
('pitch-deck-dryrun', N'Pitch deck 12 slide · 8 phút', 'Pitch Deck Dry-Run',
 N'Trình bày deck 12 slide trong 8 phút · Q&A 5 phút', 'Pitch dry run',
 'ceo', 'gold', 30,
 '{"slides":12,"time_minutes":8}'::jsonb,
 '[{"n":1,"action":"Hook slide 30s"},{"n":2,"action":"Problem-solution 2min"},{"n":3,"action":"Traction + ask 2min"}]'::jsonb,
 '{"complete_under_time":true,"qa_handle":4}'::jsonb, 'elite', 4),

-- 5. Council validator (CEO + CTO)
('council-validator', N'Hội đồng 9 chuyên gia validate ý tưởng', 'Council of 9 Validator',
 N'Submit ý tưởng · 9 expert score · go/revise/no_go decision', 'Idea validation',
 'ceo', 'silver', 20,
 '{"idea":"Vertical SaaS for biotea SMEs"}'::jsonb,
 '[{"n":1,"action":"Fill idea form"},{"n":2,"action":"Review 9 votes"},{"n":3,"action":"Apply revisions"}]'::jsonb,
 '{"min_score":650,"recommendation":"go|revise"}'::jsonb, 'pro', 5),

-- 6. Investor pipeline (CFO + CEO)
('investor-pipeline', N'VC outreach 30 → meeting 10 → DD 3 → close 1', 'VC Pipeline Funnel',
 N'Convert pipeline outreach → 1 closed investor', 'Pipeline conversion',
 'cfo', 'silver', 40,
 '{"outreach_count":30}'::jsonb,
 '[{"n":1,"action":"Build target list 30"},{"n":2,"action":"Email + intro"},{"n":3,"action":"Pitch meetings"},{"n":4,"action":"DD"},{"n":5,"action":"Close"}]'::jsonb,
 '{"closed":1,"funnel_efficiency":0.033}'::jsonb, 'pro', 6),

-- 7. DD data room prep (CFO + CLO)
('dd-data-room', N'Data Room 60 docs cho DD investor', 'DD Data Room Prep',
 N'Tổ chức 60 docs trong 8 folders · NDA · audit trail', 'Data Room org',
 'cfo', 'silver', 45,
 '{"folder_count":8,"doc_count":60}'::jsonb,
 '[{"n":1,"action":"Folder taxonomy"},{"n":2,"action":"Upload + tag"},{"n":3,"action":"NDA template"},{"n":4,"action":"Invite investor"}]'::jsonb,
 '{"docs_organized":60,"folders":8}'::jsonb, 'elite', 7),

-- 8. Financial model 5Y (CFO)
('financial-model-5y', N'Financial model 5 năm bottom-up', 'Financial Model 5Y',
 N'Build model: ARR · CAC · LTV · burn · 60-month forecast', 'Financial modeling',
 'cfo', 'gold', 60,
 '{"horizon_years":5}'::jsonb,
 '[{"n":1,"action":"Revenue assumptions"},{"n":2,"action":"OpEx breakdown"},{"n":3,"action":"Cash flow waterfall"},{"n":4,"action":"Sensitivity"}]'::jsonb,
 '{"runway_months":18,"ebitda_year_5":"positive"}'::jsonb, 'elite', 8),

-- 9. IPO readiness (CFO + CEO)
('ipo-readiness-scorecard', N'IPO Readiness 20 criteria scorecard', 'IPO Readiness 20-Criteria',
 N'Score 20 criteria · A+/A/B/C/F grade', 'IPO readiness',
 'cfo', 'gold', 50,
 '{"criteria_count":20}'::jsonb,
 '[{"n":1,"action":"Big4 audit"},{"n":2,"action":"SOX/SGX"},{"n":3,"action":"IFRS"},{"n":4,"action":"Board independence"}]'::jsonb,
 '{"score_min":700,"grade":"B|A|A+"}'::jsonb, 'enterprise', 9),

-- 10. Crisis comms (CEO + CMO)
('crisis-comms', N'Khủng hoảng PR 24h · respond protocol', 'Crisis Communications 24h',
 N'Negative press · stakeholder comms · official statement', 'Crisis PR',
 'cmo', 'gold', 30,
 '{"crisis_type":"product_recall"}'::jsonb,
 '[{"n":1,"action":"Internal alert 1h"},{"n":2,"action":"Stakeholder map"},{"n":3,"action":"Official statement 4h"},{"n":4,"action":"Media response 24h"}]'::jsonb,
 '{"response_time_hours":4,"stakeholder_reached":1.0}'::jsonb, 'elite', 10),

-- 11. Hiring loop (COO + CTO)
('hiring-loop', N'Hire 1 senior eng · 4 rounds · 3 weeks', 'Senior Engineer Hiring',
 N'Sourcing · screen · technical · onsite · offer', 'Hiring funnel',
 'cto', 'silver', 40,
 '{"role":"senior_engineer","timeline_weeks":3}'::jsonb,
 '[{"n":1,"action":"JD + sourcing"},{"n":2,"action":"Phone screen"},{"n":3,"action":"Technical"},{"n":4,"action":"Onsite + offer"}]'::jsonb,
 '{"hire":1,"time_to_offer_weeks":3}'::jsonb, 'pro', 11),

-- 12. SOC2 audit (CTO + CLO)
('soc2-audit', N'SOC2 Type II audit prep', 'SOC2 Type II Audit',
 N'Control mapping · evidence collection · auditor walkthrough', 'SOC2 prep',
 'cto', 'gold', 60,
 '{"control_count":80}'::jsonb,
 '[{"n":1,"action":"Control gap analysis"},{"n":2,"action":"Evidence collection"},{"n":3,"action":"Auditor walkthrough"},{"n":4,"action":"Remediation"}]'::jsonb,
 '{"controls_passed":75,"audit_grade":"clean"}'::jsonb, 'enterprise', 12),

-- 13. Term sheet negotiation (CEO + CLO)
('term-sheet-nego', N'Term sheet · valuation · liq pref · board seat', 'Term Sheet Negotiation',
 N'Negotiate $5M @ $20M · 1× non-participating · 1 board seat', 'Term sheet',
 'ceo', 'gold', 45,
 '{"raise_target":5000000,"valuation":20000000}'::jsonb,
 '[{"n":1,"action":"Pre-money align"},{"n":2,"action":"Liq pref structure"},{"n":3,"action":"Board composition"},{"n":4,"action":"Anti-dilution"}]'::jsonb,
 '{"valuation_min":18000000,"board_seats_founder":3}'::jsonb, 'elite', 13),

-- 14. Compliance review (CLO)
('compliance-review', N'Compliance audit theo Nghị định 13/2023', 'Compliance Review (NDP)',
 N'Personal data audit · DPA · DPIA · breach response', 'NDP 13/2023 compliance',
 'clo', 'silver', 35,
 '{"regulation":"ND_13_2023"}'::jsonb,
 '[{"n":1,"action":"Data inventory"},{"n":2,"action":"DPA contracts"},{"n":3,"action":"DPIA high risk"},{"n":4,"action":"Breach playbook"}]'::jsonb,
 '{"data_points_inventoried":100,"dpia_complete":true}'::jsonb, 'pro', 14),

-- 15. CMO playbook GTM (CMO)
('cmo-gtm-playbook', N'GTM playbook · channel mix · CAC budget', 'GTM Channel Playbook',
 N'Channel mix optimization · CAC by channel · LTV/CAC > 3', 'GTM playbook',
 'cmo', 'silver', 50,
 '{"channels":["paid","organic","partner","referral"]}'::jsonb,
 '[{"n":1,"action":"Channel CAC baseline"},{"n":2,"action":"Budget allocation"},{"n":3,"action":"A/B test"},{"n":4,"action":"Scale winners"}]'::jsonb,
 '{"ltv_cac_ratio":3.0,"payback_months":12}'::jsonb, 'pro', 15),

-- 16. Employee onboarding (COO + EMP)
('employee-onboarding', N'30-60-90 day onboarding plan', 'Employee Onboarding 30-60-90',
 N'Welcome pack · buddy · objectives · review milestones', 'Onboarding',
 'emp', 'bronze', 25,
 '{"horizon_days":90}'::jsonb,
 '[{"n":1,"action":"Day 1 welcome"},{"n":2,"action":"Day 30 review"},{"n":3,"action":"Day 60 expand"},{"n":4,"action":"Day 90 retain"}]'::jsonb,
 '{"day_90_active":true,"manager_satisfaction":0.8}'::jsonb, 'explorer', 16)

ON CONFLICT (drill_code) DO UPDATE SET
  title_vi = EXCLUDED.title_vi,
  title_en = EXCLUDED.title_en,
  description_vi = EXCLUDED.description_vi,
  scenario = EXCLUDED.scenario,
  steps = EXCLUDED.steps,
  success_criteria = EXCLUDED.success_criteria,
  display_order = EXCLUDED.display_order;
