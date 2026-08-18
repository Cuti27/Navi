# Navi

Private AI Agent for Homelab.

Navi is a self-contained artificial intelligence assistant designed to run inside your home cluster. It consists of an orchestration backend (`navi-core`) and a web interface (`frontend`) that communicate securely using a master token.

## Monorepo structure

This repository is a pnpm workspace with two main packages:

| Package | Description | Technologies |
|---|---|---|
| [`navi-core/`](./navi-core/README.md) | Orchestration backend, AI, memory, and MCP tools. | Hono, Node.js, Vercel AI SDK, Drizzle ORM, SQLite |
| [`frontend/`](./frontend/README.md) | Web UI and installable PWA on iOS, Android, and desktop; also ready to target Tauri v2 in the future. | Nuxt 3, Tailwind v4, shadcn-nuxt, Pinia, @vite-pwa/nuxt |

> 🇪🇸 [Versión en español](./README.es.md)

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [pnpm](https://pnpm.io/) (`shamefully-hoist=true` is already configured in `.npmrc`)

## Quick start

```bash
# Install all workspace dependencies
pnpm install

# Configure the backend
cp navi-core/.env.example navi-core/.env
# Edit navi-core/.env with your credentials (AI_MODEL, MASTER_TOKEN, etc.)
```

## Main commands

All commands are run from the monorepo root:

```bash
# Start backend (:3000) and frontend (:3001) in parallel
pnpm dev

# Backend only
pnpm dev:core

# Frontend only
pnpm dev:web

# Build both packages
pnpm build

# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# E2E tests (Playwright, dev server starts automatically)
pnpm test:e2e
```

See [`AGENTS.md`](./AGENTS.md) for the full command list and project conventions.

## PWA

The frontend is distributed as a Progressive Web App. It can be installed directly from the browser without an App Store or Developer Program. See [`frontend/README.md`](./frontend/README.md#pwa-progressive-web-app) for platform-specific installation instructions.

## Docker deployment

The project includes multi-stage Dockerfiles and a `docker-compose.yml` ready for Portainer GitOps.

### Local deployment

```bash
# Build images
docker compose build

# Start services
docker compose up -d
```

### Portainer GitOps deployment

1. Create a stack in Portainer → **Git repository**.
2. Point to this repo, branch `main`, path `docker-compose.yml`.
3. Enable **GitOps updates** (5-minute polling or webhook).
4. Define the required environment variables in the stack:

| Variable | Required | Example |
|---|---|---|
| `AI_PROVIDER` | Yes | `opencode` |
| `AI_MODEL` | Yes | `deepseek-v4-flash` |
| `AI_PROVIDER_API_KEY` | Yes | `skey...` |
| `MASTER_TOKEN` | Yes | `REPLACE_WITH_A_STRONG_RANDOM_TOKEN` (generate with `openssl rand -hex 32`) |

5. Deploy. Portainer will run `docker build` automatically.

### GitHub Actions + GHCR

The `.github/workflows/docker-publish.yml` workflow builds images and pushes them to GitHub Container Registry on push to `main`. To use it:

1. Set `GITHUB_USER` to your GitHub username when running docker-compose (defaults to `cuti27`). You can override it: `GITHUB_USER=youruser docker compose up -d`.
2. In Portainer, define the `GITHUB_USER` environment variable in the stack or switch the images from `build:` to `image:` to pull from GHCR directly.
3. The CI workflow uses `${{ github.repository_owner }}` automatically, so no additional configuration is needed in GitHub Actions.

## Development

1. Copy and configure `navi-core/.env` (see [navi-core/README.md](./navi-core/README.md#environment)).
2. Run `pnpm dev` to start both services.
3. Open the app at `http://localhost:3001`.
4. The Swagger-documented API is available at `http://localhost:3000/api/v1/docs`.

## Tests

Both packages use **Vitest**:

```bash
pnpm test                      # All tests
pnpm --filter navi-core test   # Backend only
pnpm --filter frontend test    # Frontend only
```

The frontend also includes E2E tests with Playwright:

```bash
pnpm --filter frontend test:e2e
```

## Web search

`navi-core` ships with the **Exa** MCP server for web search by default (requires `EXA_API_KEY` in `navi-core/.env`). See [`navi-core/README.md`](./navi-core/README.md#mcp-and-human-in-the-loop-hitl) for more details.

## Media (Radarr / Sonarr)

Navi can fetch and download movies and series via the **`arr`** MCP server (`mcp-arr-lite`). The `arr` service is defined in `docker-compose.yml`; it needs `ARR_MCP_TOKEN`, plus `RADARR_URL`/`RADARR_API_KEY` and `SONARR_URL`/`SONARR_API_KEY` in the compose `.env`. See [`navi-core/README.md`](./navi-core/README.md#default-mcp-servers) for details.

### Network and custom domains

`arr-mcp` must be able to reach Radarr and Sonarr. The compose connects `arr-mcp` to **two networks**:

- `default` — the stack's own network, so `navi-core` can reach `arr-mcp` at `http://arr-mcp:3000/mcp`.
- `jellyfin_default` (external) — a **shared network with your media stack** (Jellyfin + Radarr + Sonarr). The `arr` service joins it so it can reach Radarr/Sonarr when they run on a separate network or behind custom domains.

The external network must already exist on the Docker host before deploying (`docker network create jellyfin_default` if it doesn't). It is configurable via `JELLYFIN_NETWORK` (default `jellyfin_default`).

**Custom-domain workarounds.** If `RADARR_URL`/`SONARR_URL` point to a public hostname (e.g. `https://sonarr.example.com`) instead of a container name:

- **DNS split-horizon**: ensure the hostname resolves inside Docker. If it points to your public IP, the container may not be able to reach it (hairpin NAT / firewall). A common fix is adding a `hosts` entry mapping the hostname to the container's IP, or using the internal container name (`http://sonarr:8989`) when both are on `jellyfin_default`.
- **Reverse proxy path**: if Sonarr/Radarr are behind a reverse proxy that requires a `Host` header, configure the proxy accordingly; `arr-mcp` does not add custom headers per tool.
- **TLS**: the Arr apps and `arr-mcp` use their own API keys; `arr-mcp` does not terminate TLS. Terminate TLS at the reverse proxy and use `http://` between containers when possible.
- **Debugging**: from inside the container, run `docker exec navi_arr-mcp sh -c 'wget -qO- --header="X-Api-Key: $SONARR_API_KEY" "https://sonarr.example.com/api/v3/series/lookup?term=test"'` and check the HTTP code. A `401`/`403` is an API-key/URL issue; a hang or timeout means a connectivity/routing problem (not a code bug in `arr-mcp`).

## Security

- All API routes (`/api/v1/*`) are protected by a **Master Token** (`MASTER_TOKEN`).
- The frontend never stores LLM credentials; these live only in `navi-core` environment variables.

## Additional documentation

- [`AGENTS.md`](./AGENTS.md) — Guide for coding agents: architecture, commands, conventions, and gotchas.
- [`INIT.md`](./INIT.md) — Initial project requirements and architecture (English).
- [`INIT.es.md`](./INIT.es.md) — Requisitos y arquitectura iniciales del proyecto (español).
- [`frontend/DESIGN.md`](./frontend/DESIGN.md) — "Analogue Blueprint" design system.
- [`navi-core/README.md`](./navi-core/README.md) — Backend-specific documentation.
- [`frontend/README.md`](./frontend/README.md) — Frontend-specific documentation.

## Conventions

- Commit messages use conventional prefixes in Spanish: `feat:`, `fix:`, etc.
- The API is path-versioned: `/api/v1`.
- Version tags are namespaced, e.g. `navi-core/vX.Y.Z`.

> **Note:** if you modify any project `README.md`, update the affected documentation to keep the root, `frontend/`, and `navi-core/` files consistent with each other and with `AGENTS.md`.
