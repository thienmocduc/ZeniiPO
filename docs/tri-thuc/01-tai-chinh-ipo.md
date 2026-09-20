# 01 · KIỂM KÊ GÓI TRI THỨC TÀI CHÍNH DOANH NGHIỆP · IPO

> Kiểm kê phần **tài chính doanh nghiệp — cơ chế vốn — IPO** trong kho tri thức Wits, và
> kết quả rút ra thành dữ liệu máy đọc được: `apps/web/src/lib/v1/lo-trinh-tai-chinh.ts`.
>
> Mọi con số dưới đây đều **đếm được lại**. Mỗi bảng có kèm cách đếm. Chỗ nào kho không đủ
> căn cứ thì ghi thẳng là không đủ, không bù bằng suy diễn.
>
> Ngày kiểm kê: 2026-09-20 · Phạm vi: chỉ ĐỌC kho ở ổ D: và thư mục `docs/tri-thuc-wits`,
> không sửa gì ngoài repo này.

---

## 1 · Kho có những gì — bốn nguồn thuộc ngành `quan-tri-von`

Tra `D:/WitsAGI-Data/wits-llm/tri-thuc/manifest.json`: tệp này có **173 nguồn**, trong đó
**4 nguồn** gắn nhãn ngành `quan-tri-von`.

| # | Tầng | Nguồn | Số mục kê khai | Có trình kiểm | Tệp thật nằm đâu |
|---|---|---|---|---|---|
| 1 | `su-kien` | Gói tri thức ZeniIPO v1 (IPO · MBA · tài chính DN · cơ chế vốn) | 64 mục | không | `Zeni-iPO/docs/ZENI_DOMAIN_KNOWLEDGE_PACK_v1.md` — **nằm trong chính repo này** |
| 2 | `su-kien` | Gói tri thức ZeniIPO FULL v1 (A vốn–IPO · B pháp lý · C kế toán–thuế · D điều hành) | 305 mục | không | `Zeni-Digital-Web3/docs/tri-thuc-wits/ZENI_DOMAIN_KNOWLEDGE_PACK_FULL_v1.md` |
| 3 | `su-kien` | Bộ ngưỡng chuẩn vốn (máy đọc được) | 31 mục | **có** | `D:/WitsAGI-Data/wits-llm/du-lieu-nganh/nguong-von.json` |
| 4 | `cap-kiem-duoc` | Cặp ngành quản trị vốn (từ gói ZeniIPO) | 184 cặp | **có** | `D:/WitsAGI-Data/wits-llm/du-lieu-nganh/quan-tri-von-20260916.jsonl` |

Cộng cơ học là 584 mục. **Con số đó sai** nếu hiểu là 584 mục tri thức riêng biệt — xem mục 3.

*Cách đếm lại:* đọc `manifest.json`, lấy mảng `nguon`, lọc phần tử có `'quan-tri-von'` trong
trường `nganh`, in `tang · ten · soMuc · coTrinhKiem · duongDan`.

---

## 2 · Tệp `quan-tri-von-20260916.jsonl` — đếm chi tiết

**184 dòng JSON hợp lệ, 0 dòng lỗi, 0 mã `id` trùng.** Mỗi dòng là một cặp hỏi–đáp có trình kiểm.

**Trường có mặt:** `id`, `nganh`, `loai`, `boiCanh`, `hoi`, `dap`, `kiem`, `nguon` — cả 184/184 dòng.
Riêng `thamSo` chỉ có ở 158/184 dòng (26 dòng loại `tra-cong-thuc` không cần tham số).

| Phân bố theo `loai` | Số mục | Nội dung thật là gì |
|---|---|---|
| `cham-nguong` | 93 | Cho một con số + một giai đoạn, hỏi đạt chuẩn chưa |
| `tra-nguong` | 31 | Hỏi ngưỡng của một chỉ số ở một giai đoạn — **đúng 31, khớp 1–1 với 31 dòng trong `ipo_benchmarks`** |
| `tra-cong-thuc` | 26 | Hỏi công thức tính một chỉ số |
| `bay-giai-doan` | 24 | Một con số, hỏi ở hai giai đoạn khác nhau — dạy đúng một bài: ngưỡng đổi theo giai đoạn |
| `tu-choi-khong-co-nguong` | 10 | Hỏi ngưỡng KHÔNG tồn tại, đáp án đúng là từ chối trả lời (fail-closed) |

| Phân bố theo `nguon.muc` | Số mục |
|---|---|
| `04 · kinh tế đơn vị` | 124 |
| `04 · công thức` | 26 |
| `04 · bẫy giai đoạn` | 24 |
| `04 · fail-closed` | 10 |

**184/184 dòng có `nguon.goi` = `"ZeniIPO v1"`.** Toàn bộ tệp sinh ra từ **duy nhất chương 04**
của gói tri thức — không có nguồn nào khác.

*Cách đếm lại:* đọc từng dòng, `json.loads`, đếm `collections.Counter` trên `loai`,
`nguon.goi`, `nguon.muc`, `thamSo.chiSo`, `thamSo.giaiDoan`; đếm khoá cấp 1 để ra bảng trường.

---

## 3 · Ba phát hiện phải nói trước khi dùng kho này

### 3.1 · Phần A của gói FULL v1 là BẢN SAO của gói v1 trong repo

Chuẩn hoá hai văn bản (bỏ dòng trống, bỏ số chương ở đầu tiêu đề) rồi so tập dòng:

| Phép so | Kết quả |
|---|---|
| Số dòng duy nhất — phần A của FULL v1 (dòng 119–1206) | 750 |
| Số dòng duy nhất — `docs/ZENI_DOMAIN_KNOWLEDGE_PACK_v1.md` | 749 |
| **Giao nhau** | **748** |
| Chỉ có trong FULL v1 | 2 (tiêu đề `# PHẦN A` và một dòng ghi chú chủ sở hữu) |
| Chỉ có trong gói v1 | 1 (dòng tiêu đề tệp) |

Chính gói FULL v1 cũng tự khai điều này ở đầu phần A: *"Nguyên văn gói
`…\Zeni-iPO\docs\ZENI_DOMAIN_KNOWLEDGE_PACK_v1.md`, không sửa nội dung."*

**Hệ quả:** 64 mục của nguồn số 1 nằm TRONG 305 mục của nguồn số 2. Tri thức tài chính–IPO
riêng biệt là **305 mục**, không phải 369. Phần mới mà gói FULL mang thêm là B (pháp lý),
C (kế toán–thuế), D (điều hành), E (thu khách).

### 3.2 · Tệp `.jsonl` là dữ liệu VÒNG LẠI, không mang thêm căn cứ mới

184 cặp hỏi–đáp đều sinh máy từ bảng `ipo_benchmarks` của chính ZeniIPO (`boiCanh` ghi rõ:
*"nguồn: ZeniIPO, bảng ipo_benchmarks"*). Dùng nó để **huấn luyện và kiểm hành vi model** thì
đúng mục đích. Dùng nó làm **căn cứ mới cho sản phẩm** thì sai — đó là đọc lại số của chính mình.

Vì vậy bản rút dữ liệu ở mục 5 lấy căn cứ từ **văn bản gốc** (gói FULL v1), còn `.jsonl` chỉ
dùng để đối chiếu xem đã hiểu đúng bộ ngưỡng chưa.

### 3.3 · Không nguồn văn xuôi nào có trình kiểm

Hai nguồn `su-kien` (64 và 305 mục) đều `coTrinhKiem: false`. Chỉ hai nguồn máy đọc được
(31 ngưỡng và 184 cặp) là `true`. Nghĩa là: mọi câu chữ trong gói tri thức chưa có phép thử tự
động nào canh, ai sửa cũng không ai biết. Chỉ 31 con số ngưỡng là có.

---

## 4 · Kiểm kê theo mức "máy đọc được"

Đếm bảng Markdown và dòng dữ liệu trong bảng (dòng bắt đầu bằng `|`, sau dòng kẻ `|---|`, không
tính dòng tiêu đề) — đây là thước đo thô cho phần **đã có cấu trúc**, đối lại với văn xuôi:

| Phần của gói FULL v1 | Số dòng | Số bảng | Dòng dữ liệu trong bảng |
|---|---|---|---|
| A · IPO, tài chính DN, cơ chế vốn | 1.088 | 23 | 231 |
| B · Pháp lý doanh nghiệp | 1.284 | 24 | 197 |
| C · Kế toán, thuế, vận hành | 1.485 | 32 | 292 |
| D · Điều hành doanh nghiệp | 859 | 16 | 103 |
| E · Thu khách, dữ liệu cá nhân | 1.087 | 13 | 86 |
| **Cộng năm phần** | **5.803** | **108** | **909** |

Toàn tệp là 5.920 dòng; 117 dòng chênh là phần mở đầu trước `# PHẦN A` (bốn luật bất biến,
ranh giới bản quyền, những thứ cố ý không có trong bộ).

*Cách đếm lại:* đọc tệp, cắt theo dòng bắt đầu bằng `# PHẦN X`, với mỗi đoạn đếm dòng khớp
`^\|[\s:\-\|]+\|$` (dòng kẻ ⇒ một bảng) và các dòng `|` liền sau nó (⇒ dòng dữ liệu).

### 4.1 · Cái gì dùng được NGAY cho ZeniIPO

| Nội dung | Ở đâu | Dạng | Đã dùng chưa |
|---|---|---|---|
| 31 ngưỡng chỉ số × giai đoạn | A04 mục 2 | bảng, số | **Đã nạp** — `packages/database/zenicloud/032_nguong_chuan_von.sql` |
| 16 công thức kinh tế đơn vị | A04 mục 1 | bảng, công thức | Đã có trong mã (`derive_unit_economics`) |
| 13 mã tài khoản VAS + chuỗi EBITDA→EBT→thuế | A03 mục 1–2 | bảng, công thức | Đã có trong mã (`029_plan_tier.sql`, `lib/plan/engine.ts`) |
| 3 phương pháp định giá | A05 | công thức | Đã có trong mã (`lib/finance/valuation.ts`) |
| 10 bước hành trình vốn + cổng điều kiện | A02 mục 1 | bảng | Đã có trong mã (`025_business_spine.sql`) |
| 20 tiêu chí sẵn sàng niêm yết có trọng số | A02 mục 2 | bảng | Đã có trong mã (`003_ipo_complete_flows.sql`) |
| 8 trụ chẩn đoán tái cấu trúc | A09 | bảng | Đã có trong mã (`028_modes_and_connectors.sql`) |
| Thuật ngữ Việt–Anh | A10 · B10 · C10 · D10 | bảng | Đã có — `apps/web/src/lib/v1/thuat-ngu.ts`, đếm được **170 mục** (`grep -c "^    tu: '"`) |
| **Lộ trình theo giai đoạn: mốc · hồ sơ · rủi ro** | **rải khắp A02, A03, A05, A06, A08, B02, B07, B09, C02, C07, C09** | **văn xuôi + bảng, CHƯA gom** | **Đây chính là phần tệp mới rút ra** |

### 4.2 · Cái gì còn là văn xuôi, máy CHƯA đọc được

| Nội dung | Ở đâu | Vì sao chưa dùng được |
|---|---|---|
| Khung năng lực 12 ghế lãnh đạo, 4 nhóm × 4 cấp độ | A06 mục 3 | Chỉ nêu ví dụ cho 2 ghế, 10 ghế còn lại chưa liệt kê đủ cấp độ |
| 12 playbook trưởng khối, hệ 108 agent | A07 | Mô tả sứ mệnh, chưa có bộ chỉ số neo từng playbook |
| Bối cảnh chu kỳ vốn Việt Nam 2026–2030 | A08 mục 6 | Định tính, không con số nào gắn mốc thời gian cụ thể |
| Phần lớn B03 hợp đồng, B04 lao động, B05 mức phạt | B | Có bảng nhưng thuộc miền pháp lý, ngoài phạm vi kiểm kê này |
| Chẩn đoán sức khoẻ sổ sách thang 100 | C09 | **Chính gói tự khai:** chưa tồn tại như một hàm trong mã, là khung đề xuất |
| Quy trình giải thể doanh nghiệp | B02 chặng cuối | **Chính gói tự dán nhãn** `kien_thuc_luat_chung_chua_qua_engine`, độ tin cậy thấp hơn phần còn lại |
| Mức phạt vi phạm hành chính về thuế | C02 mục 3 | Gói tự khai không có đủ chi tiết biểu mức, phải tra riêng |

---

## 5 · Kết quả rút ra: `apps/web/src/lib/v1/lo-trinh-tai-chinh.ts`

**42 mốc**, phủ đủ 6 giai đoạn, mỗi giai đoạn ≥5 mốc, **124 đầu mục hồ sơ**.

| Giai đoạn | Mã kỹ thuật (`ipo_benchmarks.stage`) | Số mốc | Đầu mục hồ sơ | Ngưỡng có trong kho | Lượt `chi_so_chan` |
|---|---|---|---|---|---|
| `hat-giong` | `seed` | 7 | 19 | 3 | 3 |
| `vong-a` | `series_a` | 7 | 21 | 7 | 7 |
| `vong-b` | `series_b` | 7 | 18 | 9 | 9 |
| `tang-truong` | `growth` | 7 | 19 | 4 | 4 |
| `tien-niem-yet` | `pre_ipo` | 8 | 30 | 8 | 8 |
| `niem-yet` | *không có* | 6 | 17 | **0** | **0** |
| **Tổng** | | **42** | **124** | **31** | **31** |

**Kiểm chéo đã chạy, 0 lỗi:**
- 42/42 mã `ma` duy nhất.
- 31/31 lượt `chi_so_chan` trỏ tới một mã có thật trong `ipo_benchmarks` **và** có ngưỡng đúng
  ở giai đoạn đó. Không mốc nào gán chỉ số mà giai đoạn ấy không có ngưỡng.
- **31/31 ngưỡng đều được neo**, không ngưỡng nào bị bỏ sót.
- 14 mốc có chỉ số chặn, 28 mốc để mảng rỗng — 28 mốc đó là việc **kiểm bằng hồ sơ**, không có
  chỉ số số học tương ứng trong kho. Để rỗng là đúng, không phải thiếu sót.

*Cách kiểm lại:* đọc `032_nguong_chuan_von.sql`, bắt cặp `('<metric_code>','<stage>'` → tập 31
cặp. Đọc tệp `.ts`, tách từng khối mốc, lấy `giai_doan` + `chi_so_chan`, ánh xạ giai đoạn sang
`stage` bằng `GIAI_DOAN_SANG_MA_CHUAN`, đối chiếu từng cặp với tập 31.

**Kiểm kiểu:** `pnpm -C apps/web exec tsc --noEmit` → **0 lỗi** (mã thoát 0).

**Một chỗ cố ý khác bản mô tả ban đầu:** trường `chi_so_chan` khai kiểu `MaChiSoChuan[]` thay vì
`string[]`. `MaChiSoChuan` là hợp của đúng 12 mã đang có ngưỡng. Làm vậy để yêu cầu *"đừng chế
mã mới"* được **máy canh** — chế mã lạ là `tsc` đỏ ngay, không đợi tới lúc chấm điểm mới phát
hiện không có ngưỡng để so.

---

## 6 · Chỗ kho tri thức KHÔNG ĐỦ CĂN CỨ — liệt kê thẳng

### 6.1 · Giai đoạn `niem-yet` — mỏng nhất, chỉ dựng được khung

Đây là chỗ thiếu nghiêm trọng nhất.

- **Không một ngưỡng chỉ số nào** cho giai đoạn sau niêm yết. Bộ 31 ngưỡng dừng ở `pre_ipo`.
  Vì vậy cả 6 mốc `ny-*` đều có `chi_so_chan: []`.
- **Không có danh mục nghĩa vụ công bố thông tin của công ty đại chúng Việt Nam:** công bố định
  kỳ, công bố bất thường và thời hạn của nó, báo cáo tình hình quản trị công ty theo kỳ, nghĩa
  vụ của người nội bộ và người có liên quan khi giao dịch cổ phiếu. Kho không có một dòng nào.
- Toàn bộ căn cứ cho giai đoạn này chỉ gồm: **một dòng** trong bảng 10 bước (bước 10, ba chỉ số
  *diễn biến cổ phiếu · nhịp quan hệ nhà đầu tư · báo cáo quý*), **một ghế** trong bảng 12 ghế
  lãnh đạo, và phần **duy trì** các tiêu chí đã đạt ở tiền niêm yết.

**Kết luận thẳng:** 6 mốc `ny-*` đủ để định hướng chủ doanh nghiệp, **không đủ để làm hồ sơ
tuân thủ**. Muốn dùng thật phải nạp thêm danh mục nghĩa vụ công bố thông tin sau niêm yết.

### 6.2 · Bộ 31 ngưỡng có lỗ hổng theo giai đoạn — đã được kho tự thừa nhận

10 mục `fail-closed` trong `.jsonl` chính là danh sách các lỗ hổng đó, và đáp án đúng là **từ
chối trả lời**, kèm câu: *"Không suy diễn từ giai đoạn gần kề — ngưỡng giữa các giai đoạn không
đổi đều."*

| Chỉ số | Giai đoạn KHÔNG có ngưỡng |
|---|---|
| Biên lợi nhuận gộp · Giữ chân ròng · Giữ chân gộp · Quy tắc 40 · Bội số đốt tiền · Hệ số kỳ diệu · Tỷ số nhanh · Vòng quay tiền mặt · Điểm sẵn sàng niêm yết | Hạt giống |
| Số tháng sống | Tăng trưởng |

Ảnh hưởng thực tế tới tệp dữ liệu: mốc `tt-06` (*Chiến lược vốn khớp nhu cầu tiền*, giai đoạn
tăng trưởng) đúng ra phải chặn bằng số tháng sống, nhưng ngưỡng cho giai đoạn này không tồn tại
nên để mảng rỗng và ghi rõ lý do trong `nguon`. Giai đoạn hạt giống cũng chỉ chặn được 3 chỉ số.

### 6.3 · Bộ ngưỡng chưa chia theo NGÀNH

Ghi chú này đã có sẵn ở đầu `032_nguong_chuan_von.sql` và vẫn đúng: một công ty phần mềm và một
công ty sản xuất đang dùng chung ngưỡng biên lợi nhuận gộp ≥60%. Về nghiệp vụ là sai. Chính A04
mục 2 đã nêu khoảng đúng theo ngành (*phần mềm ≥70% · dịch vụ ≥40% · ăn uống 55–65%*) nhưng chỉ
nằm ở cột ghi chú dạng chữ, chưa thành dòng dữ liệu riêng. Phải bổ sung chiều ngành.

### 6.4 · Kho nghiêng hẳn về mô hình thuê bao

Trong 12 mã chỉ số, **6 mã đòi hỏi doanh thu định kỳ** mới tính được — `nrr_pct`, `grr_pct`,
`magic_number`, `quick_ratio`, `burn_multiple`, `rule_of_40` — vì công thức của chúng đều dựng
trên MRR tách bốn thành phần đầu kỳ / mở rộng / thu hẹp / mất, hoặc trên ARR ròng tăng thêm.
Thêm **2 mã nữa** — `ltv_cac_ratio` và `cac_payback_months` — dùng công thức LTV neo vào tỷ lệ
rời bỏ theo tháng, cũng chỉ hợp với mô hình thuê bao. Chỉ còn 4 mã dùng chung được cho mọi mô
hình: `gross_margin_pct`, `runway_months`, `ccc_days`, `ipo_readiness_score`.

Doanh nghiệp thương mại, sản xuất, xây dựng hay ăn uống — vốn là phần lớn khách Việt Nam mà
chính gói tri thức nhắc tới — sẽ không tính được phần lớn bộ thước này. Kho **không có** bộ chỉ
số thay thế cho các mô hình đó.

### 6.5 · Kho không có số liệu chuẩn ngành Việt Nam

Toàn bộ 31 ngưỡng là chuẩn nghề quốc tế cho mô hình thuê bao. Kho **không có** một mẫu số liệu
doanh nghiệp Việt Nam nào để so. A08 mục 5 đã đặt sẵn quy tắc cho việc này (chỉ dùng số liệu
tổng hợp, mỗi con số công bố phải gộp từ ít nhất 10 doanh nghiệp, doanh nghiệp phải chủ động
đồng ý tham gia) — nhưng đó là quy tắc, chưa phải dữ liệu.

---

## 7 · Việc nên làm tiếp, theo thứ tự

1. **Nạp danh mục nghĩa vụ công bố thông tin sau niêm yết** — lỗ hổng lớn nhất (mục 6.1).
2. **Bổ sung chiều ngành cho bộ ngưỡng**, neo theo phân ngành kinh tế Việt Nam (mục 6.3).
3. **Vá 10 lỗ hổng ngưỡng theo giai đoạn** đã liệt kê ở mục 6.2, hoặc xác nhận là cố ý không có
   và giữ hành vi từ chối trả lời.
4. **Dựng bộ chỉ số cho mô hình không thuê bao** (mục 6.4).
5. **Gắn trình kiểm cho hai nguồn văn xuôi** để không ai sửa được mà không bị phát hiện (mục 3.3).

---

## 8 · Phụ lục — tệp đã đọc trong đợt kiểm kê này

| Tệp | Vai trò |
|---|---|
| `D:/WitsAGI-Data/wits-llm/tri-thuc/manifest.json` | Tra 4 nguồn ngành `quan-tri-von` để biết tệp thật nằm đâu |
| `D:/WitsAGI-Data/wits-llm/du-lieu-nganh/quan-tri-von-20260916.jsonl` | Đếm 184 cặp, xác định là dữ liệu vòng lại |
| `D:/WitsAGI-Data/wits-llm/du-lieu-nganh/ban-do-nguon.json` | Kiểm tra — chỉ chứa hồ sơ ngành xây dựng, không liên quan |
| `Zeni-Digital-Web3/docs/tri-thuc-wits/ZENI_DOMAIN_KNOWLEDGE_PACK_FULL_v1.md` | Nguồn căn cứ chính: A01–A09, B02, B07, B09, C02, C07, C09 |
| `Zeni-iPO/docs/ZENI_DOMAIN_KNOWLEDGE_PACK_v1.md` | Đối chiếu, xác nhận là bản sao của phần A |
| `Zeni-iPO/packages/database/zenicloud/032_nguong_chuan_von.sql` | Nguồn 31 ngưỡng, dùng để kiểm chéo `chi_so_chan` |
| `Zeni-iPO/apps/web/src/lib/v1/thuat-ngu.ts` | Kiểm trùng — 170 thuật ngữ đã có, tệp mới không lặp lại |
