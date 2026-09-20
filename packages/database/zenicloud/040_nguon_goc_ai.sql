-- ============================================================================
-- 040 — NGUỒN GỐC ĐẦU RA CỦA AI: mô hình nào, lời nhắc bản nào, đầu vào là gì
--
-- BỐI CẢNH. `agent_runs` đang lưu output, số token và chi phí, nhưng KHÔNG lưu:
--   · mô hình nào sinh ra kết quả (`chatComplete` trả `r.model` mà mã chỉ dùng
--     để tính tiền rồi vứt đi — trong khi `nlq_logs` thì có `agent_model`);
--   · lời nhắc phiên bản nào;
--   · đầu vào thật sự là gì — cột `input` chỉ ghi `{mode, cadence}`, còn ảnh
--     chụp doanh nghiệp đưa cho mô hình thì không lưu ở đâu cả.
--   · `duration_ms` bị gán cứng 0, chưa bao giờ đo.
--
-- VÌ SAO PHẢI CÓ. Đề xuất của agent chảy thẳng vào dữ liệu doanh nghiệp qua
-- `agent_actions` (autonomy='auto' thì chạy luôn, không ai bấm). Khi một con
-- số sai xuất hiện trong hồ sơ IPO và bên thẩm định hỏi "số này ở đâu ra",
-- câu trả lời phải là: mô hình X, lời nhắc bản Y, đầu vào băm Z, độ tin cậy T,
-- người duyệt N. Thiếu một mắt là không lần lại được, và cũng không thể tái
-- lập để kiểm chứng.
--
-- BĂM ĐẦU VÀO DO CSDL TỰ TÍNH. Để mã ứng dụng không thể quên, và không thể
-- ghi một dấu vân tay không khớp đầu vào.
--
-- ⚠ "MÁY TỰ QUYẾT" PHẢI HIỆN RÕ, KHÔNG ĐỂ NULL. Trước đây hành động chạy tự
-- động có `decided_by` NULL — trông y hệt trường hợp người duyệt mà quên ghi
-- tên. Hai chuyện đó khác nhau về trách nhiệm. Nay `quyet_dinh_boi` nói thẳng
-- 'may' hay 'nguoi', và ràng buộc bắt hai thứ đó khớp nhau.
-- ============================================================================

ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS prompt_version text;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS input_hash text;

COMMENT ON COLUMN agent_runs.model IS 'Mô hình thật sự đã sinh ra kết quả (lấy từ phản hồi, không phải mô hình được YÊU CẦU).';
COMMENT ON COLUMN agent_runs.prompt_version IS 'Phiên bản lời nhắc. Đổi lời nhắc mà không đổi số này thì không so sánh được hai lần chạy.';
COMMENT ON COLUMN agent_runs.input_hash IS 'SHA-256 của cột input. CSDL tự tính — ứng dụng không quên được, cũng không ghi sai được.';

-- Băm đầu vào tự động, và CHẶN sửa đầu vào sau khi đã ghi.
CREATE OR REPLACE FUNCTION bam_dau_vao_agent_run() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.input IS DISTINCT FROM NEW.input THEN
    RAISE EXCEPTION 'Không được sửa đầu vào của một lần chạy đã ghi. Chạy lại thì tạo bản ghi mới.';
  END IF;
  NEW.input_hash := encode(sha256(convert_to(coalesce(NEW.input::text, ''), 'UTF8')), 'hex');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_agent_run_bam ON agent_runs;
CREATE TRIGGER trg_agent_run_bam BEFORE INSERT OR UPDATE ON agent_runs
  FOR EACH ROW EXECUTE FUNCTION bam_dau_vao_agent_run();

-- ── Máy tự quyết hay người quyết: nói thẳng, không để suy đoán từ NULL ──
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS quyet_dinh_boi text;
DO $$ BEGIN
  ALTER TABLE agent_actions ADD CONSTRAINT quyet_dinh_boi_hop_le
    CHECK (quyet_dinh_boi IS NULL OR quyet_dinh_boi IN ('may','nguoi'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  -- Người quyết thì phải có tên. Máy quyết thì KHÔNG được mượn tên ai.
  ALTER TABLE agent_actions ADD CONSTRAINT nguoi_quyet_phai_co_ten
    CHECK (
      quyet_dinh_boi IS DISTINCT FROM 'nguoi' OR decided_by IS NOT NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE agent_actions ADD CONSTRAINT may_quyet_khong_muon_ten
    CHECK (
      quyet_dinh_boi IS DISTINCT FROM 'may' OR decided_by IS NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN agent_actions.quyet_dinh_boi IS
  '"may" = tự động chạy theo autonomy, KHÔNG ai duyệt. "nguoi" = có người bấm, kèm decided_by. NULL = còn chờ.';

-- ── Một câu hỏi, một câu trả lời: "con số này ở đâu ra?" ──
CREATE OR REPLACE VIEW nguon_goc_ai AS
SELECT
  a.id                AS hanh_dong_id,
  a.tenant_id,
  a.agent_code,
  a.action_type,
  a.title,
  a.status            AS trang_thai,
  a.confidence        AS do_tin_cay,
  a.quyet_dinh_boi,
  a.decided_by        AS nguoi_duyet,
  a.decided_at        AS duyet_luc,
  a.executed_at       AS chay_luc,
  r.id                AS lan_chay_id,
  r.model             AS mo_hinh,
  r.prompt_version    AS ban_loi_nhac,
  r.input_hash        AS bam_dau_vao,
  r.tokens_input, r.tokens_output, r.cost_usd, r.duration_ms,
  r.created_at        AS chay_bat_dau,
  -- Mắt nào còn thiếu thì nói thẳng, đừng để người đọc tự đoán.
  nullif(concat_ws(', ',
    CASE WHEN r.id IS NULL           THEN 'không lần ngược được tới lần chạy' END,
    CASE WHEN r.model IS NULL        THEN 'không biết mô hình nào' END,
    CASE WHEN r.prompt_version IS NULL THEN 'không biết lời nhắc bản nào' END,
    CASE WHEN a.confidence IS NULL   THEN 'không có độ tin cậy' END,
    CASE WHEN a.quyet_dinh_boi IS NULL AND a.status IN ('executed','failed')
         THEN 'đã chạy mà không ghi ai quyết định' END
  ), '') AS thieu_gi
FROM agent_actions a
LEFT JOIN agent_runs r ON r.id = a.run_id;

COMMENT ON VIEW nguon_goc_ai IS
  'Trả lời "con số này ở đâu ra": mô hình, lời nhắc, băm đầu vào, độ tin cậy, người duyệt. Cột thieu_gi nêu rõ mắt xích nào còn trống.';
GRANT SELECT ON nguon_goc_ai TO authenticated;
