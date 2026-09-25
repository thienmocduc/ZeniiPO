/**
 * Zeni data client — query builder TƯƠNG THÍCH supabase-js, chạy trên Postgres
 * Zeni Cloud (pg). ~110 file route/lib giữ nguyên cú pháp `.from().select().eq()…`
 * / `.rpc()` / `.auth.getUser()`; chỉ 3 chokepoint lib/supabase/* đổi ruột.
 *
 * Phạm vi = ĐÚNG API surface repo đang dùng (kiểm kê 2026-08-11):
 *   from(t): select(cols|*, {count,head}) · insert(row|rows) · update(obj)
 *   · upsert(rows,{onConflict}) · delete() · eq neq in gt gte lt lte ilike
 *   · order(col,{ascending}) · limit · range · single · maybeSingle
 *   · orIlikeAny(cols, value)  ← thay thế duy nhất cho .or() PostgREST-string
 *   rpc(fn, args) — named args, KHÔNG chain builder phía sau (repo không dùng).
 * Không hỗ trợ (repo không dùng): embed select `rel(...)`, storage, realtime.
 *
 * An toàn: tên bảng/cột phải khớp /^[A-Za-z_][A-Za-z0-9_]*$/ (chặn injection
 * từ .from(biến) — nlq/ingest/crud đã whitelist thêm ở tầng trên). Giá trị
 * LUÔN đi qua tham số $n. Lỗi trả về {data:null, error:{message,code}} đúng
 * hợp đồng supabase-js — KHÔNG throw xuyên route.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// `any` CÓ CHỦ ĐÍCH: supabase-js không generics trả `any` — hơn 100 call-site
// đang dựa vào hành vi đó (data.map, data?.x). Giữ nguyên hợp đồng khi đổi ruột.

export type DbError = { message: string; code?: string; details?: string };
// Parity type với supabase-js untyped: LIST trả `any[]` (Array thật để callback
// .map/.reduce có contextual type — bare `any` sẽ nổ TS7006 hàng loạt),
// single()/maybeSingle()/rpc trả `any` (object/scalar).
export type DbResult<T = any> = {
  data: any[];
  error: DbError | null;
  count: number | null;
};
export type DbResultOne = {
  data: any;
  error: DbError | null;
  count: number | null;
};
/** Kiểu trả về sau .single()/.maybeSingle() — chỉ còn awaitable. */
export type ZeniQueryOne = PromiseLike<DbResultOne>;

export type SqlExec = (
  text: string,
  params: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;

/** Runner = mở ngữ cảnh chạy SQL (transaction + GUC RLS) rồi trả kết quả. */
export type Runner = <T>(work: (exec: SqlExec) => Promise<T>) => Promise<T>;

export type AuthUserShape = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown>;
  /** Zeni ID chưa expose — luôn null, giữ field để UI cũ không gãy. */
  last_sign_in_at?: string | null;
};

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function ident(name: string, what: string): string {
  const n = name.trim();
  if (!IDENT_RE.test(n)) throw new Error(`Tên ${what} không hợp lệ: "${name}"`);
  return `"${n}"`;
}

/** '*' | 'a, b, c' → chuỗi cột đã quote. Cấm embed `rel(...)` (sửa tay 2 chỗ cũ). */
function selectList(cols: string): string {
  const s = cols.trim();
  if (s === '' || s === '*') return '*';
  if (s.includes('(') || s.includes(':')) {
    throw new Error(`select "${s}" có embed/alias PostgREST — không hỗ trợ, viết SQL tay.`);
  }
  return s
    .split(',')
    .map((c) => ident(c, 'cột select'))
    .join(', ');
}

type Filter = { sql: (p: (v: unknown) => string) => string };
type OrderBy = { col: string; asc: boolean; nullsFirst?: boolean };
type Verb = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

class ZeniQuery<T = any> implements PromiseLike<DbResult<T>> {
  private verb: Verb | null = null;
  private cols = '*';
  private returning: string | null = null;
  private rows: Record<string, unknown>[] = [];
  private setObj: Record<string, unknown> | null = null;
  private onConflict: string | null = null;
  private filters: Filter[] = [];
  private orders: OrderBy[] = [];
  private limitN: number | null = null;
  private offsetN: number | null = null;
  private wantSingle: 'single' | 'maybe' | null = null;
  private countHead = false;

  constructor(
    private readonly table: string,
    private readonly runner: Runner,
  ) {
    ident(table, 'bảng');
  }

  // ── verbs ──────────────────────────────────────────────────────────
  select(cols?: string, opts?: { count?: 'exact'; head?: boolean }): this {
    if (this.verb && this.verb !== 'select') {
      this.returning = cols && cols.trim() !== '' ? cols : '*';
      return this;
    }
    this.verb = 'select';
    this.cols = cols ?? '*';
    if (opts?.head && opts.count === 'exact') this.countHead = true;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.verb = 'insert';
    this.rows = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string },
  ): this {
    this.verb = 'upsert';
    this.rows = Array.isArray(values) ? values : [values];
    this.onConflict = opts?.onConflict ?? null;
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.verb = 'update';
    this.setObj = values;
    return this;
  }

  delete(): this {
    this.verb = 'delete';
    return this;
  }

  // ── filters (đúng bộ repo dùng) ────────────────────────────────────
  private where(col: string, op: string, value: unknown): this {
    const c = ident(col, 'cột');
    this.filters.push({ sql: (p) => `${c} ${op} ${p(value)}` });
    return this;
  }
  eq(col: string, v: unknown): this { return this.where(col, '=', v); }
  neq(col: string, v: unknown): this { return this.where(col, '<>', v); }
  gt(col: string, v: unknown): this { return this.where(col, '>', v); }
  gte(col: string, v: unknown): this { return this.where(col, '>=', v); }
  lt(col: string, v: unknown): this { return this.where(col, '<', v); }
  lte(col: string, v: unknown): this { return this.where(col, '<=', v); }
  ilike(col: string, v: unknown): this { return this.where(col, 'ILIKE', v); }
  in(col: string, values: unknown[]): this {
    const c = ident(col, 'cột');
    this.filters.push({ sql: (p) => `${c} = ANY(${p(values)})` });
    return this;
  }
  /** Thay cho .or('a.ilike.x,b.ilike.x'): (a ILIKE v OR b ILIKE v OR …). */
  orIlikeAny(cols: string[], value: string): this {
    const quoted = cols.map((c) => ident(c, 'cột'));
    this.filters.push({
      sql: (p) => `(${quoted.map((c) => `${c} ILIKE ${p(value)}`).join(' OR ')})`,
    });
    return this;
  }

  // ── modifiers ──────────────────────────────────────────────────────
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orders.push({ col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst });
    return this;
  }
  limit(n: number): this { this.limitN = n; return this; }
  range(from: number, to: number): this {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }
  single(): ZeniQueryOne {
    this.wantSingle = 'single';
    return this as unknown as ZeniQueryOne;
  }
  maybeSingle(): ZeniQueryOne {
    this.wantSingle = 'maybe';
    return this as unknown as ZeniQueryOne;
  }

  // ── compile + run ──────────────────────────────────────────────────
  private compile(): { text: string; params: unknown[]; paramCols: (string | null)[] } {
    const params: unknown[] = [];
    // Cột ứng với từng tham số — cần để biết cột đó là jsonb hay mảng Postgres.
    // Tham số không đến từ một cột (giá trị trong WHERE…) thì để null.
    const paramCols: (string | null)[] = [];
    const p = (v: unknown) => { params.push(v); paramCols.push(null); return `$${params.length}`; };
    /** Như `p` nhưng nhớ tên cột. */
    const pc = (k: string, v: unknown) => { params.push(v); paramCols.push(k); return `$${params.length}`; };
    const t = `public.${ident(this.table, 'bảng')}`;
    const whereSql = this.filters.length
      ? ` WHERE ${this.filters.map((f) => f.sql(p)).join(' AND ')}`
      : '';
    const orderSql = this.orders.length
      ? ` ORDER BY ${this.orders
          .map(
            (o) =>
              `${ident(o.col, 'cột order')} ${o.asc ? 'ASC' : 'DESC'}${
                o.nullsFirst === undefined ? '' : o.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST'
              }`,
          )
          .join(', ')}`
      : '';
    const limitSql =
      (this.limitN != null ? ` LIMIT ${Math.max(0, Math.floor(this.limitN))}` : '') +
      (this.offsetN != null ? ` OFFSET ${Math.max(0, Math.floor(this.offsetN))}` : '');

    switch (this.verb) {
      case 'select': {
        if (this.countHead) return { text: `SELECT count(*)::int AS n FROM ${t}${whereSql}`, params, paramCols };
        return { text: `SELECT ${selectList(this.cols)} FROM ${t}${whereSql}${orderSql}${limitSql}`, params, paramCols };
      }
      case 'insert':
      case 'upsert': {
        if (this.rows.length === 0) throw new Error('insert/upsert 0 dòng.');
        const keys = [...new Set(this.rows.flatMap((r) => Object.keys(r)))];
        if (keys.length === 0) throw new Error('insert/upsert thiếu cột.');
        const colSql = keys.map((k) => ident(k, 'cột')).join(', ');
        const valuesSql = this.rows
          .map((r) => `(${keys.map((k) => pc(k, Object.prototype.hasOwnProperty.call(r, k) ? r[k] : null)).join(', ')})`)
          .join(', ');
        let conflictSql = '';
        if (this.verb === 'upsert') {
          if (!this.onConflict) throw new Error('upsert thiếu onConflict (repo luôn truyền).');
          const conflictCols = this.onConflict.split(',').map((c) => ident(c, 'cột onConflict'));
          const updatable = keys.filter((k) => !this.onConflict!.split(',').map((s) => s.trim()).includes(k));
          conflictSql = updatable.length
            ? ` ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${updatable.map((k) => `${ident(k, 'cột')} = EXCLUDED.${ident(k, 'cột')}`).join(', ')}`
            : ` ON CONFLICT (${conflictCols.join(', ')}) DO NOTHING`;
        }
        const retSql = this.returning ? ` RETURNING ${selectList(this.returning)}` : '';
        return { text: `INSERT INTO ${t} (${colSql}) VALUES ${valuesSql}${conflictSql}${retSql}`, params, paramCols };
      }
      case 'update': {
        if (!this.setObj || Object.keys(this.setObj).length === 0) throw new Error('update thiếu dữ liệu.');
        if (this.filters.length === 0) throw new Error(`update ${this.table} không có WHERE — chặn để an toàn.`);
        const setSql = Object.entries(this.setObj)
          .map(([k, v]) => `${ident(k, 'cột')} = ${pc(k, v)}`)
          .join(', ');
        const retSql = this.returning ? ` RETURNING ${selectList(this.returning)}` : '';
        return { text: `UPDATE ${t} SET ${setSql}${whereSql}${retSql}`, params, paramCols };
      }
      case 'delete': {
        if (this.filters.length === 0) throw new Error(`delete ${this.table} không có WHERE — chặn để an toàn.`);
        const retSql = this.returning ? ` RETURNING ${selectList(this.returning)}` : '';
        return { text: `DELETE FROM ${t}${whereSql}${retSql}`, params, paramCols };
      }
      default:
        throw new Error(`Query ${this.table} chưa có verb (select/insert/update/upsert/delete).`);
    }
  }

  /**
   * JSON hoá giá trị cho cột jsonb (pg tự lo Date/Buffer/null).
   *
   * ⚠ PHẢI BIẾT KIỂU CỘT. Bản cũ chỉ đoán theo hình dạng giá trị: object thì
   * JSON hoá, mảng thì JSON hoá KHI có phần tử là object. Hệ quả: một mảng
   * chuỗi thuần như `["a","b"]` lọt xuống nguyên dạng, node-postgres dựng nó
   * thành MẢNG POSTGRES `{a,b}`, và cột jsonb từ chối —
   * `invalid input syntax for type json`.
   *
   * Lỗi đó làm hỏng MỌI chỗ ghi mảng giá trị đơn vào cột jsonb, phát hiện khi
   * khách thật lưu một khối mô hình kinh doanh (`canvas_blocks.items`).
   *
   * Và KHÔNG được JSON hoá tất cả mảng: CSDL có 11 cột mảng Postgres thật
   * (`org_positions.decision_rights`, `connector_mappings.dedupe_keys`…) mà
   * ứng dụng đang ghi — JSON hoá chúng là làm hỏng chiều ngược lại.
   */
  private static normalizeParam(v: unknown, kieuCot?: string): unknown {
    if (v === null || v === undefined) return v;
    const laJson = kieuCot === 'jsonb' || kieuCot === 'json';

    if (v instanceof Date || Buffer.isBuffer(v)) return v;

    if (laJson) return typeof v === 'object' ? JSON.stringify(v) : v;

    // Không biết kiểu cột (tham số trong WHERE, hoặc bảng chưa tra được):
    // giữ nguyên cách đoán cũ, vốn đúng cho object và mảng-chứa-object.
    if (kieuCot === undefined) {
      if (typeof v === 'object' && !Array.isArray(v)) return JSON.stringify(v);
      if (Array.isArray(v) && v.some((x) => x && typeof x === 'object' && !(x instanceof Date))) {
        return JSON.stringify(v);
      }
    }
    return v;
  }

  /**
   * Kiểu dữ liệu từng cột, tra một lần cho mỗi bảng rồi nhớ lại.
   *
   * Tra ở tầng này thay vì khai cứng danh sách cột jsonb: danh sách khai tay
   * sẽ lệch ngay lần migration sau, và lệch âm thầm.
   */
  private static kieuCotTheoBang = new Map<string, Map<string, string>>();

  private static async layKieuCot(table: string, runner: Runner): Promise<Map<string, string>> {
    const daCo = ZeniQuery.kieuCotTheoBang.get(table);
    if (daCo) return daCo;
    try {
      const res = await runner(async (exec) =>
        exec(
          `SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1`,
          [table],
        ),
      );
      const m = new Map<string, string>(
        (res.rows as Array<{ column_name: string; data_type: string }>).map((r) => [
          r.column_name,
          r.data_type,
        ]),
      );
      ZeniQuery.kieuCotTheoBang.set(table, m);
      return m;
    } catch {
      // Tra không được thì trả map rỗng ⇒ quay về cách đoán cũ. Không chặn
      // câu lệnh chỉ vì không đọc được lược đồ.
      const m = new Map<string, string>();
      ZeniQuery.kieuCotTheoBang.set(table, m);
      return m;
    }
  }

  private async run(): Promise<DbResult<T>> {
    try {
      const { text, params, paramCols } = this.compile();
      // Chỉ tra lược đồ khi có tham số gắn với cột (tức là lệnh GHI).
      const kieu = paramCols.some((c) => c !== null)
        ? await ZeniQuery.layKieuCot(this.table, this.runner)
        : null;
      const norm = params.map((v, i) => {
        const col = paramCols[i];
        return ZeniQuery.normalizeParam(v, col && kieu ? kieu.get(col) : undefined);
      });
      const res = await this.runner(async (exec) => exec(text, norm));
      if (this.countHead) {
        return { data: null, error: null, count: (res.rows[0]?.n as number) ?? 0 } as unknown as DbResult<T>;
      }
      const isWrite = this.verb !== 'select';
      if (isWrite && !this.returning) {
        return { data: null, error: null, count: null } as unknown as DbResult<T>;
      }
      const rows = res.rows;
      if (this.wantSingle === 'single') {
        if (rows.length !== 1) {
          return {
            data: null,
            count: null,
            error: { code: 'PGRST116', message: `Cần đúng 1 dòng, nhận ${rows.length} (${this.table}).` },
          } as unknown as DbResult<T>;
        }
        return { data: rows[0], error: null, count: null } as unknown as DbResult<T>;
      }
      if (this.wantSingle === 'maybe') {
        return { data: rows[0] ?? null, error: null, count: null } as unknown as DbResult<T>;
      }
      return { data: rows, error: null, count: null } as DbResult<T>;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi DB không xác định';
      console.error(`[zeni/compat] ${this.verb ?? '?'} ${this.table}: ${message}`);
      return { data: null, error: { message }, count: null } as unknown as DbResult<T>;
    }
  }

  then<R1 = DbResult<T>, R2 = never>(
    onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/** Ánh xạ kết quả rpc theo PostgREST: 1 cột → scalar/array; nhiều cột → array object. */
function mapRpcResult(rows: Record<string, unknown>[]): unknown {
  if (rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  if (keys.length === 1) {
    const vals = rows.map((r) => r[keys[0]]);
    return rows.length === 1 ? vals[0] : vals;
  }
  return rows;
}

export type ZeniClient = {
  from: (table: string) => ZeniQuery;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<DbResultOne>;
  auth: {
    getUser: () => Promise<{ data: { user: AuthUserShape | null }; error: null }>;
  };
};

export function makeClient(
  runner: Runner,
  getAuthUser: () => Promise<AuthUserShape | null>,
): ZeniClient {
  return {
    from: (table: string) => new ZeniQuery(table, runner),
    rpc: (fn: string, args?: Record<string, unknown>) => {
      const exec = async (): Promise<DbResultOne> => {
        try {
          const name = ident(fn, 'hàm rpc');
          const params: unknown[] = [];
          const argSql = Object.entries(args ?? {})
            .map(([k, v]) => {
              const isJson =
                (v && typeof v === 'object' && !(v instanceof Date)) || Array.isArray(v);
              params.push(isJson ? JSON.stringify(v) : v);
              return `${ident(k, 'tham số rpc')} => $${params.length}${isJson ? '::jsonb' : ''}`;
            })
            .join(', ');
          const res = await runner(async (ex) => ex(`SELECT * FROM public.${name}(${argSql})`, params));
          return { data: mapRpcResult(res.rows), error: null, count: null };
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Lỗi rpc';
          console.error(`[zeni/compat] rpc ${fn}: ${message}`);
          return { data: null, error: { message }, count: null };
        }
      };
      return exec();
    },
    auth: {
      getUser: async () => ({ data: { user: await getAuthUser() }, error: null }),
    },
  };
}
