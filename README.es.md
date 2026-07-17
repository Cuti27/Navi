# Navi

> Esta es la versión en español. La documentación principal está en inglés en [`README.md`](./README.md).

Agente de IA privado para Homelab.

Navi es un asistente de inteligencia artificial autocontenido diseñado para ejecutarse dentro de tu clúster doméstico. Está compuesto por un backend de orquestación (`navi-core`) y una interfaz web (`frontend`) que se comunican de forma segura mediante un token maestro.

## Estructura del monorepo

Este repositorio es un workspace de pnpm con dos paquetes principales:

| Paquete | Descripción | Tecnologías |
|---|---|---|
| [`navi-core/`](./navi-core/README.es.md) | Backend de orquestación, IA, memoria y herramientas MCP. | Hono, Node.js, Vercel AI SDK, Drizzle ORM, SQLite |
| [`frontend/`](./frontend/README.es.md) | Interfaz de usuario web y PWA instalable en iOS, Android y escritorio; preparada también para Tauri v2. | Nuxt 3, Tailwind v4, shadcn-nuxt, Pinia, @vite-pwa/nuxt |

## Requisitos previos

- [Node.js](https://nodejs.org/) (versión LTS recomendada)
- [pnpm](https://pnpm.io/) (`shamefully-hoist=true` ya está configurado en `.npmrc`)

## Instalación rápida

```bash
# Instalar todas las dependencias del workspace
pnpm install

# Configurar el backend
cp navi-core/.env.example navi-core/.env
# Edita navi-core/.env con tus credenciales (AI_MODEL, MASTER_TOKEN, etc.)
```

## Comandos principales

Todos los comandos se ejecutan desde la raíz del monorepo:

```bash
# Levantar backend (:3000) y frontend (:3001) en paralelo
pnpm dev

# Solo backend
pnpm dev:core

# Solo frontend
pnpm dev:web

# Compilar ambos paquetes
pnpm build

# Ejecutar todos los tests
pnpm test

# Ejecutar tests con cobertura
pnpm test:coverage

# Tests E2E (Playwright, levanta el servidor de desarrollo automáticamente)
pnpm test:e2e
```

Consulta [`AGENTS.es.md`](./AGENTS.es.md) para la lista completa de comandos y convenciones del proyecto.

## PWA

El frontend se distribuye como Progressive Web App. Se instala directamente desde el navegador sin necesidad de App Store ni Developer Program. Consulta [`frontend/README.es.md`](./frontend/README.es.md#pwa-progressive-web-app) para las instrucciones de instalación en cada plataforma.

## Despliegue con Docker

El proyecto incluye Dockerfiles multi-stage y un `docker-compose.yml` listo para Portainer GitOps.

### Despliegue local

```bash
# Construir imágenes
docker compose build

# Levantar servicios
docker compose up -d
```

### Despliegue con Portainer GitOps

1. Crea un stack en Portainer → **Git repository**.
2. Apunta a este repo, rama `main`, path `docker-compose.yml`.
3. Activa **GitOps updates** (polling 5min o webhook).
4. Define las variables de entorno obligatorias en el stack:

| Variable | Obligatoria | Ejemplo |
|---|---|---|
| `AI_PROVIDER` | Sí | `opencode` |
| `AI_MODEL` | Sí | `deepseek-v4-flash` |
| `AI_PROVIDER_API_KEY` | Sí | `skey...` |
| `MASTER_TOKEN` | Sí | `supersecret` |

5. Despliega. Portainer hará `docker build` automáticamente.

### GitHub Actions + GHCR

El workflow `.github/workflows/docker-publish.yml` construye las imágenes y las publica en GitHub Container Registry al hacer push a `main`. Para usarlo:

1. El `docker-compose.yml` ya está configurado con el usuario `Cuti27`. Si usas otro usuario, cámbialo en las imágenes `ghcr.io/Cuti27/...`.
2. En Portainer, cambia las imágenes de `build:` a `image:` para usar GHCR directamente.

## Desarrollo

1. Copia y configura `navi-core/.env` (ver [`navi-core/README.es.md`](./navi-core/README.es.md#entorno)).
2. Ejecuta `pnpm dev` para levantar ambos servicios.
3. Accede a la aplicación en `http://localhost:3001`.
4. La API documentada con Swagger está disponible en `http://localhost:3000/api/v1/docs`.

## Tests

Ambos paquetes usan **Vitest**:

```bash
pnpm test                      # Todos los tests
pnpm --filter navi-core test   # Solo backend
pnpm --filter frontend test    # Solo frontend
```

El frontend también incluye tests E2E con Playwright:

```bash
pnpm --filter frontend test:e2e
```

## Búsqueda web

`navi-core` incluye por defecto el MCP server de **Exa** para búsqueda web (requiere `EXA_API_KEY` en `navi-core/.env`). Consulta [`navi-core/README.es.md`](./navi-core/README.es.md#mcp-y-human-in-the-loop-hitl) para más detalles.

## Seguridad

- Todas las rutas de la API (`/api/v1/*`) están protegidas por un **Token Maestro** (`MASTER_TOKEN`).
- El frontend nunca almacena credenciales del modelo de lenguaje; estas viven únicamente en las variables de entorno de `navi-core`.

## Documentación adicional

- [`AGENTS.es.md`](./AGENTS.es.md) — Guía para agentes de código: arquitectura, comandos, convenciones y gotchas.
- [`INIT.md`](./INIT.md) — Initial project requirements and architecture (English).
- [`INIT.es.md`](./INIT.es.md) — Requisitos y arquitectura iniciales del proyecto (español).
- [`frontend/DESIGN.md`](./frontend/DESIGN.md) — Sistema de diseño "Analogue Blueprint" (inglés).
- [`frontend/DESIGN.es.md`](./frontend/DESIGN.es.md) — Sistema de diseño "Analogue Blueprint" (español).
- [`navi-core/README.es.md`](./navi-core/README.es.md) — Documentación específica del backend.
- [`frontend/README.es.md`](./frontend/README.es.md) — Documentación específica del frontend.

## Convenciones

- Los mensajes de commit usan prefijos convencionales en español: `feat:`, `fix:`, etc.
- La API está versionada en ruta: `/api/v1`.
- Las etiquetas de versionado siguen el formato `navi-core/vX.Y.Z`.

> **Nota:** si modificas cualquier archivo `README.md` del proyecto, actualiza también el resto de documentación afectada para mantener la coherencia entre la raíz, `frontend/` y `navi-core/`.
