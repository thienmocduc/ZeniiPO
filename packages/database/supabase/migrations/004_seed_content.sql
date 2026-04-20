-- ═══════════════════════════════════════════════════════════════════
-- Migration 004 · Seed Content · v1.0
-- Adds catalog tables + seed data:
--   1. modules_catalog (32 modules)
--   2. agent_catalog (108 agents across 12 depts × 9 agents)
--   3. glossary (20 IPO/finance terms)
--   4. Trigger: auto-copy ipo_readiness_criteria_template → per journey
-- Only INSERTs + new catalog tables. Does NOT modify 001/002/003 tables.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1 · MODULES CATALOG (32 modules from v4 HTML spec)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE modules_catalog (
  module_code text PRIMARY KEY,
  name_vi text NOT NULL,
  name_en text NOT NULL,
  category text NOT NULL CHECK (category IN ('core','ops','finance','governance','legal','commerce','ai','academy','admin','system')),
  description_vi text,
  description_en text,
  min_tier text DEFAULT 'explorer' CHECK (min_tier IN ('free','explorer','pro','elite','enterprise')),
  icon text,
  display_order int,
  is_enabled boolean DEFAULT true
);

INSERT INTO modules_catalog (module_code, name_vi, name_en, category, description_vi, description_en, min_tier, icon, display_order) VALUES
  ('m-dash',    'Dashboard',               'Dashboard',                 'core',       'Trang tong quan hieu suat + chi so chinh',      'Executive summary · KPIs · journey',         'free',       'layout-dashboard', 1),
  ('m-kpi',     'KPI Matrix',              'KPI Matrix',                'core',       'Ma tran KPI theo vai tro + phong ban',          'Role-based KPI matrix',                      'explorer',   'grid-3x3',          2),
  ('m-mile',    'Milestones',              'Milestones',                'core',       'Cac moc quan trong trong hanh trinh IPO',       'Journey milestones',                         'explorer',   'flag',              3),
  ('m-tasks',   'Tasks',                   'Tasks',                     'core',       'Quan ly cong viec + uu tien',                   'Task management',                            'free',       'check-square',      4),
  ('m-wf',      'Workflow',                'Workflow',                  'ops',        'Quy trinh van hanh',                            'Operational workflows',                      'pro',        'workflow',          5),
  ('m-fin',     'Financials',              'Financials',                'finance',    'P&L · Cash Flow · Balance Sheet',               'Financial statements',                       'pro',        'dollar-sign',       6),
  ('m-sens',    'Sensitivity',             'Sensitivity Analysis',      'finance',    'Phan tich do nhay valuation',                   'Valuation sensitivity',                      'elite',      'sliders',           7),
  ('m-cap',     'Cap Table',               'Cap Table',                 'finance',    'Bang co dong + pha loang',                      'Capitalization + dilution',                  'pro',        'pie-chart',         8),
  ('m-clv',     'Customer LTV',            'Customer LTV',              'finance',    'LTV · CAC · Payback',                           'Unit economics',                             'pro',        'trending-up',       9),
  ('m-vh',      'Valuation Hub',           'Valuation Hub',             'finance',    'Mo hinh dinh gia DCF · Comparables',            'DCF + comps engine',                         'elite',      'calculator',        10),
  ('m-token',   'Tokenomics',              'Tokenomics',                'finance',    'Thiet ke token + vesting (Web3)',               'Token design + vesting',                     'elite',      'coins',             11),
  ('m-ipo',     'IPO Readiness',           'IPO Readiness',             'governance', '20 tieu chi san sang IPO',                      '20-criteria IPO scorecard',                  'pro',        'award',             12),
  ('m-pdeck',   'Pitch Deck',              'Pitch Deck',                'commerce',   'Bo slide goi von',                              'Fundraising pitch deck',                     'pro',        'presentation',      13),
  ('m-droom',   'Data Room',               'Data Room',                 'governance', 'Phong du lieu DD + phan quyen',                 'DD data room',                               'pro',        'folder-lock',       14),
  ('m-gvpipe',  'Governance Pipeline',     'Governance Pipeline',       'governance', 'Luong quyet dinh + hop dong dong',              'Governance decision pipeline',               'elite',      'git-branch',        15),
  ('m-gvdoc',   'Governance Docs',         'Governance Docs',           'governance', 'Nghi quyet HDQT + bien ban',                    'Board resolutions + minutes',                'elite',      'file-text',         16),
  ('m-leg',     'Legal',                   'Legal',                     'legal',      'Hop dong · IP · Litigation',                    'Contracts · IP · litigation',                'pro',        'scale',             17),
  ('m-tc',      'Terms & Conditions',      'Terms & Conditions',        'legal',      'Dieu khoan + chinh sach',                       'Terms + policies',                           'explorer',   'file-check',        18),
  ('m-tcdoc',   'T&C Docs',                'T&C Docs',                  'legal',      'Kho tai lieu dieu khoan',                       'T&C document repository',                    'pro',        'file-stack',        19),
  ('m-hsoct',   'HSOCT (Business Docs)',   'Business Registration',     'legal',      'Ho so dang ky kinh doanh',                      'Business registration dossier',              'pro',        'building',          20),
  ('m-comp',    'Compliance',              'Compliance',                'legal',      'Tuan thu SOX · GDPR · ISO',                     'Compliance framework',                       'elite',      'shield-check',      21),
  ('m-mhkd',    'Business Model',          'Business Model',            'commerce',   'Canvas mo hinh kinh doanh',                     'Business model canvas',                      'explorer',   'layers',            22),
  ('m-mkt',     'Marketing',               'Marketing',                 'commerce',   'Kenh · chien dich · CAC',                       'Channels · campaigns · CAC',                 'pro',        'megaphone',         23),
  ('m-nlq',     'Natural Language Query',  'NL Query (Ask Zeni)',       'ai',         'Hoi du lieu bang ngon ngu tu nhien',            'Natural language to SQL',                    'pro',        'message-circle',    24),
  ('academy',   'Academy',                 'Academy',                   'academy',    'Hoc vien IPO + drills',                         'IPO handbook + drills',                      'explorer',   'graduation-cap',    25),
  ('m-users',   'Users',                   'Users',                     'admin',      'Quan ly nguoi dung tenant',                     'Tenant user management',                     'explorer',   'users',             26),
  ('m-admin',   'Admin',                   'Admin',                     'admin',      'Bang dieu khien admin',                         'Admin control panel',                        'pro',        'settings-2',        27),
  ('m-sett',    'Settings',                'Settings',                  'admin',      'Cau hinh tenant + ca nhan',                     'Tenant + user settings',                     'free',       'settings',          28),
  ('m-vault',   'Vault',                   'Vault',                     'system',     'Kho luu tru mat ma + credentials',              'Encrypted vault',                            'elite',      'key-round',         29),
  ('m-sales',   'Sales',                   'Sales',                     'commerce',   'Pipeline ban hang + CRM',                       'Sales pipeline + CRM',                       'pro',        'handshake',         30),
  ('m-plv',     'Billing (Plan & Value)',  'Billing',                   'system',     'Thanh toan · hoa don · plan',                   'Billing · invoices · plans',                 'free',       'credit-card',       31),
  ('m-fclb',    'Feedback Club',           'Feedback Club',             'system',     'Gop y + beta program',                          'Feedback + beta program',                    'free',       'message-square-heart', 32);

ALTER TABLE modules_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_public_read" ON modules_catalog FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────
-- 2 · AGENT CATALOG (108 agents · 12 depts × 9 agents)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE agent_catalog (
  agent_code text PRIMARY KEY,
  name text NOT NULL,
  pantheon text NOT NULL CHECK (pantheon IN ('greek','roman','vedic','norse','egyptian','other')),
  department text NOT NULL,
  role_description text,
  is_chief boolean DEFAULT false,
  display_order int
);

-- 12 Departments (9 agents each = 108 total)
-- 1 FINANCE  2 SALES  3 MARKETING  4 OPERATIONS  5 PRODUCT  6 TECH
-- 7 LEGAL    8 SECURITY  9 HR  10 GOVERNANCE  11 STRATEGY  12 INVESTOR_RELATIONS

INSERT INTO agent_catalog (agent_code, name, pantheon, department, role_description, is_chief, display_order) VALUES
  -- ═════════════════════ FINANCE (Plutus/Lakshmi wealth deities) ═════════════════════
  ('fin-01-plutus',    'Plutus',     'greek',  'finance',  'Chief Finance Agent · wealth + treasury',        true,  1),
  ('fin-02-lakshmi',   'Lakshmi',    'vedic',  'finance',  'P&L + cash flow guardian',                       false, 2),
  ('fin-03-mercury',   'Mercury',    'roman',  'finance',  'Transaction velocity + payments',                false, 3),
  ('fin-04-freya',     'Freya',      'norse',  'finance',  'Treasury + FX management',                       false, 4),
  ('fin-05-kubera',    'Kubera',     'vedic',  'finance',  'Budget allocation + reserves',                   false, 5),
  ('fin-06-demeter',   'Demeter',    'greek',  'finance',  'Revenue recognition + forecasting',              false, 6),
  ('fin-07-vulcan',    'Vulcan',     'roman',  'finance',  'Cost engineering + optimization',                false, 7),
  ('fin-08-ganesha',   'Ganesha',    'vedic',  'finance',  'Obstacle remover · audit + reconciliation',      false, 8),
  ('fin-09-njord',     'Njord',      'norse',  'finance',  'Working capital + liquidity',                    false, 9),

  -- ═════════════════════ SALES (Hermes/Mercury messengers) ═════════════════════
  ('sal-01-hermes',    'Hermes',     'greek',  'sales',    'Chief Sales Agent · commerce + persuasion',      true,  10),
  ('sal-02-mercury',   'Mercury-S',  'roman',  'sales',    'Pipeline velocity + deal flow',                  false, 11),
  ('sal-03-freya-s',   'Freya-S',    'norse',  'sales',    'Lead generation + prospecting',                  false, 12),
  ('sal-04-saraswati', 'Saraswati-S','vedic',  'sales',    'Sales narrative + storytelling',                 false, 13),
  ('sal-05-janus',     'Janus',      'roman',  'sales',    'Deal transitions · gatekeeper of closes',        false, 14),
  ('sal-06-iris',      'Iris',       'greek',  'sales',    'Rainbow messenger · customer comms',             false, 15),
  ('sal-07-bragi',     'Bragi',      'norse',  'sales',    'Eloquence + pitch mastery',                      false, 16),
  ('sal-08-narada',    'Narada',     'vedic',  'sales',    'Network + introductions',                        false, 17),
  ('sal-09-vesta',     'Vesta',      'roman',  'sales',    'Customer retention + loyalty',                   false, 18),

  -- ═════════════════════ MARKETING (Aphrodite/Venus charm) ═════════════════════
  ('mkt-01-aphrodite', 'Aphrodite',  'greek',  'marketing','Chief Marketing Agent · brand + desire',         true,  19),
  ('mkt-02-venus',     'Venus',      'roman',  'marketing','Brand aesthetics + creative',                    false, 20),
  ('mkt-03-apollo',    'Apollo',     'greek',  'marketing','Content + PR · sun of truth',                    false, 21),
  ('mkt-04-saraswati', 'Saraswati-M','vedic',  'marketing','Knowledge + educational content',                false, 22),
  ('mkt-05-loki',      'Loki',       'norse',  'marketing','Growth hacking + viral loops',                   false, 23),
  ('mkt-06-kamadeva',  'Kamadeva',   'vedic',  'marketing','Attraction + desire engineering',                false, 24),
  ('mkt-07-eos',       'Eos',        'greek',  'marketing','Dawn campaigns · email + newsletter',            false, 25),
  ('mkt-08-flora',     'Flora',      'roman',  'marketing','Growth + blooming channels',                     false, 26),
  ('mkt-09-idun',      'Idun',       'norse',  'marketing','Retention + content refresh',                    false, 27),

  -- ═════════════════════ OPERATIONS (Hephaestus/Vulcan builders) ═════════════════════
  ('ops-01-hephaestus','Hephaestus', 'greek',  'operations','Chief Ops Agent · forge + production',          true,  28),
  ('ops-02-vulcan-o',  'Vulcan-O',   'roman',  'operations','Supply chain + manufacturing',                  false, 29),
  ('ops-03-ganesha-o', 'Ganesha-O',  'vedic',  'operations','Process obstacles removal',                     false, 30),
  ('ops-04-thor',      'Thor',       'norse',  'operations','Heavy lifting · infrastructure',                false, 31),
  ('ops-05-dionysus',  'Dionysus',   'greek',  'operations','Team morale + culture ops',                     false, 32),
  ('ops-06-vishnu',    'Vishnu',     'vedic',  'operations','Preservation · SLA + uptime',                   false, 33),
  ('ops-07-ceres',     'Ceres',      'roman',  'operations','Fulfillment + harvest ops',                     false, 34),
  ('ops-08-heimdall',  'Heimdall',   'norse',  'operations','Watchman · monitoring + observability',         false, 35),
  ('ops-09-shiva',     'Shiva',      'vedic',  'operations','Destruction + renewal · refactor ops',          false, 36),

  -- ═════════════════════ PRODUCT (Athena/Minerva wisdom) ═════════════════════
  ('prd-01-athena',    'Athena-P',   'greek',  'product',  'Chief Product Agent · strategy + wisdom',        true,  37),
  ('prd-02-minerva',   'Minerva-P',  'roman',  'product',  'Design thinking + UX research',                  false, 38),
  ('prd-03-brahma',    'Brahma',     'vedic',  'product',  'Creation · new product ideation',               false, 39),
  ('prd-04-freyr',     'Freyr',      'norse',  'product',  'Growth + product-led growth',                    false, 40),
  ('prd-05-apollo-p',  'Apollo-P',   'greek',  'product',  'Product vision + foresight',                     false, 41),
  ('prd-06-saraswati-p','Saraswati-P','vedic', 'product',  'Knowledge graph + docs',                         false, 42),
  ('prd-07-janus-p',   'Janus-P',    'roman',  'product',  'Feature flags + rollout gates',                  false, 43),
  ('prd-08-kvasir',    'Kvasir',     'norse',  'product',  'Wisdom distilled · user insights',              false, 44),
  ('prd-09-hermes-p',  'Hermes-P',   'greek',  'product',  'Integration + API messenger',                    false, 45),

  -- ═════════════════════ TECH (Hephaestus/Tvastar craft) ═════════════════════
  ('tec-01-tvastar',   'Tvastar',    'vedic',  'tech',     'Chief Tech Agent · divine architect',            true,  46),
  ('tec-02-hephaestus-t','Hephaestus-T','greek','tech',    'Backend forge · APIs + services',                false, 47),
  ('tec-03-vulcan-t',  'Vulcan-T',   'roman',  'tech',     'Infrastructure + devops',                        false, 48),
  ('tec-04-odin',      'Odin',       'norse',  'tech',     'All-seeing · observability + telemetry',         false, 49),
  ('tec-05-hermes-t',  'Hermes-T',   'greek',  'tech',     'API gateway + message bus',                      false, 50),
  ('tec-06-vishvakarma','Vishvakarma','vedic', 'tech',     'Divine engineer · architecture',                 false, 51),
  ('tec-07-minerva-t', 'Minerva-T',  'roman',  'tech',     'Code quality + static analysis',                 false, 52),
  ('tec-08-mimir',     'Mimir',      'norse',  'tech',     'Knowledge well · data engineering',              false, 53),
  ('tec-09-daedalus',  'Daedalus',   'greek',  'tech',     'Master builder · frontend + UX',                 false, 54),

  -- ═════════════════════ LEGAL (Themis/Justitia justice) ═════════════════════
  ('leg-01-themis',    'Themis',     'greek',  'legal',    'Chief Legal Agent · divine law',                 true,  55),
  ('leg-02-justitia',  'Justitia',   'roman',  'legal',    'Contracts + compliance',                         false, 56),
  ('leg-03-varuna',    'Varuna',     'vedic',  'legal',    'Cosmic order · regulatory',                      false, 57),
  ('leg-04-forseti',   'Forseti',    'norse',  'legal',    'Dispute resolution · litigation',                false, 58),
  ('leg-05-dike',      'Dike',       'greek',  'legal',    'IP + patents',                                   false, 59),
  ('leg-06-ma-at',     'Ma at',      'egyptian','legal',   'Truth + balance · audit trail',                  false, 60),
  ('leg-07-yama',      'Yama',       'vedic',  'legal',    'Judge of actions · policy enforcement',          false, 61),
  ('leg-08-tyr',       'Tyr',        'norse',  'legal',    'Oaths + binding agreements',                     false, 62),
  ('leg-09-astraea',   'Astraea',    'greek',  'legal',    'Innocence · whistleblower + ethics',             false, 63),

  -- ═════════════════════ SECURITY (Athena/Minerva guardian) ═════════════════════
  ('sec-01-athena',    'Athena-S',   'greek',  'security', 'Chief Security Agent · strategic defense',       true,  64),
  ('sec-02-minerva-s', 'Minerva-S',  'roman',  'security', 'Threat intelligence + SIEM',                     false, 65),
  ('sec-03-heimdall-s','Heimdall-S', 'norse',  'security', 'Watchman · intrusion detection',                 false, 66),
  ('sec-04-durga',     'Durga',      'vedic',  'security', 'Warrior · incident response',                    false, 67),
  ('sec-05-ares',      'Ares',       'greek',  'security', 'Red team · offensive security',                  false, 68),
  ('sec-06-mars',      'Mars',       'roman',  'security', 'Defensive ops · SOC',                            false, 69),
  ('sec-07-tyr-s',     'Tyr-S',      'norse',  'security', 'Identity + access management',                   false, 70),
  ('sec-08-kali',      'Kali',       'vedic',  'security', 'Destroy threats · DDoS mitigation',              false, 71),
  ('sec-09-anubis',    'Anubis',     'egyptian','security','Forensic investigation · post-incident',         false, 72),

  -- ═════════════════════ HR (Hera/Juno family) ═════════════════════
  ('hr-01-hera',       'Hera',       'greek',  'hr',       'Chief HR Agent · people + culture',              true,  73),
  ('hr-02-juno',       'Juno',       'roman',  'hr',       'Employee welfare + benefits',                    false, 74),
  ('hr-03-parvati',    'Parvati',    'vedic',  'hr',       'Talent development',                             false, 75),
  ('hr-04-frigg',      'Frigg',      'norse',  'hr',       'Workforce planning · queen foresight',           false, 76),
  ('hr-05-hestia',     'Hestia',     'greek',  'hr',       'Home + belonging · employee experience',         false, 77),
  ('hr-06-lakshmi-hr', 'Lakshmi-HR', 'vedic',  'hr',       'Compensation + rewards',                         false, 78),
  ('hr-07-minerva-hr', 'Minerva-HR', 'roman',  'hr',       'Learning + development',                         false, 79),
  ('hr-08-idun-hr',    'Idun-HR',    'norse',  'hr',       'Rejuvenation · wellness + engagement',           false, 80),
  ('hr-09-ma-at-hr',   'Ma at-HR',   'egyptian','hr',      'Fairness · DEI + ethics',                        false, 81),

  -- ═════════════════════ GOVERNANCE (Zeus/Jupiter rulers) ═════════════════════
  ('gov-01-zeus',      'Zeus',       'greek',  'governance','Chief Governance Agent · king of gods',         true,  82),
  ('gov-02-jupiter',   'Jupiter',    'roman',  'governance','Board operations + resolutions',                false, 83),
  ('gov-03-brahma-g',  'Brahma-G',   'vedic',  'governance','Corporate structure + bylaws',                  false, 84),
  ('gov-04-odin-g',    'Odin-G',     'norse',  'governance','All-father · board oversight',                  false, 85),
  ('gov-05-themis-g',  'Themis-G',   'greek',  'governance','Policy + procedures',                           false, 86),
  ('gov-06-varuna-g',  'Varuna-G',   'vedic',  'governance','Ethics + integrity',                            false, 87),
  ('gov-07-vesta-g',   'Vesta-G',    'roman',  'governance','Institutional memory · archives',               false, 88),
  ('gov-08-heimdall-g','Heimdall-G', 'norse',  'governance','Watchtower · audit committee',                  false, 89),
  ('gov-09-apollo-g',  'Apollo-G',   'greek',  'governance','Disclosure + transparency',                     false, 90),

  -- ═════════════════════ STRATEGY (Athena/Odin wisdom) ═════════════════════
  ('str-01-odin-s',    'Odin-Str',   'norse',  'strategy', 'Chief Strategy Agent · all-seeing',              true,  91),
  ('str-02-athena-str','Athena-Str', 'greek',  'strategy', 'Strategic planning + war games',                 false, 92),
  ('str-03-vishnu-s',  'Vishnu-Str', 'vedic',  'strategy', 'Long-term preservation',                         false, 93),
  ('str-04-janus-s',   'Janus-Str',  'roman',  'strategy', 'Two-faced · past + future analysis',             false, 94),
  ('str-05-prometheus','Prometheus', 'greek',  'strategy', 'Foresight · scenario planning',                  false, 95),
  ('str-06-saraswati-s','Saraswati-Str','vedic','strategy','Knowledge · competitive intel',                  false, 96),
  ('str-07-mimir-s',   'Mimir-Str',  'norse',  'strategy', 'Wisdom well · research',                         false, 97),
  ('str-08-minerva-str','Minerva-Str','roman', 'strategy', 'OKR + balanced scorecard',                       false, 98),
  ('str-09-chronos',   'Chronos',    'greek',  'strategy', 'Time · roadmap + sequencing',                    false, 99),

  -- ═════════════════════ INVESTOR_RELATIONS (Hermes/Mercury heralds) ═════════════════════
  ('inv-01-hermes-ir', 'Hermes-IR',  'greek',  'investor_relations','Chief IR Agent · herald of gods',       true,  100),
  ('inv-02-mercury-ir','Mercury-IR', 'roman',  'investor_relations','Fundraising pipeline',                  false, 101),
  ('inv-03-lakshmi-ir','Lakshmi-IR','vedic',   'investor_relations','Investor prosperity + LP relations',    false, 102),
  ('inv-04-bragi-ir',  'Bragi-IR',   'norse',  'investor_relations','Pitch eloquence + narrative',           false, 103),
  ('inv-05-apollo-ir', 'Apollo-IR',  'greek',  'investor_relations','Analyst relations + coverage',          false, 104),
  ('inv-06-narada-ir', 'Narada-IR',  'vedic',  'investor_relations','Network · warm intros',                 false, 105),
  ('inv-07-vesta-ir',  'Vesta-IR',   'roman',  'investor_relations','Shareholder loyalty',                   false, 106),
  ('inv-08-freya-ir',  'Freya-IR',   'norse',  'investor_relations','Capital markets strategy',              false, 107),
  ('inv-09-saraswati-ir','Saraswati-IR','vedic','investor_relations','Data room · disclosure docs',          false, 108);

ALTER TABLE agent_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_catalog_public_read" ON agent_catalog FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────
-- 3 · GLOSSARY (20 common IPO + finance terms)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE glossary (
  term text PRIMARY KEY,
  category text CHECK (category IN ('finance','ipo','legal','governance','metrics','tech')),
  definition_vi text NOT NULL,
  definition_en text NOT NULL,
  see_also text[]
);

INSERT INTO glossary (term, category, definition_vi, definition_en, see_also) VALUES
  ('ARR',          'metrics',    'Annual Recurring Revenue · doanh thu dinh ky hang nam', 'Annual Recurring Revenue', ARRAY['MRR']),
  ('MRR',          'metrics',    'Monthly Recurring Revenue · doanh thu dinh ky thang',   'Monthly Recurring Revenue', ARRAY['ARR']),
  ('PMF',          'metrics',    'Product-Market Fit · do phu hop san pham - thi truong', 'Product-Market Fit', ARRAY['Retention']),
  ('CAC',          'metrics',    'Customer Acquisition Cost · chi phi thu hut 1 khach',   'Customer Acquisition Cost', ARRAY['LTV']),
  ('LTV',          'metrics',    'Lifetime Value · gia tri tron doi mot khach hang',      'Lifetime Value', ARRAY['CAC','Payback']),
  ('Runway',       'finance',    'So thang tien mat con lai cho den khi can goi von',     'Months of cash until next raise', ARRAY['Burn']),
  ('Term Sheet',   'finance',    'Van ban tom tat dieu khoan vong goi von',               'Non-binding summary of deal terms', ARRAY['SAFE']),
  ('SAFE',         'finance',    'Simple Agreement for Future Equity · von tuong lai',    'Simple Agreement for Future Equity', ARRAY['Convertible Note']),
  ('S-1',          'ipo',        'Ho so IPO nop cho SEC (Hoa Ky)',                        'SEC IPO filing document (US)', ARRAY['Prospectus']),
  ('SOX',          'governance', 'Sarbanes-Oxley Act · chuan kiem soat noi bo IPO US',    'Sarbanes-Oxley Act · US IPO internal controls', ARRAY['PCAOB']),
  ('IFRS',         'finance',    'International Financial Reporting Standards',           'International Financial Reporting Standards', ARRAY['GAAP']),
  ('GAAP',         'finance',    'Generally Accepted Accounting Principles (US)',         'Generally Accepted Accounting Principles', ARRAY['IFRS']),
  ('P/E',          'metrics',    'Price-to-Earnings Ratio · ty le P/E dinh gia',          'Price-to-Earnings Ratio', ARRAY['EBITDA']),
  ('EBITDA',       'metrics',    'Earnings Before Interest, Tax, Depreciation, Amortization', 'Operating profit before non-cash + financing', ARRAY['Operating Margin']),
  ('Cap Table',    'finance',    'Bang co dong · chi tiet so huu va pha loang',           'Capitalization table · ownership + dilution', ARRAY['ESOP']),
  ('ESOP',         'finance',    'Employee Stock Option Plan · co phan thuong NV',        'Employee Stock Option Plan', ARRAY['Vesting']),
  ('Vesting',      'finance',    'Lich phat co phan theo thoi gian (cliff + vest)',       'Equity release schedule (cliff + vest)', ARRAY['ESOP']),
  ('DD',           'ipo',        'Due Diligence · tham dinh chi tiet truoc dau tu/IPO',   'Due Diligence · detailed pre-investment review', ARRAY['Data Room']),
  ('Lock-up',      'ipo',        'Khoa co phieu sau IPO (90-180 ngay)',                   'Post-IPO share sale restriction (90-180 days)', ARRAY['S-1']),
  ('Prospectus',   'ipo',        'Ban cao bach IPO cho nha dau tu',                       'IPO disclosure document for investors', ARRAY['S-1','MD&A']);

ALTER TABLE glossary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glossary_public_read" ON glossary FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────
-- 4 · TRIGGER · auto-copy ipo_readiness_criteria_template → per journey
-- When a new ipo_journey is created, clone the 20 template criteria into
-- tenant-scoped ipo_readiness_criteria rows.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_readiness_criteria_for_journey()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ipo_readiness_criteria (
    tenant_id, journey_id, criterion_code, category,
    name_vi, name_en, weight
  )
  SELECT
    NEW.tenant_id, NEW.id, t.criterion_code, t.category,
    t.name_vi, t.name_en, t.weight
  FROM ipo_readiness_criteria_template t
  ON CONFLICT (journey_id, criterion_code) DO NOTHING;

  RETURN NEW;
END $$;

CREATE TRIGGER on_journey_created_seed_criteria
  AFTER INSERT ON ipo_journeys
  FOR EACH ROW EXECUTE FUNCTION seed_readiness_criteria_for_journey();

COMMENT ON TABLE modules_catalog IS 'Zeniipo · 32 module catalog · v1.0';
COMMENT ON TABLE agent_catalog IS 'Zeniipo · 108 agent legion · v1.0';
COMMENT ON TABLE glossary IS 'Zeniipo · Common IPO + finance terms · v1.0';
