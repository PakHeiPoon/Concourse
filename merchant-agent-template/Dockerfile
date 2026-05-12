# syntax=docker/dockerfile:1.7
# Single-stage build — keeps better-sqlite3 native artifact intact.
# pnpm deploy across stages drops the compiled .node file; not worth fighting.
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Workspace manifests first — caches install across source edits
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/agent/package.json apps/agent/

# Install agent deps (compiles better-sqlite3 from source for linux-x64)
RUN pnpm install --frozen-lockfile --filter agent...

# Source + build (emits dist/ via tsconfig.build.json)
COPY apps/agent ./apps/agent
RUN pnpm --filter agent build

# Volume mount target — Fly.io attaches /data
RUN mkdir -p /data
ENV NODE_ENV=production \
    PORT=8787 \
    STORE_URL=file:/data/agent.db

WORKDIR /app/apps/agent
EXPOSE 8787
CMD ["node", "dist/index.js"]
