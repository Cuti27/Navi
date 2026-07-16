# AGENTS.md

Guidance for OpenCode sessions working in this repo. Read this before editing.

## Monorepo layout

pnpm workspace with two packages:

- `navi-core/` — Hono + Node.js backend. ESM (`"type": "module"`), entrypoint `src/index.ts`. Serves `/api/v1/*` on port **3000** (hardcoded).
- `frontend/` — Nuxt 3 + Tailwind v4 + shadcn-nuxt + Pinia, targetable via Tauri v2. Dev server on port **3001**.

Root `package.json` orchestrates both via `concurrently`. Reference docs: `INIT.md` (Spanish requirements/architecture), `frontend/DESIGN.md` (design system "Analogue Blueprint").

## Commands

```bash
pnpm install                    # shamefully-hoist=true (.npmrc)
pnpm dev                        # core (:3000) + web (:3001) concurrently
pnpm dev:core                   # backend only (tsx watch src/index.ts)
pnpm dev:web                    # frontend only (nuxt dev)
pnpm build                      # pnpm -r build (core: tsc -> dist/; web: nuxt build)
pnpm --filter navi-core start   # run compiled backend (node dist/src/index.js)
pnpm test                       # vitest run for both packages
pnpm test:coverage              # coverage report for both packages
pnpm test:e2e                   # Playwright E2E (frontend, starts dev server automatically)
pnpm --filter navi-core test    # backend vitest (src/**/__tests__/*.test.ts)
pnpm --filter navi-core test:watch
pnpm --filter navi-core test:coverage
pnpm --filter navi-core exec tsc --noEmit   # typecheck backend
pnpm --filter frontend test     # frontend vitest (nuxt env via @nuxt/test-utils)
pnpm --filter frontend test:watch
pnpm --filter frontend test:coverage
pnpm --filter frontend test:e2e # Playwright (config in playwright.config.ts)
pnpm --filter frontend typecheck  # vue-tsc --noEmit (the only package with a typecheck script)
pnpm --filter frontend generate   # nuxt generate (static site)
pnpm --filter frontend preview    # nuxt preview (preview generated site)
pnpm --filter navi-core exec drizzle-kit generate   # create a new SQLite migration
```

### Verification gotchas

- **No linter or formatter installed** — no ESLint/Prettier config in either package. `pnpm lint` errors.
- **Only `frontend` has a `typecheck` script.** `pnpm typecheck` at root works (frontend only, navi-core skipped). To typecheck backend: `pnpm --filter navi-core exec tsc --noEmit` or `pnpm build`.
- **Both packages have vitest with actual tests.** Test pattern: co-located `__tests__/*.test.ts` or `__tests__/*.spec.ts`.
- **Vitest `globals: false`** in both configs — import `describe`/`it`/`expect` explicitly from `vitest`.
- **No CI pipeline** (no `.github/workflows`). No Dockerfile yet.
- `pnpm-workspace.yaml` `onlyBuiltDependencies` allows `better-sqlite3`, `esbuild`, `@parcel/watcher`, `vue-demi`. `allowBuilds` also has `msw: true`.

## navi-core specifics

### ESM import paths (high-signal)

`tsconfig.json` sets `"verbatimModuleSyntax": true` + `"module": "NodeNext"`. **Relative imports must use `.js` extensions** (e.g. `./providers/factory-provider.js`), even though sources are `.ts`. `tsx` (dev) and `tsc` both expect this. New files must follow the same convention.

### Environment

Copy `navi-core/.env.example` to `navi-core/.env`. `src/index.ts` loads `dotenv/config` at startup. Required/important vars:

- `AI_MODEL` — **required**, throws on startup if missing.
- `MASTER_TOKEN` — protects all `/api/v1/*` routes via `Bearer` auth. No default; unset means every request 401s.
- `AI_PROVIDER`, `AI_PROVIDER_API_URL`, `AI_PROVIDER_API_KEY` — read by `factory-provider.ts` (supports `openai` and `opencode`).
- Defaults: `DATABASE_URL`=`./data/navi.db`, `MEMORY_DIR`=`./data/memory`, `COMPACTION_THRESHOLD`=`30`, `AI_SYSTEM_PROMPT`=``.
- `EXA_API_KEY` enables the default `exa` MCP server for web search.
- `DATABASE_URL` is NOT in `.env.example` but used by `drizzle.config.ts` and `src/index.ts`.

### Testing

Core coverage target: **≥ 70 %** lines in `src/` (excl. `index.ts`, pure types). Frontend target: **≥ 60 %** lines in `composables/`, `stores/`, `lib/`.

#### navi-core (backend)

**Stack**: Vitest (node), v8 coverage, SQLite temp DB via `mkdtempSync` + `drizzle migrate()`.

**Infra**: `src/test/setup.ts` exports `createTestDb()` → returns `{ db, destroy }`. Factories in `test/factories.ts`. Mocks in `test/mocks/` (provider, MCP service, memory store). `.env.test` provides safe values (`AI_MODEL=test-model`, `MASTER_TOKEN=test-token`, `AI_PROVIDER=openai`, `LOG_LEVEL=silent`). `vitest.config.ts` with `globals: false`.

**What's tested (21 files, 115 tests)**:
| Layer | Files | Approach |
|---|---|---|
| DB schema | `db/__tests__/schema.test.ts` | Column/type/enum assertions |
| Repositories | `db/repositories/__tests__/*.test.ts` | Real SQLite per test, CRUD + edge cases |
| Services | `chat/__tests__/compaction-service.test.ts` | Mocked AI SDK (`generateText`) + mock repos |
| Prompts | `prompts/__tests__/dynamic-system-prompt.test.ts` | Pure unit, mock `node:os` |
| Memory | `memory/__tests__/*.test.ts` | Real store (temp dir) + real DB + FTS5 search |
| MCP | `mcp/__tests__/*.test.ts` | Mock `@ai-sdk/mcp` and `@ai-sdk/mcp/mcp-stdio`, real config, fake executor |
| Middleware | `middleware/__tests__/*.test.ts` | Hono app with mocked env |
| Routes | `routes/v1/__tests__/*.test.ts` | Hono `app.request()` with mock dependencies |
| E2E orchestration | `chat/__tests__/e2e-orchestration.test.ts` | `createV1Routes` with real `ChatService` + mocked `streamText` |

**Key patterns**:
- `vi.mock("ai")` for `streamText`/`generateText` (used by `chat-service.ts` and `compaction-service.ts`)
- `createTestDb()` + `testDb.destroy()` in `beforeEach`/`afterEach` for DB isolation
- Hono test client: `app.request('/path', { method, headers, body })` — no server needed
- `TestDb` interface returns `{ db, destroy }` — no more module-level state race conditions

#### frontend (Nuxt)

**Stack**: Vitest (`environment: 'nuxt'` via `@nuxt/test-utils`), `@vue/test-utils` (`mountSuspended`), `msw/node` for HTTP mocking, Playwright for E2E.

**Infra**: `test/setup.ts` loads MSW server. `test/mock-server/handlers.ts` has reusable MSW handlers. `test/factories.ts` has factories + `createSseResponse()` helper. `vitest.config.ts` with `environment: 'nuxt'`.

**What's tested (16 files, 69 vitest + 5 Playwright)**:
| Layer | Files | Approach |
|---|---|---|
| Stores | `stores/__tests__/auth.test.ts`, `agent.test.ts` | Pinia via `setActivePinia`, no mounting needed |
| Composables | `composables/__tests__/useNaviApi.test.ts`, `useSseChat.test.ts`, `useMouseTracking.test.ts`, `useRandomAnimation.test.ts` | Mock `$fetch`, native `fetch`, mock SSE streams |
| Components | `components/{chat,session,navi}/__tests__/*.test.ts` | `mountSuspended` from `@nuxt/test-utils/runtime` |
| Pages | `pages/__tests__/login.test.ts` | Smoke test via mount |
| Lib | `lib/__tests__/utils.test.ts` | Pure function tests for `cn()` |
| E2E (Playwright) | `test/e2e/{login,chat,playground}.spec.ts` | `page.route()` for API mock, browser tests |

**Key patterns**:
- Components using Nuxt auto-imports → use `mountSuspended` instead of `mount`
- Stores → use `setActivePinia(createPinia())` in `beforeEach`
- `$fetch` mocking → `vi.stubGlobal('$fetch', mockFn)` for useNaviApi
- raw `fetch` mocking → `vi.stubGlobal('fetch', mockFn)` for useSseChat SSE streams
- `test/e2e/` is excluded from vitest config (`exclude: ['test/e2e/**']`) — they use Playwright runner
- Login E2E `page.route` + cookie pre-auth for chat/playground tests
- Some lifecycle-dependent composables (`useMouseTracking`/`useRandomAnimation`) are tested outside mount context; timer tests require `vi.useFakeTimers` + component mount

### Drizzle / SQLite

- Schema: `src/db/schema.ts`. DB is `better-sqlite3` with WAL (`src/db/client.ts`).
- **Migrations run automatically on startup** (`migrate(db, { migrationsFolder: "./drizzle" })` in `index.ts`). Generated migration files in `navi-core/drizzle/`.
- Generate a new migration: `pnpm --filter navi-core exec drizzle-kit generate`. Config in `drizzle.config.ts`.
- `./data/` (DB + memory) is created at runtime (`mkdirSync`).

### MCP + HITL

- MCP servers declared in `navi-core/mcp.config.json`; `mcp-config.ts` → `mcp-tool-service.ts`. Supports **HTTP**, **SSE**, and **stdio** transports. Config values can include environment variables using `${VAR}` syntax.
- Default servers: `deepwiki` (HTTP docs), `exa` (HTTP web search, requires `EXA_API_KEY`), and `fetch` (stdio URL fetch fallback via `mcp-fetch-server`).
- Tools listed under `autoApproveTools` run without confirmation; **all other tools require Human-in-the-Loop approval** (approval flow in `routes/v1/approval.route.ts`, repos in `src/db/repositories/`).
- `src/memory/` implements in-repo memory (store + repository + tools + context builder) and is reindexed on boot (`memoryRepository.reindexAll()`). Read-only memory tool names are exempted from HITL.

### Routing

- All `/api/v1/*` routes have `cors` + `requestLogger` + `masterAuth` middleware applied in `index.ts`.
- Routes built with `@hono/zod-openapi` (OpenAPI), swagger UI at `/api/v1/docs`. Route modules in `src/routes/v1/`: `chat`, `session`, `approval`, `mcp`, `memory` (registered via `routes/v1/index.ts`).
- Frontend API base: `NUXT_PUBLIC_API_BASE` env (defaults `http://localhost:3000/api/v1`).

## frontend specifics

- **Auth flow**: Global middleware (`middleware/auth.global.ts`) redirects unauthenticated users to `/login`. Auth store (`stores/auth.ts`) persists token via `secureStorage` (Tauri-aware wrapper in `lib/secureStorage.ts`). Login page at `pages/login.vue`.
- **Tailwind v4** via `@tailwindcss/vite` plugin (no PostCSS config). `tailwind.config.ts` is a minimal stub for shadcn CLI; actual config is in `assets/css/tailwind.css` using `@theme` directives.
- **shadcn-nuxt**, style `new-york`, baseColor `stone`, `cssVariables: true` (`components.json`). UI components live in `components/ui/`; aliases `@/components`, `@/lib/utils`, etc.
- **Pages**: `pages/index.vue` (session list + NaviFace avatar), `pages/login.vue`, `pages/playground.vue`, `pages/chat/[id].vue` (chat view).
- **Layouts**: `layouts/default.vue`, `layouts/auth.vue`.
- **Stores**: `stores/auth.ts`, `stores/agent.ts`.
- **Fonts**: Inter (sans) + JetBrains Mono (monospace) via `@nuxtjs/google-fonts`.
- `tsconfig.json` just extends `.nuxt/tsconfig.json` — do not hand-edit; rely on `nuxt prepare` (runs on `postinstall`).
- Playwright E2E tests in `test/e2e/`. Config starts a dev server automatically (`playwright.config.ts`).

## Conventions

- Commits use Spanish conventional-commit prefixes (`feat:`, `fix:`).
- API is versioned in path (`/api/v1`). SemVer tags namespaced (e.g. `navi-core/v0.1.0`).
- Frontend never stores LLM credentials — all secrets stay in backend env.

## Documentation (READMEs)

The repository has README files at three levels:

- `README.md` (root) — high-level project overview, quick start, and cross-package commands.
- `frontend/README.md` — frontend-specific setup, stack, scripts, and structure.
- `navi-core/README.md` — backend-specific setup, environment, architecture, and API details.

**Keep READMEs in sync:** if a change affects functionality, commands, environment variables, architecture, or conventions that are documented in any README, update the relevant README file(s) before finishing the task. When a change spans multiple packages, ensure the root, `frontend/`, and `navi-core/` READMEs remain consistent with each other and with `AGENTS.md`.
