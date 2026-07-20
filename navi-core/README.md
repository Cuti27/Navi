# navi-core

Core backend of **Navi**, the private AI Agent for Homelab.

This folder contains the **Orchestration and Logic Layer** of the system. It is a Node.js server built with [Hono](https://hono.dev/) and designed to act as a secure bridge between clients (frontend/mobile/desktop) and the various services in the cluster, including MCP (Model Context Protocol) servers.

> 🇪🇸 [Versión en español](./README.es.md)

## Goal

`navi-core` is the orchestrator brain that:

- Exposes a secure HTTP API for chat and agent management.
- Validates the **Master Token** on every incoming request.
- Safely holds the **LLM API Key** and other sensitive credentials (only in backend environment variables).
- Manages conversation history in a centralized **SQLite** database via Drizzle ORM.
- Builds a **dynamic System Prompt** (date, time, and basic network info) for each LLM request.
- Implements the hybrid context strategy: **sliding window + summaries** so memory is not lost and the model context is not exceeded.
- Streams LLM responses via **SSE** and emits real-time Tool Calling status events.
- Acts as the main **MCP client**, connecting to MCP servers in the environment.
- Implements the **Human-in-the-Loop (HITL)** flow: pauses execution of any tool that modifies cluster state until it receives explicit user approval.

## Technologies

- [Hono](https://hono.dev/) — lightweight Web Standards-based web framework.
- [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) — OpenAPI/Swagger generation.
- [Vercel AI SDK](https://sdk.vercel.ai/) — LLM integration and streaming.
- [Drizzle ORM](https://orm.drizzle.team/) — type-safe ORM for SQLite.
- [SQLite](https://www.sqlite.org/) + `better-sqlite3` — embedded local database with WAL.
- [tsx](https://github.com/privatenumber/tsx) — TypeScript execution in development.

## Scripts

```bash
# Install dependencies (from the monorepo root)
pnpm install

# Development with hot reload at http://localhost:3000
pnpm dev:core

# Compile TypeScript to dist/
pnpm --filter navi-core build

# Run the compiled version
pnpm --filter navi-core start

# Typecheck without emitting
pnpm --filter navi-core exec tsc --noEmit

# Tests
pnpm --filter navi-core test
pnpm --filter navi-core test:watch
pnpm --filter navi-core test:coverage

# Generate a new Drizzle migration
pnpm --filter navi-core exec drizzle-kit generate
```

## Environment

Copy `.env.example` to `.env` and configure at least the required variables:

```bash
cp .env.example .env
```

| Variable | Required | Description | Default |
|---|---|---|---|
| `AI_MODEL` | Yes | Language model identifier. | — |
| `MASTER_TOKEN` | Yes | Bearer authentication token for all `/api/v1/*` routes. Generate with `openssl rand -hex 32`. | — |
| `AI_PROVIDER` | No | AI provider: `openai` or `opencode`. | `openai` |
| `AI_PROVIDER_API_URL` | No | Provider base URL. | — |
| `AI_PROVIDER_API_KEY` | No | Provider API key. | — |
| `DATABASE_URL` | No | SQLite file path. | `./data/navi.db` |
| `MEMORY_DIR` | No | Persistent memory directory. | `./data/memory` |
| `COMPACTION_THRESHOLD` | No | Message compaction threshold. | `30` |
| `AI_SYSTEM_PROMPT` | No | Additional system prompt fragment. | `""` |
| `CORS_ORIGINS` | No | Allowed origins (comma-separated or `*` for all). | `*` |
| `EXA_API_KEY` | No | [Exa](https://exa.ai/) API key for web search via MCP. | — |

> `AI_MODEL` is required: the server will fail to start if missing.
> `MASTER_TOKEN` has no default; without it all requests will return `401`.

## Architecture within the monorepo

```
┌─────────────────┐
│   Frontend(s)   │  ← Vue/Nuxt + Tauri (web/desktop/mobile)
└────────┬────────┘
         │ Master Token + SSE
         ▼
┌─────────────────┐
│   navi-core     │  ← This project (orchestrator + AI + MCP)
│  (Node + Hono)  │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌─────────────┐
│ SQLite│  │ MCP servers │
│  DB   │  └─────────────┘
└───────┘
```

## `src/` structure

```
src/
├── chat/              # Chat logic, streaming, and compaction
├── db/                # SQLite client, schema, repositories, and migrations
├── memory/            # Internal agent memory (store, repo, tools)
├── mcp/               # MCP tool configuration and service
├── middleware/        # Hono middleware (CORS, logging, masterAuth)
├── prompts/           # Dynamic system prompt builder
├── providers/         # AI provider factory
├── routes/v1/         # API v1 HTTP routes
├── test/              # Test utilities, factories, and mocks
├── types/             # Shared types
└── index.ts           # Entry point
```

## API

All routes are under `/api/v1` and require the header:

```
Authorization: Bearer <MASTER_TOKEN>
```

Interactive documentation (Swagger UI) is available at `/api/v1/docs` when the server is running.

Main route modules:

- `chat` — conversation streaming.
- `session` — chat session management.
- `approval` — Human-in-the-Loop approvals.
- `mcp` — MCP tool listing and execution.
- `memory` — internal memory tools.

## MCP and Human-in-the-Loop (HITL)

- MCP servers are declared in `mcp.config.json` and loaded via `mcp-config.ts` → `mcp-tool-service.ts`.
- **HTTP**, **SSE**, and **stdio** transports are supported.
- `mcp.config.json` supports environment variables using the `${VAR}` syntax (for example, in headers or stdio commands).
- Tools listed in `autoApproveTools` run without confirmation.
- **All other tools require user approval** before execution.
- Read-only memory tools are exempt from HITL.
- The approval flow is managed in `routes/v1/approval.route.ts` and its associated repositories.

### Default MCP servers

The `mcp.config.json` file includes by default:

- **`deepwiki`** (HTTP): repository documentation.
- **`exa`** (HTTP): web search and page fetching. Requires `EXA_API_KEY`. The `web_search_exa` and `web_fetch_exa` tools are auto-approved.
- **`fetch`** (stdio): **temporarily disabled** due to the `private-ip` SSRF vulnerability in `mcp-fetch-server`. It can be re-enabled in `mcp.config.json` once patched.

To enable Exa, add your API key to `navi-core/.env`:

```bash
EXA_API_KEY=your_exa_api_key
```

The `Authorization: Bearer ${EXA_API_KEY}` header is injected automatically from the MCP configuration.

## Persistence

- Schema in `src/db/schema.ts`.
- Drizzle migrations are applied automatically when the server starts.
- Generate new migrations with `pnpm --filter navi-core exec drizzle-kit generate`.
- The `./data/` directory (database + memory) is created at runtime.

> **Important:** in production, mount `./data` on a persistent physical volume to avoid losing the agent state during cluster updates.

## Tests

- **Framework**: Vitest with Node environment.
- **Database**: temporary SQLite created with `mkdtempSync` and migrated with Drizzle.
- **Infrastructure**: `src/test/setup.ts` exports `createTestDb()`; factories in `test/factories.ts`; mocks in `test/mocks/`.
- **Coverage target**: ≥ 70 % lines in `src/` (excluding `index.ts` and pure types).

Run tests with:

```bash
pnpm --filter navi-core test
```

## Security

- The frontend never stores LLM credentials. All keys live exclusively in this backend's environment variables.
- Every request to `/api/v1/*` must include a valid `MASTER_TOKEN`.
- In production, expose `navi-core` only inside the cluster network or behind a TLS proxy.

## Important notes

- The project uses ESM (`"type": "module"`). Relative imports must include the `.js` extension (e.g. `./providers/factory-provider.js`), even though source files are `.ts`.
- `tsconfig.json` enables `verbatimModuleSyntax` and `module: NodeNext`; respect it when adding new imports.
- This service is deployed as a Docker container. See `docker-compose.yml` at the monorepo root and the [main README](../README.md#docker-deployment) for deployment instructions.
