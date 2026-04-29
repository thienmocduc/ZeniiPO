// Next.js instrumentation hook — runs once when the server starts.
// Wires Sentry server/edge configs.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Capture uncaught request errors and forward to Sentry server config.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: 'Pages Router' | 'App Router'; routePath: string; routeType: 'render' | 'route' | 'action' | 'middleware' },
) {
  if (process.env.SENTRY_DSN) {
    const { captureRequestError } = await import('@sentry/nextjs')
    captureRequestError(error, request, context)
  }
}
