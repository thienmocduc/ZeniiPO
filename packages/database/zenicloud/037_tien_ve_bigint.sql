-- ============================================================================
-- 037 — TIỀN VỀ BIGINT: số nguyên, không dấu phẩy động, có ghi rõ đơn vị
--
-- VÌ SAO. Tiền để kiểu `numeric` rồi đi qua JavaScript là thành `number` dấu
-- phẩy động 64 bit. Với VND — đơn vị không có hào — mọi phép cộng đều phải
-- khớp đến từng đồng, mà float thì không bảo đảm được điều đó: cộng nghìn dòng
-- doanh thu rồi lệch vài đồng là báo cáo không cân, và không ai truy được lệch
-- ở đâu. `bigint` chứa tới 9,2 tỷ tỷ đồng — thừa cho mọi doanh nghiệp Việt —
-- và cộng bao nhiêu lần cũng chính xác tuyệt đối.
--
-- Engine kế hoạch (`plan_targets.amount`) đã là `bigint` từ 029. Migration này
-- kéo phần còn lại của CSDL về cùng một chuẩn.
--
-- PHẠM VI ĐO TRÊN CSDL THẬT, KHÔNG ĐOÁN THEO TÊN CỘT. Rà 78 cột `numeric`:
--   · 39 cột là SỐ TIỀN            → đổi sang bigint (danh sách dưới)
--   · 39 cột còn lại KHÔNG phải tiền → GIỮ NGUYÊN numeric, vì chúng có phần
--     lẻ hợp lệ: tỷ lệ %, trọng số, điểm, bội số so sánh (P/E, EV/EBITDA),
--     giá MỖI cổ phần, chi phí gọi AI (nhỏ hơn một xu), và các cột `value`
--     đa dụng mà đơn vị phụ thuộc cột `unit`/`metric_type` bên cạnh.
--     Ép những cột đó về số nguyên là làm hỏng dữ liệu đúng.
--
-- AN TOÀN DỮ LIỆU. Trước khi chạy đã đếm: trong 39 cột này KHÔNG cột nào đang
-- chứa giá trị có phần lẻ (38 cột rỗng hoàn toàn, riêng `membership_tiers` có
-- 5 dòng đều là số nguyên). Nên `round()` dưới đây không làm mất một đồng nào
-- tại thời điểm chạy. Ba cột duy nhất trong CSDL có phần lẻ là
-- `ipo_benchmarks.good_min/good_max` và `ipo_readiness_criteria_template.weight`
-- — đều KHÔNG nằm trong danh sách này.
--
-- ĐƠN VỊ. Cột tên `*_usd` giữ nguyên tên (đổi tên là việc riêng, đụng hơn 40
-- file) nhưng nay ghi rõ đơn vị là ĐÔ LA NGUYÊN trong COMMENT, và bảng nào
-- thiếu thì được bổ sung cột đồng tiền để đồng tiền là DỮ LIỆU chứ không phải
-- một mẩu trong tên cột.
-- ============================================================================

-- View của 036 bám vào membership_tiers ⇒ hạ xuống trước, dựng lại ở cuối.
DROP VIEW IF EXISTS ty_gia_ngam_trong_bang_gia;

DO $$
DECLARE
  cot text;
  danh_sach text[] := ARRAY[
    -- ── Số tiền theo đồng tiền chức năng của doanh nghiệp (mặc định VND) ──
    'financial_statements.accounts_payable',
    'financial_statements.accounts_receivable',
    'financial_statements.capex',
    'financial_statements.cash_balance',
    'financial_statements.cogs',
    'financial_statements.inventory',
    'financial_statements.opex_ga',
    'financial_statements.opex_rnd',
    'financial_statements.opex_sales',
    'financial_statements.other_income',
    'financial_statements.revenue',
    'masterplan_years.ebitda_target',
    'masterplan_years.funding_target',
    'masterplan_years.revenue_target',
    'masterplan_years.valuation_target',
    'membership_tiers.price_vnd_month',
    'simulation_scenarios.base_revenue',
    'tenant_operating_profile.baseline_revenue',
    'tenant_operating_profile.sim_target_revenue',
    'unit_economics_inputs.churned_mrr',
    'unit_economics_inputs.contraction_mrr',
    'unit_economics_inputs.expansion_mrr',
    'unit_economics_inputs.new_mrr',
    'unit_economics_inputs.starting_mrr',
    'ipo_journeys.valuation_target',
    -- ── Số tiền niêm yết bằng đô la nguyên ──
    'cap_table_snapshots.valuation_usd',
    'comparables.ebitda_usd',
    'comparables.enterprise_value_usd',
    'comparables.market_cap_usd',
    'comparables.revenue_usd',
    'fundraise_rounds.actual_raise_usd',
    'fundraise_rounds.post_money_usd',
    'fundraise_rounds.pre_money_usd',
    'fundraise_rounds.target_raise_usd',
    'investor_pipeline.committed_usd',
    'investor_pipeline.target_check_usd',
    'membership_tiers.price_usd_month',
    'valuation_runs.enterprise_value_usd',
    'valuation_runs.equity_value_usd'
  ];
  bang text; ten text; hien text; so_doi int := 0; so_bo_qua int := 0;
BEGIN
  FOREACH cot IN ARRAY danh_sach LOOP
    bang := split_part(cot, '.', 1);
    ten  := split_part(cot, '.', 2);
    SELECT data_type INTO hien FROM information_schema.columns
     WHERE table_schema='public' AND table_name=bang AND column_name=ten;
    IF hien IS NULL THEN
      RAISE NOTICE 'BO QUA (khong co cot): %', cot;  so_bo_qua := so_bo_qua + 1;
    ELSIF hien = 'bigint' THEN
      so_bo_qua := so_bo_qua + 1;   -- đã đổi ở lần chạy trước, migration chạy lại được
    ELSE
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE bigint USING round(%I)::bigint', bang, ten, ten);
      so_doi := so_doi + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Da doi % cot sang bigint, bo qua % cot', so_doi, so_bo_qua;
END $$;

-- ── Đồng tiền thành DỮ LIỆU, không còn là một mẩu trong tên cột ──
-- `financial_statements` là bảng ba báo cáo cốt lõi mà trước đây không có một
-- cột đồng tiền nào: đọc bảng đó không ai biết số là VND hay USD.
ALTER TABLE financial_statements   ADD COLUMN IF NOT EXISTS ccy text NOT NULL DEFAULT 'VND';
ALTER TABLE masterplan_years       ADD COLUMN IF NOT EXISTS ccy text NOT NULL DEFAULT 'VND';
ALTER TABLE unit_economics_inputs  ADD COLUMN IF NOT EXISTS ccy text NOT NULL DEFAULT 'VND';
ALTER TABLE tenant_operating_profile ADD COLUMN IF NOT EXISTS ccy text NOT NULL DEFAULT 'VND';
ALTER TABLE simulation_scenarios   ADD COLUMN IF NOT EXISTS ccy text NOT NULL DEFAULT 'VND';

COMMENT ON COLUMN financial_statements.ccy IS
  'Đồng tiền của mọi cột tiền trong dòng này. Mặc định VND — khớp tenants.functional_ccy.';
COMMENT ON COLUMN financial_statements.revenue IS 'Số nguyên, đơn vị theo cột ccy. Không có phần thập phân.';
COMMENT ON COLUMN fundraise_rounds.pre_money_usd  IS 'ĐÔ LA NGUYÊN (bigint). Quy sang VND phải qua hàm ty_gia() kèm ngày.';
COMMENT ON COLUMN fundraise_rounds.post_money_usd IS 'ĐÔ LA NGUYÊN (bigint). Quy sang VND phải qua hàm ty_gia() kèm ngày.';
COMMENT ON COLUMN valuation_runs.enterprise_value_usd IS 'ĐÔ LA NGUYÊN (bigint).';
COMMENT ON COLUMN valuation_runs.equity_value_usd     IS 'ĐÔ LA NGUYÊN (bigint).';
COMMENT ON COLUMN cap_table_snapshots.share_price_usd IS
  'GIỮ numeric có chủ ý: giá MỖI cổ phần thường lẻ (vd 0,0234 USD) — làm tròn về số nguyên là xoá mất giá.';

-- Dựng lại view của 036 sau khi đã đổi kiểu.
CREATE OR REPLACE VIEW ty_gia_ngam_trong_bang_gia AS
SELECT tier_code,
       price_usd_month,
       price_vnd_month,
       round(price_vnd_month::numeric / price_usd_month) AS ty_gia_ngam,
       round(price_vnd_month::numeric / price_usd_month)
         - (SELECT round(min(price_vnd_month::numeric / price_usd_month))
              FROM membership_tiers WHERE price_usd_month > 0) AS lech_so_voi_thap_nhat
  FROM membership_tiers
 WHERE price_usd_month > 0;
GRANT SELECT ON ty_gia_ngam_trong_bang_gia TO authenticated;
