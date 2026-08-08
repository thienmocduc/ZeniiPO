-- ═══════════════════════════════════════════════════════════════════
-- Migration 021 · Academy scaffold (spec Part III — 7 cấp · lessons/drills)
-- ═══════════════════════════════════════════════════════════════════
-- Curriculum content is GLOBAL (not per-tenant) → public read. Each level's
-- lessons + assessment bank live here; the Journey Engine gates reference the
-- same level_num. Level 1 (Khai Tâm) is seeded in full as the reference
-- implementation; Levels 2–7 carry the module skeletons from the spec for the
-- team to fill (200 handbooks land here over time).
-- ═══════════════════════════════════════════════════════════════════

-- ── lessons ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_num int REFERENCES journey_levels(level_num) NOT NULL,
  lesson_code text UNIQUE NOT NULL,
  order_idx int NOT NULL,
  title_vi text NOT NULL,
  title_en text,
  analogy_vi text,
  body_vi jsonb DEFAULT '[]'::jsonb,   -- array of paragraphs
  takeaway_vi text,
  status text DEFAULT 'published' CHECK (status IN ('draft','published')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lessons_level ON academy_lessons(level_num, order_idx);
ALTER TABLE academy_lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lessons_public_read ON academy_lessons;
CREATE POLICY lessons_public_read ON academy_lessons FOR SELECT USING (true);

-- ── assessments (question bank per level) ───────────────────────
CREATE TABLE IF NOT EXISTS academy_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_num int REFERENCES journey_levels(level_num) UNIQUE NOT NULL,
  pass_mark int NOT NULL DEFAULT 6,
  total int NOT NULL DEFAULT 8,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{id,q,options[],correct,explain}]
  created_at timestamptz DEFAULT now()
);
ALTER TABLE academy_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assessments_public_read ON academy_assessments;
-- Public read EXCLUDING the correct answers is handled at the API layer;
-- the table itself is readable so tutors/admins can manage it. (For anti-cheat,
-- the /api/academy GET strips `correct` before sending to the client.)
CREATE POLICY assessments_public_read ON academy_assessments FOR SELECT USING (true);

-- ── deliverable specs (mirror journey gate requirements) ────────
CREATE TABLE IF NOT EXISTS academy_deliverable_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_num int REFERENCES journey_levels(level_num) NOT NULL,
  code text NOT NULL,
  label_vi text NOT NULL,
  entity text NOT NULL,             -- which Company-Brain entity it writes
  hint_vi text,
  UNIQUE(level_num, code)
);
ALTER TABLE academy_deliverable_specs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deliv_specs_public_read ON academy_deliverable_specs;
CREATE POLICY deliv_specs_public_read ON academy_deliverable_specs FOR SELECT USING (true);

-- ═══ SEED · Level 1 Khai Tâm (reference implementation) ═══════════
INSERT INTO academy_lessons (level_num, lesson_code, order_idx, title_vi, title_en, analogy_vi, body_vi, takeaway_vi) VALUES
(1,'L1-1',1,'Tư duy doanh nghiệp — không chỉ là "bán cho hết món"','Business thinking','Một quán đông khách chưa chắc là một doanh nghiệp khoẻ.',
 '["Bạn nấu ngon, quán đông — đó là cái nghề. Doanh nghiệp là khi quán vẫn chạy tốt kể cả hôm bạn nghỉ.","Doanh nghiệp khoẻ = cỗ máy tạo dòng tiền đều, nhân bản được, có người sẵn sàng trả tiền để sở hữu một phần.","Mục tiêu: biến công sức hằng ngày thành tài sản định giá được."]',
 'Doanh nghiệp = tài sản tạo dòng tiền, không phải chỉ chỗ làm việc của bạn.'),
(1,'L1-2',2,'Ba loại vốn — tiền ở đâu mà ra','Three types of capital','Mở quán thứ hai, tiền lấy từ đâu? Có 3 cái vòi.',
 '["Vốn vay (nợ): trả gốc+lãi, giữ 100% sở hữu.","Vốn góp (cổ phần): đổi sở hữu lấy tiền, không trả lãi.","Vốn tự tích luỹ: lấy lãi nuôi tăng trưởng, chậm nhưng an toàn."]',
 'Nợ = giữ sở hữu, trả lãi. Cổ phần = chia sở hữu, không trả lãi.'),
(1,'L1-3',3,'Cổ phần hoá — chia quán thành miếng','Equitization','Cắt cái quán thành 1.000.000 miếng bằng nhau.',
 '["Cổ phần là đơn vị sở hữu. Giữ 700k/1tr = 70%.","Gọi vốn = phát hành cổ phần MỚI, không bán quán.","Cổ phần hoá biến sở hữu mơ hồ thành con số định giá được."]',
 'Sở hữu % = cổ phần bạn giữ / tổng cổ phần.'),
(1,'L1-4',4,'Bốn chữ "Cổ" — đừng nhầm lẫn','Four equity terms','Cùng chữ cổ, 4 nghĩa khác nhau.',
 '["Cổ phần = miếng sở hữu.","Cổ phiếu = giấy xác nhận.","Cổ đông = người sở hữu.","Cổ tức = lợi nhuận chia cho cổ đông."]',
 'Cổ phần miếng · cổ phiếu giấy · cổ đông người · cổ tức tiền lời.'),
(1,'L1-5',5,'Chia cổ phần & quyền điều hành','Ownership vs control','Cho người góp tiền, nhưng ai cầm vô-lăng?',
 '["Sở hữu ≠ điều hành. Giữ >65% = toàn quyền; >50% = đa số; <35% = mất phủ quyết.","Mỗi vòng gọi vốn pha loãng bạn — tính trước.","ESOP 10-15% để giữ chân đội ngũ."]',
 '>65% toàn quyền · >50% đa số · <35% mất phủ quyết · ESOP 10-15%.'),
(1,'L1-6',6,'Thang gọi vốn — từ quán nhỏ tới lên sàn','Funding ladder','Leo thang từng bậc, mỗi bậc vốn lớn hơn.',
 '["Seed: chứng minh mô hình.","Series A/B/C: nhân bản, định giá tăng dần.","IPO: bán cho công chúng — rung chuông.","Zeniipo đồng hành cả thang bằng dữ liệu thật của bạn."]',
 'Seed → Series A/B/C → IPO. Đo được mình đang ở đâu.')
ON CONFLICT (lesson_code) DO NOTHING;

INSERT INTO academy_assessments (level_num, pass_mark, total, questions) VALUES
(1, 6, 8, '[
  {"id":"Q1","q":"Quán đông khách có chắc là doanh nghiệp khoẻ?","options":["Chắc chắn","Chưa chắc — phải chạy được cả khi chủ vắng & định giá được","Chỉ khi nhiều chi nhánh"],"correct":1},
  {"id":"Q2","q":"Vốn vay khác vốn góp ở điểm cốt lõi?","options":["Nợ trả lãi giữ sở hữu; cổ phần chia sở hữu không trả lãi","Cả hai trả lãi","Cổ phần luôn rẻ hơn"],"correct":0},
  {"id":"Q3","q":"Giữ 700k/1tr cổ phần = bao nhiêu %?","options":["7%","70%","0,7%"],"correct":1},
  {"id":"Q4","q":"Gọi vốn thường làm gì?","options":["Bán toàn bộ quán","Phát hành cổ phần mới","Cho mượn cổ phần"],"correct":1},
  {"id":"Q5","q":"Cổ tức là gì?","options":["Giấy xác nhận","Người sở hữu","Lợi nhuận chia cho cổ đông"],"correct":2},
  {"id":"Q6","q":"Giữ toàn quyền quyết định lớn cần trên?","options":["35%","50%","65%"],"correct":2},
  {"id":"Q7","q":"ESOP là gì, chiếm bao nhiêu?","options":["Quỹ cổ phần nhân viên ~10-15%","Thuế IPO","Vốn vay"],"correct":0},
  {"id":"Q8","q":"Thứ tự thang gọi vốn?","options":["IPO→Series A→Seed","Seed→Series A/B/C→IPO","Series A→IPO→Seed"],"correct":1}
]') ON CONFLICT (level_num) DO NOTHING;

-- deliverable specs from journey_levels.required_deliverables (all 7 levels)
INSERT INTO academy_deliverable_specs (level_num, code, label_vi, entity)
SELECT l.level_num, d->>'code', d->>'label', d->>'entity'
FROM journey_levels l, jsonb_array_elements(l.required_deliverables) d
ON CONFLICT (level_num, code) DO NOTHING;
