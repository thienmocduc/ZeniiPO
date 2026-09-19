import { z } from 'zod'

/**
 * Lõi ĐẤU NỐI DỮ LIỆU — biến bảng/bản ghi từ hệ thống ngoài (Google Sheets,
 * Larksuite, MISA, zenidigital.io, ERP bất kỳ) thành bản ghi chuẩn Zeni.
 *
 * Nguyên tắc:
 *  - Chỉ ghi vào BẢNG TRONG DANH SÁCH TRẮNG (không cho ingest tuỳ ý).
 *  - Mỗi bảng có schema riêng: sai kiểu → dòng đó bị từ chối, KHÔNG làm hỏng cả lô.
 *  - tenant_id KHÔNG lấy từ payload — luôn lấy từ connector (chống ghi chéo tenant).
 *  - Trả về cả dòng hợp lệ lẫn dòng lỗi kèm lý do → minh bạch, đối soát được.
 *
 * Hàm thuần để test offline không cần DB.
 */

export const TARGET_TABLES = [
  'financial_statements',
  'unit_economics_inputs',
  'kpi_metrics',
  'tasks',
  'investor_pipeline',
  'compliance_items',
  'market_data',
  'comparables',
] as const
export type TargetTable = (typeof TARGET_TABLES)[number]

/** Chuẩn hoá số kiểu Việt/Excel: "1.234.567,89" · "1,234,567.89" · "12%" · "(500)" = -500 */
export function toNumber(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  let s = String(v).trim()
  if (!s) return undefined
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  s = s.replace(/[%\s₫$€]/g, '').replace(/[A-Za-zĐđ]/g, '')
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    // Dấu xuất hiện SAU cùng là dấu thập phân
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma > -1) {
    // Chỉ có phẩy: nhóm 3 chữ số → phân cách nghìn, ngược lại là thập phân
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot > -1) {
    // Chỉ có chấm — kiểu VN "1.500.000" là phân cách nghìn (nhóm đúng 3 chữ số),
    // còn "1500.75" là thập phân. Không phân biệt đúng thì số tiền sai 1000 lần.
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return undefined
  return neg ? -n : n
}

/** Chuẩn hoá ngày: 2026-06 · 2026-06-15 · 15/06/2026 · 06/2026 → YYYY-MM-01 (tháng) */
/**
 * Ngày/tháng có TỒN TẠI THẬT không.
 *
 * Trước đây các hàm dưới chỉ khớp hình dạng chuỗi rồi ghép lại, nên
 * `toDate('32/13/2026')` cho ra `'2026-13-32'` — tháng 13, ngày 32 — và ghi
 * thẳng xuống database. Fail-closed (#7): dữ liệu vô lý phải bị TỪ CHỐI,
 * không được đoán cũng không được cho lọt.
 */
function isRealDate(y: number, mo: number, d: number): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

function isRealMonth(y: number, mo: number): boolean {
  return Number.isInteger(y) && y >= 1900 && y <= 2999 && mo >= 1 && mo <= 12
}

const pad2 = (n: string | number) => String(n).padStart(2, '0')

export function toMonthDate(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  const s = String(v).trim()
  const build = (y: string, mo: string) =>
    isRealMonth(Number(y), Number(mo)) ? `${y}-${pad2(mo)}-01` : undefined

  let m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(s)
  if (m) return build(m[1], m[2])
  m = /^(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return build(m[2], m[1])
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return build(m[3], m[2])

  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`
  }
  return undefined
}

export function toDate(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  const s = String(v).trim()
  const build = (y: string, mo: string, day: string) =>
    isRealDate(Number(y), Number(mo), Number(day)) ? `${y}-${pad2(mo)}-${pad2(day)}` : undefined

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) return build(m[1], m[2], m[3])
  // Định dạng Việt Nam: ngày/tháng/năm
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return build(m[3], m[2], m[1])

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

const numField = z.preprocess(toNumber, z.number().finite().optional())
const intField = z.preprocess(
  (v) => { const n = toNumber(v); return n == null ? undefined : Math.round(n) },
  z.number().int().optional(),
)
const strField = (max = 300) =>
  z.preprocess((v) => (v == null || v === '' ? undefined : String(v).trim().slice(0, max)), z.string().optional())

/** Schema + khoá upsert cho từng bảng đích. */
export const TABLE_SPECS: Record<
  TargetTable,
  { schema: z.ZodTypeAny; conflictKeys: string[]; required: string[] }
> = {
  financial_statements: {
    schema: z.object({
      period: z.preprocess(toMonthDate, z.string()),
      revenue: numField, cogs: numField, opex_sales: numField, opex_rnd: numField,
      opex_ga: numField, other_income: numField, capex: numField, cash_balance: numField,
      accounts_receivable: numField, inventory: numField, accounts_payable: numField,
      notes: strField(1000),
    }),
    conflictKeys: ['tenant_id', 'period'],
    required: ['period'],
  },
  unit_economics_inputs: {
    schema: z.object({
      period: z.preprocess(toMonthDate, z.string()),
      new_customers: intField, churned_customers: intField, active_customers: intField,
      starting_mrr: numField, new_mrr: numField, expansion_mrr: numField,
      contraction_mrr: numField, churned_mrr: numField, notes: strField(1000),
    }),
    conflictKeys: ['tenant_id', 'period'],
    required: ['period'],
  },
  kpi_metrics: {
    schema: z.object({
      metric_code: z.preprocess((v) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'), z.string().min(1).max(64)),
      name: strField(200), category: strField(64), value: numField,
      unit: strField(32), period: strField(32),
      trend: z.preprocess((v) => { const s = String(v ?? '').toLowerCase(); return ['up', 'down', 'flat'].includes(s) ? s : undefined }, z.enum(['up', 'down', 'flat']).optional()),
    }),
    conflictKeys: [],
    required: ['metric_code'],
  },
  tasks: {
    schema: z.object({
      title: z.preprocess((v) => String(v ?? '').trim().slice(0, 300), z.string().min(1)),
      description: strField(2000),
      priority: z.preprocess((v) => { const s = String(v ?? '').toLowerCase(); return ['t1', 't2', 't3'].includes(s) ? s : undefined }, z.enum(['t1', 't2', 't3']).optional()),
      status: z.preprocess((v) => { const s = String(v ?? '').toLowerCase().replace(/\s/g, '_'); return ['todo', 'in_progress', 'blocked', 'done'].includes(s) ? s : undefined }, z.enum(['todo', 'in_progress', 'blocked', 'done']).optional()),
      due_date: z.preprocess(toDate, z.string().optional()),
    }),
    conflictKeys: [],
    required: ['title'],
  },
  investor_pipeline: {
    schema: z.object({
      investor_name: z.preprocess((v) => String(v ?? '').trim().slice(0, 200), z.string().min(1)),
      firm_name: strField(200), investor_type: strField(64), stage: strField(64),
      target_check_usd: numField, committed_usd: numField, probability_pct: numField,
      contact_email: strField(200), next_action: strField(300), notes: strField(1000),
    }),
    conflictKeys: [],
    required: ['investor_name'],
  },
  compliance_items: {
    schema: z.object({
      title: z.preprocess((v) => String(v ?? '').trim().slice(0, 300), z.string().min(1)),
      item_type: z.preprocess(
        (v) => { const s = String(v ?? '').toLowerCase(); return ['license', 'contract', 'ip', 'tax', 'labor', 'filing', 'insurance', 'policy', 'other'].includes(s) ? s : 'other' },
        z.enum(['license', 'contract', 'ip', 'tax', 'labor', 'filing', 'insurance', 'policy', 'other']),
      ),
      authority: strField(200), reference_no: strField(120),
      issued_date: z.preprocess(toDate, z.string().optional()),
      expiry_date: z.preprocess(toDate, z.string().optional()),
      notes: strField(1000),
    }),
    conflictKeys: [],
    required: ['title'],
  },
  market_data: {
    schema: z.object({
      metric_type: z.preprocess(
        (v) => { const s = String(v ?? '').toLowerCase(); return ['tam', 'sam', 'som', 'growth_rate', 'penetration', 'share', 'competitor_count', 'arpu', 'market_size'].includes(s) ? s : undefined },
        z.enum(['tam', 'sam', 'som', 'growth_rate', 'penetration', 'share', 'competitor_count', 'arpu', 'market_size']),
      ),
      region: strField(120), segment: strField(120), value_numeric: numField,
      value_unit: strField(32), source: strField(200),
    }),
    conflictKeys: [],
    required: ['metric_type'],
  },
  comparables: {
    schema: z.object({
      company_name: z.preprocess((v) => String(v ?? '').trim().slice(0, 200), z.string().min(1)),
      ticker: strField(32), exchange: strField(64), industry: strField(120),
      revenue_usd: numField, ebitda_usd: numField, market_cap_usd: numField,
      ev_revenue_multiple: numField, ev_ebitda_multiple: numField, pe_ratio: numField,
    }),
    conflictKeys: [],
    required: ['company_name'],
  },
}

export type MappedResult = {
  valid: Array<Record<string, unknown>>
  rejected: Array<{ index: number; reason: string; row: Record<string, unknown> }>
}

/**
 * Ánh xạ + kiểm định một lô dòng từ hệ thống ngoài.
 * `fieldMap` = {"Tên cột nguồn": "cột_đích"}. Cột nguồn không có trong map thì
 * thử khớp thẳng tên cột đích (cho phép nguồn đã đặt đúng tên).
 */
export function mapRows(
  target: TargetTable,
  rows: Array<Record<string, unknown>>,
  fieldMap: Record<string, string>,
): MappedResult {
  const spec = TABLE_SPECS[target]
  const valid: Array<Record<string, unknown>> = []
  const rejected: MappedResult['rejected'] = []

  // Chuẩn hoá key map (bỏ hoa/thường + khoảng trắng thừa)
  const normMap = new Map<string, string>()
  for (const [src, dst] of Object.entries(fieldMap ?? {})) {
    normMap.set(src.trim().toLowerCase(), dst)
  }

  rows.forEach((row, index) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row ?? {})) {
      const key = k.trim().toLowerCase()
      const dst = normMap.get(key) ?? k.trim()
      out[dst] = v
    }
    const parsed = spec.schema.safeParse(out)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      rejected.push({
        index,
        reason: `${first?.path?.join('.') || 'row'}: ${first?.message ?? 'không hợp lệ'}`,
        row,
      })
      return
    }
    const clean = Object.fromEntries(
      Object.entries(parsed.data as Record<string, unknown>).filter(([, v]) => v !== undefined),
    )
    for (const req of spec.required) {
      if (clean[req] == null) {
        rejected.push({ index, reason: `thiếu trường bắt buộc: ${req}`, row })
        return
      }
    }
    valid.push(clean)
  })

  return { valid, rejected }
}
