# DebateThis (Next.js port) production container.
#
# Builds the Next App Router output then runs a custom server (server.ts)
# via tsx so Socket.IO can co-host on the same port. Mirrors the Python
# image's single-process / single-machine deployment model.
#
# Multi-stage:
#   1. deps    — install node_modules (cached across rebuilds)
#   2. builder — `next build` + `prisma generate`
#   3. runner  — minimal final image with built output + node_modules
#
# Build:   docker build -t debatethisnow-next .
# Run:     docker run -p 3000:3000 --env-file .env debatethisnow-next
# Deploy:  fly deploy   (picks up this Dockerfile automatically)

# --- 1. deps -----------------------------------------------------------------
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `--ignore-scripts` keeps Prisma's postinstall (which tries to run
# `prisma generate` against the unpopulated schema) from failing. We
# regenerate explicitly in the builder stage.
RUN npm ci --ignore-scripts

# --- 2. builder --------------------------------------------------------------
FROM node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client + compile Next App Router. The build needs a
# DATABASE_URL to satisfy env validation, but never connects — pass a
# placeholder. Real value is injected at runtime via Fly secrets.
ENV DATABASE_URL=postgresql://build-placeholder@localhost:5432/db
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# --- 3. runner ---------------------------------------------------------------
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
# Fly's edge terminates TLS and forwards over HTTP; the proxy.ts CSP +
# HSTS bits rely on NODE_ENV=production to flip into prod-mode.

# Copy only what runtime needs.
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src

EXPOSE 8080

# Entrypoint:
#   1. `prisma migrate deploy` — no-op on first deploy (schema already
#      lives in Neon). On later deploys, applies any new migrations.
#      If a migration FAILS, the entire entrypoint aborts and the
#      container exits — we never want a half-migrated DB serving
#      traffic.
#   2. `tsx server.ts` — replaces the shell so signals (SIGTERM from
#      Fly during rolling deploys) reach the worker cleanly.
CMD ["/bin/sh", "-c", "\
    npx prisma migrate deploy && \
    exec npx tsx server.ts \
"]
