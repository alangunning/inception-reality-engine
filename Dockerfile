FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/orchestrator/package.json packages/orchestrator/package.json
COPY packages/codex-runtime/package.json packages/codex-runtime/package.json
COPY packages/worktree-manager/package.json packages/worktree-manager/package.json
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app /app
RUN git init \
  && git config user.name "Reality Engine" \
  && git config user.email "reality-engine@localhost" \
  && git add AGENTS.md README.md LICENSE apps packages demo scripts prisma package.json package-lock.json tsconfig.json tsconfig.base.json \
  && git commit -m "Reality Engine 0.1.0"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV INCEPTION_CODEX_MODE=mock
ENV INCEPTION_PERSISTENCE=sqlite
ENV INCEPTION_REPO_ROOT=/app
ENV INCEPTION_WORKTREE_ROOT=/tmp/inception-worktrees
ENV DATABASE_URL=file:/data/inception.db

VOLUME ["/data"]
EXPOSE 3000
CMD ["npm", "start"]
