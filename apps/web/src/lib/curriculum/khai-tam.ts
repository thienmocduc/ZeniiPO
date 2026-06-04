/**
 * Cấp 1 · Khai Tâm — Hiểu cơ chế vốn (onboarding sơ cấp).
 *
 * Persona: CEO Chính Thủy (chủ chuỗi nhà hàng) — giỏi nghề, chưa biết cơ chế
 * vốn. Ngôn ngữ đời thường, ẩn dụ F&B (nồi nước lèo), không thuật ngữ doạ người.
 *
 * Flow: đọc 6 bài → thi 8 câu (đạt ≥ 6/8) → dựng cap table thật → điểm
 * readiness sơ bộ → gate Journey Engine L1 mở Cấp 2.
 *
 * Content sống ở đây (global curriculum, không per-tenant). Trụ 2 (Academy)
 * sẽ migrate vào DB để versioning + song ngữ đầy đủ.
 */

export type Lesson = {
  id: string
  title: string
  analogy: string // ẩn dụ F&B mở đầu
  body: string[] // các đoạn nội dung
  takeaway: string
}

export const KHAI_TAM_LESSONS: Lesson[] = [
  {
    id: 'L1-1',
    title: 'Tư duy doanh nghiệp — không chỉ là "bán cho hết món"',
    analogy: 'Một quán đông khách chưa chắc là một doanh nghiệp khoẻ.',
    body: [
      'Bạn nấu ngon, quán đông — đó là "cái nghề". Doanh nghiệp là khi quán vẫn chạy tốt kể cả hôm bạn nghỉ, và giá trị của nó lớn hơn số tiền trong két mỗi tối.',
      'Doanh nghiệp khoẻ = một cỗ máy tạo ra dòng tiền đều, có thể nhân bản, và có người khác sẵn sàng trả tiền để sở hữu một phần của nó.',
      'Mục tiêu cuối: biến công sức hằng ngày thành một tài sản có thể định giá — thứ mà nhà đầu tư, ngân hàng, hoặc sàn chứng khoán công nhận bằng tiền.',
    ],
    takeaway: 'Doanh nghiệp = tài sản tạo dòng tiền, không phải chỉ là chỗ làm việc của bạn.',
  },
  {
    id: 'L1-2',
    title: 'Ba loại vốn — tiền ở đâu mà ra',
    analogy: 'Mở quán thứ hai, tiền lấy từ đâu? Có 3 cái "vòi".',
    body: [
      '① Vốn vay (nợ): vay ngân hàng/người thân. Phải trả gốc + lãi, nhưng quán vẫn 100% của bạn. Rủi ro: trả không nổi thì mất tài sản thế chấp.',
      '② Vốn góp (cổ phần): người khác bỏ tiền vào, đổi lấy một phần sở hữu quán. Không phải trả lãi, nhưng bạn chia bớt "miếng bánh" và quyền quyết định.',
      '③ Vốn tự tích luỹ (lợi nhuận giữ lại): lấy lãi tháng này nuôi tháng sau. An toàn nhất nhưng chậm nhất.',
      'IPO (lên sàn) là hình thức cao nhất của vốn góp: bán cổ phần cho công chúng qua sàn chứng khoán.',
    ],
    takeaway: 'Nợ = giữ sở hữu nhưng phải trả lãi. Cổ phần = chia sở hữu nhưng không trả lãi.',
  },
  {
    id: 'L1-3',
    title: 'Cổ phần hoá — chia quán thành "miếng"',
    analogy: 'Tưởng tượng cắt cái quán thành 1.000.000 miếng bằng nhau.',
    body: [
      'Cổ phần là đơn vị sở hữu. Nếu quán chia thành 1.000.000 cổ phần và bạn giữ 700.000, bạn sở hữu 70%.',
      'Khi gọi vốn, bạn không "bán quán" — bạn phát hành thêm cổ phần mới cho nhà đầu tư. Quán to ra, số miếng nhiều hơn, nhưng mỗi miếng có thể đáng giá hơn.',
      'Cổ phần hoá biến "quyền sở hữu mơ hồ" thành con số rõ ràng, ghi sổ được, mua bán được, và định giá được.',
    ],
    takeaway: 'Cổ phần = miếng sở hữu đếm được. Sở hữu % = số cổ phần bạn giữ / tổng cổ phần.',
  },
  {
    id: 'L1-4',
    title: 'Bốn chữ "Cổ" — đừng nhầm lẫn',
    analogy: 'Cùng chữ "cổ" nhưng 4 nghĩa khác nhau, nhầm là mất tiền oan.',
    body: [
      'Cổ phần (share): đơn vị sở hữu — cái "miếng".',
      'Cổ phiếu (stock certificate): tờ giấy/bản ghi xác nhận bạn sở hữu cổ phần.',
      'Cổ đông (shareholder): người sở hữu cổ phần — chính bạn và nhà đầu tư.',
      'Cổ tức (dividend): phần lợi nhuận chia cho cổ đông — "tiền lời" của việc sở hữu.',
    ],
    takeaway: 'Cổ phần là miếng · Cổ phiếu là giấy · Cổ đông là người · Cổ tức là tiền lời.',
  },
  {
    id: 'L1-5',
    title: 'Chia cổ phần & quyền điều hành — giữ vô-lăng',
    analogy: 'Cho người ta góp tiền, nhưng ai cầm vô-lăng lái quán?',
    body: [
      'Sở hữu (%) và điều hành (quyền quyết định) là hai thứ khác nhau. Bạn có thể giữ quyền điều hành kể cả khi sở hữu dưới 100%.',
      'Ngưỡng quan trọng: giữ trên 65% = toàn quyền quyết định lớn; trên 50% = quyền đa số; dưới 35% = mất quyền phủ quyết. Mỗi vòng gọi vốn làm % của bạn giảm (pha loãng).',
      'ESOP (quỹ cổ phần cho nhân viên): dành 10–15% để thưởng người giỏi — giữ chân đội ngũ khi lớn.',
      'Bài học sống còn: tính trước mỗi vòng gọi vốn sẽ pha loãng bạn bao nhiêu, đừng để mất quyền kiểm soát lúc nào không hay.',
    ],
    takeaway: 'Giữ > 65% = toàn quyền · > 50% = đa số · < 35% = mất phủ quyết. ESOP 10–15%.',
  },
  {
    id: 'L1-6',
    title: 'Thang gọi vốn — từ quán nhỏ tới lên sàn',
    analogy: 'Leo thang từng bậc: mỗi bậc là một vòng vốn lớn hơn.',
    body: [
      'Pre-seed/Seed: tiền nhỏ để chứng minh mô hình (bạn bè, angel, quỹ hạt giống).',
      'Series A/B/C: quỹ lớn rót tiền để nhân bản chuỗi — mỗi vòng định giá cao hơn.',
      'IPO: bán cổ phần cho công chúng qua sàn (HOSE, SGX...). Đây là "rung chuông" — đỉnh của thang.',
      'Zeniipo đồng hành cả thang: mỗi bậc mở khoá đúng công cụ — cap table, financial model, fundraise pipeline, readiness scorecard — chạy bằng dữ liệu thật của chính quán bạn.',
    ],
    takeaway: 'Seed → Series A/B/C → IPO. Mỗi bậc cần chuẩn bị khác nhau, và bạn đo được mình đang ở đâu.',
  },
]

export type QuizQuestion = {
  id: string
  q: string
  options: string[]
  correct: number // index
  explain: string
}

export const KHAI_TAM_QUIZ: QuizQuestion[] = [
  {
    id: 'Q1',
    q: 'Một quán đông khách mỗi tối có chắc là một "doanh nghiệp khoẻ"?',
    options: ['Chắc chắn rồi', 'Chưa chắc — doanh nghiệp khoẻ phải chạy được cả khi chủ vắng & định giá được', 'Chỉ khi có nhiều chi nhánh'],
    correct: 1,
    explain: 'Đông khách là "cái nghề". Doanh nghiệp khoẻ là tài sản tạo dòng tiền đều, nhân bản được, định giá được.',
  },
  {
    id: 'Q2',
    q: 'Vốn vay (nợ) khác vốn góp (cổ phần) ở điểm cốt lõi nào?',
    options: ['Nợ phải trả lãi nhưng giữ sở hữu; cổ phần chia sở hữu nhưng không trả lãi', 'Cả hai đều phải trả lãi', 'Cổ phần luôn rẻ hơn'],
    correct: 0,
    explain: 'Nợ = giữ 100% sở hữu, phải trả gốc+lãi. Cổ phần = chia sở hữu, không trả lãi.',
  },
  {
    id: 'Q3',
    q: 'Bạn giữ 700.000 trên tổng 1.000.000 cổ phần. Bạn sở hữu bao nhiêu %?',
    options: ['7%', '70%', '0,7%'],
    correct: 1,
    explain: '700.000 / 1.000.000 = 70%.',
  },
  {
    id: 'Q4',
    q: 'Khi gọi vốn, bạn thường làm gì để nhà đầu tư có sở hữu?',
    options: ['Bán toàn bộ quán', 'Phát hành thêm cổ phần mới cho nhà đầu tư', 'Cho mượn cổ phần rồi đòi lại'],
    correct: 1,
    explain: 'Gọi vốn = phát hành cổ phần mới. Công ty to ra, tổng số cổ phần tăng.',
  },
  {
    id: 'Q5',
    q: '"Cổ tức" nghĩa là gì?',
    options: ['Tờ giấy xác nhận sở hữu', 'Người sở hữu cổ phần', 'Phần lợi nhuận chia cho cổ đông'],
    correct: 2,
    explain: 'Cổ tức = tiền lời chia cho cổ đông. (Cổ phiếu = giấy, cổ đông = người.)',
  },
  {
    id: 'Q6',
    q: 'Để giữ TOÀN QUYỀN quyết định các vấn đề lớn, bạn nên giữ trên bao nhiêu %?',
    options: ['Trên 35%', 'Trên 50%', 'Trên 65%'],
    correct: 2,
    explain: 'Trên 65% = toàn quyền quyết định lớn. >50% = đa số. <35% = mất quyền phủ quyết.',
  },
  {
    id: 'Q7',
    q: 'ESOP là gì và thường chiếm bao nhiêu cap table?',
    options: ['Quỹ cổ phần cho nhân viên, ~10–15%', 'Thuế phải nộp khi IPO', 'Một loại vốn vay'],
    correct: 0,
    explain: 'ESOP = quỹ cổ phần thưởng nhân viên, thường 10–15%, để giữ chân đội ngũ.',
  },
  {
    id: 'Q8',
    q: 'Thứ tự đúng của thang gọi vốn là?',
    options: ['IPO → Series A → Seed', 'Seed → Series A/B/C → IPO', 'Series A → IPO → Seed'],
    correct: 1,
    explain: 'Seed (chứng minh mô hình) → Series A/B/C (nhân bản) → IPO (lên sàn, "rung chuông").',
  },
]

export const KHAI_TAM_PASS_MARK = 6
export const KHAI_TAM_TOTAL = 8
