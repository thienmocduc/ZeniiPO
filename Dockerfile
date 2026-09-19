# Zeni-iPO → ZeniCloud Compute (Cloud Run container).
# Multi-stage: pnpm monorepo install + turbo build → Next.js standalone runner.
# Image stays small (standalone bundles only traced deps). No secrets baked in —
# env vars are injected at deploy time by ZeniCloud.

# ---- builder ----
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

# Copy the whole monorepo (workspace install needs all manifests + lockfile).
COPY . .
RUN pnpm install --frozen-lockfile

# Build only the web app via turbo (its deps build transitively).
RUN pnpm turbo run build --filter=@zeniipo/web

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone output is rooted at the monorepo root (outputFileTracingRoot),
# so it contains apps/web/server.js + minimal node_modules + traced files
# (incl. src/lib/v1/source.html via outputFileTracingIncludes).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
