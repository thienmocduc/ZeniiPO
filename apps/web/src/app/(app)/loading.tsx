/**
 * Skeleton loader for any (app) route segment that is loading.
 * Mirrors the v1 layout (header band + 4-card KPI row + 2 cards) so the
 * transition from skeleton → real content is jitter-free.
 */
export default function AppLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse" aria-busy="true" aria-label="Đang tải">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3 w-40 rounded bg-w8" />
        <div className="h-7 w-2/3 rounded bg-w8" />
        <div className="h-4 w-1/2 rounded bg-w8" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded border border-w8 bg-bg-2 p-4 space-y-3">
            <div className="h-3 w-24 rounded bg-w8" />
            <div className="h-8 w-32 rounded bg-w8" />
            <div className="h-3 w-20 rounded bg-w8" />
          </div>
        ))}
      </div>

      {/* Two cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded border border-w8 bg-bg-2 p-5 space-y-3">
            <div className="h-4 w-1/3 rounded bg-w8" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full rounded bg-w8" />
              <div className="h-3 w-5/6 rounded bg-w8" />
              <div className="h-3 w-4/6 rounded bg-w8" />
              <div className="h-3 w-full rounded bg-w8" />
              <div className="h-3 w-3/4 rounded bg-w8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
