/**
 * Lộ trình tài chính theo giai đoạn vốn — rút từ kho tri thức Wits.
 *
 * Vì sao cần: kho tri thức đã có 31 NGƯỠNG chỉ số (bảng `ipo_benchmarks`,
 * nạp bởi packages/database/zenicloud/032_nguong_chuan_von.sql) và 170 THUẬT
 * NGỮ (apps/web/src/lib/v1/thuat-ngu.ts), nhưng chưa có thứ trả lời câu hỏi
 * thực tế nhất của chủ doanh nghiệp: *"giai đoạn này tôi phải làm xong những
 * việc gì, giấy tờ nào phải có trong tay?"*. Tệp này là phần còn thiếu đó.
 *
 * Nguồn: gói tri thức ZeniIPO FULL v1 (kho Wits, tầng `su-kien`) —
 *   C:/Users/Admin/Documents/Zeni-Digital-Web3/docs/tri-thuc-wits/ZENI_DOMAIN_KNOWLEDGE_PACK_FULL_v1.md
 * Phần A của gói đó là bản sao nguyên văn của docs/ZENI_DOMAIN_KNOWLEDGE_PACK_v1.md
 * trong chính repo này, nên trường `nguon` trỏ theo mã chương (A02, A04, B07…)
 * để tra được ở cả hai nơi. Bản kiểm kê kèm cách đếm: docs/tri-thuc/01-tai-chinh-ipo.md
 *
 * Quy ước dữ liệu:
 *  - `ma` duy nhất toàn mảng, tiền tố theo giai đoạn (hg · va · vb · tt · tnl · ny).
 *  - `muc_tieu` viết ở thể KIỂM ĐƯỢC: đọc xong phải biết nhìn vào đâu để nói
 *    xong hay chưa xong. Không viết khẩu hiệu kiểu "chuẩn bị kỹ càng".
 *  - `ho_so_can` là giấy tờ/tài liệu cầm được, không phải hoạt động.
 *  - `chi_so_chan` CHỈ nhận mã đã tồn tại trong `ipo_benchmarks`. Mốc nào chưa
 *    có ngưỡng phù hợp thì để mảng rỗng — KHÔNG suy diễn ngưỡng từ giai đoạn
 *    gần kề (nguyên tắc fail-closed của kho, xem A04 mục 3).
 *  - `nguon` trỏ về mục cụ thể trong kho, không ghi chung chung.
 *
 * CHƯA ĐỦ CĂN CỨ — ghi ra để không ai tưởng đã đủ: giai đoạn `niem-yet` không
 * có một ngưỡng chỉ số nào trong bộ 31 ngưỡng, và kho cũng không có danh mục
 * nghĩa vụ công bố thông tin sau niêm yết của công ty đại chúng Việt Nam. Sáu
 * mốc `ny-*` dưới đây dựng từ bước 10 của hành trình vốn cộng phần duy trì các
 * tiêu chí đã đạt ở tiền niêm yết — đủ để định hướng, KHÔNG đủ để làm hồ sơ.
 */

/** Sáu giai đoạn vốn, đặt tên theo cách giới làm nghề ở Việt Nam vẫn gọi. */
export type GiaiDoanVon =
  | 'hat-giong'
  | 'vong-a'
  | 'vong-b'
  | 'tang-truong'
  | 'tien-niem-yet'
  | 'niem-yet';

/**
 * Mười hai mã chỉ số đang có ngưỡng trong bảng `ipo_benchmarks`.
 * Kiểu hẹp có chủ đích: chế thêm mã mới sẽ đỏ ngay ở `tsc`, không đợi tới lúc
 * chấm điểm mới phát hiện không có ngưỡng để so.
 */
export type MaChiSoChuan =
  | 'ltv_cac_ratio'
  | 'cac_payback_months'
  | 'gross_margin_pct'
  | 'nrr_pct'
  | 'grr_pct'
  | 'rule_of_40'
  | 'burn_multiple'
  | 'runway_months'
  | 'magic_number'
  | 'quick_ratio'
  | 'ccc_days'
  | 'ipo_readiness_score';

export type MocTaiChinh = {
  giai_doan: GiaiDoanVon;
  /** Mã ngắn, duy nhất trong toàn mảng. */
  ma: string;
  /** Tên mốc, tiếng Việt. */
  ten: string;
  /** Một câu: đạt được cái gì thì coi là xong. */
  muc_tieu: string;
  /** Hồ sơ/tài liệu phải có trong tay. */
  ho_so_can: string[];
  /** Mã chỉ số phải đạt ngưỡng — khớp `metric_code` trong `ipo_benchmarks`. */
  chi_so_chan: MaChiSoChuan[];
  /** Rủi ro lớn nhất nếu bỏ qua mốc này. */
  rui_ro: string;
  /** Xuất xứ trong kho tri thức. */
  nguon: string;
};

/**
 * Ánh xạ sang mã giai đoạn kỹ thuật của bảng `ipo_benchmarks` (cột `stage`)
 * và của API `/api/unit-economics/derive`. `niem-yet` trả `null` vì bộ 31
 * ngưỡng không có dòng nào cho giai đoạn sau niêm yết.
 */
export const GIAI_DOAN_SANG_MA_CHUAN: Record<GiaiDoanVon, string | null> = {
  'hat-giong': 'seed',
  'vong-a': 'series_a',
  'vong-b': 'series_b',
  'tang-truong': 'growth',
  'tien-niem-yet': 'pre_ipo',
  'niem-yet': null,
};

/** Nhãn tiếng Việt của giai đoạn, dùng khi hiển thị. */
export const TEN_GIAI_DOAN: Record<GiaiDoanVon, string> = {
  'hat-giong': 'Hạt giống',
  'vong-a': 'Vòng A',
  'vong-b': 'Vòng B',
  'tang-truong': 'Tăng trưởng',
  'tien-niem-yet': 'Tiền niêm yết',
  'niem-yet': 'Niêm yết',
};

export const LO_TRINH_TAI_CHINH: MocTaiChinh[] = [
  // ══════════════════════ HẠT GIỐNG ══════════════════════
  {
    giai_doan: 'hat-giong',
    ma: 'hg-01',
    ten: 'Pháp nhân mở đúng, giấy phép con có TRƯỚC khi hoạt động',
    muc_tieu:
      'Ngành nghề ghi trong hồ sơ đăng ký phủ hết hoạt động đang làm thật, và mọi ngành có điều kiện đều đã cầm giấy phép con trước ngày phát sinh doanh thu đầu tiên.',
    ho_so_can: [
      'Giấy chứng nhận đăng ký doanh nghiệp',
      'Danh mục ngành nghề đã đăng ký, đối chiếu với danh mục hoạt động thực tế',
      'Giấy phép con của ngành có điều kiện (an toàn thực phẩm, phòng cháy chữa cháy, môi trường, khám chữa bệnh… tuỳ ngành)',
    ],
    chi_so_chan: [],
    rui_ro:
      'Vừa làm vừa xin giấy phép: bị đình chỉ hoạt động và phạt hành chính, còn khi thẩm định vòng vốn sau này thì lộ ra cấu trúc pháp nhân không sạch — một trong ba tiêu chí pháp lý của bộ chấm sẵn sàng niêm yết.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · B02 Vòng đời pháp lý doanh nghiệp, chặng "Trước khi mở"; danh mục chu kỳ giấy phép ở B07 mục 1',
  },
  {
    giai_doan: 'hat-giong',
    ma: 'hg-02',
    ten: 'Xong nghĩa vụ 30 ngày đầu',
    muc_tieu:
      'Trong 30 ngày kể từ khi bắt đầu hoạt động: đã công bố nội dung đăng ký doanh nghiệp, đã khai trình sử dụng lao động, đã đăng ký thuế và hoá đơn điện tử.',
    ho_so_can: [
      'Xác nhận công bố nội dung đăng ký doanh nghiệp',
      'Bản khai trình sử dụng lao động (nếu có thuê người)',
      'Hồ sơ đăng ký thuế và đăng ký sử dụng hoá đơn điện tử',
    ],
    chi_so_chan: [],
    rui_ro:
      'Quá hạn là phạt tự động, không cần ai kiện. Nặng hơn: chưa có hoá đơn điện tử thì doanh thu không có dấu vết bên thứ ba, sau này mọi con số đều dừng ở mức 1 — tự khai.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · B02 chặng "30 ngày đầu"; thang kiểm chứng dữ liệu ở A01 mục 4',
  },
  {
    giai_doan: 'hat-giong',
    ma: 'hg-03',
    ten: 'Mô hình kinh doanh đóng khung và đã qua hội đồng thẩm định',
    muc_tieu:
      'Mô hình kinh doanh có ít nhất 5 trong 9 khối đã điền nội dung thật, và đã chạy qua một phiên hội đồng thẩm định có biên bản.',
    ho_so_can: [
      'Bản mô hình kinh doanh 9 khối',
      'Biên bản phiên hội đồng thẩm định kèm điểm và phần phản biện',
    ],
    chi_so_chan: [],
    rui_ro:
      'Không đóng khung mô hình thì mọi con số kế hoạch phía sau đều là số bịa theo cảm tính, và cuộc gọi vốn đầu tiên sẽ tắc ngay ở câu hỏi "anh kiếm tiền bằng cách nào".',
    nguon: 'Gói tri thức ZeniIPO FULL v1 · A02 mục 1, bước 1 "Ý tưởng & Mô hình kinh doanh" — cổng qua bước',
  },
  {
    giai_doan: 'hat-giong',
    ma: 'hg-04',
    ten: 'Quy mô thị trường có nguồn và tín hiệu khách thật',
    muc_tieu:
      'Có con số TAM/SAM/SOM dẫn được nguồn, kèm ít nhất 3 tín hiệu thị trường đã ghi nhận từ khách thật chứ không phải phỏng đoán.',
    ho_so_can: [
      'Bản tính TAM/SAM/SOM ghi rõ nguồn và cách tính từng tầng',
      'Ít nhất 3 tín hiệu khách thật có bằng chứng: thư quan tâm, đơn hàng thử, danh sách chờ, biên bản phỏng vấn khách',
    ],
    chi_so_chan: [],
    rui_ro:
      'Quy mô thị trường lấy từ một bài báo rồi nhân lên là lỗi bị bắt ngay ở vòng thẩm định đầu tiên; mất uy tín cho toàn bộ phần còn lại của hồ sơ.',
    nguon: 'Gói tri thức ZeniIPO FULL v1 · A02 mục 1, bước 2 "Kiểm chứng thị trường" — cổng qua bước',
  },
  {
    giai_doan: 'hat-giong',
    ma: 'hg-05',
    ten: 'Ba tháng số liệu tài chính liên tục theo hệ 13 mã tài khoản',
    muc_tieu:
      'Có báo cáo kết quả kinh doanh 3 tháng liên tục, mọi dòng đều gắn một trong 13 mã tài khoản bắt buộc, không còn dòng "chi phí khác" thả nổi.',
    ho_so_can: [
      'Báo cáo kết quả kinh doanh 3 tháng liên tục theo hệ 13 mã (5111, 5113, 521, 632, 6411, 6417, 6421, 6427, 635, 515, 711, 811, 821)',
      'Sao kê ngân hàng cùng kỳ để đối chiếu',
      'Bảng thuế suất có ngày hiệu lực dùng cho dòng 821',
    ],
    chi_so_chan: [],
    rui_ro:
      'Kế hoạch và sổ thật dùng hai hệ mã khác nhau thì vĩnh viễn không so được kế hoạch với thực tế từng đồng — đây là điều kiện tiên quyết để ngân hàng và quỹ tin số liệu.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A03 mục 1 (13 mã tài khoản bắt buộc) và mục 2 (chuỗi EBITDA → EBT → thuế); cổng bước 3 ở A02 mục 1',
  },
  {
    giai_doan: 'hat-giong',
    ma: 'hg-06',
    ten: 'Kinh tế đơn vị đo được và đạt chuẩn hạt giống',
    muc_tieu:
      'Tính được CAC và LTV từ số liệu tháng, LTV tính trên biên gộp chứ không phải doanh thu, và cả hai chỉ số chặn đều đạt ngưỡng giai đoạn hạt giống.',
    ho_so_can: [
      'Bảng tính CAC theo kỳ: toàn bộ chi phí bán hàng và marketing chia số khách mới',
      'Bảng tính LTV ghi rõ đã nhân biên gộp và chia tỷ lệ rời bỏ tháng',
      'Bảng theo dõi khách hoạt động, khách mới, khách rời theo tháng',
    ],
    chi_so_chan: ['ltv_cac_ratio', 'cac_payback_months'],
    rui_ro:
      'Tính LTV trên doanh thu thay vì biên gộp làm LTV phồng lên nhiều lần, kéo theo mọi quyết định chi marketing đều sai — kho tri thức ghi đây là lỗi phổ biến nhất khi doanh nghiệp tự tính.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A04 mục 1 (16 công thức, phần lưu ý phương pháp về LTV) và mục 2 (ngưỡng giai đoạn Hạt giống: LTV:CAC ≥3 · hoàn vốn khách ≤18 tháng)',
  },
  {
    giai_doan: 'hat-giong',
    ma: 'hg-07',
    ten: 'Tiền đủ sống 12 tháng, mở vòng gọi vốn khi còn ít nhất 9 tháng',
    muc_tieu:
      'Số tháng sống đạt ngưỡng hạt giống, và trong kế hoạch tiền mặt đã ấn định mốc bắt đầu gọi vốn khi số dư còn nuôi được ít nhất 9 tháng.',
    ho_so_can: [
      'Bảng tiền mặt theo tháng, nối liền kỳ (số dư cuối tháng này bằng số dư đầu tháng sau)',
      'Bảng tính đốt tiền trung bình 3 tháng gần nhất',
      'Bảng nhu cầu vốn cho vòng tới: đốt tiền × (số tháng sàn + đệm) − tiền hiện có',
    ],
    chi_so_chan: ['runway_months'],
    rui_ro:
      'Bắt đầu gọi vốn lúc sắp hết tiền là gọi ở thế yếu, định giá bị ép — và đó là lúc doanh nghiệp không còn quyền từ chối điều khoản xấu.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A03 mục 5 "Quy tắc khớp vốn" (nhắm 18 tháng sống sau khi nhận tiền, khởi động khi còn ≥9 tháng); ngưỡng Hạt giống ≥12 tháng ở A04 mục 2',
  },

  // ══════════════════════ VÒNG A ══════════════════════
  {
    giai_doan: 'vong-a',
    ma: 'va-01',
    ten: 'Một hệ sổ duy nhất, đối soát ngân hàng đều đặn hằng tháng',
    muc_tieu:
      'Doanh nghiệp chỉ còn một hệ sổ; mỗi tháng có biên bản đối soát sao kê ngân hàng với sổ, và không còn dòng sao kê tồn đọng chờ người chọn quá một kỳ.',
    ho_so_can: [
      'Sổ kế toán theo chuẩn mực kế toán Việt Nam, một hệ duy nhất',
      'Biên bản đối soát sao kê ngân hàng từng tháng, kèm tỷ lệ dòng đã khớp',
      'Danh sách kiểm tra trước khi khoá kỳ, đã ký cho từng kỳ',
    ],
    chi_so_chan: [],
    rui_ro:
      'Giữ nhiều hệ sổ vì lý do thuế là rào cản thật của hành trình vốn: quỹ và ngân hàng không tin số, thương vụ gãy đúng ở khâu thẩm định. Minh bạch hoá mất từ vài tháng đến hơn một năm, để đến lúc cần tiền mới làm là đã muộn.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 3 (đặc thù Việt Nam — nhiều hệ sổ) · A08 mục 6 (chuẩn hoá số liệu TRƯỚC khi cần tiền) · C09 trụ "Đối soát ngân hàng"',
  },
  {
    giai_doan: 'vong-a',
    ma: 'va-02',
    ten: 'Mô hình tài chính ba kịch bản, qua đủ bốn bất biến, có phân tích độ nhạy',
    muc_tieu:
      'Mô hình chạy qua cả bốn bất biến mà không vỡ; ba kịch bản cơ sở / lạc quan / thận trọng dùng chung một bộ giả định gốc; có bảng độ nhạy xếp hạng giả định nào ảnh hưởng lớn nhất tới EBITDA năm thứ ba.',
    ho_so_can: [
      'Mô hình tài chính có biên bản kiểm bốn bất biến: tổng 12 tháng bằng tổng năm · tiền nối liền kỳ · tiền là số nguyên đồng · giả định vô lý thì dừng chứ không tự sửa',
      'Ba kịch bản dựng từ cùng một bộ giả định gốc, chỉ khác tham số',
      'Bảng độ nhạy ±10% và ±20% cho từng giả định, xếp hạng theo mức ảnh hưởng',
    ],
    chi_so_chan: [],
    rui_ro:
      'Dựng ba mô hình rời rạc thay vì một bộ giả định gốc thì nhà đầu tư chỉ cần hỏi chéo hai câu là lộ; và bảng xếp hạng độ nhạy chính là danh sách rủi ro phải quản trị — không có nó thì không biết phải giữ chặt giả định nào.',
    nguon: 'Gói tri thức ZeniIPO FULL v1 · A03 mục 6 (bốn bất biến) và mục 7 (phân tích độ nhạy)',
  },
  {
    giai_doan: 'vong-a',
    ma: 'va-03',
    ten: 'Kinh tế đơn vị đạt chuẩn vòng A',
    muc_tieu:
      'Bốn chỉ số chặn của vòng A đều đạt ngưỡng trên số liệu tháng đã đối soát sổ, không phải số tự khai.',
    ho_so_can: [
      'Bảng chỉ số kinh tế đơn vị theo tháng, ghi kèm mức kiểm chứng của từng con số',
      'Bảng tính biên lợi nhuận gộp tách rõ giá vốn theo mã 632',
      'Bảng MRR mới / mở rộng / thu hẹp / mất theo tháng để tính tỷ số nhanh',
    ],
    chi_so_chan: ['ltv_cac_ratio', 'cac_payback_months', 'gross_margin_pct', 'quick_ratio'],
    rui_ro:
      'Cùng một con số nhưng ngưỡng đổi theo giai đoạn: LTV:CAC 3,2 đạt ở vòng A nhưng chưa đạt ở tăng trưởng. Không neo đúng giai đoạn khi chấm thì kết luận sai mà vẫn nghe có vẻ đúng.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A04 mục 2 (ngưỡng Vòng A: LTV:CAC ≥3 · hoàn vốn khách ≤15 tháng · biên gộp ≥60% · tỷ số nhanh ≥4) và mục 3 (cách chấm theo giai đoạn)',
  },
  {
    giai_doan: 'vong-a',
    ma: 'va-04',
    ten: 'Chứng minh được khách cũ tự bù phần rời bỏ',
    muc_tieu:
      'Giữ chân doanh thu ròng đạt ngưỡng vòng A, tính từ bảng MRR tách rõ bốn thành phần đầu kỳ, mở rộng, thu hẹp, mất.',
    ho_so_can: [
      'Bảng nhóm khách theo tháng ký hợp đồng (cohort) ít nhất 6 kỳ',
      'Bảng MRR tách bốn thành phần: đầu kỳ · mở rộng · thu hẹp · mất',
      'Danh sách khách rời kèm lý do đã ghi nhận',
    ],
    chi_so_chan: ['nrr_pct'],
    rui_ro:
      'Giữ chân dưới 100% nghĩa là cái thùng đang thủng: mọi đồng chi cho marketing chỉ để bù phần rò rỉ, càng tăng chi càng lỗ mà biểu đồ doanh thu vẫn đi lên nên rất dễ nhầm là đang tăng trưởng.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A04 mục 1 (công thức NRR) và mục 2 (ngưỡng Vòng A ≥100% — bằng 100% nghĩa là khách cũ tự bù phần rời bỏ)',
  },
  {
    giai_doan: 'vong-a',
    ma: 'va-05',
    ten: 'Đốt tiền có kỷ luật và đủ sống 18 tháng sau khi nhận tiền',
    muc_tieu:
      'Bội số đốt tiền và số tháng sống đều đạt ngưỡng vòng A; quy mô vòng gọi vốn đủ nuôi tới mốc kết quả tiếp theo cộng đệm an toàn.',
    ho_so_can: [
      'Bảng tính bội số đốt tiền: đốt ròng năm hoá chia phần ARR ròng tăng thêm',
      'Kế hoạch tiền mặt 18 tháng sau ngày nhận tiền dự kiến',
      'Bản mô tả mốc kết quả mà vòng vốn này phải đưa doanh nghiệp tới',
    ],
    chi_so_chan: ['burn_multiple', 'runway_months'],
    rui_ro:
      'Gọi một vòng không đủ nuôi tới mốc kết quả tiếp theo thì 12 tháng sau lại phải gọi tiếp trong khi chưa có gì mới để kể — vòng đó gần như chắc chắn bị ép định giá.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A03 mục 5 (quy tắc khớp vốn) · A04 mục 2 (ngưỡng Vòng A: bội số đốt tiền ≤2 · số tháng sống ≥18)',
  },
  {
    giai_doan: 'vong-a',
    ma: 'va-06',
    ten: 'Bảng cổ đông tính đủ pha loãng các vòng sau',
    muc_tieu:
      'Có bảng cổ đông trước và sau đầu tư, kèm bảng tính tỷ lệ sở hữu điều chỉnh theo pha loãng dự kiến của các vòng tiếp theo.',
    ho_so_can: [
      'Bảng cổ đông trước đầu tư và sau đầu tư',
      'Bản điều khoản đầu tư đã ký',
      'Bảng tính pha loãng các vòng sau (thực hành phổ biến: khoảng 25%) và tỷ lệ sở hữu điều chỉnh tương ứng',
    ],
    chi_so_chan: [],
    rui_ro:
      'Quỹ luôn tính phần pha loãng các vòng sau; người sáng lập không tính thì sau hai vòng mới phát hiện mình đã mất quyền kiểm soát — lúc đó không sửa được nữa.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A05 mục 3 (phương pháp quỹ mạo hiểm — công thức tỷ lệ sở hữu điều chỉnh và mức pha loãng mặc định)',
  },
  {
    giai_doan: 'vong-a',
    ma: 'va-07',
    ten: 'Có người thật sự sở hữu số tài chính',
    muc_tieu:
      'Ghế giám đốc tài chính hoặc trưởng phòng tài chính đã có người, và người đó được ghi rõ là chủ sở hữu của biên gộp, EBITDA, đốt tiền ròng, số tháng sống và vòng quay tiền.',
    ho_so_can: [
      'Sơ đồ tổ chức ghi rõ ghế và người đang ngồi',
      'Bản mô tả quyền quyết định của ghế tài chính: duyệt chi vượt ngân sách, chốt chính sách kế toán, chọn kiểm toán độc lập, quan hệ ngân hàng',
      'Bảng phân công chỉ số: mỗi chỉ số tài chính có đúng một người chịu trách nhiệm',
    ],
    chi_so_chan: [],
    rui_ro:
      'Không ai sở hữu số tài chính thì cải thiện chỉ số không bền, và khi thẩm định nhà đầu tư sẽ kết luận công ty phụ thuộc người sáng lập — yếu tố làm giảm bội số định giá.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A06 mục 2 (12 ghế lãnh đạo, cột "xuất hiện từ bước" — ghế tài chính xuất hiện từ bước 3) · A05 mục 5 (yếu tố giảm bội số)',
  },

  // ══════════════════════ VÒNG B ══════════════════════
  {
    giai_doan: 'vong-b',
    ma: 'vb-01',
    ten: 'Công ty chạy bằng quy trình, không bằng trí nhớ người sáng lập',
    muc_tieu:
      'Các việc lặp lại đã có quy trình chuẩn ban hành, và hệ mục tiêu đang vận hành thật với chu kỳ rà soát cố định.',
    ho_so_can: [
      'Bộ quy trình chuẩn cho các việc lặp lại, có ngày ban hành và người sở hữu',
      'Bảng mục tiêu đang chạy theo chu kỳ, kèm biên bản rà soát định kỳ',
      'Báo cáo độ phủ quy trình: bao nhiêu phần công việc lặp lại đã được chuẩn hoá',
    ],
    chi_so_chan: [],
    rui_ro:
      'Mở rộng khi chưa chuẩn hoá quy trình thì chi phí đơn vị tăng theo quy mô thay vì giảm — đúng chiều ngược với thứ nhà đầu tư vòng B bỏ tiền để mua.',
    nguon: 'Gói tri thức ZeniIPO FULL v1 · A02 mục 1, bước 5 "Mở rộng & hệ thống" — cổng qua bước',
  },
  {
    giai_doan: 'vong-b',
    ma: 'vb-02',
    ten: 'Kinh tế đơn vị siết theo chuẩn vòng B',
    muc_tieu:
      'Ba chỉ số chặn của vòng B đều đạt ngưỡng đã siết cao hơn vòng A, chứng minh hiệu quả TĂNG theo quy mô chứ không loãng đi.',
    ho_so_can: [
      'Bảng chỉ số kinh tế đơn vị 12 tháng gần nhất, so ngưỡng theo đúng giai đoạn',
      'Bản giải trình xu hướng biên gộp theo quy mô',
    ],
    chi_so_chan: ['ltv_cac_ratio', 'cac_payback_months', 'gross_margin_pct'],
    rui_ro:
      'Giữ nguyên chỉ số của vòng A rồi coi là đã đạt: ngưỡng vòng B cao hơn (LTV:CAC ≥3,5 · hoàn vốn ≤12 tháng · biên gộp ≥65%), nên cùng một con số có thể vừa đạt ở vòng trước vừa trượt ở vòng này.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A04 mục 2 (ngưỡng Vòng B) và mục 3 (cùng một con số, kết luận khác nhau theo giai đoạn)',
  },
  {
    giai_doan: 'vong-b',
    ma: 'vb-03',
    ten: 'Giữ chân đo hai chiều: ròng và gộp',
    muc_tieu:
      'Cả giữ chân doanh thu ròng lẫn giữ chân doanh thu gộp đều đạt ngưỡng vòng B, nghĩa là phần bán thêm không còn dùng để che mức rò rỉ thật.',
    ho_so_can: [
      'Bảng giữ chân doanh thu ròng và gộp theo tháng, tính riêng',
      'Bảng phân tích rời bỏ theo nhóm khách và theo gói dịch vụ',
    ],
    chi_so_chan: ['nrr_pct', 'grr_pct'],
    rui_ro:
      'Chỉ đo giữ chân ròng sẽ giấu mất mức rò rỉ thuần: bán thêm cho vài khách lớn có thể kéo chỉ số ròng lên trên 110% trong khi khách nhỏ đang rời hàng loạt. Khách doanh nghiệp lớn còn nên đạt giữ chân gộp ≥90%.',
    nguon: 'Gói tri thức ZeniIPO FULL v1 · A04 mục 1 (công thức NRR và GRR) và mục 2 (ngưỡng Vòng B)',
  },
  {
    giai_doan: 'vong-b',
    ma: 'vb-04',
    ten: 'Chứng minh tiền bán hàng đẩy được doanh thu trước khi tăng chi',
    muc_tieu:
      'Hệ số kỳ diệu đạt ngưỡng vòng B — mới được phép tăng ngân sách bán hàng.',
    ho_so_can: [
      'Bảng tính hệ số kỳ diệu theo quý: chênh doanh thu hai kỳ nhân 4 chia chi phí bán hàng kỳ trước',
      'Bảng chi phí bán hàng tách khỏi chi phí marketing thương hiệu',
    ],
    chi_so_chan: ['magic_number'],
    rui_ro:
      'Tăng chi bán hàng khi hệ số kỳ diệu còn dưới ngưỡng là đổ thêm tiền vào một cỗ máy chưa chạy — đốt nhanh hơn mà doanh thu không theo kịp.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A04 mục 2 (ngưỡng Vòng B: hệ số kỳ diệu ≥0,75 — đạt ngưỡng này mới nên tăng chi bán hàng)',
  },
  {
    giai_doan: 'vong-b',
    ma: 'vb-05',
    ten: 'Cân bằng tăng trưởng với lợi nhuận, đốt tiền hiệu quả hơn vòng trước',
    muc_tieu:
      'Quy tắc 40 đạt ngưỡng, bội số đốt tiền siết xuống mức vòng B, và số tháng sống vẫn giữ trên ngưỡng an toàn.',
    ho_so_can: [
      'Bảng tính quy tắc 40: tăng trưởng phần trăm cộng biên EBITDA phần trăm',
      'Bảng đốt tiền ròng năm hoá và ARR ròng tăng thêm theo quý',
      'Kế hoạch tiền mặt cập nhật hằng tháng',
    ],
    chi_so_chan: ['rule_of_40', 'burn_multiple', 'runway_months'],
    rui_ro:
      'Mua tăng trưởng bằng cách đốt thêm tiền sẽ kéo bội số đốt tiền vượt 1,5 — nhà đầu tư vòng sau đọc ra ngay rằng tăng trưởng này không tự nuôi được.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A04 mục 2 (ngưỡng Vòng B: quy tắc 40 ≥40 · bội số đốt tiền ≤1,5 · số tháng sống ≥18)',
  },
  {
    giai_doan: 'vong-b',
    ma: 'vb-06',
    ten: 'Kiểm soát nội bộ: tách vai, duyệt chi theo hạn mức, sổ bất biến',
    muc_tieu:
      'Không một người nào vừa tạo vừa duyệt cùng một giao dịch trọng yếu; khoản chi lớn đi qua nhiều lớp phê duyệt; bút toán đã ghi sổ là bất biến và mọi thay đổi để lại dấu vết nối chuỗi.',
    ho_so_can: [
      'Bảng phân tách nhiệm vụ: kế toán · thủ kho · nhân sự · người duyệt chi · kiểm toán nội bộ chỉ đọc',
      'Chính sách duyệt chi theo ba hạn mức, đã ban hành',
      'Nhật ký thay đổi bút toán nối chuỗi bằng mã băm, kiểm được tính liên tục',
    ],
    chi_so_chan: [],
    rui_ro:
      'Người vừa ghi sổ vừa duyệt chi cho chính bút toán mình tạo là lỗ hổng kiểm soát kinh điển; kiểm toán trước niêm yết sẽ nêu thành phát hiện, và vá lúc đó tốn hơn nhiều so với làm từ vòng B.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · C07 mục 1 (ba hạn mức duyệt chi) · mục 2 (phân tách nhiệm vụ) · mục 3 (khoá kỳ và dấu vết kiểm toán)',
  },
  {
    giai_doan: 'vong-b',
    ma: 'vb-07',
    ten: 'Lịch tuân thủ sạch, không còn mốc quá hạn',
    muc_tieu:
      'Toàn bộ nghĩa vụ định kỳ đã lên lịch có người chịu trách nhiệm, và tại thời điểm rà soát không còn mốc nào quá hạn, không giấy phép con nào hết hiệu lực.',
    ho_so_can: [
      'Lịch nghĩa vụ cả năm: khai thuế giá trị gia tăng và thu nhập cá nhân, tạm nộp thuế thu nhập doanh nghiệp theo quý, bảo hiểm xã hội hằng tháng, kinh phí công đoàn, báo cáo lao động hai kỳ, quyết toán năm, nộp báo cáo tài chính năm',
      'Danh mục giấy phép con kèm ngày hết hạn và chu kỳ gia hạn',
      'Danh mục giấy uỷ quyền còn hiệu lực, có cơ chế thu hồi khi hết hạn',
    ],
    chi_so_chan: [],
    rui_ro:
      'Quên nghĩa vụ định kỳ là bị phạt chậm nộp tự động. Nguy hiểm hơn tiền phạt: giấy uỷ quyền hết hạn chưa thu hồi để người không còn thẩm quyền tiếp tục ký thay công ty, và giấy phép con quá hạn có thể bị đình chỉ hoạt động.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · C02 mục 1 (bảng nghĩa vụ đầy đủ theo sắc thuế) · B07 mục 2 (lịch nghĩa vụ định kỳ) · B09 mục 1 và mục 4 (bốn trụ theo dõi và thứ tự vá theo mức hậu quả không đảo ngược được)',
  },

  // ══════════════════════ TĂNG TRƯỞNG ══════════════════════
  {
    giai_doan: 'tang-truong',
    ma: 'tt-01',
    ten: 'Vòng quay tiền mặt trong chuẩn',
    muc_tieu:
      'Vòng quay tiền mặt đạt ngưỡng giai đoạn tăng trưởng, tính từ ngày phải thu cộng ngày tồn kho trừ ngày phải trả trên số liệu sổ thật.',
    ho_so_can: [
      'Bảng ngày phải thu, ngày tồn kho, ngày phải trả theo tháng',
      'Bảng tuổi nợ phải thu theo khách hàng',
      'Chính sách công nợ đã ban hành: hạn mức, thời hạn, cơ chế nhắc nợ',
    ],
    chi_so_chan: ['ccc_days'],
    rui_ro:
      'Doanh nghiệp có lãi vẫn chết vì hết tiền: lãi nằm trên giấy còn tiền nằm ở phải thu và kho. Mở rộng nhanh với vòng tiền dài là cách đốt sạch tiền vòng vốn vừa nhận mà báo cáo kết quả kinh doanh vẫn đẹp.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A03 mục 4 (dòng tiền gián tiếp và vốn lưu động) · A04 mục 2 (ngưỡng Tăng trưởng: vòng quay tiền mặt ≤45 ngày)',
  },
  {
    giai_doan: 'tang-truong',
    ma: 'tt-02',
    ten: 'Hiệu quả thu khách đạt mức đòi hỏi cao hơn',
    muc_tieu:
      'LTV:CAC và thời gian hoàn vốn khách đạt ngưỡng giai đoạn tăng trưởng, đo trên số liệu đã đối soát sổ.',
    ho_so_can: [
      'Bảng kinh tế đơn vị 12 tháng gần nhất kèm mức kiểm chứng từng con số',
      'Bảng tách CAC theo kênh để biết kênh nào đang kéo chỉ số xuống',
    ],
    chi_so_chan: ['ltv_cac_ratio', 'cac_payback_months'],
    rui_ro:
      'Giai đoạn này ngưỡng LTV:CAC nâng lên ≥4; giữ nguyên mức 3,5 của vòng B rồi tưởng đã đạt là kết luận sai — cùng con số đó trượt chuẩn tăng trưởng.',
    nguon: 'Gói tri thức ZeniIPO FULL v1 · A04 mục 2 (ngưỡng Tăng trưởng: LTV:CAC ≥4 · hoàn vốn khách ≤12 tháng)',
  },
  {
    giai_doan: 'tang-truong',
    ma: 'tt-03',
    ten: 'Giữ quy tắc 40 qua suốt chu kỳ mở rộng',
    muc_tieu:
      'Tổng tăng trưởng phần trăm cộng biên EBITDA phần trăm đạt ngưỡng, duy trì qua ít nhất bốn quý liên tiếp chứ không phải một quý đẹp.',
    ho_so_can: [
      'Bảng quy tắc 40 theo quý, ít nhất bốn quý liên tiếp',
      'Bản giải trình quý nào lệch và vì sao',
    ],
    chi_so_chan: ['rule_of_40'],
    rui_ro:
      'Đạt quy tắc 40 một quý rồi trượt ngay quý sau cho thấy chỉ số đến từ một sự kiện bất thường. Nhà đầu tư giai đoạn này mua tính bền của nhịp tăng, không mua một quý.',
    nguon: 'Gói tri thức ZeniIPO FULL v1 · A04 mục 2 (ngưỡng Tăng trưởng: quy tắc 40 ≥40 — chuẩn vàng công ty phần mềm)',
  },
  {
    giai_doan: 'tang-truong',
    ma: 'tt-04',
    ten: 'Năm kiểm toán độc lập đầu tiên trong chuỗi hai năm',
    muc_tieu:
      'Có báo cáo tài chính năm đã được một công ty kiểm toán độc lập kiểm toán, kèm thư quản lý và kế hoạch khắc phục cho từng phát hiện.',
    ho_so_can: [
      'Báo cáo tài chính năm đã kiểm toán',
      'Thư quản lý của đơn vị kiểm toán',
      'Danh sách phát hiện kiểm toán kèm người chịu trách nhiệm và hạn khắc phục',
    ],
    chi_so_chan: [],
    rui_ro:
      'Niêm yết trong nước đòi hỏi báo cáo tài chính kiểm toán hai năm LIÊN TIẾP. Bắt đầu kiểm toán muộn là tự đẩy ngày đủ điều kiện nộp hồ sơ ra xa ít nhất hai năm, bất kể các chỉ số khác tốt đến đâu.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 3 (bộ lọc cứng Việt Nam: kiểm toán 2 năm liên tiếp, ROE dương, hết lỗ luỹ kế) · A02 mục 2 (tiêu chí kiểm toán, trọng số 2,0 trên thang 100)',
  },
  {
    giai_doan: 'tang-truong',
    ma: 'tt-05',
    ten: 'Đủ ghế lãnh đạo có chủ, không còn mảng vô chủ',
    muc_tieu:
      'Mọi khối chức năng đang vận hành đều có một ghế được định nghĩa và một người ngồi; riêng ghế tài chính, vận hành, nhân sự và pháp chế phải có người trước khi bước vào giai đoạn thể chế hoá.',
    ho_so_can: [
      'Sơ đồ tổ chức đối chiếu với 12 khối chức năng, đánh dấu khối nào chưa có chủ',
      'Bảng quyền quyết định của từng ghế',
      'Khung năng lực cho các ghế then chốt, chấm theo bốn cấp độ',
    ],
    chi_so_chan: [],
    rui_ro:
      'Đến bước vốn và kỷ luật tài chính mà chưa có ai sở hữu số tài chính, hoặc bước thể chế mà chưa có pháp chế và quản trị, thì đó là lỗ hổng tổ chức phải chỉ ra ngay — thẩm định sẽ quy thành rủi ro phụ thuộc người sáng lập và ép giảm bội số.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A06 mục 1 (12 khối chức năng) và mục 2 (12 ghế, cột "xuất hiện từ bước" và cách dùng cột đó)',
  },
  {
    giai_doan: 'tang-truong',
    ma: 'tt-06',
    ten: 'Chiến lược vốn khớp nhu cầu tiền',
    muc_tieu:
      'Biên gộp dương, và kế hoạch vốn chứng minh được là vòng đang mở đủ bù nhu cầu tiền tới mốc kết quả tiếp theo.',
    ho_so_can: [
      'Bảng nhu cầu vốn theo tháng, đối chiếu với tiến độ vòng đang mở',
      'Bản đối chiếu bốn kênh vốn: tín dụng ngân hàng · vốn cổ phần tư nhân · vốn chiến lược · thị trường đại chúng, kèm lý do chọn kênh',
      'Hồ sơ vay chuẩn hoá nếu chọn kênh tín dụng',
    ],
    chi_so_chan: [],
    rui_ro:
      'Mặc định đẩy sang gọi vốn cổ phần trong khi thứ doanh nghiệp cần là hồ sơ vay chuẩn hoá: vốn cổ phần là tiền đắt nhất vì bán đi quyền sở hữu vĩnh viễn, còn tín dụng ngân hàng mới là kênh lớn nhất của doanh nghiệp vừa và nhỏ Việt Nam.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 1, bước 6 "Vốn & kỷ luật tài chính" — cổng qua bước · A08 mục 1 (bốn kênh vốn và thứ tự tư vấn đúng). Bộ 31 ngưỡng KHÔNG có ngưỡng số tháng sống cho giai đoạn tăng trưởng nên không đặt chỉ số chặn ở đây',
  },
  {
    giai_doan: 'tang-truong',
    ma: 'tt-07',
    ten: 'Đấu nối nguồn dữ liệu bên thứ ba, số liệu lên mức 3',
    muc_tieu:
      'Doanh thu và dòng tiền được xác thực bằng nguồn bên thứ ba (sao kê ngân hàng, hoá đơn điện tử) chứ không dừng ở sổ nội bộ.',
    ho_so_can: [
      'Biên bản đấu nối nguồn dữ liệu: sao kê ngân hàng, hoá đơn điện tử',
      'Báo cáo đối soát giữa doanh thu sổ và doanh thu theo hoá đơn điện tử',
      'Bảng ghi mức kiểm chứng cho từng chỉ số đang công bố',
    ],
    chi_so_chan: [],
    rui_ro:
      'Số liệu dừng ở mức tự khai hoặc mới đối soát sổ thì ngân hàng và quỹ vẫn phải tự thẩm tra lại từ đầu, kéo dài thời gian thẩm định và cho họ cớ để chiết khấu định giá.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A01 mục 4 (thang ba mức kiểm chứng dữ liệu) · A09 mục 3 bước 2 (đấu nối nguồn tự động để số liệu không phụ thuộc thiện chí nhập tay)',
  },

  // ══════════════════════ TIỀN NIÊM YẾT ══════════════════════
  {
    giai_doan: 'tien-niem-yet',
    ma: 'tnl-01',
    ten: 'Qua bộ lọc cứng của niêm yết trong nước',
    muc_tieu:
      'Có báo cáo tài chính kiểm toán hai năm liên tiếp, tỷ suất lợi nhuận trên vốn chủ dương, và không còn lỗ luỹ kế trên bảng cân đối.',
    ho_so_can: [
      'Báo cáo tài chính đã kiểm toán hai năm liên tiếp',
      'Bảng tính tỷ suất lợi nhuận trên vốn chủ hai năm',
      'Bảng cân đối kế toán thể hiện lỗ luỹ kế đã xử lý xong',
      'Bản đánh giá chi phí và thời gian chuyển đổi hoặc đối chiếu sang chuẩn báo cáo quốc tế, nếu nhắm vốn quốc tế',
    ],
    chi_so_chan: [],
    rui_ro:
      'Đây là bộ lọc cứng, không thương lượng được: còn lỗ luỹ kế thì chưa cần bàn tới bất cứ việc gì khác của lộ trình niêm yết.',
    nguon: 'Gói tri thức ZeniIPO FULL v1 · A02 mục 3 (đặc thù Việt Nam — điều kiện niêm yết trong nước)',
  },
  {
    giai_doan: 'tien-niem-yet',
    ma: 'tnl-02',
    ten: 'Quản trị công ty chuẩn niêm yết',
    muc_tieu:
      'Hội đồng quản trị có ít nhất 3 thành viên độc lập, uỷ ban kiểm toán đã lập, sổ tay quản trị đã ký ban hành và chính sách chống giao dịch nội gián đang hiệu lực.',
    ho_so_can: [
      'Danh sách thành viên hội đồng quản trị, ghi rõ thành viên độc lập',
      'Quyết định thành lập uỷ ban kiểm toán và quy chế hoạt động',
      'Sổ tay quản trị công ty đã ký ban hành',
      'Chính sách chống giao dịch nội gián kèm danh sách người nội bộ',
      'Tập nghị quyết hội đồng quản trị và biên bản họp theo từng kỳ',
    ],
    chi_so_chan: [],
    rui_ro:
      'Quản trị và pháp lý là hai trụ hay bị bỏ quên nhất nhưng lại là hai trụ làm gãy thương vụ ở khâu thẩm định: bên mua sẽ hỏi ai đã phê duyệt những quyết định lớn ba năm qua, và không có nghị quyết thì không có câu trả lời.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 2 (nhóm Quản trị, tổng trọng số 4,0 trên thang 100) · A09 mục 2 và mục 3 (thứ tự vá trụ)',
  },
  {
    giai_doan: 'tien-niem-yet',
    ma: 'tnl-03',
    ten: 'Pháp lý sạch trước khi mở phòng dữ liệu',
    muc_tieu:
      'Cấu trúc pháp nhân đã dọn sạch, danh mục sở hữu trí tuệ rà soát xong, toàn bộ tranh chấp và kiện tụng đã được công bố đầy đủ.',
    ho_so_can: [
      'Sơ đồ cấu trúc pháp nhân hiện hành kèm bản giải trình các pháp nhân liên quan',
      'Báo cáo rà soát danh mục sở hữu trí tuệ: nhãn hiệu, mã nguồn, quyền tác giả và căn cứ sở hữu với phần do nhân sự hoặc đối tác tạo ra',
      'Danh sách tranh chấp, kiện tụng, khiếu nại kèm trạng thái và thời hiệu còn lại',
    ],
    chi_so_chan: [],
    rui_ro:
      'Quyền sở hữu mã nguồn hoặc tài sản trí tuệ không ghi rõ trong hợp đồng là rủi ro nổ đúng lúc thẩm định. Nặng hơn: vụ việc để quá thời hiệu khởi kiện là mất quyền vĩnh viễn, không khắc phục được bằng tiền.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 2 (nhóm Pháp lý, tổng trọng số 3,5) · B07 mục 3 (bẫy nghề sở hữu mã nguồn) · B09 mục 4 (ưu tiên theo mức hậu quả không đảo ngược được)',
  },
  {
    giai_doan: 'tien-niem-yet',
    ma: 'tnl-04',
    ten: 'Phòng dữ liệu đầy đủ và điểm sẵn sàng đạt ngưỡng nộp hồ sơ',
    muc_tieu:
      'Phòng dữ liệu có đủ các nhóm tài liệu và điểm sẵn sàng niêm yết đạt ngưỡng mới nên nộp hồ sơ.',
    ho_so_can: [
      'Phòng dữ liệu phân nhóm: tài chính · pháp lý · thương mại · nhân sự · công nghệ · quản trị',
      'Bảng chấm 20 tiêu chí sẵn sàng niêm yết có trọng số, quy về thang 100',
      'Nhật ký truy cập phòng dữ liệu và cơ chế phân quyền theo từng nhà đầu tư',
    ],
    chi_so_chan: ['ipo_readiness_score'],
    rui_ro:
      'Nộp hồ sơ khi điểm sẵn sàng còn dưới ngưỡng thì rủi ro bị trả hồ sơ, tốn phí tư vấn và mất uy tín với thị trường — mất uy tín là phần không mua lại được bằng tiền.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 2 (20 tiêu chí có trọng số, ngưỡng ≥85/100) · A04 mục 2 (ngưỡng điểm sẵn sàng niêm yết ở giai đoạn Tiền niêm yết)',
  },
  {
    giai_doan: 'tien-niem-yet',
    ma: 'tnl-05',
    ten: 'Chất lượng tăng trưởng chịu được soi của ngân hàng đầu tư',
    muc_tieu:
      'Bảy chỉ số chặn của giai đoạn tiền niêm yết đều đạt ngưỡng trên số liệu đã kiểm toán, không phải số quản trị nội bộ.',
    ho_so_can: [
      'Bảng chỉ số kinh tế đơn vị dựng từ số liệu đã kiểm toán, ít nhất tám quý',
      'Bản đối chiếu giữa số quản trị nội bộ và số đã kiểm toán, giải trình mọi chênh lệch',
      'Bộ nhóm công ty so sánh dùng cho phần câu chuyện tăng trưởng',
    ],
    chi_so_chan: [
      'ltv_cac_ratio',
      'cac_payback_months',
      'gross_margin_pct',
      'nrr_pct',
      'grr_pct',
      'rule_of_40',
      'burn_multiple',
    ],
    rui_ro:
      'Ngân hàng đầu tư soi kỹ chất lượng tăng trưởng chứ không chỉ tốc độ: biên gộp dưới 70%, giữ chân ròng dưới 120% hay bội số đốt tiền trên 1 đều thành lý do chiết khấu định giá ngay trong lần trình đầu tiên.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A04 mục 2 (toàn bộ ngưỡng giai đoạn Tiền niêm yết) · A05 mục 5 (yếu tố thực chiến làm tăng hoặc giảm bội số)',
  },
  {
    giai_doan: 'tien-niem-yet',
    ma: 'tnl-06',
    ten: 'Bộ tài liệu công bố đã soạn xong',
    muc_tieu:
      'Bản cáo bạch, phần thảo luận và phân tích của ban điều hành, và khung công bố phát triển bền vững đều đã soạn xong và qua rà soát pháp lý.',
    ho_so_can: [
      'Bản cáo bạch bản thảo đã qua rà soát',
      'Thảo luận và phân tích của ban điều hành',
      'Khung công bố phát triển bền vững theo một chuẩn công bố được thừa nhận',
      'Khung quản trị rủi ro doanh nghiệp và hợp đồng bảo hiểm trách nhiệm lãnh đạo',
    ],
    chi_so_chan: [],
    rui_ro:
      'Riêng bản cáo bạch đã chiếm trọng số 2,0 trên thang 100 của bộ chấm sẵn sàng; để tới phút chót mới soạn thì vừa trễ lịch phát hành vừa kéo tụt điểm sẵn sàng xuống dưới ngưỡng nộp.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 2 (nhóm Công bố, tổng trọng số 4,0; nhóm Rủi ro 1,5)',
  },
  {
    giai_doan: 'tien-niem-yet',
    ma: 'tnl-07',
    ten: 'Khoảng định giá dựng từ nhiều phương pháp độc lập',
    muc_tieu:
      'Có một KHOẢNG định giá dựng từ ít nhất hai phương pháp độc lập, liệt kê đủ giả định, kèm nhóm công ty so sánh và bản nêu rõ giả định nào ảnh hưởng lớn nhất.',
    ho_so_can: [
      'Bản định giá theo so sánh thị trường, dùng trung vị bội số và có chiết khấu thanh khoản cho công ty chưa niêm yết',
      'Bản định giá theo chiết khấu dòng tiền, kèm kiểm tra sức khoẻ tỷ trọng giá trị cuối kỳ',
      'Danh sách toàn bộ giả định: tăng trưởng, chi phí vốn, bội số, chiết khấu, pha loãng',
      'Bộ nhóm công ty so sánh kèm lý do chọn',
    ],
    chi_so_chan: [],
    rui_ro:
      'Đưa đúng một con số chắc nịch mà không nêu giả định là dấu hiệu hoặc đang bán hàng hoặc chưa hiểu nghề. Hai bẫy kỹ thuật hay gặp: lấy bội số công ty niêm yết nước ngoài áp thẳng cho doanh nghiệp Việt Nam chưa niêm yết, và mô hình chiết khấu dòng tiền có giá trị cuối kỳ chiếm trên 75% tổng giá trị.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A05 mục 1 (so sánh thị trường, chiết khấu thanh khoản) · mục 2 (chiết khấu dòng tiền, điều kiện bắt buộc và kiểm tra sức khoẻ) · mục 4 (cách trình bày kết quả)',
  },
  {
    giai_doan: 'tien-niem-yet',
    ma: 'tnl-08',
    ten: 'Đội ngũ và hạ tầng vận hành đủ chuẩn công ty đại chúng',
    muc_tieu:
      'Ghế giám đốc tài chính do người đủ năng lực công ty đại chúng đảm nhiệm, đã chọn được tổ chức bảo lãnh phát hành chính, và hệ thống quản trị nguồn lực chạy ở mức sản xuất.',
    ho_so_can: [
      'Hồ sơ năng lực giám đốc tài chính, chấm theo khung năng lực bốn nhóm bốn cấp độ',
      'Hợp đồng hoặc thư cam kết với tổ chức bảo lãnh phát hành chính',
      'Biên bản nghiệm thu hệ thống quản trị nguồn lực ở mức sản xuất, xuất được bộ số liệu kiểm toán khớp nhau',
      'Quy chế kiểm soát nội bộ theo chuẩn áp dụng cho công ty niêm yết',
    ],
    chi_so_chan: [],
    rui_ro:
      'Kiểm soát nội bộ và năng lực giám đốc tài chính cộng lại chiếm trọng số lớn trong bộ chấm sẵn sàng; thiếu một trong hai thì điểm khó vượt ngưỡng nộp dù các trụ khác đã tốt.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 2 (nhóm Đội ngũ 1,5 · nhóm Vận hành 2,5 · kiểm soát nội bộ 2,0) · A06 mục 3 (khung năng lực giám đốc tài chính) · C09 trụ "Sẵn sàng cho bên thứ ba"',
  },

  // ══════════════════════ NIÊM YẾT ══════════════════════
  {
    giai_doan: 'niem-yet',
    ma: 'ny-01',
    ten: 'Đã niêm yết — chuyển hẳn sang vận hành công ty đại chúng',
    muc_tieu:
      'Cổ phiếu đã giao dịch trên sàn, và bộ máy đã chuyển sang nhịp vận hành công ty đại chúng chứ không còn chạy theo nếp công ty tư nhân.',
    ho_so_can: [
      'Quyết định chấp thuận niêm yết và hồ sơ phát hành hoàn tất',
      'Quy chế vận hành sau niêm yết: người phát ngôn, quy trình công bố thông tin, nhịp báo cáo',
    ],
    chi_so_chan: [],
    rui_ro:
      'Coi niêm yết là đích đến rồi buông kỷ luật là hiểu sai bản chất: niêm yết là một CƠ CHẾ vận hành, không phải một sự kiện. Buông sau ngày chào sàn thì mọi rủi ro quay lại ngay trong kỳ báo cáo đầu tiên.',
    nguon: 'Gói tri thức ZeniIPO FULL v1 · A02 mục 1, bước 10 "Niêm yết & sau niêm yết" — cổng "đã niêm yết"; nguyên tắc cốt lõi mở đầu chương A02',
  },
  {
    giai_doan: 'niem-yet',
    ma: 'ny-02',
    ten: 'Nhịp quan hệ nhà đầu tư cố định, có người chịu trách nhiệm',
    muc_tieu:
      'Có một người sở hữu mảng quan hệ nhà đầu tư, nhịp cập nhật đã ấn định và được giữ đúng qua từng kỳ.',
    ho_so_can: [
      'Bản phân công ghế quan hệ nhà đầu tư kèm quyền quản trị truy cập phòng dữ liệu',
      'Lịch cập nhật nhà đầu tư và bản lưu các kỳ đã gửi',
      'Danh sách nhà đầu tư đang theo dõi doanh nghiệp',
    ],
    chi_so_chan: [],
    rui_ro:
      'Không ai sở hữu nhịp cập nhật thì thông tin ra thị trường trở nên thất thường; nhà đầu tư tổ chức đọc sự thất thường đó thành rủi ro quản trị.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 1, bước 10 (chỉ số then chốt: nhịp quan hệ nhà đầu tư) · A06 mục 2 (ghế Trưởng quan hệ nhà đầu tư, xuất hiện từ bước 6)',
  },
  {
    giai_doan: 'niem-yet',
    ma: 'ny-03',
    ten: 'Báo cáo quý ra đúng hạn, số liệu khớp sổ',
    muc_tieu:
      'Mỗi quý ra đúng hạn một bộ báo cáo mà số liệu khớp với sổ cái, không phải bản dựng riêng cho công bố.',
    ho_so_can: [
      'Bộ báo cáo quý kèm bản đối chiếu với sổ cái',
      'Danh sách kiểm tra trước khi khoá kỳ đã hoàn tất cho từng tháng trong quý',
      'Bản giải trình chênh lệch so kế hoạch cho từng khoản mục trọng yếu',
    ],
    chi_so_chan: [],
    rui_ro:
      'Kỳ chưa khoá xong đã công bố thì số liệu còn ở trạng thái tạm tính; phải đính chính sau khi công bố là loại sự cố ảnh hưởng trực tiếp tới niềm tin thị trường.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 1, bước 10 (chỉ số then chốt: báo cáo quý) · C02 mục 4 (việc chốt sổ cuối tháng trước khi khoá kỳ)',
  },
  {
    giai_doan: 'niem-yet',
    ma: 'ny-04',
    ten: 'Lịch nghĩa vụ thuế, bảo hiểm và báo cáo tài chính năm giữ sạch liên tục',
    muc_tieu:
      'Không có mốc nghĩa vụ nào quá hạn trong 12 tháng gần nhất, và báo cáo tài chính năm nộp trong hạn kể từ ngày kết thúc năm tài chính.',
    ho_so_can: [
      'Bảng theo dõi tờ khai nộp đúng hạn trên tổng số tờ khai phải nộp 12 tháng gần nhất',
      'Chứng từ nộp bảo hiểm xã hội, bảo hiểm y tế, bảo hiểm thất nghiệp và kinh phí công đoàn từng tháng',
      'Báo cáo tài chính năm và hồ sơ quyết toán thuế thu nhập doanh nghiệp, thu nhập cá nhân',
    ],
    chi_so_chan: [],
    rui_ro:
      'Tiền chậm nộp cộng dồn theo ngày, nhưng phần đắt hơn là một hồ sơ tuân thủ có vết ngay sau khi niêm yết — đó là thứ mọi bên thẩm định về sau đều đọc lại.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · C02 mục 1 (bảng nghĩa vụ đầy đủ) và mục 3 (nguyên tắc tiền chậm nộp) · C09 trụ "Tuân thủ nghĩa vụ thuế"',
  },
  {
    giai_doan: 'niem-yet',
    ma: 'ny-05',
    ten: 'Dấu vết kiểm toán bất biến, xuất được số liệu bất cứ lúc nào',
    muc_tieu:
      'Sổ cái giữ nguyên tính bất biến, kỳ khoá đúng thứ tự thời gian, và bất cứ lúc nào cũng xuất được bộ số liệu kiểm toán khớp nhau cho bên thứ ba.',
    ho_so_can: [
      'Nhật ký thay đổi nối chuỗi bằng mã băm, kiểm được tính liên tục của chuỗi',
      'Bằng chứng kỳ được khoá đúng thứ tự thời gian',
      'Bộ số liệu xuất cho kiểm toán: sổ cái, sổ chi tiết, bảng cân đối, nhật ký thay đổi — khớp nhau',
    ],
    chi_so_chan: [],
    rui_ro:
      'Bút toán đã ghi sổ mà còn kéo lùi về nháp sửa được, hoặc khoá kỳ sau khi kỳ trước còn mở, là hai lỗ hổng cho phép sửa số liệu quá khứ mà báo cáo không phát hiện — với công ty đại chúng thì đó không còn là chuyện sổ sách nội bộ.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · C07 mục 3 (khoá kỳ và dấu vết kiểm toán) và mục 4 (bảng hình thức gian lận và cách chặn tự động)',
  },
  {
    giai_doan: 'niem-yet',
    ma: 'ny-06',
    ten: 'Chính sách chống giao dịch nội gián duy trì hiệu lực',
    muc_tieu:
      'Danh sách người nội bộ được cập nhật liên tục, và mỗi kỳ công bố đều có cửa sổ hạn chế giao dịch được áp dụng thật.',
    ho_so_can: [
      'Danh sách người nội bộ và người liên quan, cập nhật theo biến động nhân sự',
      'Quy định cửa sổ hạn chế giao dịch quanh mỗi kỳ công bố',
      'Nhật ký xác nhận tuân thủ của người nội bộ theo từng kỳ',
    ],
    chi_so_chan: [],
    rui_ro:
      'Chính sách ban hành để lấy điểm sẵn sàng rồi bỏ đó sau khi chào sàn là rủi ro pháp lý cá nhân cho chính lãnh đạo, không chỉ rủi ro cho công ty.',
    nguon:
      'Gói tri thức ZeniIPO FULL v1 · A02 mục 2 (tiêu chí "Chính sách chống giao dịch nội gián", nhóm Quản trị). Kho KHÔNG có danh mục nghĩa vụ công bố thông tin sau niêm yết của công ty đại chúng Việt Nam — mốc này là phần DUY TRÌ tiêu chí đã đạt ở tiền niêm yết, chưa phải hồ sơ tuân thủ đầy đủ',
  },
];
