import { NextResponse } from 'next/server'
import { z, type ZodTypeAny } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { requireUserAndTenant } from './tenant'

type ListFilter = (req: Request, ctx: { tenantId: string; userId: string }) => Record<string, unknown>

export type CrudConfig<TCreate extends ZodTypeAny, TUpdate extends ZodTypeAny = TCreate> = {
  /** Public.<table> name */
  table: string
  /** PostgREST select string. Default '*'. */
  select?: string
  /** Order by column desc on list. Default 'created_at'. */
  orderBy?: string
  /** Hard cap on list (default 200) */
  limit?: number
  /** Optional extra equality filters from query string ?key=val */
  searchableColumns?: string[]
  /** Schema for POST body (insert). Tenant_id auto-injected. */
  createSchema: TCreate
  /** Schema for PATCH body (update). Defaults to createSchema.partial(). */
  updateSchema?: TUpdate
  /** Override list filter. Receives Request + ctx; return shallow {col: val}. */
  listFilter?: ListFilter
  /** Insert hook — mutate insert payload (e.g., add created_by). */
  beforeInsert?: (payload: Record<string, unknown>, ctx: { userId: string; tenantId: string }) => Record<string, unknown>
}

function asPgError(error: { message: string }) {
  return NextResponse.json({ error: error.message }, { status: 500 })
}

export function createCrudHandler<TC extends ZodTypeAny, TU extends ZodTypeAny>(
  cfg: CrudConfig<TC, TU>,
) {
  const select = cfg.select ?? '*'
  const orderBy = cfg.orderBy ?? 'created_at'
  const limit = cfg.limit ?? 200

  async function GET(req: Request) {
    const supabase = await createServerClient()
    const auth = await requireUserAndTenant(supabase)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status })
    }
    let q = supabase.from(cfg.table).select(select)
    // Apply ?key=val filters for whitelisted searchable columns.
    const url = new URL(req.url)
    for (const col of cfg.searchableColumns ?? []) {
      const v = url.searchParams.get(col)
      if (v != null && v !== '') q = q.eq(col, v)
    }
    // Custom filters from listFilter
    if (cfg.listFilter) {
      const f = cfg.listFilter(req, { tenantId: auth.tenantId, userId: auth.user.id })
      for (const [k, v] of Object.entries(f)) {
        if (v == null) continue
        if (typeof v === 'object' && 'in' in (v as Record<string, unknown>)) {
          q = q.in(k, (v as { in: unknown[] }).in)
        } else {
          q = q.eq(k, v)
        }
      }
    }
    q = q.order(orderBy, { ascending: false }).limit(limit)
    const { data, error } = await q
    if (error) return asPgError(error)
    return NextResponse.json({ data })
  }

  async function POST(req: Request) {
    const body = await req.json().catch(() => ({}))
    const parsed = cfg.createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = await createServerClient()
    const auth = await requireUserAndTenant(supabase)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status })
    }
    let payload: Record<string, unknown> = { ...parsed.data, tenant_id: auth.tenantId }
    if (cfg.beforeInsert) {
      payload = cfg.beforeInsert(payload, { userId: auth.user.id, tenantId: auth.tenantId })
    }
    const { data, error } = await supabase.from(cfg.table).insert(payload).select(select).single()
    if (error) return asPgError(error)
    return NextResponse.json({ data }, { status: 201 })
  }

  return { GET, POST }
}

export function createCrudItemHandler<TU extends ZodTypeAny>(cfg: {
  table: string
  select?: string
  updateSchema: TU
}) {
  const select = cfg.select ?? '*'

  async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const supabase = await createServerClient()
    const auth = await requireUserAndTenant(supabase)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status })
    }
    const { data, error } = await supabase.from(cfg.table).select(select).eq('id', id).maybeSingle()
    if (error) return asPgError(error)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  }

  async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const body = await req.json().catch(() => ({}))
    const parsed = cfg.updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = await createServerClient()
    const auth = await requireUserAndTenant(supabase)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status })
    }
    const { data, error } = await supabase.from(cfg.table).update(parsed.data).eq('id', id).select(select).single()
    if (error) return asPgError(error)
    return NextResponse.json({ data })
  }

  async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const supabase = await createServerClient()
    const auth = await requireUserAndTenant(supabase)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status })
    }
    const { error } = await supabase.from(cfg.table).delete().eq('id', id)
    if (error) return asPgError(error)
    return NextResponse.json({ ok: true })
  }

  return { GET, PATCH, DELETE }
}
