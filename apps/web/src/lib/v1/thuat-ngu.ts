/**
 * Từ điển thuật ngữ tài chính · gọi vốn · IPO xuất hiện trên giao diện ZeniIPO.
 *
 * Vì sao cần: giao diện đã Việt hoá phần chữ thường, nhưng thuật ngữ chuyên
 * ngành (ARR, Burn multiple, Term sheet, Liquidation preference…) thì KHÔNG
 * dịch — giới làm nghề ở Việt Nam vẫn gọi nguyên tiếng Anh. Thay vì dịch ép,
 * ta giữ nguyên thuật ngữ và kèm một nghĩa RẤT NGẮN hiện ngay bên cạnh, cộng
 * một câu giải thích đầy đủ cho chú giải khi rê chuột.
 *
 * Nguồn nội dung: bảng `glossary` trong
 * packages/database/zenicloud/004_seed_content.sql (đã viết lại tiếng Việt có
 * dấu đầy đủ) + máy quét chữ Latin còn lại trên `source.html` và các trang .tsx.
 *
 * Quy ước dữ liệu:
 *  - `tu` viết đúng y như chữ hiện trên màn hình, không trùng nhau.
 *  - `nghia` tối đa 6 từ để nhét vừa cạnh thuật ngữ.
 *  - `giai_thich` đúng MỘT câu, nêu công thức nếu là chỉ số có công thức.
 *  - Mảng sắp theo `nhom` rồi theo `tu` (A→Z, không phân biệt hoa thường).
 *
 * KHÔNG đưa vào đây: tên riêng (Zeni, ANIMA, SGX, HOSE…), mã vai trò
 * (CFO-001…) và từ tiếng Anh thường (days, target, review…) — những thứ đó
 * được dịch hẳn sang tiếng Việt chứ không chú giải.
 */

export type ThuatNgu = {
  /** Dạng viết đúng của thuật ngữ, khớp chính xác chữ hiện trên màn hình. */
  tu: string;
  /** Nghĩa tiếng Việt NGẮN — tối đa 6 từ, dùng để hiện ngay bên cạnh. */
  nghia: string;
  /** Giải thích đầy đủ một câu, dùng cho chú giải khi rê chuột. */
  giai_thich: string;
  nhom: 'tai-chinh' | 'goi-von' | 'ipo' | 'phap-ly' | 'chi-so' | 'cong-nghe' | 'quan-tri';
};

export const THUAT_NGU: ThuatNgu[] = [
  // ───────────────────────────── chi-so ─────────────────────────────
  {
    tu: 'ARPU',
    nghia: 'doanh thu bình quân mỗi khách',
    giai_thich:
      'Doanh thu bình quân thu được trên một khách hàng trong kỳ: tổng doanh thu chia số khách đang hoạt động.',
    nhom: 'chi-so',
  },
  {
    tu: 'ARR',
    nghia: 'doanh thu định kỳ năm',
    giai_thich:
      'Doanh thu thuê bao đều đặn quy về một năm, tính bằng MRR của tháng gần nhất nhân 12 — chỉ tính phần lặp lại, không tính hợp đồng bán một lần.',
    nhom: 'chi-so',
  },
  {
    tu: 'Burn multiple',
    nghia: 'bội số đốt tiền',
    giai_thich:
      'Số tiền đốt ròng để tạo thêm một đồng ARR mới: đốt ròng chia phần ARR tăng thêm — dưới 1,5 là gọi vốn hiệu quả, trên 3 là báo động.',
    nhom: 'chi-so',
  },
  {
    tu: 'CAC',
    nghia: 'chi phí kéo một khách',
    giai_thich:
      'Chi phí bỏ ra để có thêm một khách hàng trả tiền: toàn bộ tiền marketing cộng lương đội bán chia số khách mới trong kỳ.',
    nhom: 'chi-so',
  },
  {
    tu: 'CAC payback',
    nghia: 'số tháng hoàn vốn khách',
    giai_thich:
      'Số tháng để lãi gộp từ một khách bù lại đúng chi phí đã bỏ ra để kéo khách đó về; dưới 12 tháng là mô hình lành.',
    nhom: 'chi-so',
  },
  {
    tu: 'CAGR',
    nghia: 'tăng trưởng kép hằng năm',
    giai_thich:
      'Tốc độ tăng trưởng bình quân kép mỗi năm của một chỉ tiêu: lấy căn bậc n của (giá trị cuối chia giá trị đầu) rồi trừ 1.',
    nhom: 'chi-so',
  },
  {
    tu: 'Churn',
    nghia: 'tỷ lệ khách rời bỏ',
    giai_thich:
      'Phần khách hoặc phần doanh thu mất đi trong kỳ, tính bằng số mất chia số đầu kỳ — đối trọng trực tiếp của tỷ lệ giữ chân.',
    nhom: 'chi-so',
  },
  {
    tu: 'Cohort',
    nghia: 'nhóm khách cùng kỳ',
    giai_thich:
      'Nhóm khách hàng bắt đầu dùng trong cùng một tháng, theo dõi riêng theo thời gian để biết sản phẩm giữ chân tốt lên hay xấu đi.',
    nhom: 'chi-so',
  },
  {
    tu: 'Contribution margin',
    nghia: 'biên đóng góp',
    giai_thich:
      'Phần còn lại của doanh thu sau khi trừ toàn bộ chi phí biến đổi, dùng để gánh chi phí cố định và tạo lợi nhuận.',
    nhom: 'chi-so',
  },
  {
    tu: 'DAU',
    nghia: 'khách dùng mỗi ngày',
    giai_thich:
      'Số người dùng thật sự mở và dùng sản phẩm trong một ngày, thước đo mức độ gắn bó hằng ngày.',
    nhom: 'chi-so',
  },
  {
    tu: 'EBITDA',
    nghia: 'lãi trước thuế lãi khấu hao',
    giai_thich:
      'Lợi nhuận hoạt động trước lãi vay, thuế, khấu hao hữu hình và phân bổ vô hình — cho thấy lõi kinh doanh sinh tiền tới đâu, bỏ qua cách tài trợ vốn.',
    nhom: 'chi-so',
  },
  {
    tu: 'GMV',
    nghia: 'tổng giá trị giao dịch',
    giai_thich:
      'Tổng giá trị hàng hoá, dịch vụ chạy qua nền tảng trước khi trừ hoàn tiền và chiết khấu — đây KHÔNG phải doanh thu của công ty.',
    nhom: 'chi-so',
  },
  {
    tu: 'Gross margin',
    nghia: 'biên lợi nhuận gộp',
    giai_thich:
      'Tỷ lệ lãi gộp trên doanh thu: (doanh thu trừ giá vốn) chia doanh thu — công ty phần mềm thường trên 70%, dịch vụ vận hành thấp hơn nhiều.',
    nhom: 'chi-so',
  },
  {
    tu: 'GRR',
    nghia: 'giữ doanh thu gốc',
    giai_thich:
      'Tỷ lệ doanh thu giữ được từ tập khách cũ khi KHÔNG tính phần bán thêm, nên luôn nhỏ hơn hoặc bằng 100%.',
    nhom: 'chi-so',
  },
  {
    tu: 'Logo churn',
    nghia: 'tỷ lệ mất khách hàng',
    giai_thich:
      'Tỷ lệ mất khách tính theo đầu khách (đếm "logo"), khác với mất doanh thu — mất một khách nhỏ và một khách lớn ở đây đếm như nhau.',
    nhom: 'chi-so',
  },
  {
    tu: 'LTV',
    nghia: 'giá trị trọn đời khách',
    giai_thich:
      'Tổng lãi gộp một khách mang lại trong suốt thời gian gắn bó: lãi gộp bình quân tháng chia tỷ lệ rời bỏ tháng.',
    nhom: 'chi-so',
  },
  {
    tu: 'LTV/CAC',
    nghia: 'bội số hoàn vốn khách',
    giai_thich:
      'Giá trị trọn đời của khách chia chi phí kéo khách đó về; từ 3 lần trở lên mới được coi là mô hình kéo khách có lãi.',
    nhom: 'chi-so',
  },
  {
    tu: 'Magic number',
    nghia: 'hiệu suất một đồng bán hàng',
    giai_thich:
      'Đo hiệu quả đội bán hàng: phần ARR tăng thêm trong quý nhân 4 rồi chia chi phí bán hàng và marketing quý trước — trên 0,75 là nên đổ thêm tiền.',
    nhom: 'chi-so',
  },
  {
    tu: 'MAU',
    nghia: 'khách dùng mỗi tháng',
    giai_thich:
      'Số người dùng có ít nhất một lần dùng sản phẩm trong 30 ngày, mẫu số quen thuộc khi so với người dùng hằng ngày.',
    nhom: 'chi-so',
  },
  {
    tu: 'MoM',
    nghia: 'so với tháng trước',
    giai_thich:
      'Mức thay đổi của chỉ tiêu so với chính nó tháng liền trước, dùng để bắt nhịp tăng trưởng ngắn hạn.',
    nhom: 'chi-so',
  },
  {
    tu: 'MRR',
    nghia: 'doanh thu định kỳ tháng',
    giai_thich:
      'Doanh thu thuê bao đều đặn của một tháng, cộng từ toàn bộ hợp đồng đang chạy đã quy về giá trị tháng.',
    nhom: 'chi-so',
  },
  {
    tu: 'Net margin',
    nghia: 'biên lợi nhuận ròng',
    giai_thich:
      'Lợi nhuận sau thuế chia doanh thu — con số cuối cùng sau khi đã trừ mọi chi phí, lãi vay và thuế.',
    nhom: 'chi-so',
  },
  {
    tu: 'NRR',
    nghia: 'giữ doanh thu mở rộng',
    giai_thich:
      'Doanh thu năm nay thu từ đúng tập khách năm ngoái, tính cả phần bán thêm và trừ phần rời bỏ; trên 120% nghĩa là khách cũ tự lớn lên và nuôi tăng trưởng.',
    nhom: 'chi-so',
  },
  {
    tu: 'Payback period',
    nghia: 'kỳ hoàn vốn',
    giai_thich:
      'Thời gian cần để dòng tiền thu về bù đủ khoản tiền đã bỏ ra cho một khoản đầu tư hay một kênh kéo khách.',
    nhom: 'chi-so',
  },
  {
    tu: 'PMF',
    nghia: 'sản phẩm khớp thị trường',
    giai_thich:
      'Trạng thái sản phẩm đã trúng nhu cầu thật: khách tự quay lại, tự giới thiệu, và ngừng bán thì khách kêu — mốc bắt buộc trước khi đổ tiền mở rộng.',
    nhom: 'chi-so',
  },
  {
    tu: 'QoQ',
    nghia: 'so với quý trước',
    giai_thich:
      'Mức thay đổi của chỉ tiêu so với quý liền trước, nhịp báo cáo quen thuộc với hội đồng quản trị và nhà đầu tư.',
    nhom: 'chi-so',
  },
  {
    tu: 'Retention',
    nghia: 'tỷ lệ giữ chân khách',
    giai_thich:
      'Phần khách hàng còn ở lại sau một khoảng thời gian tính từ lúc bắt đầu dùng, thường đọc theo từng nhóm khách cùng kỳ.',
    nhom: 'chi-so',
  },
  {
    tu: 'Rule of 40',
    nghia: 'quy tắc bốn mươi',
    giai_thich:
      'Tăng trưởng doanh thu (%) cộng biên EBITDA (%) từ 40 trở lên thì công ty phần mềm được coi là khoẻ, dù đang ưu tiên tăng trưởng hay ưu tiên lợi nhuận.',
    nhom: 'chi-so',
  },
  {
    tu: 'SAM',
    nghia: 'phần thị trường phục vụ được',
    giai_thich:
      'Phần của tổng thị trường mà mô hình kinh doanh, địa bàn và giấy phép hiện tại cho phép doanh nghiệp với tới.',
    nhom: 'chi-so',
  },
  {
    tu: 'SOM',
    nghia: 'phần thị trường giành được',
    giai_thich:
      'Phần thị trường doanh nghiệp thật sự chiếm được trong vài năm tới với nguồn lực và đội ngũ hiện có.',
    nhom: 'chi-so',
  },
  {
    tu: 'Take rate',
    nghia: 'tỷ lệ ăn chia sàn',
    giai_thich:
      'Phần trăm nền tảng giữ lại trên mỗi giao dịch: doanh thu thuần chia tổng giá trị giao dịch chạy qua nền tảng.',
    nhom: 'chi-so',
  },
  {
    tu: 'TAM',
    nghia: 'tổng dung lượng thị trường',
    giai_thich:
      'Tổng số tiền cả thị trường có thể chi cho loại sản phẩm này nếu doanh nghiệp phục vụ được toàn bộ khách hàng.',
    nhom: 'chi-so',
  },
  {
    tu: 'Traction',
    nghia: 'lực kéo thị trường',
    giai_thich:
      'Bằng chứng số liệu cho thấy thị trường đang thật sự kéo sản phẩm đi: doanh thu, người dùng, hợp đồng tăng đều theo tháng.',
    nhom: 'chi-so',
  },
  {
    tu: 'Unit economics',
    nghia: 'lãi lỗ trên một đơn vị',
    giai_thich:
      'Bóc tách doanh thu và chi phí xuống mức một khách hoặc một đơn hàng để xem bán thêm là lời thêm hay lỗ thêm.',
    nhom: 'chi-so',
  },
  {
    tu: 'YTD',
    nghia: 'luỹ kế từ đầu năm',
    giai_thich:
      'Số cộng dồn từ ngày đầu năm tài chính đến thời điểm đang xem, dùng để đối chiếu với kế hoạch cả năm.',
    nhom: 'chi-so',
  },

  // ──────────────────────────── cong-nghe ────────────────────────────
  {
    tu: 'API',
    nghia: 'cổng kết nối phần mềm',
    giai_thich:
      'Cổng để phần mềm này gọi thẳng phần mềm kia lấy hoặc ghi dữ liệu, không cần con người thao tác trên màn hình.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'Cache',
    nghia: 'bộ nhớ đệm',
    giai_thich:
      'Chỗ giữ tạm kết quả vừa tính để lần sau trả ngay, đổi lại phải chấp nhận dữ liệu có thể cũ vài giây.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'Cron',
    nghia: 'lịch chạy tự động',
    giai_thich:
      'Lịch hẹn giờ cho máy tự chạy một việc lặp lại, ví dụ nửa đêm chốt sổ hoặc mỗi sáng gửi báo cáo.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'Idempotent',
    nghia: 'gọi lại không nhân đôi',
    giai_thich:
      'Tính chất của một thao tác mà gọi lại nhiều lần vẫn cho đúng một kết quả — bắt buộc với bút toán và thanh toán để tránh ghi trùng.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'JWT',
    nghia: 'vé đăng nhập có ký',
    giai_thich:
      'Mẩu dữ liệu đã ký số mà máy chủ cấp sau khi đăng nhập, trình duyệt mang theo mỗi lần gọi để chứng minh mình là ai.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'Latency',
    nghia: 'độ trễ phản hồi',
    giai_thich:
      'Khoảng thời gian từ lúc bấm đến lúc hệ thống trả kết quả, thường đọc ở mức phân vị 95 chứ không đọc trung bình.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'Multi-tenant',
    nghia: 'nhiều khách chung một hệ',
    giai_thich:
      'Một hệ thống duy nhất phục vụ nhiều doanh nghiệp, dữ liệu mỗi bên nằm trong khoang riêng và tuyệt đối không nhìn thấy nhau.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'OAuth',
    nghia: 'uỷ quyền đăng nhập',
    giai_thich:
      'Chuẩn cho phép đăng nhập bằng tài khoản bên thứ ba mà không đưa mật khẩu cho ứng dụng, chỉ trao một phiếu quyền giới hạn.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'Rate limit',
    nghia: 'giới hạn số lần gọi',
    giai_thich:
      'Mức trần số lần được gọi một cổng kết nối trong một khoảng thời gian, để một khách không làm nghẽn cả hệ thống.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'RLS',
    nghia: 'khoá dữ liệu theo dòng',
    giai_thich:
      'Cơ chế khoá ngay trong cơ sở dữ liệu, mỗi câu truy vấn chỉ thấy được những dòng thuộc đúng doanh nghiệp của người đang đăng nhập.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'SaaS',
    nghia: 'phần mềm thuê bao',
    giai_thich:
      'Mô hình bán phần mềm chạy trên nền tảng đám mây, khách trả tiền theo tháng hoặc năm thay vì mua đứt một lần.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'SSO',
    nghia: 'đăng nhập một lần',
    giai_thich:
      'Đăng nhập một lần bằng tài khoản công ty rồi vào được mọi ứng dụng liên kết, không phải nhớ thêm mật khẩu nào.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'Tenant',
    nghia: 'khoang dữ liệu một khách',
    giai_thich:
      'Một doanh nghiệp khách hàng trên nền tảng, kèm toàn bộ dữ liệu và người dùng của riêng họ trong khoang tách biệt.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'Uptime',
    nghia: 'thời gian hệ thống sống',
    giai_thich:
      'Tỷ lệ thời gian hệ thống chạy được trên tổng thời gian trong kỳ, ví dụ 99,9% tương đương chết tối đa khoảng 43 phút mỗi tháng.',
    nhom: 'cong-nghe',
  },
  {
    tu: 'Webhook',
    nghia: 'báo ngược khi có việc',
    giai_thich:
      'Cách hệ thống bên kia tự gọi về địa chỉ của ta ngay khi có sự kiện, thay vì ta phải hỏi thăm liên tục.',
    nhom: 'cong-nghe',
  },

  // ───────────────────────────── goi-von ─────────────────────────────
  {
    tu: 'Anchor investor',
    nghia: 'nhà đầu tư neo vòng',
    giai_thich:
      'Nhà đầu tư cam kết phần vốn lớn sớm nhất, làm điểm tựa uy tín để các nhà đầu tư còn lại yên tâm vào cùng vòng.',
    nhom: 'goi-von',
  },
  {
    tu: 'Anti-dilution',
    nghia: 'chống pha loãng',
    giai_thich:
      'Điều khoản bảo vệ nhà đầu tư cũ khi vòng sau gọi vốn ở giá thấp hơn, bằng cách điều chỉnh lại giá chuyển đổi cổ phần của họ.',
    nhom: 'goi-von',
  },
  {
    tu: 'Board seat',
    nghia: 'ghế hội đồng quản trị',
    giai_thich:
      'Quyền cử một người vào hội đồng quản trị, kèm quyền biểu quyết các quyết định lớn của doanh nghiệp.',
    nhom: 'goi-von',
  },
  {
    tu: 'Bridge round',
    nghia: 'vòng vốn cầu nối',
    giai_thich:
      'Vòng gọi vốn nhỏ và nhanh để bắc cầu tới vòng chính thức khi tiền sắp cạn hoặc chỉ số chưa đủ đẹp để chốt giá.',
    nhom: 'goi-von',
  },
  {
    tu: 'Cap table',
    nghia: 'bảng cổ phần',
    giai_thich:
      'Bảng liệt kê ai sở hữu bao nhiêu phần trăm doanh nghiệp, gồm cả quyền chọn chưa thực hiện và các khoản sẽ chuyển đổi thành cổ phần.',
    nhom: 'goi-von',
  },
  {
    tu: 'Cliff',
    nghia: 'mốc chờ đầu tiên',
    giai_thich:
      'Khoảng thời gian đầu chưa được nhận cổ phần nào, thường là 12 tháng; qua mốc này mới nhận một cục rồi sau đó nhận dần hằng tháng.',
    nhom: 'goi-von',
  },
  {
    tu: 'Convertible note',
    nghia: 'vay chuyển thành cổ phần',
    giai_thich:
      'Khoản vay có lãi và có ngày đáo hạn, đến vòng gọi vốn sau sẽ chuyển thành cổ phần theo mức chiết khấu và giá trần đã thoả thuận.',
    nhom: 'goi-von',
  },
  {
    tu: 'Data room',
    nghia: 'phòng dữ liệu thẩm định',
    giai_thich:
      'Kho tài liệu điện tử có kiểm soát quyền xem, nơi nhà đầu tư và kiểm toán soi hồ sơ pháp lý, tài chính, hợp đồng của doanh nghiệp.',
    nhom: 'goi-von',
  },
  {
    tu: 'DD',
    nghia: 'thẩm định chi tiết',
    giai_thich:
      'Viết tắt của Due Diligence — đợt soi toàn diện sổ sách, pháp lý, công nghệ và nhân sự trước khi nhà đầu tư xuống tiền.',
    nhom: 'goi-von',
  },
  {
    tu: 'Dilution',
    nghia: 'pha loãng',
    giai_thich:
      'Tỷ lệ sở hữu của cổ đông cũ giảm xuống vì doanh nghiệp phát hành thêm cổ phần cho vòng vốn mới hoặc cho quỹ nhân viên.',
    nhom: 'goi-von',
  },
  {
    tu: 'Down round',
    nghia: 'vòng gọi giá thấp hơn',
    giai_thich:
      'Vòng gọi vốn định giá thấp hơn vòng trước, thường kích hoạt điều khoản chống pha loãng và làm tổn thương tỷ lệ của nhà sáng lập.',
    nhom: 'goi-von',
  },
  {
    tu: 'Drag-along',
    nghia: 'quyền kéo cổ đông bán',
    giai_thich:
      'Quyền buộc nhóm cổ đông thiểu số phải bán theo khi đa số đã đồng ý bán doanh nghiệp, để thương vụ không bị một vài người chặn.',
    nhom: 'goi-von',
  },
  {
    tu: 'Due Diligence',
    nghia: 'soát xét trước rót vốn',
    giai_thich:
      'Quá trình nhà đầu tư kiểm chứng mọi con số và cam kết của doanh nghiệp trước khi ký, thường kéo dài 4 đến 10 tuần.',
    nhom: 'goi-von',
  },
  {
    tu: 'ESOP',
    nghia: 'quỹ cổ phần nhân viên',
    giai_thich:
      'Phần cổ phần để dành thưởng cho nhân viên theo lịch trao quyền, thường chiếm 8–15% bảng cổ phần và làm pha loãng cổ đông hiện hữu.',
    nhom: 'goi-von',
  },
  {
    tu: 'Exit',
    nghia: 'lối thoát vốn',
    giai_thich:
      'Cách nhà đầu tư thu tiền về: bán doanh nghiệp, bán lại phần vốn cho quỹ khác, hoặc niêm yết lên sàn.',
    nhom: 'goi-von',
  },
  {
    tu: 'Lead investor',
    nghia: 'nhà đầu tư dẫn vòng',
    giai_thich:
      'Quỹ đứng ra chốt định giá và bộ điều khoản cho cả vòng, thường bỏ phần vốn lớn nhất và lấy ghế hội đồng quản trị.',
    nhom: 'goi-von',
  },
  {
    tu: 'Liquidation preference',
    nghia: 'ưu tiên hoàn vốn trước',
    giai_thich:
      'Quyền của nhà đầu tư được rút trước một bội số vốn đã bỏ ra khi doanh nghiệp bị bán hoặc giải thể, phần còn lại mới chia cho cổ đông thường.',
    nhom: 'goi-von',
  },
  {
    tu: 'Observer seat',
    nghia: 'ghế dự thính hội đồng',
    giai_thich:
      'Quyền cử người dự họp hội đồng quản trị và nhận tài liệu nhưng KHÔNG có quyền biểu quyết.',
    nhom: 'goi-von',
  },
  {
    tu: 'Option pool',
    nghia: 'quỹ quyền chọn cổ phần',
    giai_thich:
      'Số cổ phần chưa phát hành để dành cấp quyền chọn mua cho nhân viên; nhà đầu tư thường đòi lập quỹ này TRƯỚC khi rót vốn nên nhà sáng lập chịu pha loãng.',
    nhom: 'goi-von',
  },
  {
    tu: 'Post-money',
    nghia: 'định giá sau tiền',
    giai_thich:
      'Giá trị doanh nghiệp tính ngay sau khi tiền vòng mới đã vào: định giá trước tiền cộng số vốn gọi được.',
    nhom: 'goi-von',
  },
  {
    tu: 'Pre-money',
    nghia: 'định giá trước tiền',
    giai_thich:
      'Giá trị doanh nghiệp được hai bên chốt trước khi tiền vòng mới rót vào, là căn cứ tính tỷ lệ cổ phần nhà đầu tư nhận.',
    nhom: 'goi-von',
  },
  {
    tu: 'Preferred share',
    nghia: 'cổ phần ưu đãi',
    giai_thich:
      'Loại cổ phần nhà đầu tư nắm, kèm quyền ưu tiên hoàn vốn, chống pha loãng và quyền phủ quyết mà cổ phần thường không có.',
    nhom: 'goi-von',
  },
  {
    tu: 'Ratchet',
    nghia: 'ép lại giá cho quỹ',
    giai_thich:
      'Dạng chống pha loãng nặng tay nhất, đưa giá cổ phần của nhà đầu tư cũ về đúng bằng giá vòng mới bất kể vòng mới nhỏ cỡ nào.',
    nhom: 'goi-von',
  },
  {
    tu: 'SAFE',
    nghia: 'thoả thuận vốn tương lai',
    giai_thich:
      'Giấy nhận tiền trước và hẹn quy đổi thành cổ phần ở vòng sau, không phải khoản vay nên không có lãi và không có ngày đáo hạn.',
    nhom: 'goi-von',
  },
  {
    tu: 'Secondary',
    nghia: 'bán lại cổ phần cũ',
    giai_thich:
      'Giao dịch cổ đông hiện hữu bán phần của mình cho người khác — tiền vào túi người bán, doanh nghiệp không nhận thêm đồng nào.',
    nhom: 'goi-von',
  },
  {
    tu: 'Seed round',
    nghia: 'vòng hạt giống',
    giai_thich:
      'Vòng gọi vốn chính thức đầu tiên, dùng tiền để chứng minh sản phẩm trúng nhu cầu và dựng bộ máy bán hàng đầu tiên.',
    nhom: 'goi-von',
  },
  {
    tu: 'Series A',
    nghia: 'vòng gọi vốn A',
    giai_thich:
      'Vòng sau hạt giống, dành cho doanh nghiệp đã có doanh thu lặp lại và cần tiền để nhân rộng mô hình đã chạy được.',
    nhom: 'goi-von',
  },
  {
    tu: 'Soft commit',
    nghia: 'cam kết miệng chưa ký',
    giai_thich:
      'Lời hứa sẽ tham gia vòng vốn nhưng chưa ràng buộc pháp lý — chỉ nên tính vào dự báo với tỷ lệ chốt thực tế, không tính đủ 100%.',
    nhom: 'goi-von',
  },
  {
    tu: 'SPV',
    nghia: 'pháp nhân lập riêng',
    giai_thich:
      'Công ty lập ra chỉ để giữ một tài sản hoặc gom nhiều nhà đầu tư nhỏ thành một dòng trên bảng cổ phần.',
    nhom: 'goi-von',
  },
  {
    tu: 'Syndicate',
    nghia: 'nhóm quỹ cùng rót',
    giai_thich:
      'Nhóm nhiều nhà đầu tư cùng góp vào một vòng theo điều khoản chung do nhà đầu tư dẫn vòng chốt.',
    nhom: 'goi-von',
  },
  {
    tu: 'Tag-along',
    nghia: 'quyền bán bám theo',
    giai_thich:
      'Quyền của cổ đông nhỏ được bán phần của mình theo cùng giá và cùng điều kiện khi cổ đông lớn bán cho bên thứ ba.',
    nhom: 'goi-von',
  },
  {
    tu: 'Term sheet',
    nghia: 'bản điều khoản tóm tắt',
    giai_thich:
      'Văn bản tóm tắt các điều khoản chính của thương vụ (định giá, tỷ lệ, quyền ưu tiên), phần lớn chưa ràng buộc pháp lý trừ điều khoản bảo mật và độc quyền đàm phán.',
    nhom: 'goi-von',
  },
  {
    tu: 'Tranche',
    nghia: 'đợt giải ngân',
    giai_thich:
      'Một phần vốn được rót theo đợt khi doanh nghiệp đạt đủ cột mốc đã cam kết, thay vì nhận trọn một lần.',
    nhom: 'goi-von',
  },
  {
    tu: 'Vesting',
    nghia: 'lịch trao quyền',
    giai_thich:
      'Lịch cổ phần hoặc quyền chọn được trao dần theo thời gian gắn bó, phổ biến là 4 năm kèm mốc chờ 1 năm đầu.',
    nhom: 'goi-von',
  },
  {
    tu: 'Warrant',
    nghia: 'chứng quyền mua thêm',
    giai_thich:
      'Quyền mua thêm cổ phần ở mức giá định trước trong một khoảng thời gian, thường kèm theo khoản vay hoặc thoả thuận hợp tác lớn.',
    nhom: 'goi-von',
  },
  {
    tu: 'Waterfall',
    nghia: 'thứ tự chia tiền bán',
    giai_thich:
      'Trình tự dòng tiền chảy về từng nhóm cổ đông khi doanh nghiệp được bán: trả nợ, rồi ưu tiên hoàn vốn, phần dư mới chia theo tỷ lệ sở hữu.',
    nhom: 'goi-von',
  },

  // ─────────────────────────────── ipo ───────────────────────────────
  {
    tu: 'Bookbuilding',
    nghia: 'dựng sổ đặt mua',
    giai_thich:
      'Giai đoạn tổ chức bảo lãnh gom lệnh đặt mua của nhà đầu tư tổ chức theo từng mức giá để tìm ra giá chào bán cuối cùng.',
    nhom: 'ipo',
  },
  {
    tu: 'Bookrunner',
    nghia: 'đầu mối dựng sổ',
    giai_thich:
      'Ngân hàng đầu tư giữ vai trò chính trong việc gom lệnh, chốt giá và phân bổ cổ phần cho đợt chào bán.',
    nhom: 'ipo',
  },
  {
    tu: 'Cornerstone investor',
    nghia: 'nhà đầu tư nền móng',
    giai_thich:
      'Nhà đầu tư lớn cam kết mua một lượng cổ phần cố định ngay trước khi chào bán và chịu khoá cổ phiếu, để tạo niềm tin cho thị trường.',
    nhom: 'ipo',
  },
  {
    tu: 'Delisting',
    nghia: 'huỷ niêm yết',
    giai_thich:
      'Cổ phiếu bị đưa ra khỏi sàn, do doanh nghiệp tự nguyện rút hoặc do vi phạm điều kiện duy trì niêm yết.',
    nhom: 'ipo',
  },
  {
    tu: 'Filing',
    nghia: 'nộp hồ sơ lên cơ quan',
    giai_thich:
      'Việc nộp bộ hồ sơ công bố thông tin lên cơ quan quản lý thị trường chứng khoán và chờ ý kiến phản hồi.',
    nhom: 'ipo',
  },
  {
    tu: 'Free float',
    nghia: 'cổ phiếu tự do chuyển nhượng',
    giai_thich:
      'Tỷ lệ cổ phiếu thực sự trôi nổi trên thị trường, không tính phần của cổ đông nội bộ và cổ đông lớn bị hạn chế bán.',
    nhom: 'ipo',
  },
  {
    tu: 'Greenshoe',
    nghia: 'quyền bán vượt mức',
    giai_thich:
      'Quyền của tổ chức bảo lãnh được bán thêm tối đa 15% số cổ phần chào bán để bình ổn giá trong những phiên đầu.',
    nhom: 'ipo',
  },
  {
    tu: 'Listing',
    nghia: 'niêm yết sàn',
    giai_thich:
      'Việc cổ phiếu chính thức được đưa lên sàn giao dịch và bắt đầu khớp lệnh công khai hằng ngày.',
    nhom: 'ipo',
  },
  {
    tu: 'Lock-up',
    nghia: 'khoá bán sau niêm yết',
    giai_thich:
      'Khoảng thời gian cổ đông nội bộ bị cấm bán cổ phiếu sau khi lên sàn, thường 90 đến 180 ngày.',
    nhom: 'ipo',
  },
  {
    tu: 'Mandate',
    nghia: 'thư uỷ nhiệm bảo lãnh',
    giai_thich:
      'Văn bản doanh nghiệp chính thức chỉ định ngân hàng đầu tư đứng ra thu xếp và bảo lãnh đợt chào bán.',
    nhom: 'ipo',
  },
  {
    tu: 'Prospectus',
    nghia: 'bản cáo bạch',
    giai_thich:
      'Tài liệu công bố chính thức mô tả hoạt động, tài chính và rủi ro của doanh nghiệp để nhà đầu tư đọc trước khi mua.',
    nhom: 'ipo',
  },
  {
    tu: 'Quiet period',
    nghia: 'kỳ im lặng trước chào bán',
    giai_thich:
      'Giai đoạn doanh nghiệp bị hạn chế phát ngôn quảng bá ngoài hồ sơ đã nộp, để tránh bị coi là chào bán trái quy định.',
    nhom: 'ipo',
  },
  {
    tu: 'Red herring',
    nghia: 'cáo bạch nháp chưa giá',
    giai_thich:
      'Bản cáo bạch sơ bộ phát cho nhà đầu tư trong giai đoạn thăm dò, đầy đủ thông tin nhưng chưa có giá và số lượng cuối cùng.',
    nhom: 'ipo',
  },
  {
    tu: 'Roadshow',
    nghia: 'chuyến chào bán cổ phần',
    giai_thich:
      'Chuỗi buổi gặp nhà đầu tư tổ chức ở nhiều thành phố để ban lãnh đạo trình bày câu chuyện doanh nghiệp và gom lệnh đặt mua.',
    nhom: 'ipo',
  },
  {
    tu: 'S-1',
    nghia: 'hồ sơ IPO Mỹ',
    giai_thich:
      'Bộ hồ sơ đăng ký chào bán lần đầu nộp cho cơ quan quản lý chứng khoán Hoa Kỳ, tương đương bản cáo bạch đầy đủ.',
    nhom: 'ipo',
  },
  {
    tu: 'Underwriter',
    nghia: 'tổ chức bảo lãnh phát hành',
    giai_thich:
      'Ngân hàng đầu tư đứng ra định giá, phân phối và cam kết mua lại phần cổ phần không bán hết trong đợt chào bán.',
    nhom: 'ipo',
  },

  // ───────────────────────────── phap-ly ─────────────────────────────
  {
    tu: 'Audit',
    nghia: 'kiểm toán',
    giai_thich:
      'Việc đơn vị độc lập soát xét và đưa ra ý kiến về tính trung thực của báo cáo tài chính, bắt buộc phải sạch trước khi lên sàn.',
    nhom: 'phap-ly',
  },
  {
    tu: 'Compliance',
    nghia: 'tuân thủ quy định',
    giai_thich:
      'Việc doanh nghiệp làm đúng luật, giấy phép và quy trình nội bộ, có hồ sơ chứng minh khi cơ quan quản lý hoặc kiểm toán hỏi tới.',
    nhom: 'phap-ly',
  },
  {
    tu: 'Escrow',
    nghia: 'tài khoản phong toả',
    giai_thich:
      'Tài khoản do bên thứ ba giữ tiền hoặc cổ phần, chỉ giải toả khi các điều kiện trong hợp đồng đã được thực hiện đủ.',
    nhom: 'phap-ly',
  },
  {
    tu: 'Governance',
    nghia: 'quản trị công ty',
    giai_thich:
      'Bộ máy và quy tắc phân quyền quyết định giữa hội đồng quản trị, ban điều hành và cổ đông, kèm cơ chế giám sát chéo.',
    nhom: 'phap-ly',
  },
  {
    tu: 'IP',
    nghia: 'sở hữu trí tuệ',
    giai_thich:
      'Tài sản vô hình như bằng sáng chế, nhãn hiệu, mã nguồn và công thức — phải đứng tên công ty chứ không đứng tên cá nhân sáng lập.',
    nhom: 'phap-ly',
  },
  {
    tu: 'LOI',
    nghia: 'thư ý định',
    giai_thich:
      'Thư bày tỏ ý định giao dịch và các điều khoản dự kiến, phần lớn chưa ràng buộc trừ điều khoản bảo mật và độc quyền đàm phán.',
    nhom: 'phap-ly',
  },
  {
    tu: 'MOU',
    nghia: 'biên bản ghi nhớ',
    giai_thich:
      'Biên bản ghi nhận thoả thuận hợp tác trên nguyên tắc giữa hai bên, chưa phát sinh nghĩa vụ thanh toán như hợp đồng.',
    nhom: 'phap-ly',
  },
  {
    tu: 'NDA',
    nghia: 'thoả thuận bảo mật',
    giai_thich:
      'Cam kết không tiết lộ thông tin nhận được, ký trước khi mở phòng dữ liệu hay chia sẻ số liệu tài chính chi tiết.',
    nhom: 'phap-ly',
  },
  {
    tu: 'PCAOB',
    nghia: 'chuẩn kiểm toán Mỹ',
    giai_thich:
      'Chuẩn kiểm toán áp cho công ty đại chúng niêm yết tại Hoa Kỳ, yêu cầu hồ sơ và bằng chứng chặt hơn kiểm toán thông thường.',
    nhom: 'phap-ly',
  },
  {
    tu: 'Related party',
    nghia: 'giao dịch bên liên quan',
    giai_thich:
      'Giao dịch với người nhà, công ty sân sau hoặc cổ đông lớn — phải công bố và định giá theo giá thị trường, là điểm kiểm toán soi kỹ nhất.',
    nhom: 'phap-ly',
  },
  {
    tu: 'SHA',
    nghia: 'thoả thuận cổ đông',
    giai_thich:
      'Hợp đồng giữa các cổ đông quy định quyền biểu quyết, quyền phủ quyết, hạn chế chuyển nhượng và cách xử lý khi có tranh chấp.',
    nhom: 'phap-ly',
  },
  {
    tu: 'SOX',
    nghia: 'luật kiểm soát nội bộ',
    giai_thich:
      'Luật của Hoa Kỳ buộc công ty niêm yết phải có hệ thống kiểm soát nội bộ với báo cáo tài chính và quy trách nhiệm cá nhân cho tổng giám đốc và giám đốc tài chính.',
    nhom: 'phap-ly',
  },
  {
    tu: 'SPA',
    nghia: 'hợp đồng mua bán cổ phần',
    giai_thich:
      'Hợp đồng chính thức chuyển nhượng cổ phần, ghi rõ giá, điều kiện tiên quyết, cam đoan bảo đảm và trách nhiệm bồi hoàn.',
    nhom: 'phap-ly',
  },

  // ───────────────────────────── quan-tri ─────────────────────────────
  {
    tu: 'Audit trail',
    nghia: 'vết ghi mọi thao tác',
    giai_thich:
      'Nhật ký ghi lại ai làm gì, lúc nào, trên dữ liệu nào và không được phép sửa — điều kiện bắt buộc để qua được kiểm toán.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Backlog',
    nghia: 'hàng việc chờ làm',
    giai_thich:
      'Danh sách việc đã xác định nhưng chưa làm, xếp theo thứ tự ưu tiên để đội ngũ bốc dần theo từng chặng.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Benchmark',
    nghia: 'đối chuẩn với ngành',
    giai_thich:
      'Việc đặt chỉ số của doanh nghiệp cạnh mức chuẩn của các công ty cùng ngành, cùng giai đoạn để biết mình đang ở nhóm nào.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Board deck',
    nghia: 'bộ slide họp hội đồng',
    giai_thich:
      'Bộ tài liệu chuẩn bị cho phiên họp hội đồng quản trị: kết quả so kế hoạch, tiền mặt, rủi ro và những quyết định cần chốt.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Budget vs actual',
    nghia: 'ngân sách so thực chi',
    giai_thich:
      'So sánh số thực tế với số kế hoạch từng khoản mục để tìm ra chênh lệch và giải trình nguyên nhân.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Dogfood',
    nghia: 'tự dùng sản phẩm mình',
    giai_thich:
      'Việc công ty dùng chính sản phẩm của mình để vận hành hằng ngày, nhờ đó phát hiện lỗi trước khi khách hàng gặp phải.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Forecast',
    nghia: 'dự báo kỳ tới',
    giai_thich:
      'Con số dự kiến cho các kỳ sắp tới dựa trên thực tế đã chạy, cập nhật liên tục chứ không cố định như ngân sách đầu năm.',
    nhom: 'quan-tri',
  },
  {
    tu: 'GTM',
    nghia: 'cách đưa ra thị trường',
    giai_thich:
      'Kế hoạch đưa sản phẩm tới khách: chọn tệp khách, kênh bán, thông điệp, giá và cách đội bán hàng phối hợp.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Headcount',
    nghia: 'quân số nhân sự',
    giai_thich:
      'Tổng số nhân sự chính thức đang trả lương, cơ sở để tính chi phí lương và năng suất doanh thu trên đầu người.',
    nhom: 'quan-tri',
  },
  {
    tu: 'ICP',
    nghia: 'chân dung khách lý tưởng',
    giai_thich:
      'Mô tả nhóm khách hàng phù hợp nhất với sản phẩm (ngành, quy mô, ngân sách, nỗi đau), dùng để lọc cơ hội và tập trung nguồn lực.',
    nhom: 'quan-tri',
  },
  {
    tu: 'KOC',
    nghia: 'người dùng có ảnh hưởng',
    giai_thich:
      'Người tiêu dùng thật có tiếng nói trong cộng đồng nhỏ, đánh giá dựa trên trải nghiệm dùng nên độ tin cậy cao dù lượng theo dõi khiêm tốn.',
    nhom: 'quan-tri',
  },
  {
    tu: 'KOL',
    nghia: 'người nổi tiếng dẫn dắt',
    giai_thich:
      'Người có ảnh hưởng lớn trên truyền thông, dùng để phủ nhận diện nhanh nhưng chi phí cao và tỷ lệ chốt đơn thường thấp hơn nhóm người dùng thật.',
    nhom: 'quan-tri',
  },
  {
    tu: 'KPI',
    nghia: 'chỉ số đo then chốt',
    giai_thich:
      'Chỉ số được chọn để đo kết quả một vai trò hay một bộ phận, phải có nguồn số rõ ràng và có người chịu trách nhiệm.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Milestone',
    nghia: 'cột mốc phải đạt',
    giai_thich:
      'Điểm mốc có ngày và tiêu chí đạt rõ ràng trên lộ trình, thường gắn với điều kiện giải ngân hoặc điều kiện của nhà đầu tư.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Moat',
    nghia: 'hào phòng thủ cạnh tranh',
    giai_thich:
      'Lợi thế khiến đối thủ khó sao chép: bằng sáng chế, dữ liệu độc quyền, hiệu ứng mạng lưới, chi phí chuyển đổi hoặc giấy phép.',
    nhom: 'quan-tri',
  },
  {
    tu: 'MVP',
    nghia: 'bản chạy được tối thiểu',
    giai_thich:
      'Phiên bản nhỏ nhất đủ để khách dùng thật và cho phản hồi, mục tiêu là học nhanh chứ không phải làm đủ tính năng.',
    nhom: 'quan-tri',
  },
  {
    tu: 'OKR',
    nghia: 'mục tiêu và kết quả',
    giai_thich:
      'Cách đặt mục tiêu theo quý: một mục tiêu định tính kèm 3 đến 5 kết quả then chốt đo được, gắn từ cấp tập đoàn xuống từng đội.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Pipeline',
    nghia: 'đường ống cơ hội',
    giai_thich:
      'Toàn bộ cơ hội đang chạy xếp theo từng giai đoạn kèm xác suất chốt, dùng để dự báo doanh thu hoặc dự báo vốn gọi được.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Roadmap',
    nghia: 'lộ trình sản phẩm',
    giai_thich:
      'Bản kế hoạch theo thời gian cho biết làm gì trước làm gì sau và vì sao, gắn với mục tiêu kinh doanh chứ không chỉ là danh sách tính năng.',
    nhom: 'quan-tri',
  },
  {
    tu: 'SLA',
    nghia: 'cam kết mức dịch vụ',
    giai_thich:
      'Mức chất lượng dịch vụ cam kết với khách bằng văn bản, ví dụ thời gian phản hồi hoặc tỷ lệ hệ thống hoạt động, kèm chế tài nếu không đạt.',
    nhom: 'quan-tri',
  },
  {
    tu: 'SOP',
    nghia: 'quy trình chuẩn',
    giai_thich:
      'Quy trình thao tác chuẩn viết ra thành các bước để ai làm cũng cho ra cùng một kết quả, nền tảng để nhân rộng và để kiểm toán.',
    nhom: 'quan-tri',
  },
  {
    tu: 'Sprint velocity',
    nghia: 'sức chạy mỗi chặng',
    giai_thich:
      'Khối lượng công việc đội kỹ thuật hoàn thành bình quân mỗi chặng, dùng để ước lượng thời gian cho các hạng mục tiếp theo.',
    nhom: 'quan-tri',
  },

  // ──────────────────────────── tai-chinh ────────────────────────────
  {
    tu: 'Accrual',
    nghia: 'ghi nhận theo dồn tích',
    giai_thich:
      'Nguyên tắc kế toán ghi doanh thu và chi phí vào kỳ phát sinh nghĩa vụ, không phụ thuộc lúc nào tiền thực sự thu chi.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Amortization',
    nghia: 'phân bổ tài sản vô hình',
    giai_thich:
      'Việc dàn giá trị tài sản vô hình như bản quyền hay phần mềm vào chi phí đều theo thời gian sử dụng.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Burn rate',
    nghia: 'tiền đốt mỗi tháng',
    giai_thich:
      'Số tiền mặt ròng hao hụt bình quân mỗi tháng: tiền chi ra trừ tiền thu về, là mẫu số để tính số tháng còn sống.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'CapEx',
    nghia: 'chi mua tài sản',
    giai_thich:
      'Khoản chi mua sắm hoặc xây dựng tài sản dùng nhiều năm, ghi tăng tài sản rồi khấu hao dần chứ không tính hết vào chi phí một kỳ.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Cash flow',
    nghia: 'dòng tiền',
    giai_thich:
      'Dòng tiền thực sự vào ra tài khoản trong kỳ, khác lợi nhuận kế toán và là thứ quyết định doanh nghiệp sống hay chết.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'COGS',
    nghia: 'giá vốn hàng bán',
    giai_thich:
      'Chi phí trực tiếp để tạo ra phần doanh thu đã ghi nhận: nguyên liệu, hạ tầng phục vụ khách, nhân sự vận hành trực tiếp.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Covenant',
    nghia: 'điều kiện ràng buộc vay',
    giai_thich:
      'Cam kết tài chính doanh nghiệp phải duy trì trong suốt thời gian vay, vi phạm thì ngân hàng có quyền đòi nợ trước hạn.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'DCF',
    nghia: 'chiết khấu dòng tiền',
    giai_thich:
      'Phương pháp định giá bằng cách quy dòng tiền tự do dự kiến các năm tới về hiện tại theo chi phí vốn bình quân.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Deferred revenue',
    nghia: 'tiền thu chưa ghi doanh thu',
    giai_thich:
      'Tiền khách đã trả trước cho dịch vụ chưa cung cấp — đứng bên nợ phải trả và chỉ chuyển dần thành doanh thu theo thời gian phục vụ.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Depreciation',
    nghia: 'khấu hao tài sản hữu hình',
    giai_thich:
      'Việc dàn giá trị máy móc, thiết bị, nhà xưởng vào chi phí theo thời gian sử dụng ước tính.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Dividend',
    nghia: 'cổ tức',
    giai_thich:
      'Phần lợi nhuận chia cho cổ đông bằng tiền hoặc bằng cổ phiếu, chỉ chia khi có lợi nhuận chưa phân phối và được đại hội đồng cổ đông thông qua.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'EPS',
    nghia: 'lãi trên mỗi cổ phiếu',
    giai_thich:
      'Lợi nhuận sau thuế chia số cổ phiếu đang lưu hành bình quân, mẫu số chính để tính chỉ số giá trên lợi nhuận.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Equity value',
    nghia: 'giá trị vốn chủ',
    giai_thich:
      'Phần giá trị thuộc về cổ đông: giá trị doanh nghiệp trừ nợ vay ròng, cũng chính là vốn hoá khi đã niêm yết.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'EV/EBITDA',
    nghia: 'bội số giá trị doanh nghiệp',
    giai_thich:
      'Giá trị doanh nghiệp chia lợi nhuận trước lãi vay, thuế và khấu hao — bội số so sánh phổ biến vì loại bỏ khác biệt về nợ vay và chính sách khấu hao.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Free cash flow',
    nghia: 'tiền còn lại thật sự',
    giai_thich:
      'Dòng tiền từ hoạt động kinh doanh trừ chi đầu tư tài sản — phần tiền còn lại để trả nợ, chia cổ tức hoặc tái đầu tư.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'GAAP',
    nghia: 'chuẩn kế toán Mỹ',
    giai_thich:
      'Bộ nguyên tắc kế toán được thừa nhận rộng rãi tại Hoa Kỳ, bắt buộc với doanh nghiệp niêm yết ở thị trường này.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Goodwill',
    nghia: 'lợi thế thương mại',
    giai_thich:
      'Phần giá mua vượt trên giá trị hợp lý của tài sản thuần khi thâu tóm doanh nghiệp, phải đánh giá suy giảm hằng năm.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'IFRS',
    nghia: 'chuẩn báo cáo quốc tế',
    giai_thich:
      'Bộ chuẩn mực lập báo cáo tài chính quốc tế; doanh nghiệp Việt Nam muốn gọi vốn ngoại hoặc niêm yết nước ngoài phải chuyển đổi sang chuẩn này.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'IRR',
    nghia: 'tỷ suất hoàn vốn nội bộ',
    giai_thich:
      'Mức lãi suất làm giá trị hiện tại ròng của dòng tiền dự án bằng không, dùng để so hiệu quả giữa các khoản đầu tư.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Liquidity',
    nghia: 'khả năng xoay tiền mặt',
    giai_thich:
      'Khả năng đáp ứng nghĩa vụ ngắn hạn bằng tiền và tài sản dễ bán, đo bằng tỷ số thanh toán hiện hành và số dư tiền thực có.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Market cap',
    nghia: 'vốn hoá thị trường',
    giai_thich:
      'Giá trị thị trường của toàn bộ cổ phần: giá một cổ phiếu nhân số cổ phiếu đang lưu hành.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'MOIC',
    nghia: 'bội số trên vốn gốc',
    giai_thich:
      'Tổng tiền thu về chia tổng vốn đã bỏ ra, không tính yếu tố thời gian nên thường đọc kèm tỷ suất hoàn vốn nội bộ.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'NPV',
    nghia: 'giá trị hiện tại ròng',
    giai_thich:
      'Tổng dòng tiền tương lai quy về hiện tại trừ vốn đầu tư ban đầu; lớn hơn không thì dự án tạo thêm giá trị.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'OpEx',
    nghia: 'chi phí vận hành',
    giai_thich:
      'Chi phí chạy bộ máy hằng ngày như lương, thuê văn phòng, marketing — tính hết vào kết quả kinh doanh trong kỳ phát sinh.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'P/E',
    nghia: 'giá chia lợi nhuận',
    giai_thich:
      'Giá một cổ phiếu chia lãi trên mỗi cổ phiếu, cho biết thị trường trả bao nhiêu đồng cho một đồng lợi nhuận hằng năm.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'ROA',
    nghia: 'lợi nhuận trên tài sản',
    giai_thich:
      'Lợi nhuận sau thuế chia tổng tài sản bình quân, đo mức sinh lời trên toàn bộ tài sản doanh nghiệp đang nắm.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'ROE',
    nghia: 'lợi nhuận trên vốn chủ',
    giai_thich:
      'Lợi nhuận sau thuế chia vốn chủ sở hữu bình quân, cho biết một đồng vốn cổ đông tạo ra bao nhiêu đồng lãi.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'ROI',
    nghia: 'lợi nhuận trên đầu tư',
    giai_thich:
      'Lãi thu được chia số tiền đã bỏ ra cho một khoản đầu tư hoặc một chiến dịch, tính theo phần trăm.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Runway',
    nghia: 'số tháng còn sống',
    giai_thich:
      'Số tháng doanh nghiệp còn sống được với mức đốt tiền hiện tại và số dư tiền đang có: số dư tiền chia mức đốt ròng mỗi tháng.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Valuation',
    nghia: 'định giá doanh nghiệp',
    giai_thich:
      'Giá trị doanh nghiệp được xác định theo bội số doanh thu, bội số lợi nhuận hoặc chiết khấu dòng tiền, tuỳ giai đoạn và ngành.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Variance',
    nghia: 'chênh so kế hoạch',
    giai_thich:
      'Khoảng lệch giữa số thực tế và số kế hoạch của một khoản mục, kèm phần giải trình nguyên nhân cho hội đồng quản trị.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'WACC',
    nghia: 'chi phí vốn bình quân',
    giai_thich:
      'Chi phí vốn bình quân gia quyền giữa vốn vay và vốn chủ theo tỷ trọng từng nguồn, dùng làm suất chiết khấu khi định giá.',
    nhom: 'tai-chinh',
  },
  {
    tu: 'Working capital',
    nghia: 'vốn lưu động',
    giai_thich:
      'Tài sản ngắn hạn trừ nợ ngắn hạn — phần vốn nằm kẹt trong hàng tồn kho và công nợ để bộ máy chạy hằng ngày.',
    nhom: 'tai-chinh',
  },
];
