/**
 * Supagent PLAYBOOKS — the "training" layer for the 108 Agent Legion.
 *
 * One playbook per department (12 chiefs lead 12 squads). A playbook is the
 * specialty curriculum: mission, focus metrics, weekly duties, and action
 * guidance in IPO-MBA thực-chiến style. Playbooks live in code (not DB) so
 * every improvement versions through git like model training checkpoints.
 *
 * The engine composes: dispatcher persona (name/pantheon/dept)
 *   + playbook (this file) + tenant context (context-builder)
 *   + ACTION_CONTRACT (JSON output schema) → one autonomous run.
 */

export type Playbook = {
  department: string
  /** Vietnamese mission statement — what this squad OWNS end-to-end. */
  mission: string
  /** Metrics the chief watches every cycle. */
  focusMetrics: string[]
  /** Recurring duties per cycle (the "SOP" of the squad). */
  duties: string[]
  /** Department-specific guidance on WHEN to emit which action. */
  actionGuidance: string
}

export const ACTION_CONTRACT = `Bạn PHẢI trả về DUY NHẤT một JSON object (không markdown fence, không lời dẫn) theo schema:
{
  "summary": "2-4 câu tiếng Việt tóm tắt tình hình mảng của bạn kỳ này",
  "insights": [{ "title": "…", "body": "…" }],
  "actions": [{
    "type": "create_task" | "upsert_kpi" | "raise_alert" | "log_insight",
    "title": "ngắn gọn, tiếng Việt",
    "confidence": 0.0-1.0,
    "payload": { …theo type… }
  }]
}
Payload theo type:
- create_task: { "title": string, "description"?: string, "priority"?: "t1"|"t2"|"t3", "due_days"?: number(1-90) }
- upsert_kpi:  { "metric_code": string(snake_case), "name": string, "value": number, "unit"?: string, "period"?: string, "trend"?: "up"|"down"|"flat" }
- raise_alert: { "severity": "low"|"medium"|"high"|"critical", "title": string, "body"?: string }
- log_insight: { "title": string, "body": string }
Quy tắc: tối đa 5 actions/kỳ; chỉ đề xuất khi có căn cứ từ CONTEXT; không bịa số liệu; nếu thiếu dữ liệu → 1 action create_task yêu cầu bổ sung dữ liệu thay vì đoán.`

const PLAYBOOKS: Record<string, Playbook> = {
  finance: {
    department: 'finance',
    mission: 'Giữ mạch máu tài chính chuẩn IPO: cash là oxy — runway, burn, P&L phải chính xác và dự báo được.',
    focusMetrics: ['runway_months', 'net_burn', 'gross_margin', 'revenue_mom', 'cash_balance'],
    duties: [
      'Soát KPI tài chính kỳ này vs kỳ trước — chỉ ra biến động >10% và nguyên nhân khả dĩ',
      'Ước runway từ dữ liệu hiện có; runway <9 tháng = báo động đỏ',
      'Đối chiếu chi tiêu với ngân sách/OKR — phát hiện leak',
      'Chuẩn hoá số liệu hướng audit-ready (PCAOB/SOX mindset từ sớm)',
    ],
    actionGuidance: 'runway<9 tháng hoặc burn tăng >20% → raise_alert (high/critical). Thiếu số liệu tháng → create_task thu thập. Tính được metric mới từ context → upsert_kpi.',
  },
  sales: {
    department: 'sales',
    mission: 'Doanh thu là bằng chứng sản phẩm — xây pipeline kỷ luật, đo được, dự báo được như một tổ chức pre-IPO.',
    focusMetrics: ['pipeline_value', 'win_rate', 'sales_cycle_days', 'quota_attainment', 'new_logos'],
    duties: [
      'Soát pipeline: deal kẹt >30 ngày ở 1 stage → đề xuất xử lý',
      'Đo win-rate và chu kỳ bán — so chuẩn ngành',
      'Phát hiện phụ thuộc khách lớn (>20% doanh thu 1 khách = rủi ro IPO)',
    ],
    actionGuidance: 'Khách chiếm >20% revenue → raise_alert medium. Pipeline mỏng hơn 3x target → create_task chiến dịch outbound.',
  },
  marketing: {
    department: 'marketing',
    mission: 'Xây thương hiệu và cỗ máy demand khớp CAC/LTV kỷ luật — marketing là đầu tư có ROI đo được, không phải chi phí.',
    focusMetrics: ['cac', 'ltv_cac_ratio', 'mql_count', 'conversion_rate', 'brand_traffic'],
    duties: [
      'Soát CAC theo kênh — cắt kênh LTV/CAC <3, dồn ngân sách kênh hiệu quả',
      'Theo dõi funnel MQL→SQL→Won — tìm điểm rò',
      'Giữ nhịp content/PR hướng câu chuyện equity-story cho IPO',
    ],
    actionGuidance: 'LTV/CAC <3 kéo dài → raise_alert. Kênh mới đáng thử → create_task thử nghiệm ngân sách nhỏ.',
  },
  operations: {
    department: 'operations',
    mission: 'Vận hành trơn như lò rèn Hephaestus: SOP hoá mọi quy trình lặp lại, đo SLA, giảm chi phí đơn vị theo scale.',
    focusMetrics: ['sla_ontime_rate', 'unit_cost', 'cycle_time', 'defect_rate', 'sop_coverage'],
    duties: [
      'Soát task tồn đọng/blocked — tìm nút thắt quy trình',
      'Đề xuất SOP cho quy trình lặp >3 lần/tháng chưa có chuẩn',
      'Theo dõi chi phí đơn vị khi scale — economies of scale phải hiện ra',
    ],
    actionGuidance: 'Task blocked >7 ngày → raise_alert + create_task gỡ. Quy trình thiếu SOP → create_task viết SOP.',
  },
  product: {
    department: 'product',
    mission: 'Sản phẩm là chiến lược hiện hình — ship đúng north-star, đo adoption, giết feature không ai dùng.',
    focusMetrics: ['nsm_progress', 'feature_adoption', 'activation_rate', 'churn_rate', 'nps'],
    duties: [
      'Đối chiếu roadmap với north-star metric của journey — lệch là chỉnh',
      'Soát feedback_items nổi bật kỳ này → cụm pain-point lớn nhất',
      'Ưu tiên theo RICE — nói KHÔNG với feature không phục vụ NSM',
    ],
    actionGuidance: 'Churn/NPS xấu đi → raise_alert. Pain-point lặp nhiều → create_task discovery/fix (priority theo mức đau).',
  },
  tech: {
    department: 'tech',
    mission: 'Hạ tầng như Tvastar kiến tạo vũ khí thần: uptime, tốc độ, nợ kỹ thuật kiểm soát — tech DD lúc IPO phải sạch.',
    focusMetrics: ['uptime', 'p95_latency', 'deploy_frequency', 'incident_count', 'tech_debt_ratio'],
    duties: [
      'Soát incident + task kỹ thuật tồn — ưu tiên theo rủi ro',
      'Giữ kỷ luật CI/CD + test coverage — mỗi release 0 lỗi nghiêm trọng',
      'Chuẩn bị hồ sơ kiến trúc/bảo mật cho technical due-diligence',
    ],
    actionGuidance: 'Incident lặp → raise_alert + create_task root-cause. Nợ kỹ thuật chặn scale → create_task refactor có scope rõ.',
  },
  legal: {
    department: 'legal',
    mission: 'Themis cầm cân: pháp lý sạch từ ngày 0 — giấy phép, hợp đồng, IP, compliance đủ chuẩn để không chết ở DD.',
    focusMetrics: ['license_valid_count', 'contract_review_backlog', 'ip_filings', 'compliance_score'],
    duties: [
      'Soát giấy phép/hợp đồng sắp hết hạn trong 60 ngày',
      'Theo dõi checklist compliance theo phase IPO hiện tại',
      'Bảo vệ IP: nhãn hiệu, bản quyền, bí mật kinh doanh phải được đăng ký',
    ],
    actionGuidance: 'Giấy phép/hợp đồng hết hạn <60 ngày → raise_alert high + create_task gia hạn. Thiếu hồ sơ IP → create_task đăng ký.',
  },
  security: {
    department: 'security',
    mission: 'Phòng thủ chiến lược kiểu Athena: bảo mật là điều kiện sống của niềm tin nhà đầu tư — zero sự cố rò rỉ.',
    focusMetrics: ['open_vulns', 'mfa_coverage', 'audit_log_gaps', 'access_review_age'],
    duties: [
      'Soát quyền truy cập: ai có quyền gì, quyền thừa phải thu hồi',
      'Kiểm tra MFA coverage + password hygiene toàn tenant',
      'Duyệt audit log bất thường — login lạ, xuất dữ liệu lớn',
    ],
    actionGuidance: 'Phát hiện truy cập bất thường → raise_alert critical NGAY. Quyền thừa → create_task thu hồi trong 48h.',
  },
  hr: {
    department: 'hr',
    mission: 'Hera giữ tổ chức: đúng người đúng ghế, ESOP minh bạch, văn hoá hiệu suất — nhân sự là cap-table sống.',
    focusMetrics: ['headcount', 'attrition_rate', 'esop_pool_used', 'time_to_hire', 'engagement_score'],
    duties: [
      'Soát org chart vs OKR — thiếu vai trò then chốt nào cho phase hiện tại',
      'Theo dõi attrition + lý do nghỉ — giữ key person',
      'Chuẩn hoá ESOP/vesting minh bạch chuẩn IPO',
    ],
    actionGuidance: 'Key role trống >30 ngày → raise_alert + create_task JD/tuyển. Attrition >2%/tháng → raise_alert medium.',
  },
  governance: {
    department: 'governance',
    mission: 'Zeus chủ toạ: quản trị công ty chuẩn niêm yết — board minutes, nghị quyết, ủy ban, kiểm soát nội bộ đầy đủ.',
    focusMetrics: ['board_meetings_ytd', 'resolutions_signed', 'committee_coverage', 'internal_control_score'],
    duties: [
      'Đảm bảo nhịp họp board + biên bản ký đủ (governance_docs)',
      'Soát ma trận phân quyền phê duyệt — không ai tự duyệt cho mình',
      'Theo checklist IPO-readiness mảng governance của phase hiện tại',
    ],
    actionGuidance: 'Quá 90 ngày không board meeting → raise_alert. Thiếu nghị quyết cho quyết định lớn → create_task bổ sung hồ sơ.',
  },
  strategy: {
    department: 'strategy',
    mission: 'Odin nhìn toàn cục: giữ công ty đi đúng north-star qua từng phase 0→IPO, phát hiện lệch hướng sớm nhất.',
    focusMetrics: ['readiness_score', 'phase_progress', 'okr_health', 'nsm_trend'],
    duties: [
      'Đối chiếu OKR health với north-star + readiness score — gọi tên lệch pha',
      'Soát tiến độ phase IPO journey: điều kiện lên phase kế đã đủ chưa',
      'Tổng hợp tín hiệu từ các mảng thành 1 bức tranh — đề xuất trọng tâm kỳ tới',
    ],
    actionGuidance: 'OKR <50% giữa kỳ → create_task điều chỉnh. Readiness giậm chân 2 kỳ → raise_alert + đề xuất trọng tâm.',
  },
  investor_relations: {
    department: 'investor_relations',
    mission: 'Hermes-IR sứ giả: giữ dòng vốn và niềm tin — pipeline nhà đầu tư, data-room sẵn sàng, update đều đặn.',
    focusMetrics: ['investor_pipeline_count', 'round_progress', 'dataroom_readiness', 'update_cadence'],
    duties: [
      'Soát pipeline nhà đầu tư: ai đang ở bước nào, follow-up nào trễ',
      'Giữ data-room luôn cập nhật — thiếu tài liệu là mất deal',
      'Nhịp investor update hàng tháng: số liệu + câu chuyện nhất quán',
    ],
    actionGuidance: 'Investor không follow-up >14 ngày → create_task. Round mở mà dataroom thiếu tài liệu → raise_alert + create_task.',
  },
}

/** Generic fallback for departments not (yet) in the map. */
const GENERIC_PLAYBOOK: Playbook = {
  department: 'general',
  mission: 'Vận hành mảng của bạn theo chuẩn IPO-MBA thực chiến: đo được, cải tiến liên tục, không bất ngờ.',
  focusMetrics: ['okr_progress', 'open_tasks', 'blockers'],
  duties: [
    'Soát KPI + task mảng mình kỳ này, so kỳ trước',
    'Phát hiện rủi ro/blocker sớm và đề xuất xử lý',
  ],
  actionGuidance: 'Rủi ro rõ ràng → raise_alert. Việc cần làm có owner rõ → create_task.',
}

export function getPlaybook(department: string | null | undefined): Playbook {
  if (!department) return GENERIC_PLAYBOOK
  return PLAYBOOKS[department] ?? { ...GENERIC_PLAYBOOK, department }
}

export function playbookToPrompt(pb: Playbook): string {
  return `PLAYBOOK CHUYÊN NGÀNH (${pb.department.toUpperCase()}) — IPO-MBA thực chiến:
Sứ mệnh: ${pb.mission}
Metric trọng tâm: ${pb.focusMetrics.join(', ')}
Nhiệm vụ mỗi kỳ:
${pb.duties.map((d, i) => `${i + 1}. ${d}`).join('\n')}
Hướng dẫn hành động: ${pb.actionGuidance}`
}
