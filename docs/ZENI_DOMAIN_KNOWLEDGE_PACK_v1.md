# ZENI DOMAIN KNOWLEDGE PACK v1 — IPO · MBA · TÀI CHÍNH DOANH NGHIỆP · CƠ CHẾ VỐN
**Chủ sở hữu:** Zeni Holdings (ZeniIPO) · **Gửi cho:** đội WitsAGI để train LLM chuyên ngành nội bộ
**Phiên bản:** v1 · 2026-09-16 · **Ngôn ngữ chính:** Tiếng Việt (thuật ngữ song ngữ Việt–Anh)

---

## 1 · Bộ này là gì

Toàn bộ tri thức chuyên ngành đã được **mã hoá thành hàm chạy được** trong nền tảng ZeniIPO —
không phải bài viết sưu tầm. Mỗi con số, công thức, ngưỡng chuẩn trong bộ này đều đang chạy
trong production và có nguồn gốc file:dòng trong mã nguồn (ghi ở cuối mỗi file).

Mục tiêu train: LLM nội bộ Zeni trả lời được như **một hội đồng chuyên gia thực chiến** —
CFO, kế toán trưởng VAS, investment banker, luật sư doanh nghiệp, IR, chiến lược —
phục vụ toàn hệ sinh thái Zeni (ZeniIPO · ZeniOS · ZeniERP · Academy).

## 2 · Mục lục — 11 phần trong tài liệu này

| Phần | Nội dung | Dùng để train năng lực gì |
|---|---|---|
| 01 · Bản đồ tri thức | 9 miền tri thức + kiến trúc 3 tầng dữ liệu + 4 chế độ khách hàng | Định vị câu hỏi thuộc miền nào |
| 02 · Hành trình vốn | 10 bước Idea→IPO · cổng điều kiện · 20 tiêu chí niêm yết có trọng số | Tư vấn lộ trình, chấm mức sẵn sàng |
| 03 · Tài chính VAS | Hệ tài khoản · kết quả kinh doanh · dòng tiền gián tiếp · vốn lưu động · thuế | Đọc và dựng báo cáo tài chính chuẩn Việt Nam |
| 04 · Kinh tế đơn vị | 16 công thức + 31 ngưỡng chuẩn theo giai đoạn | Chấm sức khoẻ kinh doanh như quỹ đầu tư |
| 05 · Định giá | 3 phương pháp + công thức đầy đủ + bẫy thường gặp | Định giá doanh nghiệp, đàm phán vòng vốn |
| 06 · Tổ chức | 12 khối chức năng · 12 ghế lãnh đạo · năng lực · quyền quyết định | Thiết kế tổ chức, mô tả công việc, phân quyền |
| 07 · Vận hành tự động | 12 playbook trưởng khối + hệ 108 agent + hợp đồng hành động | Vận hành tự động có kỷ luật |
| 08 · Cơ chế vốn Việt Nam | 4 kênh vốn · 3 nghiệp vụ cần giấy phép · 3 nấc kết nối vốn hợp pháp | Tư vấn gọi vốn đúng luật Việt Nam |
| 09 · Chẩn đoán 8 trụ | Chấm doanh nghiệp hiện hữu so chuẩn vốn (thang 100) + thứ tự vá | Tái cấu trúc doanh nghiệp đang hoạt động |
| 10 · Từ điển | Thuật ngữ Việt–Anh có định nghĩa vận hành + lỗi dịch cần tránh | Chuẩn hoá ngôn ngữ, chống dịch sai |
| 11 · Mẫu hội thoại | 10 cặp hỏi–đáp thể hiện hành vi mong muốn sau khi train | Fine-tune hành vi trả lời (chuyển thành cặp instruction–response) |

## 3 · Nguyên tắc BẮT BUỘC khi train (đây là DNA nghiệp vụ, không phải style)

Model train từ bộ này phải **thừa hưởng 7 kỷ luật** sau. Mọi câu trả lời vi phạm coi là sai:

1. **Fail-closed — không đoán số.** Thiếu dữ liệu → trả lời "chưa đo được" + chỉ cách lấy dữ liệu.
   Tuyệt đối không suy diễn con số tài chính từ cảm tính.
2. **Mọi số phải kèm nguồn** dạng `{nguồn · thời điểm}`, và kèm mức kiểm chứng:
   *tự khai < đối soát sổ < xác thực ngân hàng/thuế*.
3. **Tiền là số nguyên VND.** Không dùng số thực cho tiền (sai số cộng dồn). Tỷ lệ tính lúc dùng, không lưu.
4. **Mọi dòng tiền phải gắn mã tài khoản VAS + kỳ THÁNG + mã công ty.** Không có "dòng tự do".
5. **Kế hoạch đã công bố là bất biến.** Sửa = tạo phiên bản mới, giữ nguyên bản cũ để đối chiếu.
6. **Tài liệu gửi nhà đầu tư luôn cần người duyệt.** AI chỉ đề xuất, không tự công bố.
7. **Ranh giới pháp lý vốn (Việt Nam):** không tư vấn đầu tư cá nhân hoá, không hứa lợi nhuận,
   không dùng từ "sàn/môi giới/quản lý danh mục" khi chưa có giấy phép tương ứng.

## 4 · Cách dùng cho pipeline train

- **Giai đoạn 1 — tiêm tri thức nền:** dùng phần 01–10 (toàn bộ nội dung chuyên ngành).
- **Giai đoạn 2 — dạy hành vi:** chuyển 10 mẫu ở phần 11 thành cặp instruction–response;
  mỗi mẫu đã gắn sẵn kỷ luật ở mục 3 ngay trong câu trả lời mẫu.
- **Giai đoạn 3 — neo dữ kiện:** tách các bảng ngưỡng chuẩn (phần 04), mã tài khoản (phần 03)
  và công thức (phần 03, 04, 05) thành cặp hỏi–đáp ngắn để model không bịa số.
- **Đánh giá:** bộ câu hỏi kiểm tra nên bao gồm ít nhất: (a) một câu thiếu dữ liệu — model PHẢI
  nói "chưa đo được"; (b) một câu hỏi định giá — phải nêu rõ giả định; (c) một câu chạm pháp lý
  gọi vốn — phải nêu ranh giới giấy phép.

## 5 · Giới hạn & bảo mật

- Bộ này **không chứa** dữ liệu khách hàng, số liệu tài chính thật của bất kỳ doanh nghiệp nào,
  khoá bí mật hay thông tin cá nhân. Toàn bộ là **khung phương pháp + ngưỡng chuẩn ngành**.
- Các ngưỡng chuẩn là thông lệ ngành (VC/banker) tính tới đầu 2026 — cần rà lại theo năm.
- Phần pháp lý Việt Nam là **kiến thức khung, không phải ý kiến pháp lý**; mọi triển khai
  chạm giấy phép phải có luật sư xác nhận.


---

# 01 · BẢN ĐỒ TRI THỨC & KIẾN TRÚC DỮ LIỆU

## 1 · Chín miền tri thức

| # | Miền | Câu hỏi điển hình | File chi tiết |
|---|---|---|---|
| D1 | Hành trình vốn (Idea→IPO) | "Công ty tôi đang ở bước nào? Muốn lên bước sau cần gì?" | 02 |
| D2 | Kế toán – tài chính VAS | "Ghi doanh thu vào tài khoản nào? EBITDA tính sao?" | 03 |
| D3 | Kinh tế đơn vị & tăng trưởng | "LTV:CAC 2.4 là tốt hay xấu ở vòng Series A?" | 04 |
| D4 | Định giá doanh nghiệp | "Công ty tôi đáng giá bao nhiêu? Nhà đầu tư trả bội số nào?" | 05 |
| D5 | Tổ chức & năng lực vị trí | "CFO cần năng lực gì? Ghế nào được quyền quyết định gì?" | 06 |
| D6 | Vận hành tự động & agent | "Giao việc gì cho agent? Việc nào bắt buộc người duyệt?" | 07 |
| D7 | Cơ chế vốn & pháp lý Việt Nam | "Gọi vốn cộng đồng có hợp pháp không? Phí thành công cấu trúc sao?" | 08 |
| D8 | Chẩn đoán & tái cấu trúc | "Doanh nghiệp đang chạy tốt, muốn chuẩn IPO phải vá gì?" | 09 |
| D9 | Ngôn ngữ chuẩn | "NRR là gì? Dịch runway thế nào cho đúng?" | 10 |

## 2 · Kiến trúc 3 tầng dữ liệu

Model phải hiểu để không trả lời lẫn tầng:

```
  KẾ HOẠCH  (ZeniIPO)  →  QUYẾT ĐỊNH (ZeniOS)  →  THỰC TẾ (ZeniERP)
  Mô hình kinh doanh      Nhận chỉ tiêu            Sổ kế toán VAS
  Mô hình tài chính       So kế hoạch vs thực tế   Bút toán bất biến
  Masterplan · vốn        Thẻ quyết định           Nguồn sự thật số tiền
```

**Luật phân tầng (một nguồn sự thật duy nhất):**
- Tầng KẾ HOẠCH sở hữu: mô hình kinh doanh, giả định, kế hoạch tài chính, chỉ tiêu.
- Tầng QUYẾT ĐỊNH sở hữu: bảng cổ đông, phòng dữ liệu, biên bản quyết định.
- Tầng THỰC TẾ sở hữu: sổ cái, bút toán, số dư.
- **Không tầng nào tạo bảng dữ liệu của tầng khác** — chỉ đọc qua hợp đồng API.
- Điểm gặp nhau: **chỉ tiêu theo (công ty × kỳ tháng × mã tài khoản × số tiền nguyên VND)**.

## 3 · Bốn chế độ vận hành của khách hàng

Model phải hỏi rõ chế độ trước khi tư vấn:

| Chế độ | Ai dùng | Trọng tâm tư vấn |
|---|---|---|
| startup | Khởi nghiệp 0→1 | Dựng khung: mô hình kinh doanh → mô hình tài chính → gọi vốn |
| restructure | Doanh nghiệp đang có doanh thu, cần chuẩn hoá | Chẩn đoán 8 trụ (file 09) → vá từng trụ theo thứ tự ưu tiên |
| simulation | Luyện điều hành trên kịch bản giả lập | Chạy kịch bản, học phản ứng, không ảnh hưởng dữ liệu thật |
| live_ops | Đấu nối dữ liệu thật từ hệ thống đang dùng | Đối soát, cảnh báo sớm, kỷ luật số liệu |

**Nguyên tắc trả lời:** cùng một câu hỏi "nên làm gì tiếp theo?" có đáp án KHÁC NHAU theo
chế độ và theo bước trong hành trình. Model phải xác định (chế độ, bước) trước khi khuyến nghị.

## 4 · Thang kiểm chứng dữ liệu

Dùng xuyên suốt mọi câu trả lời có số:

| Mức | Tên | Nguồn | Độ tin cậy khi gọi vốn/vay |
|---|---|---|---|
| 1 | Tự khai | Người dùng gõ tay | Thấp — chỉ dùng lập kế hoạch |
| 2 | Đối soát sổ | Khớp với sổ kế toán nội bộ | Trung bình |
| 3 | Xác thực bên thứ ba | Sao kê ngân hàng · hoá đơn điện tử (dữ liệu thuế) | Cao — ngân hàng/quỹ chấp nhận |

Khi báo một chỉ số, luôn nói kèm mức kiểm chứng. Ví dụ đúng:
> Biên lợi nhuận gộp 62% *(nguồn: sổ nội bộ tháng 8/2026 · mức 2 — đối soát sổ, chưa xác thực hoá đơn điện tử)*.

---
*Nguồn mã: `028_modes_and_connectors.sql` (4 chế độ) · `docs/TICKETS_BRAIN_V1.md` (kiến trúc 3 tầng, 8 ràng buộc).*


---

# 02 · HÀNH TRÌNH VỐN — 10 BƯỚC IDEA → IPO

> Nguyên tắc cốt lõi phải dạy model: **IPO không phải một sự kiện, mà là một CƠ CHẾ vận hành.**
> Doanh nghiệp không "chuẩn bị IPO" trong 6 tháng cuối — họ vận hành chuẩn công ty đại chúng
> từ sớm, IPO chỉ là hệ quả. Ở Việt Nam mỗi năm chỉ vài chục thương vụ niêm yết, nhưng hàng
> trăm nghìn doanh nghiệp cần đúng cái KỶ LUẬT đó để vay được vốn và gọi được vốn.

## 1 · Mười bước, sứ mệnh và cổng điều kiện

| Bước | Tên | Sứ mệnh | Chỉ số then chốt | Cổng qua bước (máy đo được) |
|---|---|---|---|---|
| 1 | Ý tưởng & Mô hình kinh doanh | Đóng khung mô hình — 9 khối BMC + hội đồng thẩm định | độ đầy BMC, điểm hội đồng | BMC ≥5/9 khối có nội dung · đã chạy hội đồng thẩm định |
| 2 | Kiểm chứng thị trường | Chứng minh thị trường: TAM/SAM/SOM + tín hiệu khách thật | TAM, SAM, SOM, tín hiệu khách | có quy mô thị trường · ≥3 tín hiệu thị trường ghi nhận |
| 3 | Sản phẩm đầu & kinh tế đơn vị | Sản phẩm đầu tiên + kinh tế đơn vị dương hướng | doanh thu tháng, CAC, LTV, tỷ lệ kích hoạt | có doanh thu trong P&L · ≥3 tháng số liệu tài chính |
| 4 | Phù hợp thị trường & tăng trưởng | Chứng minh phù hợp thị trường: tăng trưởng + giữ chân | tăng trưởng theo tháng, giữ chân, NPS | tăng trưởng tháng > 0 · OKR đang vận hành |
| 5 | Mở rộng & hệ thống | Mở rộng có kỷ luật: quy trình, OKR, sơ đồ tổ chức, tự động hoá | độ phủ quy trình, sức khoẻ OKR, nhân sự | có quy trình chuẩn · hệ thống agent đang chạy |
| 6 | Vốn & kỷ luật tài chính | P&L chuẩn kiểm toán + vòng tiền khoẻ + chiến lược vốn khớp đốt tiền | biên gộp, đốt tiền ròng, số tháng sống, vòng tiền | biên gộp > 0 · số tháng sống ≥9 HOẶC vòng vốn đang mở đủ bù · vòng vốn khớp nhu cầu tiền |
| 7 | Thể chế & quản trị | Quản trị chuẩn niêm yết: hội đồng, nghị quyết, kiểm soát nội bộ | số phiên họp HĐQT, nghị quyết, điểm tuân thủ | có thành viên HĐQT · có tài liệu quản trị |
| 8 | Sẵn sàng tiền niêm yết | Thẩm định sẵn sàng: phòng dữ liệu đầy, điểm sẵn sàng cao | điểm sẵn sàng, tài liệu phòng dữ liệu, phát hiện kiểm toán | phòng dữ liệu đủ nhóm tài liệu · điểm sẵn sàng tăng liên tục |
| 9 | Thực thi niêm yết | Bản cáo bạch, roadshow, định giá, bảo lãnh phát hành | điểm sẵn sàng, khoảng định giá, độ phủ sổ lệnh | điểm sẵn sàng ≥85 · có định giá + nhóm công ty so sánh |
| 10 | Niêm yết & sau niêm yết | Vận hành công ty đại chúng: quan hệ nhà đầu tư, báo cáo quý, tuân thủ | diễn biến cổ phiếu, nhịp IR, báo cáo quý | đã niêm yết |

**Quy tắc tư vấn:** không bao giờ khuyên nhảy cóc. Nếu khách ở bước 3 mà hỏi chuyện định giá
IPO, hãy nêu ngắn gọn bức tranh xa rồi kéo về **điều kiện của bước kế tiếp** — không qua cổng
thì mọi việc sau đều vô nghĩa.

## 2 · Hai mươi tiêu chí sẵn sàng niêm yết (có trọng số — thang 100)

| Nhóm | Tiêu chí | Trọng số |
|---|---|---|
| Kiểm toán | Kiểm toán bởi công ty kiểm toán lớn, 2 năm liên tiếp | 2.0 |
| Kiểm toán | Kiểm soát nội bộ chuẩn SOX/SGX | 2.0 |
| Tài chính | Báo cáo theo chuẩn quốc tế IFRS | 1.5 |
| Tài chính | Báo cáo 3 năm sạch, không phải trình bày lại | 2.0 |
| Tài chính | Ghi nhận doanh thu chuẩn ASC606/IFRS15 | 1.5 |
| Quản trị | HĐQT có ≥3 thành viên độc lập | 1.5 |
| Quản trị | Đã lập uỷ ban kiểm toán | 1.0 |
| Quản trị | Sổ tay quản trị đã ký ban hành | 1.0 |
| Quản trị | Chính sách chống giao dịch nội gián | 0.5 |
| Pháp lý | Cấu trúc pháp nhân sạch | 1.5 |
| Pháp lý | Hoàn tất rà soát danh mục sở hữu trí tuệ | 1.0 |
| Pháp lý | Công bố đầy đủ tranh chấp, kiện tụng | 1.0 |
| Công bố | Khung công bố ESG (TCFD/GRI) | 1.0 |
| Công bố | Đã soạn thảo luận & phân tích của ban điều hành | 1.0 |
| Công bố | Đã soạn bản cáo bạch | 2.0 |
| Rủi ro | Khung quản trị rủi ro doanh nghiệp | 1.0 |
| Rủi ro | Đã mua bảo hiểm trách nhiệm lãnh đạo (D&O) | 0.5 |
| Vận hành | Đã chọn tổ chức bảo lãnh phát hành chính | 1.5 |
| Vận hành | Hệ thống quản trị nguồn lực mức sản xuất | 1.0 |
| Đội ngũ | CFO đủ năng lực công ty đại chúng | 1.5 |

**Ngưỡng:** điểm sẵn sàng **≥85/100** mới nên nộp hồ sơ. Dưới ngưỡng mà vẫn nộp thì rủi ro bị
trả hồ sơ, tốn phí tư vấn và mất uy tín với thị trường.

## 3 · Đặc thù Việt Nam — model phải phân biệt với chuẩn Mỹ/Singapore

- Niêm yết trong nước đòi hỏi **báo cáo tài chính kiểm toán 2 năm liên tiếp**, **ROE dương**,
  **không còn lỗ luỹ kế**, quản trị công ty đủ chuẩn. Đây là bộ lọc cứng — doanh nghiệp còn
  lỗ luỹ kế thì chưa cần bàn việc khác.
- Sổ sách theo **Chuẩn mực kế toán Việt Nam (VAS)**; muốn ra vốn quốc tế thường cần chuyển đổi
  hoặc đối chiếu sang IFRS — chi phí và thời gian phải tính vào lộ trình.
- Nhiều doanh nghiệp vừa và nhỏ **giữ nhiều hệ sổ** vì lý do thuế. Đây là rào cản THẬT của
  hành trình vốn: minh bạch hoá phải đổi lại được TIỀN (khoản vay, vòng vốn) thì chủ doanh
  nghiệp mới làm. Tư vấn phải nói thẳng điều này, không né tránh.
- Kênh vốn lớn nhất của doanh nghiệp vừa và nhỏ Việt Nam là **tín dụng ngân hàng**, không phải
  quỹ mạo hiểm. Hồ sơ vay chuẩn hoá thường sinh lợi sớm hơn gọi vốn cổ phần.
- Startup hướng vốn quốc tế hay lập **công ty mẹ ở Singapore** + công ty vận hành Việt Nam;
  khi đó tồn tại song song hai hệ: sổ VAS cho công ty Việt Nam và bảng cổ đông kiểu quốc tế
  (SAFE, trái phiếu chuyển đổi) ở công ty mẹ.

---
*Nguồn mã: `025_business_spine.sql` (10 bước + cổng) · `003_ipo_complete_flows.sql` (20 tiêu chí + trọng số) · `026_mba_ipo_engine.sql` (ngưỡng 85).*


---

# 03 · KẾ TOÁN – TÀI CHÍNH CHUẨN VIỆT NAM (VAS) & MÔ HÌNH TÀI CHÍNH

## 1 · Hệ tài khoản dùng cho mô hình kế hoạch (13 mã bắt buộc)

Mọi dòng tiền trong kế hoạch **bắt buộc** gắn một mã dưới đây. Không có "dòng tự do".
Cột *dấu* là chiều tác động lên lợi nhuận (+1 cộng, −1 trừ).

| Mã | Tên khoản mục | Báo cáo | Dấu | Nhóm |
|---|---|---|---|---|
| 5111 | Doanh thu bán hàng | Kết quả kinh doanh | +1 | doanh thu |
| 5113 | Doanh thu cung cấp dịch vụ | Kết quả kinh doanh | +1 | doanh thu |
| 521 | Các khoản giảm trừ doanh thu | Kết quả kinh doanh | −1 | giảm trừ doanh thu |
| 632 | Giá vốn hàng bán | Kết quả kinh doanh | −1 | giá vốn |
| 6411 | Chi phí bán hàng — nhân sự | Kết quả kinh doanh | −1 | chi phí bán hàng |
| 6417 | Chi phí bán hàng — marketing | Kết quả kinh doanh | −1 | chi phí bán hàng |
| 6421 | Chi phí quản lý — nhân sự | Kết quả kinh doanh | −1 | chi phí quản lý |
| 6427 | Chi phí quản lý — thuê văn phòng | Kết quả kinh doanh | −1 | chi phí quản lý |
| 635 | Chi phí tài chính | Kết quả kinh doanh | −1 | tài chính |
| 515 | Doanh thu hoạt động tài chính | Kết quả kinh doanh | +1 | tài chính |
| 711 | Thu nhập khác | Kết quả kinh doanh | +1 | khác |
| 811 | Chi phí khác | Kết quả kinh doanh | −1 | khác |
| 821 | Chi phí thuế thu nhập doanh nghiệp | Kết quả kinh doanh | −1 | thuế |

**Vì sao bắt buộc:** chỉ khi kế hoạch và sổ thật dùng CHUNG một hệ mã thì mới so được
kế hoạch với thực tế từng đồng. Đây là điều kiện tiên quyết để ngân hàng và quỹ tin số liệu.

## 2 · Chuỗi tính toán kết quả kinh doanh (thứ tự cố định)

```
EBITDA      = doanh thu(5111+5113) − giảm trừ(521) − giá vốn(632)
              − chi phí bán hàng(6411+6417) − chi phí quản lý(6421+6427)

EBT         = EBITDA − chi phí tài chính(635) + doanh thu tài chính(515)
              + thu nhập khác(711) − chi phí khác(811)

Thuế (821)  = max(0, EBT) × thuế suất
              (thuế suất lấy từ bảng cấu hình có ngày hiệu lực — KHÔNG cố định trong công thức;
               thuế suất phổ thông hiện hành ở Việt Nam là 20%, nhưng phải tra bảng vì có
               ưu đãi theo ngành/địa bàn và có thể thay đổi theo năm)

Lợi nhuận sau thuế = EBT − thuế
```

**Bẫy thường gặp:** lỗ thì thuế bằng 0, không âm — nhiều mô hình Excel để thuế âm tạo ra
"lãi nhờ lỗ", sai hoàn toàn. Công thức `max(0, EBT)` xử lý đúng việc này.

## 3 · Bốn kiểu quy luật sinh số (driver) cho từng dòng

| Kiểu | Cách tính | Dùng cho |
|---|---|---|
| Giá × sản lượng | đơn giá × số lượng bán trong kỳ | doanh thu sản phẩm/dịch vụ truyền thống |
| Doanh thu định kỳ | MRR kỳ này = MRR kỳ trước × (1 + tăng trưởng mới − rời bỏ) | mô hình thuê bao, phần mềm |
| Phần trăm doanh thu | hệ số % × doanh thu cùng kỳ | giá vốn, hoa hồng, phí giao dịch |
| Nhân sự | số người × lương × (1 + tỷ lệ bảo hiểm bắt buộc) | chi phí nhân sự bán hàng và quản lý |

Nguyên tắc: **chi phí nhân sự phải tính đủ phần đóng góp bảo hiểm của doanh nghiệp**, nếu
chỉ tính lương gross thì thiếu đáng kể — lỗi rất phổ biến ở mô hình tự làm.

## 4 · Dòng tiền gián tiếp & vốn lưu động (phần hay sai nhất)

```
Phải thu   = doanh thu × số ngày phải thu ÷ 30
Tồn kho    = giá vốn × số ngày tồn kho ÷ 30
Phải trả   = giá vốn × số ngày phải trả ÷ 30

Vốn lưu động = phải thu + tồn kho − phải trả
Δ vốn lưu động tăng  →  TIỀN BỊ GIAM  →  trừ khỏi dòng tiền
Dòng tiền thuần ≈ lợi nhuận sau thuế − Δ vốn lưu động − đầu tư tài sản
Tiền cuối kỳ = tiền đầu kỳ + dòng tiền thuần   (kỳ này nối kỳ sau, không đứt)
```

**Bài học sống còn:** doanh nghiệp **có lãi vẫn chết vì hết tiền**. Lãi trên giấy nhưng
khách trả chậm 90 ngày và hàng tồn 60 ngày thì tiền nằm ở phải thu và kho, không nằm ở
tài khoản. Đây là lý do vòng tiền quan trọng ngang lợi nhuận.

**Vòng quay tiền mặt:** `vòng tiền = ngày phải thu + ngày tồn kho − ngày phải trả`.
Càng thấp càng khoẻ; âm là tuyệt vời (khách trả trước, nhà cung cấp cho nợ).

## 5 · Mười một chỉ số tài chính sinh tự động từ báo cáo tháng

| Chỉ số | Công thức | Đọc hiểu |
|---|---|---|
| Tăng trưởng theo tháng | (doanh thu kỳ này − kỳ trước) ÷ kỳ trước × 100 | nhịp tăng ngắn hạn |
| Biên lợi nhuận gộp | (doanh thu − giá vốn) ÷ doanh thu × 100 | chất lượng mô hình kinh doanh |
| EBITDA | xem mục 2 | khả năng sinh tiền từ hoạt động cốt lõi |
| Đốt tiền ròng | phần âm của EBITDA sau trừ đầu tư | mỗi tháng mất bao nhiêu tiền |
| Số dư tiền | tiền cuối kỳ | tài sản sống còn |
| Số tháng sống (runway) | số dư tiền ÷ đốt tiền trung bình 3 tháng | còn bao lâu trước khi hết tiền |
| Ngày phải thu | phải thu ÷ doanh thu × 30 | khách trả chậm bao lâu |
| Ngày tồn kho | tồn kho ÷ giá vốn × 30 | hàng nằm kho bao lâu |
| Ngày phải trả | phải trả ÷ giá vốn × 30 | mình trả nhà cung cấp bao lâu |
| Vòng quay tiền mặt | phải thu + tồn kho − phải trả (ngày) | tiền quay một vòng mất bao lâu |
| Nhu cầu vốn | đốt tiền × (số tháng sàn + đệm) − tiền hiện có | cần gọi bao nhiêu cho vòng tới |

**Quy tắc khớp vốn:** một vòng gọi vốn hợp lý phải đủ nuôi doanh nghiệp tới mốc kết quả
tiếp theo cộng thêm đệm an toàn. Thực hành phổ biến: nhắm **18 tháng sống** sau khi nhận
tiền, và bắt đầu gọi vốn khi còn **ít nhất 9 tháng** — gọi vốn lúc sắp hết tiền là gọi ở
thế yếu, định giá sẽ bị ép.

## 6 · Bốn bất biến kiểm tra mô hình (nếu vỡ thì mô hình sai, không được dùng)

1. **Tổng 12 tháng = tổng năm** cho từng dòng — không được lệch dù 1 đồng.
2. **Tiền liên tục:** số dư cuối tháng này = số dư đầu tháng sau.
3. **Tiền là số nguyên VND** — không dùng số thực, tránh sai số cộng dồn.
4. **Giả định vô lý thì dừng, không đoán:** tỷ lệ âm, phần trăm >100, số tháng âm → báo lỗi
   rõ ràng thay vì tự "sửa" thành số hợp lý.

## 7 · Phân tích độ nhạy (bắt buộc khi trình nhà đầu tư)

Ba kịch bản (cơ sở / lạc quan / thận trọng) phải dùng **cùng một bộ giả định gốc**, chỉ khác
tham số — không được dựng ba mô hình rời rạc. Ngoài ra chạy **phân tích độ nhạy hình phễu**:
bơm từng giả định ±10% và ±20%, xem EBITDA năm thứ 3 đổi bao nhiêu, xếp hạng giả định nào
ảnh hưởng lớn nhất. Đó chính là danh sách rủi ro cần quản trị.

## 8 · Đọc số liệu Việt Nam (chuẩn hoá dữ liệu nhập)

- Dấu chấm trong `1.500.000` là **dấu phân cách hàng nghìn** → giá trị 1.500.000.
  Nhưng `1500.75` là số thập phân → 1500,75. Nhận diện bằng quy luật nhóm 3 chữ số.
- `(500)` trong báo cáo kế toán nghĩa là **âm 500**.
- Ngày `15/06/2026` là ngày 15 tháng 6 — không phải 6 tháng 15.
- Kỳ báo cáo luôn quy về **ngày đầu tháng** để ghép dữ liệu nhiều nguồn.

---
*Nguồn mã: `029_plan_tier.sql` (13 mã tài khoản, bảng thuế suất) · `apps/web/src/lib/plan/engine.ts` (chuỗi EBITDA→EBT→thuế, vốn lưu động, 4 bất biến, độ nhạy) · `025_business_spine.sql` (11 chỉ số) · `apps/web/src/lib/connectors/ingest.ts` (chuẩn hoá số liệu Việt Nam).*


---

# 04 · KINH TẾ ĐƠN VỊ & NGƯỠNG CHUẨN THEO GIAI ĐOẠN

> Đây là bộ thước mà quỹ đầu tư và ngân hàng đầu tư dùng để chấm doanh nghiệp. Model phải
> tính được, giải thích được **ý nghĩa kinh doanh**, và so được với ngưỡng theo đúng giai đoạn.

## 1 · Mười sáu công thức (tính trên dữ liệu tháng)

| Chỉ số | Công thức | Ý nghĩa |
|---|---|---|
| Doanh thu bình quân mỗi khách (ARPU) | (MRR đầu kỳ + MRR mới + MRR mở rộng − MRR thu hẹp − MRR mất) ÷ số khách đang hoạt động | mỗi khách mang về bao nhiêu/tháng |
| Chi phí thu hút khách (CAC) | tổng chi phí bán hàng & marketing trong kỳ ÷ số khách mới | mua một khách tốn bao nhiêu |
| Tỷ lệ rời bỏ theo khách | khách rời ÷ (khách hoạt động − khách mới + khách rời) × 100 | mỗi tháng mất bao nhiêu % khách |
| Giá trị vòng đời khách (LTV) | ARPU × biên gộp% ÷ tỷ lệ rời bỏ tháng% | một khách mang lại bao nhiêu lợi nhuận gộp cả đời |
| LTV:CAC | LTV ÷ CAC | mỗi đồng bỏ ra thu về mấy đồng |
| Thời gian hoàn vốn khách | CAC ÷ (ARPU × biên gộp%) | bao nhiêu tháng thì hoà vốn một khách |
| Giữ chân doanh thu ròng (NRR) | (MRR đầu kỳ + mở rộng − thu hẹp − mất) ÷ MRR đầu kỳ × 100 | khách cũ tự lớn lên hay teo đi |
| Giữ chân doanh thu gộp (GRR) | (MRR đầu kỳ − thu hẹp − mất) ÷ MRR đầu kỳ × 100 | mức rò rỉ thuần, không tính upsell |
| Tỷ số nhanh | (MRR mới + mở rộng) ÷ (MRR mất + thu hẹp) | tốc độ thêm so với tốc độ mất |
| Doanh thu định kỳ năm (ARR) | MRR cuối kỳ × 12 | quy mô doanh thu chuẩn hoá |
| ARR ròng tăng thêm | ARR kỳ này − ARR kỳ trước | lượng tăng trưởng tuyệt đối |
| Tăng trưởng năm | (ARR kỳ này − kỳ trước) ÷ kỳ trước × 100 | nhịp tăng |
| Biên EBITDA | EBITDA ÷ doanh thu × 100 | khả năng sinh lời |
| Quy tắc 40 | tăng trưởng% + biên EBITDA% | cân bằng tăng trưởng và lợi nhuận |
| Bội số đốt tiền | đốt tiền ròng (năm hoá) ÷ ARR ròng tăng thêm | đốt mấy đồng để ra một đồng doanh thu mới |
| Hệ số kỳ diệu | (doanh thu kỳ này − kỳ trước) × 4 ÷ chi phí bán hàng kỳ trước | tiền bán hàng có đẩy được doanh thu không |

**Lưu ý phương pháp:** LTV dùng **biên gộp**, không dùng doanh thu — nếu dùng doanh thu thì
LTV bị thổi phồng và mọi quyết định chi marketing đều sai. Đây là lỗi phổ biến nhất khi
doanh nghiệp tự tính.

## 2 · Ba mươi mốt ngưỡng chuẩn theo giai đoạn

Ký hiệu: *tối thiểu* = phải lớn hơn hoặc bằng · *tối đa* = phải nhỏ hơn hoặc bằng.

| Chỉ số | Giai đoạn | Ngưỡng | Ghi chú thực chiến |
|---|---|---|---|
| LTV:CAC | Hạt giống | ≥3 | Chuẩn kinh điển: dưới 3 thì chưa nên mở rộng |
| LTV:CAC | Vòng A | ≥3 | Dưới 1 là đốt tiền mua khách lỗ |
| LTV:CAC | Vòng B | ≥3.5 | Mở rộng phải chứng minh hiệu quả tăng |
| LTV:CAC | Tăng trưởng | ≥4 | Giai đoạn này đòi hỏi cao hơn |
| LTV:CAC | Tiền niêm yết | ≥4 | Ngân hàng đầu tư soi kỹ chất lượng tăng trưởng |
| Hoàn vốn khách | Hạt giống | ≤18 tháng | Giai đoạn sớm cho phép dài hơn |
| Hoàn vốn khách | Vòng A | ≤15 tháng | |
| Hoàn vốn khách | Vòng B | ≤12 tháng | Chuẩn tốt của mô hình thuê bao |
| Hoàn vốn khách | Tăng trưởng | ≤12 tháng | |
| Hoàn vốn khách | Tiền niêm yết | ≤12 tháng | Để câu chuyện niêm yết thuyết phục |
| Biên lợi nhuận gộp | Vòng A | ≥60% | Phần mềm ≥70% · dịch vụ ≥40% · ăn uống 55–65% |
| Biên lợi nhuận gộp | Vòng B | ≥65% | Biên phải mở rộng theo quy mô |
| Biên lợi nhuận gộp | Tiền niêm yết | ≥70% | Chuẩn công ty đại chúng ngành công nghệ |
| Giữ chân doanh thu ròng | Vòng A | ≥100% | Bằng 100% nghĩa là khách cũ tự bù phần rời bỏ |
| Giữ chân doanh thu ròng | Vòng B | ≥110% | Chuẩn tốt |
| Giữ chân doanh thu ròng | Tiền niêm yết | ≥120% | Nhóm dẫn đầu khi niêm yết |
| Giữ chân doanh thu gộp | Vòng B | ≥85% | Khách doanh nghiệp lớn nên ≥90% |
| Giữ chân doanh thu gộp | Tiền niêm yết | ≥90% | |
| Quy tắc 40 | Vòng B | ≥40 | Tăng trưởng% + biên EBITDA% |
| Quy tắc 40 | Tăng trưởng | ≥40 | Chuẩn vàng công ty phần mềm |
| Quy tắc 40 | Tiền niêm yết | ≥40 | Gần như bắt buộc khi niêm yết công nghệ |
| Bội số đốt tiền | Vòng A | ≤2 | Dưới 1 là xuất sắc · 1–1.5 tốt · trên 2 xấu |
| Bội số đốt tiền | Vòng B | ≤1.5 | |
| Bội số đốt tiền | Tiền niêm yết | ≤1 | Phải đốt tiền hiệu quả |
| Hệ số kỳ diệu | Vòng B | ≥0.75 | Đạt ngưỡng này mới nên tăng chi bán hàng |
| Tỷ số nhanh | Vòng A | ≥4 | Thêm gấp 4 lần mất |
| Số tháng sống | Hạt giống | ≥12 tháng | Dưới mức này là gọi vốn ở thế yếu |
| Số tháng sống | Vòng A | ≥18 tháng | Chuẩn an toàn |
| Số tháng sống | Vòng B | ≥18 tháng | |
| Vòng quay tiền mặt | Tăng trưởng | ≤45 ngày | Càng thấp càng khoẻ; âm là tuyệt vời |
| Điểm sẵn sàng niêm yết | Tiền niêm yết | ≥85/100 | Mới nên nộp hồ sơ |

## 3 · Cách chấm và diễn giải (hành vi model cần học)

Khi khách đưa một con số, quy trình trả lời chuẩn:

1. **Xác định giai đoạn** — cùng chỉ số, ngưỡng khác nhau. LTV:CAC 3.2 là ĐẠT ở vòng A
   nhưng CHƯA ĐẠT ở tăng trưởng.
2. **So ngưỡng và nói rõ đạt/chưa đạt**, kèm khoảng cách bao nhiêu.
3. **Giải thích nguyên nhân gốc** — ví dụ LTV:CAC thấp thường do một trong ba: rời bỏ cao,
   biên gộp mỏng, hoặc chi phí thu hút khách đắt. Chỉ ra cần đo thêm gì để biết nguyên nhân nào.
4. **Đề xuất hành động theo thứ tự đòn bẩy**, không liệt kê tràn lan.
5. **Nêu mức kiểm chứng của số liệu** — nếu là số tự khai thì phải nói rõ kết luận chỉ mang
   tính tham khảo cho tới khi đối soát.

**Ví dụ mẫu chuẩn:**
> LTV:CAC của anh đang 2.1 ở vòng A — chuẩn là ≥3, tức còn thiếu khoảng 30%. Ba nguyên nhân
> có thể: (1) rời bỏ 5%/tháng là cao, kéo LTV xuống; (2) biên gộp 48% mỏng so với mô hình
> phần mềm; (3) chi phí thu hút khách tăng. Với dữ liệu hiện có, rời bỏ là đòn bẩy lớn nhất:
> giảm rời bỏ từ 5% xuống 3% sẽ nâng LTV khoảng 67% mà không tốn thêm tiền marketing.
> *(nguồn: số liệu tháng 8/2026 · mức 1 — tự khai, nên đối soát sổ trước khi dùng cho hồ sơ vốn.)*

---
*Nguồn mã: `026_mba_ipo_engine.sql` — bảng `ipo_benchmarks` (31 dòng ngưỡng) + hàm `derive_unit_economics` (16 công thức) + hàm `grade_vs_benchmark` (chấm theo giai đoạn).*


---

# 05 · ĐỊNH GIÁ DOANH NGHIỆP — 3 PHƯƠNG PHÁP CHUẨN

> Nguyên tắc nghề: **không có một con số đúng duy nhất.** Định giá là một KHOẢNG, dựng từ
> nhiều phương pháp độc lập rồi đối chiếu. Ai đưa ra đúng một con số chắc nịch mà không nêu
> giả định thì hoặc đang bán hàng, hoặc chưa hiểu nghề.

## 1 · Phương pháp so sánh thị trường (dùng đầu tiên)

Dựa trên bội số mà thị trường ĐANG trả cho công ty cùng ngành, cùng quy mô, cùng tốc độ tăng.

```
Giá trị doanh nghiệp theo doanh thu = doanh thu × trung vị(bội số giá trị/doanh thu)
Giá trị doanh nghiệp theo EBITDA    = EBITDA  × trung vị(bội số giá trị/EBITDA)
Giá trị doanh nghiệp thô            = trung bình các cách tính có dữ liệu hợp lệ
Giá trị doanh nghiệp                = giá trị thô × (1 − chiết khấu thanh khoản)
Giá trị vốn chủ sở hữu              = giá trị doanh nghiệp − nợ ròng
```

- Dùng **trung vị** chứ không phải trung bình cho bội số — một công ty ngoại lai sẽ bóp méo trung bình.
- **Chiết khấu thanh khoản** cho công ty chưa niêm yết: thực hành phổ biến khoảng **25%**
  (cổ phần công ty tư nhân không bán ngay được như cổ phiếu niêm yết).
- Chỉ dùng bội số EBITDA khi EBITDA **dương**; công ty còn lỗ thì dùng bội số doanh thu.
- Bội số hệ số giá trên lợi nhuận chỉ áp dụng khi có lợi nhuận sau thuế dương.

**Bẫy:** lấy bội số của công ty niêm yết Mỹ áp thẳng cho doanh nghiệp Việt Nam chưa niêm yết
là sai kép — khác thị trường, khác thanh khoản, khác quy mô. Phải chiết khấu và nêu rõ.

## 2 · Phương pháp chiết khấu dòng tiền (chuẩn học thuật)

```
Với mỗi năm y từ 1..n:
    dòng tiền tự do(y)   = dòng tiền năm 1 × (1 + tăng trưởng)^(y−1)
    giá trị hiện tại(y)  = dòng tiền tự do(y) ÷ (1 + chi phí vốn)^y

Giá trị cuối kỳ         = dòng tiền năm cuối × (1 + tăng trưởng vĩnh viễn)
                          ÷ (chi phí vốn − tăng trưởng vĩnh viễn)
Giá trị hiện tại cuối kỳ = giá trị cuối kỳ ÷ (1 + chi phí vốn)^n
Giá trị doanh nghiệp     = tổng giá trị hiện tại các năm + giá trị hiện tại cuối kỳ
Giá trị vốn chủ sở hữu   = giá trị doanh nghiệp − nợ ròng
```

**Điều kiện bắt buộc:** chi phí vốn phải **lớn hơn** tăng trưởng vĩnh viễn. Nếu không, mẫu số
âm hoặc bằng 0 và mô hình vô nghĩa — phải báo lỗi, tuyệt đối không trả ra con số.

**Kiểm tra sức khoẻ:** nếu **giá trị cuối kỳ chiếm trên 75%** tổng giá trị thì mô hình đang
"đặt cược vào tương lai xa" — phải cảnh báo người dùng, vì kết quả cực nhạy với giả định.
Tăng trưởng vĩnh viễn hợp lý không nên vượt tốc độ tăng trưởng dài hạn của nền kinh tế.

## 3 · Phương pháp quỹ mạo hiểm (dùng khi đàm phán vòng vốn)

Đi ngược từ giá trị thoái vốn kỳ vọng về hôm nay theo tỷ suất sinh lời mục tiêu của quỹ.

```
Giá trị thoái vốn      = doanh thu khi thoái vốn × bội số khi thoái vốn
Định giá sau đầu tư    = giá trị thoái vốn ÷ (1 + tỷ suất mục tiêu)^số năm tới khi thoái
Định giá trước đầu tư  = định giá sau đầu tư − số tiền đầu tư
Tỷ lệ sở hữu cần       = số tiền đầu tư ÷ định giá sau đầu tư × 100
Tỷ lệ sở hữu điều chỉnh = tỷ lệ sở hữu cần ÷ (1 − pha loãng dự kiến các vòng sau)
```

- Pha loãng mặc định các vòng sau: khoảng **25%** — quỹ luôn tính phần này, nếu người sáng lập
  không tính thì sẽ bất ngờ khi bảng cổ đông sau 2 vòng.
- Tỷ suất mục tiêu của quỹ mạo hiểm thường rất cao (nhiều chục phần trăm mỗi năm) vì phần lớn
  danh mục sẽ mất trắng — đây không phải quỹ "tham", mà là toán xác suất của lớp tài sản này.

## 4 · Cách trình bày kết quả (bắt buộc)

1. Đưa **khoảng giá trị** từ nhiều phương pháp, không đưa một số duy nhất.
2. Liệt kê **toàn bộ giả định** đã dùng (tăng trưởng, chi phí vốn, bội số, chiết khấu, pha loãng).
3. Nói rõ **phương pháp nào phù hợp nhất với giai đoạn**: công ty sớm chưa có lợi nhuận thì
   so sánh thị trường và phương pháp quỹ mạo hiểm có ý nghĩa hơn chiết khấu dòng tiền.
4. Nêu **điều gì làm thay đổi kết quả nhiều nhất** (thường là tăng trưởng và chi phí vốn).
5. Kèm cảnh báo: đây là **ước tính phục vụ đàm phán**, không phải thẩm định giá theo quy định
   pháp luật; giao dịch thật cần đơn vị thẩm định giá có chức năng.

## 5 · Yếu tố thực chiến ảnh hưởng bội số (ngoài công thức)

Tăng bội số: giữ chân doanh thu ròng cao · biên gộp lớn · tăng trưởng bền · doanh thu định kỳ ·
khách hàng phân tán (không phụ thuộc vài khách lớn) · sổ sách sạch, kiểm toán được · đội ngũ đủ.

Giảm bội số: phụ thuộc một khách hoặc một kênh · biên mỏng · rời bỏ cao · sổ sách nhiều hệ ·
pháp lý sở hữu trí tuệ chưa rõ · người sáng lập ôm mọi quyết định (rủi ro nhân sự chủ chốt) ·
tranh chấp chưa xử lý.

---
*Nguồn mã: `apps/web/src/lib/finance/valuation.ts` — ba hàm thuần `valuateComparables`, `valuateDcf`, `valuateVcMethod` (17/17 kiểm thử số cứng đạt).*


---

# 06 · TỔ CHỨC, NĂNG LỰC VỊ TRÍ & QUYỀN QUYẾT ĐỊNH

> Nguyên tắc: **tổ chức là bảng cổ đông sống.** Doanh nghiệp chuẩn vốn phải trả lời được ba câu
> cho mọi ghế: ghế này SỞ HỮU chỉ số nào · được QUYẾT ĐỊNH việc gì · cần NĂNG LỰC gì.
> Không trả lời được thì khi thẩm định, nhà đầu tư sẽ kết luận "công ty phụ thuộc người sáng lập".

## 1 · Mười hai khối chức năng

| Khối | Sứ mệnh |
|---|---|
| Ban điều hành | Chốt chiến lược, phân bổ vốn, chịu trách nhiệm kết quả trước HĐQT và cổ đông |
| Tài chính — Kế toán | Giữ mạch máu tiền: kết quả kinh doanh chuẩn kiểm toán, dòng tiền, ngân sách, thuế, quan hệ ngân hàng |
| Kinh doanh | Biến sản phẩm thành doanh thu: đường ống bán hàng kỷ luật, dự báo chuẩn, mở rộng khách hiện hữu |
| Marketing — Thương hiệu | Tạo nhu cầu hiệu quả và dựng câu chuyện giá trị cho nhà đầu tư |
| Sản phẩm | Ship đúng chỉ số Bắc Đẩu, đo mức sử dụng, loại bỏ tính năng không ai dùng |
| Công nghệ | Độ sẵn sàng hệ thống, tốc độ, bảo mật, nợ kỹ thuật kiểm soát được |
| Vận hành | Chuẩn hoá mọi quy trình lặp lại, đo cam kết dịch vụ, giảm chi phí đơn vị theo quy mô |
| Nhân sự — Tổ chức | Đúng người đúng ghế, quyền chọn cổ phần minh bạch, giữ nhân sự chủ chốt |
| Pháp chế — Tuân thủ | Giấy phép, hợp đồng, sở hữu trí tuệ, tuân thủ đủ chuẩn để không gãy khi thẩm định |
| Quản trị công ty | Hội đồng quản trị, nghị quyết, uỷ ban, kiểm soát nội bộ chuẩn công ty niêm yết |
| Quan hệ nhà đầu tư | Giữ dòng vốn và niềm tin: danh sách nhà đầu tư, phòng dữ liệu, cập nhật định kỳ |
| An ninh — Rủi ro | Bảo mật dữ liệu, quản trị rủi ro, không để xảy ra sự cố rò rỉ trước và trong niêm yết |

## 2 · Mười hai ghế lãnh đạo — quyền quyết định và chỉ số sở hữu

| Ghế | Báo cáo cho | Được quyền quyết định | Sở hữu chỉ số | Xuất hiện từ bước |
|---|---|---|---|---|
| Chủ tịch HĐQT | Cổ đông | Phê duyệt chiến lược & masterplan · chốt vòng gọi vốn và định giá · bổ nhiệm/miễn nhiệm CEO · phê duyệt mua bán sáp nhập · quyết định niêm yết | định giá, điểm sẵn sàng, quy tắc 40 | 1 |
| Tổng giám đốc | Chủ tịch | Phê duyệt ngân sách năm · bổ nhiệm cấp giám đốc · chốt giá và mô hình kinh doanh · phê duyệt tuyển dụng cấp quản lý | doanh thu tháng, quy tắc 40, số tháng sống, giữ chân doanh thu ròng | 1 |
| Giám đốc tài chính | CEO | Phê duyệt chi vượt ngân sách · chốt chính sách kế toán · chọn kiểm toán độc lập · quản lý quan hệ ngân hàng | biên gộp, EBITDA, đốt tiền ròng, số tháng sống, vòng quay tiền, bội số đốt tiền | 3 |
| Giám đốc vận hành | CEO | Phê duyệt quy trình chuẩn · chọn nhà cung cấp lớn · quyết định năng lực phục vụ | chi phí đơn vị, tỷ lệ đúng hạn, thời gian chu trình, độ phủ quy trình | 4 |
| Giám đốc kinh doanh | CEO | Phê duyệt chiết khấu ngoài khung · chốt hợp đồng chiến lược · thiết kế địa bàn và hạn ngạch | doanh thu định kỳ năm, tăng thêm ròng, tỷ lệ thắng, hệ số kỳ diệu, giá trị đường ống | 3 |
| Giám đốc marketing | CEO | Phân bổ ngân sách kênh · phê duyệt nhận diện thương hiệu · chốt thông điệp ra thị trường | chi phí thu hút khách, LTV:CAC, số khách tiềm năng đạt chuẩn, lưu lượng thương hiệu | 3 |
| Giám đốc sản phẩm | CEO | Chốt lộ trình sản phẩm · quyết định ngừng tính năng · định nghĩa chỉ số Bắc Đẩu | tỷ lệ kích hoạt, giữ chân doanh thu ròng, chỉ số hài lòng, mức dùng tính năng | 3 |
| Giám đốc công nghệ | CEO | Chọn kiến trúc và công nghệ lõi · phê duyệt chi hạ tầng · quyết định tự làm hay mua | độ sẵn sàng hệ thống, độ trễ, tần suất triển khai, số sự cố | 3 |
| Giám đốc nhân sự | CEO | Phê duyệt khung lương · thiết kế quyền chọn cổ phần · chốt cơ cấu tổ chức | quy mô nhân sự, tỷ lệ nghỉ việc, quỹ quyền chọn đã dùng, thời gian tuyển | 4 |
| Giám đốc pháp chế | CEO | Phê duyệt hợp đồng mẫu · chốt phương án xử lý tranh chấp · quyết định đăng ký sở hữu trí tuệ | số giấy phép còn hiệu lực, điểm tuân thủ | 4 |
| Trưởng quan hệ nhà đầu tư | CFO | Nhịp cập nhật nhà đầu tư · quản trị quyền truy cập phòng dữ liệu | số nhà đầu tư trong danh sách, tiến độ vòng vốn, độ sẵn sàng phòng dữ liệu | 6 |
| Trưởng phòng tài chính | CFO | Duyệt chi trong hạn mức · quản lý công nợ phải thu, phải trả | ngày phải thu, ngày phải trả, vòng quay tiền | 3 |

**Cách dùng cột "xuất hiện từ bước":** doanh nghiệp bước 1–2 không cần đủ 12 ghế. Nhưng đến
bước 6 mà chưa có ai thực sự sở hữu số tài chính, hoặc bước 7 mà chưa có pháp chế và quản trị,
thì đó là **lỗ hổng tổ chức** phải chỉ ra ngay.

## 3 · Khung năng lực (bốn nhóm, bốn cấp độ)

Nhóm: **chiến lược · tài chính · vận hành · con người** (thêm *quản trị* cho ghế hội đồng).
Cấp độ: *cơ bản → thành thạo → nâng cao → chuyên gia*.

Ví dụ chuẩn — Chủ tịch HĐQT:
- Tư duy chiến lược dài hạn (10 năm) — chuyên gia
- Quản trị công ty và trách nhiệm uỷ thác — chuyên gia
- Cấu trúc vốn và pha loãng — nâng cao
- Quan hệ nhà đầu tư tổ chức — nâng cao
- Đánh giá và bổ nhiệm nhân sự cấp cao — chuyên gia

Ví dụ chuẩn — Giám đốc tài chính:
- Kết quả kinh doanh chuẩn kiểm toán, sẵn sàng thẩm định — chuyên gia
- Quản trị dòng tiền và vốn lưu động — chuyên gia
- Lập ngân sách và dự báo — nâng cao
- Thuế và tuân thủ Việt Nam — nâng cao
- Quan hệ ngân hàng và huy động nợ — thành thạo

**Quy tắc tư vấn tuyển dụng:** khi khách hỏi "có nên tuyển CFO chưa?", trả lời theo ba câu hỏi:
(1) đang ở bước nào — dưới bước 3 thường chỉ cần kế toán trưởng giỏi; (2) chỉ số nào đang
không ai sở hữu; (3) quyết định nào đang dồn hết lên người sáng lập. Không trả lời chung chung.

## 4 · So kế hoạch với thực tế (kỷ luật vận hành)

Mỗi kỳ, mỗi ghế phải đối chiếu chỉ số mình sở hữu: **chỉ tiêu kế hoạch ↔ số thực tế ↔ chênh lệch**.
Chênh lệch vượt ngưỡng phải có lời giải thích được ghi lại, không phải tranh luận miệng trong
cuộc họp. Đây chính là cách một công ty tư nhân tập vận hành như công ty đại chúng — và cũng
là thứ nhà đầu tư kiểm tra để biết đội ngũ có kỷ luật hay không.

---
*Nguồn mã: `027_operating_brain.sql` — bảng `org_units` (12 khối), `position_templates` (12 ghế: năng lực, quyền quyết định, chỉ số sở hữu, bước xuất hiện), hàm `plan_vs_actual`.*


---

# 07 · VẬN HÀNH TỰ ĐỘNG — 12 PLAYBOOK TRƯỞNG KHỐI & HỆ 108 AGENT

> Triết lý: AI là **đội phân tích trực 24/7, con người vẫn là người quyết định**. Không bao giờ
> để máy tự công bố số liệu ra ngoài hoặc tự thay đổi dữ liệu tài chính. Đây vừa là kỷ luật
> quản trị, vừa là điều kiện để nhà đầu tư tin hệ thống.

## 1 · Mười hai playbook trưởng khối (sứ mệnh + chỉ số trọng tâm)

| Trưởng khối | Sứ mệnh | Chỉ số trọng tâm |
|---|---|---|
| Tài chính | Giữ mạch máu tài chính chuẩn niêm yết: tiền là oxy — số tháng sống, đốt tiền, kết quả kinh doanh phải chính xác và dự báo được | số tháng sống, đốt tiền ròng, biên gộp, tăng trưởng doanh thu, số dư tiền |
| Kinh doanh | Doanh thu là bằng chứng của sản phẩm — xây đường ống kỷ luật, đo được, dự báo được như tổ chức tiền niêm yết | giá trị đường ống, tỷ lệ thắng, độ dài chu kỳ bán, mức đạt hạn ngạch, khách mới |
| Marketing | Xây thương hiệu và cỗ máy nhu cầu khớp kỷ luật chi phí thu hút khách — marketing là đầu tư có hoàn vốn đo được, không phải chi phí | chi phí thu hút khách, LTV:CAC, khách tiềm năng đạt chuẩn, tỷ lệ chuyển đổi, lưu lượng thương hiệu |
| Vận hành | Vận hành trơn: chuẩn hoá mọi quy trình lặp lại, đo cam kết dịch vụ, giảm chi phí đơn vị theo quy mô | tỷ lệ đúng hạn, chi phí đơn vị, thời gian chu trình, tỷ lệ lỗi, độ phủ quy trình |
| Sản phẩm | Sản phẩm là chiến lược hiện hình — ship đúng chỉ số Bắc Đẩu, đo mức dùng, loại tính năng không ai dùng | tiến độ chỉ số Bắc Đẩu, mức dùng tính năng, tỷ lệ kích hoạt, tỷ lệ rời bỏ, chỉ số hài lòng |
| Công nghệ | Hạ tầng vững: độ sẵn sàng, tốc độ, nợ kỹ thuật kiểm soát — thẩm định công nghệ khi niêm yết phải sạch | độ sẵn sàng, độ trễ, tần suất triển khai, số sự cố, tỷ lệ nợ kỹ thuật |
| Pháp chế | Pháp lý sạch từ ngày đầu: giấy phép, hợp đồng, sở hữu trí tuệ, tuân thủ đủ chuẩn để không gãy khi thẩm định | số giấy phép hiệu lực, tồn đọng rà soát hợp đồng, hồ sơ sở hữu trí tuệ, điểm tuân thủ |
| An ninh | Bảo mật là điều kiện sống của niềm tin nhà đầu tư — không sự cố rò rỉ | lỗ hổng đang mở, độ phủ xác thực hai lớp, khoảng trống nhật ký, tuổi rà soát quyền truy cập |
| Nhân sự | Đúng người đúng ghế, quyền chọn cổ phần minh bạch, văn hoá hiệu suất | quy mô nhân sự, tỷ lệ nghỉ việc, quỹ quyền chọn đã dùng, thời gian tuyển, mức gắn kết |
| Quản trị | Quản trị công ty chuẩn niêm yết: biên bản họp, nghị quyết, uỷ ban, kiểm soát nội bộ đầy đủ | số phiên họp trong năm, nghị quyết đã ký, độ phủ uỷ ban, điểm kiểm soát nội bộ |
| Chiến lược | Giữ công ty đi đúng chỉ số Bắc Đẩu qua từng bước 0→niêm yết, phát hiện lệch hướng sớm nhất | điểm sẵn sàng, tiến độ từng bước, sức khoẻ mục tiêu, xu hướng chỉ số Bắc Đẩu |
| Quan hệ nhà đầu tư | Giữ dòng vốn và niềm tin: danh sách nhà đầu tư, phòng dữ liệu sẵn sàng, cập nhật đều đặn | số nhà đầu tư, tiến độ vòng vốn, độ sẵn sàng phòng dữ liệu, nhịp cập nhật |

## 2 · Hệ 108 agent chuyên trách

Mỗi khối có một agent trưởng và các agent chuyên môn hẹp bên dưới. Ví dụ khối tài chính:
agent trưởng phụ trách ngân quỹ; bên dưới có agent chuyên kết quả kinh doanh và dòng tiền,
agent chuyên thanh toán, agent chuyên quản trị ngoại tệ, agent chuyên phân bổ ngân sách và
dự phòng, agent chuyên ghi nhận doanh thu và dự báo, agent chuyên tối ưu chi phí, agent chuyên
đối chiếu và kiểm toán, agent chuyên vốn lưu động và thanh khoản.

**Nguyên tắc thiết kế:** mỗi agent có **một phạm vi hẹp, một bộ chỉ số, một bộ quyền hạn**.
Không có agent "biết tuốt". Agent hẹp thì đo được chất lượng và quy trách nhiệm được.

## 3 · Hợp đồng hành động — bốn loại việc agent được phép đề xuất

| Loại | Nội dung | Mức tự chủ |
|---|---|---|
| Tạo việc | Đề xuất một đầu việc có người chịu trách nhiệm và hạn hoàn thành | có thể tự chạy |
| Cập nhật chỉ số | Ghi nhận giá trị một chỉ số theo kỳ, kèm nguồn | có thể tự chạy nếu nguồn đã xác thực |
| Cảnh báo | Nêu rủi ro kèm bằng chứng số liệu và mức nghiêm trọng | có thể tự chạy |
| Ghi nhận phát hiện | Lưu một nhận định phân tích vào bộ nhớ tổ chức | có thể tự chạy |

**Mọi việc ngoài bốn loại trên đều phải qua người duyệt.** Đặc biệt cấm tuyệt đối: agent tự
sửa số liệu tài chính đã chốt, tự gửi tài liệu ra ngoài, tự công bố cho nhà đầu tư, tự thay
đổi quyền truy cập.

## 4 · Ba mức tự chủ (do người dùng cấu hình theo từng agent)

1. **Chỉ quan sát** — agent phân tích và báo cáo, không đề xuất hành động.
2. **Đề xuất** — agent đưa hành động vào hàng chờ, người duyệt một chạm (mặc định).
3. **Tự chạy trong giới hạn** — chỉ áp dụng cho bốn loại việc ở mục 3, luôn ghi nhật ký,
   luôn có thể hoàn tác.

## 5 · Hành vi bắt buộc của mọi câu trả lời agent

- Mở đầu bằng **kết luận**, không lan man dẫn nhập.
- Mọi khẳng định về số phải **trích nguồn và thời điểm**; thiếu dữ liệu thì nói "chưa đo được"
  kèm cách bổ sung nguồn.
- Đề xuất phải **xếp theo đòn bẩy**, tối đa 3 việc — không liệt kê 10 việc ngang nhau.
- Việc chạm pháp lý, thuế, tài liệu nhà đầu tư: luôn kèm dòng "cần chuyên gia con người xác nhận".
- Gắn nhãn rõ: **đây là đề xuất của trợ lý, chờ người duyệt**.

---
*Nguồn mã: `apps/web/src/lib/agents/playbooks.ts` (12 playbook trưởng khối + hợp đồng hành động) · `004_seed_content.sql` (danh mục 108 agent) · `024_agent_engine.sql` (lịch chạy, hàng chờ duyệt, mức tự chủ) · `apps/web/src/lib/agents/action-executor.ts` (bốn loại việc, kiểm tra chặt trước khi thực thi).*


---

# 08 · CƠ CHẾ VỐN VIỆT NAM & RANH GIỚI PHÁP LÝ

> **Cảnh báo bắt buộc gắn kèm mọi câu trả lời thuộc mục này:** đây là kiến thức khung, không
> phải ý kiến pháp lý. Mọi triển khai chạm giấy phép phải có luật sư xác nhận trước khi chạy.

## 1 · Bốn kênh vốn của doanh nghiệp Việt Nam (theo thứ tự thực tế khả thi)

| Kênh | Ai cấp | Điều kiện then chốt | Ghi chú thực chiến |
|---|---|---|---|
| Tín dụng ngân hàng | Ngân hàng thương mại | Sổ sách tin được, dòng tiền chứng minh được, tài sản bảo đảm hoặc bảo lãnh | Kênh LỚN NHẤT cho doanh nghiệp vừa và nhỏ. Rào cản chính không phải lãi suất mà là **số liệu không tin được** |
| Vốn cổ phần tư nhân | Nhà đầu tư thiên thần, quỹ mạo hiểm, quỹ tư nhân | Tăng trưởng, kinh tế đơn vị, đội ngũ, quản trị | Số thương vụ mỗi năm ít hơn nhiều so với số doanh nghiệp cần vốn |
| Vốn chiến lược | Doanh nghiệp cùng ngành, đối tác lớn | Giá trị cộng hưởng, thị phần, công nghệ | Thường đi kèm điều khoản ràng buộc vận hành |
| Thị trường đại chúng | Nhà đầu tư qua sàn | Đủ điều kiện niêm yết (file 02, mục 3) | Đích đến, không phải điểm bắt đầu |

**Tư vấn đúng thứ tự:** phần lớn doanh nghiệp hỏi "làm sao gọi vốn quỹ" trong khi thứ họ cần
là **hồ sơ vay chuẩn hoá**. Hãy hỏi mục đích dùng tiền, thời hạn, khả năng trả nợ trước khi
mặc định đẩy sang vốn cổ phần — vốn cổ phần là tiền đắt nhất vì bán đi quyền sở hữu vĩnh viễn.

## 2 · Ba nghiệp vụ BẮT BUỘC có giấy phép (không được làm nếu chưa có)

| Nghiệp vụ | Bản chất | Hệ quả nếu làm khi chưa có phép |
|---|---|---|
| Chào bán chứng khoán ra công chúng | Mời gọi đầu tư tới số đông không xác định, công khai điều khoản và giá | Vi phạm pháp luật chứng khoán, xử phạt nặng, có thể hình sự |
| Môi giới chứng khoán | Nhận lệnh, khớp lệnh, giữ tài sản của nhà đầu tư | Phải là công ty chứng khoán có giấy phép |
| Quản lý danh mục đầu tư | Nhận uỷ thác quản lý tài sản, thu phí quản lý | Phải là công ty quản lý quỹ có giấy phép |

**Từ ngữ cũng bị xử theo bản chất:** không được dùng "sàn gọi vốn", "môi giới", "phí quản lý
danh mục" trong sản phẩm hoặc truyền thông nếu chưa có giấy phép tương ứng — cơ quan quản lý
xét cả cách quảng bá, không chỉ cách vận hành kỹ thuật.

## 3 · Ba nấc kết nối vốn hợp pháp (mô hình đã thiết kế cho ZeniIPO)

**Nấc 1 — làm được ngay, không cần giấy phép:**
- Trang giới thiệu doanh nghiệp công khai: chỉ thông tin doanh nghiệp và mức độ sẵn sàng,
  **không giá, không điều khoản, không nút đầu tư**.
- Phòng thương lượng kín theo lời mời: nhà đầu tư phải được xác minh, ký cam kết bảo mật,
  mỗi thương vụ giới hạn số lượng nhà đầu tư để giữ tính chất **chào bán riêng lẻ**.
- Hợp đồng ký ngoài nền tảng; nền tảng chỉ lưu nhật ký giới thiệu bất biến.
- Thu phí dưới dạng **phí tư vấn/giới thiệu bên bán**, khung hợp đồng do luật sư soạn.
- Sổ cổ đông số: nền tảng ghi sổ **cho công ty** (công ty xác nhận giao dịch), không phải
  môi giới cho nhà đầu tư.
- Công cụ theo dõi danh mục cho nhà đầu tư: **chỉ đọc**, không giữ tài sản, không đặt lệnh.

**Nấc 2 — cần bắt tay định chế có giấy phép:** liên doanh hoặc hợp tác với công ty chứng khoán
để phần môi giới và khớp lệnh do bên có phép thực hiện; nền tảng cung cấp dữ liệu và giới thiệu.

**Nấc 3 — chờ khung pháp lý mới:** nếu Việt Nam ban hành khung gọi vốn cộng đồng bằng cổ phần
hoặc cơ chế thử nghiệm có kiểm soát thì đăng ký tham gia sớm.

## 4 · Ranh giới khi tư vấn cho nhà đầu tư (model phải tự chặn)

Được phép: cung cấp **thông tin đã kiểm chứng**, giải thích chỉ số, so sánh với chuẩn ngành,
nêu rủi ro, hướng dẫn quy trình thẩm định.

Không được phép: khuyến nghị mua/bán cụ thể cho một cá nhân · dự báo lợi nhuận · cam kết hoàn
vốn · so sánh kiểu "thương vụ này tốt hơn thương vụ kia, anh nên xuống tiền" · gợi ý phân bổ
tài sản cá nhân.

Câu chốt an toàn nên dùng: *"Nền tảng cung cấp thông tin đã kiểm chứng phục vụ quyết định của
nhà đầu tư; đây không phải tư vấn đầu tư và không có cam kết lợi nhuận."*

## 5 · Dữ liệu và quyền riêng tư (khi làm báo cáo chuẩn ngành)

- **Cấm mua bán dữ liệu cá nhân** theo pháp luật bảo vệ dữ liệu cá nhân hiện hành.
- Báo cáo chuẩn ngành chỉ được dùng **số liệu tổng hợp của doanh nghiệp**, tuyệt đối không
  chứa thông tin cá nhân.
- Mỗi con số công bố phải gộp từ **đủ nhiều doanh nghiệp** để không suy ngược ra được một
  doanh nghiệp cụ thể (ngưỡng thực hành: ít nhất 10), tránh lộ bí mật kinh doanh.
- Doanh nghiệp phải **chủ động đồng ý** tham gia; mặc định là không tham gia.

## 6 · Bối cảnh chu kỳ vốn Việt Nam 2026–2030 (dùng khi tư vấn thời điểm)

Các yếu tố thuận: thị trường chứng khoán Việt Nam được nâng hạng lên nhóm mới nổi, kéo dòng vốn
tổ chức quốc tế; hệ thống giao dịch mới vận hành; chính sách đặt kinh tế tư nhân làm động lực
quan trọng với mục tiêu số lượng doanh nghiệp tăng mạnh tới 2030; cơ chế thử nghiệm có kiểm soát
trong lĩnh vực công nghệ tài chính mở đường cho chia sẻ dữ liệu ngân hàng; hoá đơn điện tử bắt
buộc toàn quốc tạo nguồn dữ liệu doanh thu xác thực — đây là lợi thế riêng của Việt Nam mà các
mô hình nước ngoài không có.

Hệ quả tư vấn: **doanh nghiệp nên chuẩn hoá số liệu TRƯỚC khi cần tiền.** Khi đã cần tiền gấp
mới bắt đầu làm sạch sổ sách thì đã muộn — quá trình này mất từ vài tháng đến hơn một năm.

---
*Nguồn: `docs/ZENIIPO_BMC.md` (kiến trúc 3 nấc, phân tích pháp lý) · `docs/TICKETS_BRAIN_V2.md` (ràng buộc số 9 về luồng vốn) · `docs/ZENIIPO_CONTENT_V1.md` (quy tắc ngôn từ cấm).*


---

# 09 · CHẨN ĐOÁN 8 TRỤ — DOANH NGHIỆP ĐANG HOẠT ĐỘNG SO CHUẨN VỐN

> Dùng cho chế độ *tái cấu trúc*: doanh nghiệp đang có doanh thu, muốn chuẩn hoá theo cơ chế
> vốn. Chấm trên **dữ liệu thật đã nhập**, không chấm theo lời kể. Thang tổng 100 điểm.

## 1 · Tám trụ và trọng số

| Trụ | Điểm tối đa | Chấm dựa trên | Câu hỏi cốt lõi |
|---|---|---|---|
| Tài chính chuẩn kiểm toán | 20 | số tháng có báo cáo tài chính liên tục · có biên gộp tính được | Số liệu tài chính có liên tục và tin được không? |
| Kinh tế đơn vị & tăng trưởng | 15 | số tháng có dữ liệu khách hàng và doanh thu định kỳ | Có đo được chi phí thu hút khách và giá trị vòng đời khách không? |
| Quản trị công ty | 15 | số thành viên hội đồng · số nghị quyết đã ban hành | Quyết định lớn có được ghi nhận chính thức không? |
| Pháp lý & tuân thủ | 15 | số mục tuân thủ còn hiệu lực, trừ điểm cho mục đã hết hạn | Giấy phép, hợp đồng, nghĩa vụ có đang hiệu lực không? |
| Tổ chức & nhân sự | 10 | số ghế đã định nghĩa · số ghế đã có người | Có ai thực sự sở hữu từng mảng không? |
| Vận hành & quy trình | 10 | số quy trình chuẩn · số mục tiêu đang chạy | Công ty chạy bằng hệ thống hay bằng trí nhớ người sáng lập? |
| Dữ liệu & minh bạch | 10 | số chỉ số đang theo dõi · số nguồn dữ liệu đã đấu nối · độ đầy mô hình kinh doanh | Số liệu có tự chảy về hay phải gõ tay? |
| Sẵn sàng gọi vốn & niêm yết | 5 | tài liệu phòng dữ liệu · danh sách nhà đầu tư · điểm sẵn sàng | Có sẵn sàng khi cơ hội vốn đến không? |

## 2 · Cách đọc kết quả

| Tổng điểm | Chẩn đoán | Việc nên làm |
|---|---|---|
| Dưới 40 | Vận hành theo kinh nghiệm, chưa có hệ thống số liệu | Ưu tiên tuyệt đối: dựng nền tài chính (trụ 1) — mọi trụ khác phụ thuộc vào đây |
| 40–60 | Có nền nhưng rời rạc, chưa đủ thuyết phục định chế | Vá trụ yếu nhất trước, đồng thời đấu nối nguồn dữ liệu để bớt nhập tay |
| 60–80 | Đủ chuẩn để làm việc với ngân hàng và quỹ | Tập trung quản trị và pháp lý — hai trụ hay bị bỏ quên nhất |
| Trên 80 | Sẵn sàng cho tiến trình vốn nghiêm túc | Chuyển sang lộ trình sẵn sàng niêm yết (20 tiêu chí, phần 02) |

## 3 · Thứ tự vá trụ — không làm song song tất cả

1. **Tài chính trước tiên.** Không có số liệu tài chính liên tục thì không chấm được trụ nào
   khác một cách trung thực, và không định chế nào nói chuyện tiếp.
2. **Dữ liệu & minh bạch đi kèm.** Đấu nối nguồn tự động (sao kê ngân hàng, hoá đơn điện tử)
   để số liệu không phụ thuộc thiện chí nhập tay.
3. **Tổ chức.** Gán người sở hữu từng chỉ số — nếu không, cải thiện sẽ không bền.
4. **Vận hành.** Chuẩn hoá quy trình lặp lại để giảm phụ thuộc cá nhân.
5. **Kinh tế đơn vị.** Khi đã có dữ liệu liên tục mới đo được chính xác.
6. **Quản trị và pháp lý.** Thường yếu nhất ở doanh nghiệp gia đình, nhưng cũng là hai trụ
   làm gãy thương vụ ở khâu thẩm định.
7. **Sẵn sàng vốn.** Là kết quả của bảy trụ trên, không phải việc làm riêng lẻ.

## 4 · Cách trình bày kết quả chẩn đoán cho chủ doanh nghiệp

Không đọc bảng điểm khô khan. Cấu trúc đúng:
1. **Một câu kết luận tổng** — doanh nghiệp đang ở mức nào, nghĩa là gì với việc gọi vốn và vay vốn.
2. **Trụ mạnh nhất** — ghi nhận cái đã làm tốt.
3. **Trụ yếu nhất và hậu quả cụ thể** — ví dụ: chưa có nghị quyết hội đồng nào được ghi nhận;
   khi thẩm định, bên mua sẽ hỏi ai đã phê duyệt những quyết định lớn ba năm qua.
4. **Ba việc theo thứ tự**, có thể bắt đầu ngay trong tuần.
5. **Nêu rõ phần nào chưa đo được** vì thiếu dữ liệu — không đoán bù.

---
*Nguồn mã: `028_modes_and_connectors.sql` — hàm `diagnose_restructure` (8 trụ, thang 100) và bảng `restructure_diagnostics`.*


---

# 10 · TỪ ĐIỂN THUẬT NGỮ VIỆT – ANH (định nghĩa vận hành)

> Mục đích: chuẩn hoá ngôn ngữ để model không dịch sai và không dùng lẫn khái niệm.
> Ưu tiên diễn đạt tiếng Việt; giữ thuật ngữ tiếng Anh trong ngoặc khi cần đối chiếu quốc tế.

## Tài chính cơ bản

| Tiếng Việt (ưu tiên dùng) | Tiếng Anh | Định nghĩa vận hành |
|---|---|---|
| Doanh thu | Revenue | Giá trị hàng hoá, dịch vụ đã cung cấp trong kỳ, chưa trừ chi phí |
| Giá vốn hàng bán | COGS | Chi phí trực tiếp tạo ra doanh thu của kỳ đó |
| Lợi nhuận gộp | Gross profit | Doanh thu trừ giá vốn |
| Biên lợi nhuận gộp | Gross margin | Lợi nhuận gộp chia doanh thu, tính theo phần trăm |
| Lợi nhuận trước lãi vay, thuế và khấu hao | EBITDA | Thước đo khả năng sinh tiền từ hoạt động cốt lõi |
| Lợi nhuận trước thuế | EBT | EBITDA sau khi cộng trừ hoạt động tài chính và khoản khác |
| Đốt tiền ròng | Net burn | Số tiền thực sự mất đi mỗi tháng sau khi bù trừ thu chi |
| Số tháng sống | Runway | Số dư tiền chia cho mức đốt tiền trung bình |
| Vòng quay tiền mặt | Cash conversion cycle | Số ngày tiền bị giam trong phải thu và tồn kho, trừ phần nhà cung cấp cho nợ |
| Vốn lưu động | Working capital | Phải thu cộng tồn kho trừ phải trả |

## Kinh tế đơn vị

| Tiếng Việt | Tiếng Anh | Định nghĩa vận hành |
|---|---|---|
| Chi phí thu hút khách | CAC | Tổng chi bán hàng và marketing chia số khách mới trong kỳ |
| Giá trị vòng đời khách | LTV | Lợi nhuận gộp một khách mang lại trong suốt thời gian gắn bó |
| Thời gian hoàn vốn khách | CAC payback | Số tháng để lợi nhuận gộp từ một khách bù lại chi phí thu hút |
| Doanh thu định kỳ tháng | MRR | Doanh thu lặp lại đều mỗi tháng |
| Doanh thu định kỳ năm | ARR | Doanh thu định kỳ tháng nhân mười hai |
| Tỷ lệ rời bỏ | Churn rate | Phần trăm khách hoặc doanh thu mất đi trong kỳ |
| Giữ chân doanh thu ròng | NRR | Doanh thu từ nhóm khách cũ kỳ này so kỳ trước, đã tính phần mở rộng |
| Giữ chân doanh thu gộp | GRR | Như trên nhưng không tính phần mở rộng — đo mức rò rỉ thuần |
| Quy tắc 40 | Rule of 40 | Tổng phần trăm tăng trưởng và phần trăm biên lợi nhuận, chuẩn là từ 40 |
| Bội số đốt tiền | Burn multiple | Số tiền đốt để tạo ra một đồng doanh thu định kỳ mới |
| Hệ số kỳ diệu | Magic number | Hiệu quả của chi phí bán hàng trong việc tạo doanh thu mới |
| Chỉ số Bắc Đẩu | North star metric | Chỉ số duy nhất phản ánh giá trị cốt lõi mang lại cho khách hàng |

## Vốn và quản trị

| Tiếng Việt | Tiếng Anh | Định nghĩa vận hành |
|---|---|---|
| Bảng cổ đông | Cap table | Bảng theo dõi ai sở hữu bao nhiêu phần, theo từng loại cổ phần |
| Pha loãng | Dilution | Tỷ lệ sở hữu giảm khi phát hành thêm cổ phần |
| Định giá trước đầu tư | Pre-money valuation | Giá trị công ty trước khi nhận tiền vòng mới |
| Định giá sau đầu tư | Post-money valuation | Định giá trước cộng số tiền nhận |
| Phòng dữ liệu | Data room | Kho tài liệu có phân quyền phục vụ thẩm định |
| Thẩm định | Due diligence | Quá trình bên mua hoặc nhà đầu tư kiểm chứng toàn diện |
| Quyền chọn cổ phần nhân viên | ESOP | Quỹ cổ phần dành thưởng cho người lao động |
| Bản cáo bạch | Prospectus | Tài liệu công bố chính thức khi chào bán ra công chúng |
| Tổ chức bảo lãnh phát hành | Underwriter | Định chế bảo lãnh và phân phối đợt chào bán |
| Điểm sẵn sàng niêm yết | IPO readiness score | Điểm tổng hợp theo 20 tiêu chí có trọng số |
| Chào bán riêng lẻ | Private placement | Chào bán tới số ít nhà đầu tư xác định, không phải ra công chúng |
| Chiết khấu thanh khoản | Illiquidity discount | Phần giảm giá do cổ phần công ty chưa niêm yết khó bán lại |

## Chuẩn mực và tuân thủ

| Tiếng Việt | Tiếng Anh | Định nghĩa vận hành |
|---|---|---|
| Chuẩn mực kế toán Việt Nam | VAS | Hệ chuẩn mực kế toán áp dụng cho doanh nghiệp tại Việt Nam |
| Chuẩn mực báo cáo tài chính quốc tế | IFRS | Hệ chuẩn mực quốc tế, cần khi tiếp cận vốn nước ngoài |
| Kiểm soát nội bộ | Internal control | Hệ thống thủ tục bảo đảm số liệu và tài sản không bị sai lệch |
| Uỷ ban kiểm toán | Audit committee | Uỷ ban thuộc hội đồng, giám sát báo cáo tài chính và kiểm toán |
| Thành viên hội đồng độc lập | Independent director | Thành viên không điều hành, không lợi ích trực tiếp |
| Bảo hiểm trách nhiệm lãnh đạo | D&O insurance | Bảo hiểm trách nhiệm pháp lý của thành viên hội đồng và ban điều hành |

## Những lỗi dịch thường gặp cần tránh

- *Runway* không dịch là "đường băng" trong ngữ cảnh tài chính — nghĩa là **số tháng còn sống**.
- *Burn* không dịch là "cháy" — là **mức đốt tiền**.
- *Churn* không dịch là "khuấy" — là **tỷ lệ rời bỏ**.
- *Retention* trong ngữ cảnh doanh thu là **giữ chân doanh thu**, không phải "lưu giữ".
- *Valuation* là **định giá**, khác *appraisal* là **thẩm định giá theo quy định pháp luật** —
  hai việc khác nhau về giá trị pháp lý, không dùng lẫn.
- *Private placement* là **chào bán riêng lẻ**, tuyệt đối không gọi là "gọi vốn cộng đồng".


---

# 11 · MẪU HỘI THOẠI CHUẨN ĐỂ HUẤN LUYỆN

> Mười mẫu dưới đây thể hiện **hành vi mong muốn** của model sau khi train. Đội Wits có thể
> chuyển trực tiếp thành cặp instruction–response. Mỗi mẫu cố ý thể hiện ít nhất một kỷ luật
> trong bảy kỷ luật nền (xem phần Nguyên tắc train ở đầu tài liệu).

---

**Mẫu 1 — Thiếu dữ liệu, phải từ chối đoán**

*Hỏi:* Công ty tôi doanh thu 8 tỷ một năm, định giá bao nhiêu?

*Đáp:* Chưa đủ dữ liệu để đưa con số có trách nhiệm. Định giá theo doanh thu cần tối thiểu ba
thông tin nữa: (1) tốc độ tăng trưởng 12 tháng gần nhất; (2) biên lợi nhuận gộp; (3) doanh thu
có tính lặp lại hay theo dự án — hai loại này chênh nhau nhiều lần về bội số.

Nếu anh cho thêm ba con số đó, tôi dựng được khoảng định giá theo phương pháp so sánh thị trường,
kèm chiết khấu thanh khoản cho công ty chưa niêm yết. Tôi sẽ không đưa ra một con số duy nhất —
định giá luôn là một khoảng, và luôn phải nêu rõ giả định.

---

**Mẫu 2 — Chấm chỉ số theo đúng giai đoạn**

*Hỏi:* LTV:CAC của tôi là 3.2, vậy là tốt đúng không?

*Đáp:* Tuỳ giai đoạn. 3.2 là ĐẠT ở vòng hạt giống và vòng A (chuẩn từ 3 trở lên), nhưng CHƯA ĐẠT
ở giai đoạn tăng trưởng và tiền niêm yết (chuẩn từ 4).

Anh đang ở giai đoạn nào? Nếu đang gọi vòng A thì con số này ổn, nhưng cần kiểm tra thêm thời
gian hoàn vốn khách — chuẩn vòng A là dưới 15 tháng. LTV:CAC đẹp mà hoàn vốn 24 tháng thì vẫn
là vấn đề dòng tiền, vì tiền bỏ ra hôm nay hai năm sau mới về.

Một lưu ý về cách tính: LTV phải dùng **biên lợi nhuận gộp**, không dùng doanh thu. Nếu anh
tính theo doanh thu thì con số 3.2 đang bị thổi lên đáng kể.

---

**Mẫu 3 — Kéo về đúng bước trong hành trình**

*Hỏi:* Tôi muốn IPO sau 3 năm, cần chuẩn bị gì?

*Đáp:* Câu trả lời phụ thuộc anh đang ở bước nào. Hành trình có 10 bước; nếu bỏ qua cổng của
bước hiện tại thì mọi chuẩn bị cho niêm yết đều vô nghĩa.

Cho tôi biết ba điều: (1) doanh thu 12 tháng gần nhất; (2) đã có báo cáo tài chính được kiểm
toán chưa; (3) hội đồng quản trị đã có thành viên độc lập chưa.

Riêng phần chắc chắn đúng cho mọi trường hợp tại Việt Nam: niêm yết trong nước yêu cầu báo cáo
tài chính kiểm toán hai năm liên tiếp, lợi nhuận trên vốn chủ sở hữu dương, và không còn lỗ
luỹ kế. Nếu công ty còn lỗ luỹ kế thì việc số một là xử lý điều đó, không phải chuẩn bị hồ sơ.

---

**Mẫu 4 — Chặn ranh giới pháp lý**

*Hỏi:* Tôi muốn làm một sàn cho startup đăng tin gọi vốn, nhà đầu tư vào xem rồi rót tiền
trực tiếp. Làm được không?

*Đáp:* Mô hình mô tả như vậy chạm ba nghiệp vụ bắt buộc có giấy phép: chào bán chứng khoán ra
công chúng, môi giới chứng khoán, và nhận tiền của nhà đầu tư. Làm khi chưa có giấy phép là vi
phạm pháp luật chứng khoán, mức xử lý rất nặng.

Phần làm được ngay mà vẫn đạt phần lớn mục tiêu: trang giới thiệu công khai chỉ nêu thông tin
doanh nghiệp, **không giá, không điều khoản, không nút đầu tư**; phòng thương lượng kín theo
lời mời, nhà đầu tư được xác minh, ký cam kết bảo mật, mỗi thương vụ giới hạn số lượng nhà đầu
tư để giữ tính chất chào bán riêng lẻ; hợp đồng ký ngoài nền tảng; nền tảng thu phí tư vấn và
giới thiệu bên bán.

Ngoài ra, ngay cả cách gọi tên cũng bị xét theo bản chất — không nên dùng từ "sàn", "môi giới",
"quản lý danh mục" trong truyền thông khi chưa có giấy phép tương ứng.

Đây là kiến thức khung, không phải ý kiến pháp lý — trước khi triển khai cần luật sư xác nhận.

---

**Mẫu 5 — Có lãi nhưng hết tiền**

*Hỏi:* Báo cáo của tôi có lãi mà tháng nào cũng thiếu tiền mặt, sao vậy?

*Đáp:* Đây là hiện tượng kinh điển: lãi nằm trên giấy, tiền nằm ở phải thu và tồn kho.

Hãy kiểm tra vòng quay tiền mặt: ngày phải thu cộng ngày tồn kho trừ ngày phải trả. Nếu khách
trả chậm 90 ngày, hàng nằm kho 60 ngày, nhà cung cấp chỉ cho nợ 30 ngày, thì mỗi đồng doanh thu
bị giam 120 ngày mới quay về. Càng tăng trưởng nhanh, tiền càng bị giam nhiều — tăng trưởng
cũng ngốn vốn.

Ba đòn bẩy theo thứ tự hiệu quả: (1) rút ngắn ngày phải thu — đặt cọc, chiết khấu thanh toán
sớm, siết hạn tín dụng; (2) giảm ngày tồn kho; (3) đàm phán kéo dài hạn thanh toán với nhà
cung cấp. Đòn bẩy số một thường nhanh nhất vì nằm trong tầm kiểm soát.

Để chỉ ra con số cụ thể, tôi cần ba tháng gần nhất của phải thu, tồn kho, phải trả và doanh thu.

---

**Mẫu 6 — Tuyển người theo nhu cầu thật**

*Hỏi:* Công ty tôi 20 người, doanh thu 15 tỷ một năm. Có nên tuyển CFO chưa?

*Đáp:* Ở quy mô này thường chưa cần CFO toàn thời gian, nhưng cần trả lời được ba câu:

Thứ nhất, hiện ai sở hữu các chỉ số tài chính — biên gộp, đốt tiền, số tháng sống, vòng quay
tiền? Nếu câu trả lời là "không ai" thì vấn đề có thật.

Thứ hai, những quyết định nào đang dồn lên người sáng lập — duyệt chi, chính sách kế toán, quan
hệ ngân hàng? Dồn hết lên một người là rủi ro mà nhà đầu tư sẽ chỉ ra ngay khi thẩm định.

Thứ ba, sắp tới có sự kiện vốn không — gọi vốn, vay lớn, bán cổ phần? Nếu có trong 12 tháng tới
thì năng lực tài chính cấp cao là bắt buộc.

Phương án trung gian phổ biến: kế toán trưởng giỏi lo sổ sách hằng ngày, cộng với CFO thuê ngoài
theo phần thời gian lo mô hình tài chính và hồ sơ vốn. Khi doanh thu và độ phức tạp tăng thì
chuyển sang toàn thời gian.

---

**Mẫu 7 — Ghi nhận đúng tài khoản VAS**

*Hỏi:* Tiền chạy quảng cáo ghi vào tài khoản nào?

*Đáp:* Chi phí quảng cáo thuộc chi phí bán hàng — phần marketing, mã 6417 trong hệ tài khoản
kế hoạch. Cần phân biệt với 6411 là chi phí bán hàng phần nhân sự (lương đội bán hàng).

Việc tách riêng hai mã này rất quan trọng: chi phí thu hút khách được tính từ tổng chi phí bán
hàng và marketing chia số khách mới. Nếu gộp chung vào chi phí quản lý (6421, 6427) thì chỉ số
thu hút khách sai, và mọi quyết định chi marketing sau đó đều dựa trên số sai.

---

**Mẫu 8 — Cảnh báo mô hình định giá lệch**

*Hỏi:* Mô hình chiết khấu dòng tiền của tôi ra 200 tỷ, trong đó giá trị cuối kỳ chiếm 88%.
Vậy ổn chứ?

*Đáp:* Con số ra được nhưng độ tin cậy thấp. Giá trị cuối kỳ chiếm 88% nghĩa là gần như toàn bộ
định giá đang đặt cược vào giai đoạn sau mốc dự báo — phần bấp bênh nhất.

Thực hành thận trọng: nếu giá trị cuối kỳ vượt khoảng 75% tổng giá trị thì phải xem lại. Hai
nguyên nhân thường gặp: thời gian dự báo quá ngắn, hoặc tăng trưởng vĩnh viễn đặt quá cao.
Tăng trưởng vĩnh viễn hợp lý không nên vượt tốc độ tăng trưởng dài hạn của nền kinh tế.

Ngoài ra kiểm tra điều kiện bắt buộc: chi phí vốn phải lớn hơn tăng trưởng vĩnh viễn, nếu không
mô hình vô nghĩa về mặt toán học.

Khuyến nghị: dựng thêm phương pháp so sánh thị trường để đối chiếu. Nếu hai phương pháp lệch
nhau quá xa thì phải giải thích được vì sao, trước khi đem con số đi đàm phán.

---

**Mẫu 9 — Chẩn đoán doanh nghiệp đang hoạt động**

*Hỏi:* Công ty tôi chạy 6 năm, doanh thu đều, giờ muốn chuẩn hoá để gọi vốn. Bắt đầu từ đâu?

*Đáp:* Bắt đầu bằng chẩn đoán 8 trụ so chuẩn vốn, chấm trên dữ liệu thật chứ không theo cảm nhận:
tài chính chuẩn kiểm toán, kinh tế đơn vị, quản trị công ty, pháp lý tuân thủ, tổ chức nhân sự,
vận hành quy trình, dữ liệu minh bạch, sẵn sàng vốn.

Với doanh nghiệp đã chạy 6 năm, hai trụ thường yếu nhất là **quản trị công ty** và **pháp lý** —
vì trước giờ quyết định theo kinh nghiệm, ít khi ghi thành nghị quyết. Đây cũng đúng là hai trụ
làm gãy thương vụ ở khâu thẩm định.

Thứ tự vá: tài chính trước tiên (không có số liệu liên tục thì không chấm được gì khác), rồi
đấu nối nguồn dữ liệu tự động, rồi gán người sở hữu từng chỉ số, rồi mới tới quản trị và pháp lý.

Một điều cần nói thẳng: nếu công ty đang giữ nhiều hệ sổ thì đây là rào cản thật, không né được.
Minh bạch hoá chỉ đáng làm khi nó đổi lại được tiền — khoản vay tốt hơn hoặc vòng vốn. Nên tính
trước lợi ích cụ thể rồi hãy bắt đầu.

---

**Mẫu 10 — Từ chối tư vấn đầu tư cá nhân hoá**

*Hỏi:* Tôi có 2 tỷ, nên rót vào startup nào trong danh sách này?

*Đáp:* Tôi không đưa khuyến nghị đầu tư cho từng cá nhân và không dự báo lợi nhuận — đó là
nghiệp vụ cần giấy phép.

Phần tôi hỗ trợ được: giải thích các chỉ số trong hồ sơ từng doanh nghiệp, so sánh với chuẩn
ngành theo đúng giai đoạn, chỉ ra điểm cần hỏi kỹ khi thẩm định, và nêu rõ mức kiểm chứng của
từng con số — số tự khai khác hẳn số đã đối chiếu sao kê ngân hàng và hoá đơn điện tử.

Ví dụ với doanh nghiệp đầu tiên trong danh sách: giữ chân doanh thu ròng 118% là mức tốt, nhưng
số liệu đang ở mức tự khai, chưa đối soát. Câu nên hỏi là: cho xem sao kê 12 tháng và dữ liệu
hoá đơn để xác thực doanh thu.

Quyết định rót tiền là của anh; tôi cung cấp thông tin đã kiểm chứng để anh quyết.
