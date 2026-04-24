/**
 * Python sidecar client.
 *
 * Calls the FastAPI service at services/python (typically deployed on
 * Railway / Fly.io / Render). Uses a short-lived HS256 JWT signed with
 * a shared secret — the same secret is configured on the Python side as
 * PYTHON_SHARED_SECRET.
 *
 * Server-side only — never import this from a client component.
 */

const ENCODER = new TextEncoder();

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[python.ts] Missing env var: ${name}`);
  return v;
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, ENCODER.encode(message));
  return base64url(sig);
}

export interface PythonJwtClaims {
  tenant_id: string;
  user_id: string;
  role: string;
  /** Time-to-live in seconds (default 300 = 5 min). */
  ttl_seconds?: number;
}

/**
 * Sign a short-lived HS256 JWT for the Python sidecar.
 * Uses Web Crypto so it works in both Node and Edge runtimes.
 */
export async function signSharedJwt(claims: PythonJwtClaims): Promise<string> {
  const secret = getEnv("PYTHON_SHARED_SECRET");
  const ttl = claims.ttl_seconds ?? 300;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    tenant_id: claims.tenant_id,
    user_id: claims.user_id,
    role: claims.role,
    iat: now,
    exp: now + ttl,
  };

  const encHeader = base64url(ENCODER.encode(JSON.stringify(header)));
  const encPayload = base64url(ENCODER.encode(JSON.stringify(payload)));
  const signingInput = `${encHeader}.${encPayload}`;
  const sig = await hmacSha256(secret, signingInput);
  return `${signingInput}.${sig}`;
}

export class PythonApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "PythonApiError";
  }
}

export interface CallPythonOptions {
  tenant_id: string;
  user_id: string;
  role: string;
  /** Override default 30s timeout. */
  timeout_ms?: number;
  /** GET / POST etc. Defaults to POST. */
  method?: "GET" | "POST";
}

/**
 * Call the Python sidecar with a signed JWT.
 *
 * @example
 *   const result = await callPython(
 *     '/sensitivity/monte-carlo',
 *     { ar_growth_pct: 80, churn_pct: 8, ... },
 *     { tenant_id, user_id, role: 'ceo' }
 *   );
 */
export async function callPython<T = unknown>(
  path: string,
  body: unknown,
  opts: CallPythonOptions,
): Promise<T> {
  const baseUrl = process.env.PYTHON_API_URL || "http://localhost:8000";
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const jwt = await signSharedJwt({
    tenant_id: opts.tenant_id,
    user_id: opts.user_id,
    role: opts.role,
  });

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeout_ms ?? 30_000,
  );

  try {
    const res = await fetch(url, {
      method: opts.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Zeniipo-Auth": `Bearer ${jwt}`,
      },
      body: opts.method === "GET" ? undefined : JSON.stringify(body ?? {}),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      throw new PythonApiError(
        res.status,
        `Python sidecar ${res.status} on ${path}`,
        parsed,
      );
    }
    return parsed as T;
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------- Typed convenience wrappers ---------- */

export interface MonteCarloInput {
  ar_growth_pct: number;
  churn_pct: number;
  gross_margin_pct: number;
  ltv_cac_ratio: number;
  multiple: number;
  base_arr_usd?: number;
  runs?: number;
  seed?: number;
  journey_id?: string;
}

export interface MonteCarloResult {
  p10: number; p25: number; p50: number; p75: number; p90: number;
  mean: number; std: number; min: number; max: number; runs: number;
  histogram_bins: { lower: number; upper: number; count: number }[];
  distribution: number[];
  persisted: boolean;
}

export function monteCarlo(
  input: MonteCarloInput,
  ctx: CallPythonOptions,
): Promise<MonteCarloResult> {
  return callPython<MonteCarloResult>("/sensitivity/monte-carlo", input, ctx);
}

export interface CouncilIdea {
  description: string;
  industry: string;
  market_size: string;
  competition: string;
}

export interface CouncilResult {
  overall_score: number;
  recommendation: "go" | "revise" | "no_go";
  summary: string;
  votes: {
    persona: string; dimension: string; score: number; weight: number;
    rationale: string; risks: string[]; opportunities: string[];
    duration_ms: number; error: string | null;
  }[];
  total_duration_ms: number;
}

export function councilValidate(
  idea: CouncilIdea,
  ctx: CallPythonOptions,
  extra_context?: string,
): Promise<CouncilResult> {
  return callPython<CouncilResult>(
    "/council/validate",
    { idea, extra_context },
    ctx,
  );
}

export interface BatchAgentInput {
  agent_codes: string[];
  prompt: string;
  mode?: "fast" | "standard" | "deep";
  journey_id?: string;
}

export interface BatchAgentResult {
  agent: string; output: string;
  tokens_input: number; tokens_output: number;
  cost_usd: number; duration_ms: number;
  error: string | null; persisted: boolean;
}

export function batchAgents(
  input: BatchAgentInput,
  ctx: CallPythonOptions,
): Promise<BatchAgentResult[]> {
  return callPython<BatchAgentResult[]>("/batch/agents", input, ctx);
}
