/**
 * Monte Carlo financial simulation — spec Part I.2 Financial Model.
 *
 * Simulates N trials of month-by-month cash trajectory with stochastic
 * revenue growth, producing a runway distribution (P10/P50/P90), probability
 * of survival to horizon, ending-ARR distribution, and probability of hitting
 * a target ARR. Deterministic given a seed (testable, reproducible).
 *
 * Pure — no I/O, no Date.now/Math.random (uses a seeded PRNG) so it runs
 * identically in API routes, tests, and (if needed) workflow scripts.
 */

export type ModelAssumptions = {
  starting_cash: number // USD on hand today
  monthly_revenue: number // current MRR (USD)
  monthly_growth_mean: number // mean MoM growth, e.g. 0.10 = 10%
  monthly_growth_volatility: number // stddev of MoM growth, e.g. 0.05
  gross_margin: number // 0..1
  monthly_fixed_costs: number // OPEX excl. COGS (USD/mo)
  horizon_months: number // simulate this many months (e.g. 36)
  target_arr?: number // optional ARR goal to score probability against
  trials?: number // default 1000
  seed?: number // default 42 (deterministic)
}

export type MonteCarloResult = {
  trials: number
  horizon_months: number
  runway: { p10: number; p50: number; p90: number; mean: number } // months to cash<0 (horizon if survives)
  survival_probability: number // P(cash never < 0 within horizon)
  ending_arr: { p10: number; p50: number; p90: number; mean: number }
  target_arr?: number
  probability_hit_target?: number // P(ending ARR >= target)
  median_path: { month: number; cash: number; revenue: number }[] // P50 representative path
  warnings: string[]
}

// ─── seeded PRNG (mulberry32) + Box-Muller normal ──────────────
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function normal(rng: () => number, mean: number, sd: number): number {
  // Box-Muller
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + sd * z
}
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

export function runMonteCarlo(a: ModelAssumptions): MonteCarloResult {
  const trials = a.trials ?? 1000
  const horizon = a.horizon_months
  const rng = mulberry32(a.seed ?? 42)
  const warnings: string[] = []

  if (a.gross_margin < 0 || a.gross_margin > 1) warnings.push('gross_margin nên trong khoảng 0–1')
  if (a.monthly_growth_mean > 0.5) warnings.push('Tăng trưởng > 50%/tháng phi thực tế — kết quả có thể lạc quan quá')

  const runways: number[] = []
  const endingArrs: number[] = []
  let survived = 0
  let hitTarget = 0

  // capture one representative path near the median for the chart
  const allPaths: { cash: number[]; revenue: number[]; runway: number; endArr: number }[] = []

  for (let t = 0; t < trials; t++) {
    let cash = a.starting_cash
    let rev = a.monthly_revenue
    let runway = horizon
    let brokeBroke = false
    const cashPath: number[] = [cash]
    const revPath: number[] = [rev]
    for (let m = 1; m <= horizon; m++) {
      const g = Math.max(-0.5, normal(rng, a.monthly_growth_mean, a.monthly_growth_volatility))
      rev = Math.max(0, rev * (1 + g))
      const grossProfit = rev * a.gross_margin
      const net = grossProfit - a.monthly_fixed_costs
      cash += net
      cashPath.push(cash)
      revPath.push(rev)
      if (cash < 0 && !brokeBroke) {
        runway = m
        brokeBroke = true
      }
    }
    if (!brokeBroke) survived++
    const endArr = rev * 12
    runways.push(runway)
    endingArrs.push(endArr)
    if (a.target_arr != null && endArr >= a.target_arr) hitTarget++
    if (t < 200) allPaths.push({ cash: cashPath, revenue: revPath, runway, endArr })
  }

  const sortedRunway = [...runways].sort((x, y) => x - y)
  const sortedArr = [...endingArrs].sort((x, y) => x - y)
  const mean = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length

  // representative median path = the captured path whose runway is closest to P50
  const p50Runway = percentile(sortedRunway, 50)
  const repr = allPaths.reduce(
    (best, p) => (Math.abs(p.runway - p50Runway) < Math.abs(best.runway - p50Runway) ? p : best),
    allPaths[0],
  )
  const medianPath = repr
    ? repr.cash.map((c, i) => ({ month: i, cash: Math.round(c), revenue: Math.round(repr.revenue[i]) }))
    : []

  return {
    trials,
    horizon_months: horizon,
    runway: {
      p10: percentile(sortedRunway, 10),
      p50: p50Runway,
      p90: percentile(sortedRunway, 90),
      mean: Math.round(mean(runways) * 10) / 10,
    },
    survival_probability: Math.round((survived / trials) * 1000) / 1000,
    ending_arr: {
      p10: Math.round(percentile(sortedArr, 10)),
      p50: Math.round(percentile(sortedArr, 50)),
      p90: Math.round(percentile(sortedArr, 90)),
      mean: Math.round(mean(endingArrs)),
    },
    target_arr: a.target_arr,
    probability_hit_target: a.target_arr != null ? Math.round((hitTarget / trials) * 1000) / 1000 : undefined,
    median_path: medianPath,
    warnings,
  }
}

// ─── Sensitivity grid: P50 runway across growth × margin variations ──
export function sensitivityGrid(base: ModelAssumptions): {
  growth_deltas: number[]
  margin_deltas: number[]
  runway_p50: number[][]
} {
  const growthDeltas = [-0.25, -0.1, 0, 0.1, 0.25]
  const marginDeltas = [-0.1, -0.05, 0, 0.05, 0.1]
  const grid: number[][] = []
  for (const gd of growthDeltas) {
    const row: number[] = []
    for (const md of marginDeltas) {
      const r = runMonteCarlo({
        ...base,
        trials: 300, // lighter for grid
        monthly_growth_mean: base.monthly_growth_mean * (1 + gd),
        gross_margin: Math.max(0, Math.min(1, base.gross_margin + md)),
      })
      row.push(r.runway.p50)
    }
    grid.push(row)
  }
  return { growth_deltas: growthDeltas, margin_deltas: marginDeltas, runway_p50: grid }
}
