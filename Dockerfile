# syntax=docker/dockerfile:1
# Self-host image for Self Distiller. Prisma 7 uses the pg driver adapter (pure JS),
# so no query-engine binary is needed in the runtime image.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Full build context: has source, devDeps, prisma CLI, tsx, generated client.
# Used both to build the app and (as the `migrate` compose service) to run migrations + seed.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
# Version label: git is only needed at build time (runner image has no .git).
# GIT_SHA / GIT_DATE build args override; otherwise resolve from the checkout.
# Never fail the build: fall back to "unknown".
ARG GIT_SHA=""
ARG GIT_DATE=""
RUN apk add --no-cache git
RUN export NEXT_PUBLIC_GIT_SHA="${GIT_SHA:-$(git -c safe.directory=/app rev-parse --short=7 HEAD 2>/dev/null || true)}" \
 && export NEXT_PUBLIC_GIT_DATE="${GIT_DATE:-$(git -c safe.directory=/app log -1 --format=%cd --date=short 2>/dev/null || true)}" \
 && export NEXT_PUBLIC_GIT_SHA="${NEXT_PUBLIC_GIT_SHA:-unknown}" \
 && pnpm build

# Minimal standalone runtime.
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
