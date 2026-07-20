# navi-core

> Esta es la versión en español. La documentación principal está en inglés en [`README.md`](./README.md).

Backend central de **Navi**, el agente de IA privado para Homelab.

Esta carpeta contiene la **Capa de Orquestación y Lógica** del sistema. Es un servidor Node.js construido con [Hono](https://hono.dev/) y diseñado para actuar como puente seguro entre los clientes (frontend/móvil/escritorio) y los distintos servicios del clúster, incluyendo los servidores MCP (Model Context Protocol).

## Objetivo

`navi-core` es el cerebro orquestador que:

- Expone una API HTTP segura para el chat y la gestión del agente.
- Valida el **Token Maestro** en todas las peticiones entrantes.
- Custodia de forma segura la **API Key del LLM** y otras credenciales sensibles (solo en variables de entorno del backend).
- Gestiona el historial de conversaciones en una base de datos **SQLite** centralizada mediante Drizzle ORM.
- Construye un **System Prompt dinámico** (fecha, hora e información básica de red) para cada petición al LLM.
- Implementa la estrategia híbrida de contexto: **ventana deslizante + resúmenes** para no perder memoria ni exceder el contexto del modelo.
- Transmite las respuestas del LLM en **streaming (SSE)** y emite eventos de estado de las herramientas (Tool Calling) en tiempo real.
- Actúa como **cliente MCP principal**, conectándose a servidores MCP del entorno.
- Implementa el flujo **Human-in-the-Loop (HITL)**: pausa la ejecución de cualquier herramienta que modifique el estado del clúster hasta recibir una aprobación explícita del usuario.

## Tecnologías

- [Hono](https://hono.dev/) — framework web ligero y basado en Web Standards.
- [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) — generación de OpenAPI/Swagger.
- [Vercel AI SDK](https://sdk.vercel.ai/) — integración y streaming con modelos de lenguaje.
- [Drizzle ORM](https://orm.drizzle.team/) — ORM tipo-seguro para SQLite.
- [SQLite](https://www.sqlite.org/) + `better-sqlite3` — base de datos local embebida con WAL.
- [tsx](https://github.com/privatenumber/tsx) — ejecución de TypeScript en desarrollo.

## Scripts

```bash
# Instalar dependencias (desde la raíz del monorepo)
pnpm install

# Desarrollo con hot reload en http://localhost:3000
pnpm dev:core

# Compilar TypeScript a dist/
pnpm --filter navi-core build

# Ejecutar la versión compilada
pnpm --filter navi-core start

# Typecheck sin emitir
pnpm --filter navi-core typecheck

# Tests
pnpm --filter navi-core test
pnpm --filter navi-core test:watch
pnpm --filter navi-core test:coverage

# Generar una nueva migración de Drizzle
pnpm --filter navi-core exec drizzle-kit generate
```

## Entorno

Copia `.env.example` a `.env` y configura al menos las variables obligatorias:

```bash
cp .env.example .env
```

| Variable | Requerida | Descripción | Por defecto |
|---|---|---|---|
| `AI_MODEL` | Sí | Identificador del modelo de lenguaje. | — |
| `MASTER_TOKEN` | Sí | Token de autenticación Bearer para todas las rutas `/api/v1/*`. Generar con `openssl rand -hex 32`. | — |
| `AI_PROVIDER` | No | Proveedor de IA: `openai` u `opencode`. | `openai` |
| `AI_PROVIDER_API_URL` | No | URL base del proveedor. | — |
| `AI_PROVIDER_API_KEY` | No | API key del proveedor. | — |
| `DATABASE_URL` | No | Ruta del archivo SQLite. | `./data/navi.db` |
| `MEMORY_DIR` | No | Directorio de memoria persistente. | `./data/memory` |
| `COMPACTION_THRESHOLD` | No | Umbral de compactación de mensajes. | `30` |
| `AI_SYSTEM_PROMPT` | No | Fragmento adicional del system prompt. | `""` |
| `CORS_ORIGINS` | No | Orígenes permitidos (separados por comas o `*` para todos). | `*` |
| `EXA_API_KEY` | No | API key de [Exa](https://exa.ai/) para búsquedas web vía MCP. | — |
| `GITHUB_USER` | No | Usuario de GitHub para el namespace de imágenes Docker al usar docker-compose. | `cuti27` |

> `AI_MODEL` es obligatorio: el servidor fallará al arrancar si falta.
> `MASTER_TOKEN` no tiene valor por defecto; sin él todas las peticiones devolverán `401`.

## Arquitectura dentro del monorepo

```
┌─────────────────┐
│   Frontend(s)   │  ← Vue/Nuxt + Tauri (web/escritorio/móvil)
└────────┬────────┘
         │ Token Maestro + SSE
         ▼
┌─────────────────┐
│   navi-core     │  ← Este proyecto (orquestador + IA + MCP)
│  (Node + Hono)  │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌─────────────┐
│ SQLite│  │ Servidores  │
│  DB   │  │    MCP      │
└───────┘  └─────────────┘
```

## Estructura de `src/`

```
src/
├── chat/              # Lógica de chat, streaming y compactación
├── db/                # Cliente SQLite, schema, repositorios y migraciones
├── memory/            # Memoria interna del agente (store, repo, herramientas)
├── mcp/               # Configuración y servicio de herramientas MCP
├── middleware/        # Middlewares de Hono (CORS, logging, masterAuth)
├── prompts/           # Construcción del system prompt dinámico
├── providers/         # Fábrica de proveedores de IA
├── routes/v1/         # Rutas HTTP de la API v1
├── test/              # Utilidades, factories y mocks de tests
├── types/             # Tipos compartidos
└── index.ts           # Punto de entrada
```

## API

Todas las rutas están bajo `/api/v1` y requieren el header:

```
Authorization: Bearer <MASTER_TOKEN>
```

La documentación interactiva (Swagger UI) está disponible en `/api/v1/docs` cuando el servidor está en ejecución.

Módulos de ruta principales:

- `chat` — streaming de conversaciones.
- `session` — gestión de sesiones de chat.
- `approval` — aprobaciones Human-in-the-Loop.
- `mcp` — listado y ejecución de herramientas MCP.
- `memory` — herramientas de memoria interna.

## MCP y Human-in-the-Loop (HITL)

- Los servidores MCP se declaran en `mcp.config.json` y se cargan mediante `mcp-config.ts` → `mcp-tool-service.ts`.
- Se soportan transportes **HTTP**, **SSE** y **stdio**.
- `mcp.config.json` admite variables de entorno con la sintaxis `${VAR}` (por ejemplo, en headers o en el comando stdio).
- Las herramientas listadas en `autoApproveTools` se ejecutan sin confirmación.
- **Todas las demás herramientas requieren aprobación del usuario** antes de ejecutarse.
- Las herramientas de memoria de solo lectura están exentas de HITL.
- El flujo de aprobaciones se gestiona en `routes/v1/approval.route.ts` y sus repositorios asociados.

### Servidores MCP por defecto

El archivo `mcp.config.json` incluye de serie:

- **`deepwiki`** (HTTP): documentación de repositorios.
- **`exa`** (HTTP): búsqueda web y fetch de páginas. Requiere `EXA_API_KEY`. Las herramientas `web_search_exa` y `web_fetch_exa` están auto-aprobadas.
- **`fetch`** (stdio): **deshabilitado temporalmente** por la vulnerabilidad SSRF en la dependencia `private-ip` de `mcp-fetch-server`. Cuando haya parche, se puede volver a activar en `mcp.config.json`.

Para activar Exa, añade tu API key a `navi-core/.env`:

```bash
EXA_API_KEY=your_exa_api_key
```

El header `Authorization: Bearer ${EXA_API_KEY}` se inyecta automáticamente desde la configuración MCP.

## Persistencia

- Esquema en `src/db/schema.ts`.
- Las migraciones de Drizzle se aplican automáticamente al arrancar el servidor.
- Genera nuevas migraciones con `pnpm --filter navi-core exec drizzle-kit generate`.
- El directorio `./data/` (base de datos + memoria) se crea en tiempo de ejecución.

> **Importante:** en producción, monta `./data` sobre un volumen físico persistente para evitar perder el estado del agente durante actualizaciones del clúster.

## Tests

- **Framework**: Vitest con entorno Node.
- **Base de datos**: SQLite temporal creada con `mkdtempSync` y migrada con Drizzle.
- **Infraestructura**: `src/test/setup.ts` exporta `createTestDb()`; factories en `test/factories.ts`; mocks en `test/mocks/`.
- **Cobertura objetivo**: ≥ 70 % de líneas en `src/` (excluyendo `index.ts` y tipos puros).

Ejecuta los tests con:

```bash
pnpm --filter navi-core test
```

## Seguridad

- El frontend nunca almacena credenciales del LLM. Todas las claves residen exclusivamente en las variables de entorno de este backend.
- Cada petición a `/api/v1/*` debe incluir el `MASTER_TOKEN` válido.
- En producción, se recomienda exponer `navi-core` solo dentro de la red del clúster o detrás de un proxy con TLS.

## Notas importantes

- El proyecto usa ESM (`"type": "module"`). Los imports relativos deben incluir extensión `.js` (p. ej. `./providers/factory-provider.js`), aunque los ficheros fuente sean `.ts`.
- `tsconfig.json` activa `verbatimModuleSyntax` y `module: NodeNext`; respétalo al añadir nuevos imports.
- Este servicio se despliega como contenedor Docker. Consulta el `docker-compose.yml` en la raíz del monorepo y el [README principal](../README.md) para las instrucciones de despliegue.
