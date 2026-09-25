import { describe, expect, it } from 'vitest'
import { makeClient, type Runner, type SqlExec } from './compat'

/**
 * THAM SỐ GỬI XUỐNG POSTGRES PHẢI ĐÚNG KIỂU CỘT.
 *
 * Lỗi thật phát hiện 25/09/2026 khi khách thật lưu một khối mô hình kinh
 * doanh: `canvas_blocks.items` là jsonb, giá trị là mảng chuỗi `["a","b"]`.
 * Lớp tương thích chỉ đoán theo HÌNH DẠNG giá trị — object thì JSON hoá, mảng
 * thì JSON hoá KHI có phần tử là object — nên mảng chuỗi thuần lọt xuống
 * nguyên dạng, node-postgres dựng thành mảng Postgres `{a,b}`, và cột jsonb
 * từ chối: `invalid input syntax for type json`. HTTP 500.
 *
 * Và không được JSON hoá mọi mảng: CSDL có 11 cột mảng Postgres THẬT mà ứng
 * dụng đang ghi (`org_positions.decision_rights`, `connector_mappings.dedupe_keys`…).
 * Sửa sai chiều này là hỏng chiều kia.
 */

type BatDuoc = { text: string; params: unknown[] }

/**
 * Runner giả: trả lược đồ cột khi được hỏi information_schema, và ghi lại mọi
 * câu lệnh khác để test soi tham số thật sự gửi xuống.
 */
function runnerGia(cot: Record<string, string>, batDuoc: BatDuoc[]): Runner {
  const exec: SqlExec = async (text, params) => {
    if (text.includes('information_schema.columns')) {
      return {
        rows: Object.entries(cot).map(([column_name, data_type]) => ({ column_name, data_type })),
        rowCount: Object.keys(cot).length,
      }
    }
    batDuoc.push({ text, params })
    return { rows: [{ ok: true }], rowCount: 1 }
  }
  return async (work) => work(exec)
}

const client = (cot: Record<string, string>, batDuoc: BatDuoc[]) =>
  makeClient(runnerGia(cot, batDuoc), async () => null)

describe('Lớp tương thích: tham số theo đúng kiểu cột', () => {
  it('1. mảng CHUỖI vào cột jsonb ⇒ JSON hoá (đây là lỗi đã làm hỏng lưu BMC)', async () => {
    const bat: BatDuoc[] = []
    await client({ items: 'jsonb', block_key: 'text' }, bat)
      .from('canvas_blocks')
      .insert({ block_key: 'channels', items: ['kênh A', 'kênh B'] })
      .select('block_key')
      .single()

    expect(bat).toHaveLength(1)
    // Phải là CHUỖI JSON, không phải mảng JS (mảng JS → `{a,b}` → jsonb từ chối).
    expect(bat[0].params).toContain('["kênh A","kênh B"]')
    expect(bat[0].params.some((p) => Array.isArray(p))).toBe(false)
  })

  it('2. mảng vào cột MẢNG POSTGRES ⇒ GIỮ NGUYÊN mảng JS', async () => {
    const bat: BatDuoc[] = []
    await client({ decision_rights: 'ARRAY', title_vi: 'text' }, bat)
      .from('org_positions')
      .insert({ title_vi: 'Giám đốc tài chính', decision_rights: ['duyệt chi', 'ký hợp đồng'] })
      .select('title_vi')
      .single()

    const mang = bat[0].params.find((p) => Array.isArray(p))
    expect(mang).toEqual(['duyệt chi', 'ký hợp đồng'])
    // JSON hoá cột mảng thật là hỏng chiều ngược lại.
    expect(bat[0].params).not.toContain('["duyệt chi","ký hợp đồng"]')
  })

  it('3. object vào cột jsonb vẫn JSON hoá như trước', async () => {
    const bat: BatDuoc[] = []
    await client({ driver_config: 'jsonb', label_vi: 'text' }, bat)
      .from('plan_lines')
      .insert({ label_vi: 'Doanh thu', driver_config: { monthly_vnd: 100 } })
      .select('label_vi')
      .single()
    expect(bat[0].params).toContain('{"monthly_vnd":100}')
  })

  it('4. mảng SỐ vào cột jsonb cũng JSON hoá (không chỉ mảng chuỗi)', async () => {
    const bat: BatDuoc[] = []
    await client({ amounts: 'jsonb' }, bat)
      .from('thu_nghiem')
      .insert({ amounts: [1, 2, 3] })
      .select('amounts')
      .single()
    expect(bat[0].params).toContain('[1,2,3]')
  })

  it('5. null giữ nguyên null, không thành chuỗi "null"', async () => {
    const bat: BatDuoc[] = []
    await client({ items: 'jsonb', ghi_chu: 'text' }, bat)
      .from('canvas_blocks')
      .insert({ items: null, ghi_chu: null })
      .select('items')
      .single()
    expect(bat[0].params.every((p) => p === null)).toBe(true)
  })

  it('6. UPDATE cũng theo kiểu cột, không chỉ INSERT', async () => {
    const bat: BatDuoc[] = []
    await client({ items: 'jsonb', id: 'uuid' }, bat)
      .from('canvas_blocks')
      .update({ items: ['một ý'] })
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .select('items')
      .single()
    expect(bat[0].params).toContain('["một ý"]')
  })

  it('7. giá trị trong WHERE không bị nhầm thành cột', async () => {
    const bat: BatDuoc[] = []
    await client({ items: 'jsonb', block_key: 'text' }, bat)
      .from('canvas_blocks')
      .select('items')
      .eq('block_key', 'channels')
    // Chuỗi lọc phải đi xuống nguyên dạng, không bị JSON hoá.
    expect(bat[0].params).toContain('channels')
  })
})
