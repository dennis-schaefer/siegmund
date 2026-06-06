# syntax=docker/dockerfile:1
# Build context is the repository root so the workspace lockfile and
# packages/shared can be resolved during the dependency install.

FROM node:26.3.0-alpine AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install -g corepack
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY mobile/package.json ./mobile/package.json
RUN pnpm install --frozen-lockfile --filter @siegmund/backend...

FROM node:26.3.0-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY backend ./backend
RUN addgroup -S app && adduser -S -G app app && chown -R app:app /app
USER app
WORKDIR /app/backend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node /app/backend/healthcheck.mjs
CMD ["node", "--experimental-strip-types", "src/index.ts"]
