# AGENTS.es.md

> Esta es la versión en español. La documentación principal está en inglés en [`AGENTS.md`](./AGENTS.md).

Guía para sesiones de OpenCode que trabajan en este repositorio. Léelo antes de editar.

## Layout del monorepo

Workspace de pnpm con dos paquetes:

- `navi-core/` — Backend con Hono + Node.js. ESM (`"type": "module"`), punto de entrada `src/index.ts`. Sirve `/api/v1/*` en el puerto **3000** (hardcoded).
- `frontend/` — Nuxt 3 + Tailwind v4 + shadcn-nuxt + Pinia, orientado a Tauri v2. Servidor de desarrollo en el puerto **3001**.

El `package.json` raíz orquesta ambos mediante `concurrently`. Documentos de referencia: `INIT.md` (requisitos/arquitectura en inglés), `INIT.es.md` (requisitos/arquitectura en español), `frontend/DESIGN.md` (sistema de diseño "Analogue Blueprint" en inglés), `frontend/DESIGN.es.md` (español).

## Comandos

```bash
pnpm install                    # shamefully-hoist=true (.npmrc)
pnpm dev                        # core (:3000) + web (:3001) concurrentemente
pnpm dev:core                   # solo backend (tsx watch src/index.ts)
pnpm dev:web                    # solo frontend (nuxt dev)
pnpm build                      # pnpm -r build (core: tsc -> dist/; web: nuxt build)
pnpm --filter navi-core start   # ejecutar backend compilado (node dist/src/index.js)
pnpm test                       # vitest run para ambos paquetes
pnpm test:coverage              # reporte de cobertura para ambos paquetes
pnpm test:e2e                   # Playwright E2E (frontend, levanta dev server automáticamente)
pnpm --filter navi-core test    # backend vitest (src/**/__tests__/*.test.ts)
pnpm --filter navi-core test:watch
pnpm --filter navi-core test:coverage
pnpm --filter navi-core exec tsc --noEmit   # typecheck backend
pnpm --filter frontend test     # frontend vitest (nuxt env vía @nuxt/test-utils)
pnpm --filter frontend test:watch
pnpm --filter frontend test:coverage
pnpm --filter frontend test:e2e # Playwright (config en playwright.config.ts)
pnpm --filter frontend typecheck  # vue-tsc --noEmit (el único paquete con script typecheck)
pnpm --filter frontend generate   # nuxt generate (sitio estático)
pnpm --filter frontend preview    # nuxt preview (previsualizar sitio generado)
pnpm --filter navi-core exec drizzle-kit generate   # crear una nueva migración SQLite
docker compose build              # construir ambas imágenes Docker
docker compose up -d              # levantar servicios en segundo plano
docker compose down               # detener servicios
```

### Gotchas de verificación

- **No hay linter ni formatter instalado** — no hay config de ESLint/Prettier en ningún paquete. `pnpm lint` falla.
- **Solo `frontend` tiene script `typecheck`.** `pnpm typecheck` en raíz funciona (solo frontend, navi-core se salta). Para typecheck backend: `pnpm --filter navi-core exec tsc --noEmit` o `pnpm build`.
- **Ambos paquetes tienen vitest con tests reales.** Patrón de tests: `__tests__/*.test.ts` o `__tests__/*.spec.ts` co-ubicados.
- **Vitest `globals: false`** en ambas configs — importa `describe`/`it`/`expect` explícitamente de `vitest`.
- **Pipeline CI** — `.github/workflows/docker-publish.yml` construye y publica imágenes Docker en GHCR al hacer push a `main`.
- **Dockerfiles** — `navi-core/Dockerfile` (multi-stage, Node 24 Alpine), `frontend/Dockerfile` (multi-stage, Node 24 Alpine). `docker-compose.yml` en raíz para Portainer GitOps.
- `pnpm-workspace.yaml` `onlyBuiltDependencies` permite `better-sqlite3`, `esbuild`, `@parcel/watcher`, `vue-demi`. `allowBuilds` también incluye `msw: true`.

## Especificidades de navi-core

### Rutas de import ESM (alta señal)

`tsconfig.json` establece `"verbatimModuleSyntax": true` + `"module": "NodeNext"`. **Los imports relativos deben usar extensión `.js`** (p. ej. `./providers/factory-provider.js`), aunque los fuentes sean `.ts`. Tanto `tsx` (dev) como `tsc` lo esperan. Los nuevos archivos deben seguir la misma convención.

### Entorno

Copia `navi-core/.env.example` a `navi-core/.env`. `src/index.ts` carga `dotenv/config` al arrancar. Variables requerias/importantes:

- `AI_MODEL` — **requerido**, lanza error al arrancar si falta.
- `MASTER_TOKEN` — protege todas las rutas `/api/v1/*` vía auth `Bearer`. Sin valor por defecto; si no está configurado, todas las peticiones devuelven 401.
- `AI_PROVIDER`, `AI_PROVIDER_API_URL`, `AI_PROVIDER_API_KEY` — leídos por `factory-provider.ts` (soporta `openai` y `opencode`).
- Por defecto: `DATABASE_URL`=`./data/navi.db`, `MEMORY_DIR`=`./data/memory`, `COMPACTION_THRESHOLD`=`30`, `AI_SYSTEM_PROMPT`=``.
- `EXA_API_KEY` habilita el servidor MCP `exa` por defecto para búsqueda web.
- `DATABASE_URL` NO está en `.env.example` pero se usa en `drizzle.config.ts` y `src/index.ts`.

### Testing

Objetivo de cobertura en core: **≥ 70 %** líneas en `src/` (excl. `index.ts`, tipos puros). Frontend: **≥ 60 %** líneas en `composables/`, `stores/`, `lib/`.

#### navi-core (backend)

**Stack**: Vitest (node), cobertura v8, SQLite temp DB vía `mkdtempSync` + `drizzle migrate()`.

**Infra**: `src/test/setup.ts` exporta `createTestDb()` → retorna `{ db, destroy }`. Factories en `test/factories.ts`. Mocks en `test/mocks/` (provider, MCP service, memory store). `.env.test` provee valores seguros (`AI_MODEL=test-model`, `MASTER_TOKEN=test-token`, `AI_PROVIDER=openai`, `LOG_LEVEL=silent`). `vitest.config.ts` con `globals: false`.

**Qué se testea (21 archivos, 115 tests)**:
| Capa | Archivos | Enfoque |
|---|---|---|
| Esquema DB | `db/__tests__/schema.test.ts` | Aserciones de columna/tipo/enum |
| Repositorios | `db/repositories/__tests__/*.test.ts` | SQLite real por test, CRUD + casos límite |
| Servicios | `chat/__tests__/compaction-service.test.ts` | AI SDK mockeado (`generateText`) + repos mockeados |
| Prompts | `prompts/__tests__/dynamic-system-prompt.test.ts` | Unidad pura, mockea `node:os` |
| Memoria | `memory/__tests__/*.test.ts` | Store real (dir temp) + DB real + búsqueda FTS5 |
| MCP | `mcp/__tests__/*.test.ts` | Mockea `@ai-sdk/mcp` y `@ai-sdk/mcp/mcp-stdio`, config real, executor falso |
| Middleware | `middleware/__tests__/*.test.ts` | App Hono con env mockeado |
| Rutas | `routes/v1/__tests__/*.test.ts` | `app.request()` de Hono con dependencias mockeadas |
| Orquestación E2E | `chat/__tests__/e2e-orchestration.test.ts` | `createV1Routes` con `ChatService` real + `streamText` mockeado |

**Patrones clave**:
- `vi.mock("ai")` para `streamText`/`generateText` (usados por `chat-service.ts` y `compaction-service.ts`)
- `createTestDb()` + `testDb.destroy()` en `beforeEach`/`afterEach` para aislamiento de DB
- Cliente de test de Hono: `app.request('/path', { method, headers, body })` — no se necesita servidor
- La interfaz `TestDb` retorna `{ db, destroy }` — no más condiciones de carrera con estado a nivel de módulo

#### frontend (Nuxt)

**Stack**: Vitest (`environment: 'nuxt'` vía `@nuxt/test-utils`), `@vue/test-utils` (`mountSuspended`), `msw/node` para mockeo HTTP, Playwright para E2E.

**Infra**: `test/setup.ts` carga el servidor MSW. `test/mock-server/handlers.ts` tiene handlers MSW reutilizables. `test/factories.ts` tiene factories + helper `createSseResponse()`. `vitest.config.ts` con `environment: 'nuxt'`.

**Qué se testea (16 archivos, 69 vitest + 5 Playwright)**:
| Capa | Archivos | Enfoque |
|---|---|---|
| Stores | `stores/__tests__/auth.test.ts`, `agent.test.ts` | Pinia vía `setActivePinia`, no se necesita mount |
| Composables | `composables/__tests__/useNaviApi.test.ts`, `useSseChat.test.ts`, `useMouseTracking.test.ts`, `useRandomAnimation.test.ts` | Mockear `$fetch`, `fetch` nativo, streams SSE simulados |
| Componentes | `components/{chat,session,navi}/__tests__/*.test.ts` | `mountSuspended` de `@nuxt/test-utils/runtime` |
| Páginas | `pages/__tests__/login.test.ts` | Smoke test vía mount |
| Lib | `lib/__tests__/utils.test.ts` | Tests de funciones puras para `cn()` |
| E2E (Playwright) | `test/e2e/{login,chat,playground}.spec.ts` | `page.route()` para mock de API, tests de navegador |

**Patrones clave**:
- Componentes que usan auto-imports de Nuxt → usar `mountSuspended` en lugar de `mount`
- Stores → usar `setActivePinia(createPinia())` en `beforeEach`
- Mockeo de `$fetch` → `vi.stubGlobal('$fetch', mockFn)` para useNaviApi
- Mockeo de `fetch` raw → `vi.stubGlobal('fetch', mockFn)` para streams SSE de useSseChat
- `test/e2e/` se excluye de vitest config (`exclude: ['test/e2e/**']`) — usan el runner de Playwright
- Login E2E `page.route` + cookie pre-auth para tests de chat/playground
- Algunos composables dependientes del ciclo de vida (`useMouseTracking`/`useRandomAnimation`) se testean fuera del contexto de mount; tests de timers requieren `vi.useFakeTimers` + mount de componente

### Drizzle / SQLite

- Esquema: `src/db/schema.ts`. DB es `better-sqlite3` con WAL (`src/db/client.ts`).
- **Las migraciones se ejecutan automáticamente al arrancar** (`migrate(db, { migrationsFolder: "./drizzle" })` en `index.ts`). Archivos de migración generados en `navi-core/drizzle/`.
- Generar una nueva migración: `pnpm --filter navi-core exec drizzle-kit generate`. Config en `drizzle.config.ts`.
- `./data/` (DB + memoria) se crea en runtime (`mkdirSync`).

### MCP + HITL

- Servidores MCP declarados en `navi-core/mcp.config.json`; `mcp-config.ts` → `mcp-tool-service.ts`. Soporta transportes **HTTP**, **SSE** y **stdio**. Los valores de config pueden incluir variables de entorno con sintaxis `${VAR}`.
- Servidores por defecto: `deepwiki` (docs HTTP), `exa` (búsqueda web HTTP, requiere `EXA_API_KEY`). El servidor stdio `fetch` está deshabilitado actualmente por la vulnerabilidad SSRF `private-ip` en `mcp-fetch-server`.
- Las herramientas listadas bajo `autoApproveTools` se ejecutan sin confirmación; **todas las demás herramientas requieren aprobación Human-in-the-Loop** (flujo de aprobación en `routes/v1/approval.route.ts`, repos en `src/db/repositories/`).
- `src/memory/` implementa memoria interna del repo (store + repositorio + herramientas + constructor de contexto) y se reindexa al arrancar (`memoryRepository.reindexAll()`). Los nombres de herramientas de memoria de solo lectura están exentos de HITL.

### Routing

- Todas las rutas `/api/v1/*` tienen middleware `cors` + `requestLogger` + `masterAuth` aplicado en `index.ts`.
- Rutas construidas con `@hono/zod-openapi` (OpenAPI), swagger UI en `/api/v1/docs`. Módulos de ruta en `src/routes/v1/`: `chat`, `session`, `approval`, `mcp`, `memory` (registrados vía `routes/v1/index.ts`).
- Base de API del frontend: variable env `NUXT_PUBLIC_API_BASE` (por defecto `http://localhost:3000/api/v1`).

## Especificidades del frontend

- **Flujo de auth**: El middleware global (`middleware/auth.global.ts`) redirige a usuarios no autenticados a `/login`. El store de auth (`stores/auth.ts`) persiste el token vía `secureStorage` (wrapper consciente de Tauri en `lib/secureStorage.ts`). Página de login en `pages/login.vue`.
- **Tailwind v4** vía plugin `@tailwindcss/vite` (sin config PostCSS). `tailwind.config.ts` es un stub mínimo para la CLI de shadcn; la config real está en `assets/css/tailwind.css` usando directivas `@theme`.
- **shadcn-nuxt**, estilo `new-york`, baseColor `stone`, `cssVariables: true` (`components.json`). Componentes UI en `components/ui/`; aliases `@/components`, `@/lib/utils`, etc.
- **Páginas**: `pages/index.vue` (lista de sesiones + avatar NaviFace), `pages/login.vue`, `pages/playground.vue`, `pages/chat/[id].vue` (vista de chat).
- **Layouts**: `layouts/default.vue`, `layouts/auth.vue`.
- **Stores**: `stores/auth.ts`, `stores/agent.ts`.
- **Fuentes**: Inter (sans) + JetBrains Mono (monospace) vía `@nuxtjs/google-fonts`.
- `tsconfig.json` solo extiende `.nuxt/tsconfig.json` — no editar a mano; confiar en `nuxt prepare` (se ejecuta en `postinstall`).
- Tests E2E con Playwright en `test/e2e/`. La config levanta automáticamente el dev server (`playwright.config.ts`).

## Convenciones

- Los commits usan prefijos conventional-commit en español (`feat:`, `fix:`).
- La API está versionada en path (`/api/v1`). Tags SemVer con namespace (p. ej. `navi-core/v0.1.0`).
- El frontend nunca almacena credenciales del LLM — todos los secretos permanecen en el env del backend.

## Documentación (READMEs)

El repositorio tiene archivos README en tres niveles:

- `README.md` (raíz) — visión general del proyecto, quick start y comandos cross-package (inglés).
- `README.es.md` (raíz) — versión en español.
- `frontend/README.md` — setup específico del frontend, stack, scripts y estructura (inglés).
- `frontend/README.es.md` — versión en español.
- `navi-core/README.md` — documentación específica del backend: entorno, arquitectura y API (inglés).
- `navi-core/README.es.md` — versión en español.
- `INIT.md` — requisitos y arquitectura iniciales del proyecto (inglés).
- `INIT.es.md` — versión en español.
- `frontend/DESIGN.md` — sistema de diseño "Analogue Blueprint" (inglés).
- `frontend/DESIGN.es.md` — versión en español.

**Mantén los READMEs sincronizados:** si un cambio afecta funcionalidad, comandos, variables de entorno, arquitectura o convenciones documentadas en cualquier README, actualiza los archivos README relevantes antes de terminar la tarea. Cuando un cambio abarque varios paquetes, asegúrate de que los READMEs raíz, `frontend/` y `navi-core/` permanezcan consistentes entre sí y con `AGENTS.md`.
