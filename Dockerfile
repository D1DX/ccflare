# ccflare — D1DX fork
# Runs the ccflare server on port 8080.
# Dashboard assets are built at image time; SQLite state persists via /data volume.

FROM oven/bun:1.3-slim

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json bun.lock ./
COPY apps/desktop/package.json ./apps/desktop/
COPY apps/lander/package.json ./apps/lander/
COPY apps/server/package.json ./apps/server/
COPY apps/tui/package.json ./apps/tui/
COPY apps/web/package.json ./apps/web/
COPY packages/api/package.json ./packages/api/
COPY packages/config/package.json ./packages/config/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/http/package.json ./packages/http/
COPY packages/logger/package.json ./packages/logger/
COPY packages/oauth-flow/package.json ./packages/oauth-flow/
COPY packages/providers/package.json ./packages/providers/
COPY packages/proxy/package.json ./packages/proxy/
COPY packages/runtime-server/package.json ./packages/runtime-server/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/

RUN bun install --frozen-lockfile

# Copy source and build dashboard assets
COPY . .
RUN bun run build:dashboard

# ccflare stores SQLite + config in paths from env vars (lowercase-prefixed)
ENV ccflare_DB_PATH=/data/ccflare.db
ENV ccflare_CONFIG_PATH=/data/ccflare.json
RUN mkdir -p /data && chown -R bun:bun /data /app

USER bun

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

VOLUME ["/data"]

CMD ["bun", "run", "apps/server/src/server.ts"]
