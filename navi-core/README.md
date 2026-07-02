# navi-core

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
- Actúa como **cliente MCP principal**, conectándose a servidores MCP internos del Swarm (`http://mcp-name:port`).
- Implementa el flujo **Human-in-the-Loop (HITL)**: pausa la ejecución de cualquier herramienta que modifique el estado del clúster hasta recibir una aprobación explícita del usuario.

## Tecnologías

- [Hono](https://hono.dev/) — framework web ligero y basado en Web Standards.
- [Vercel AI SDK](https://sdk.vercel.ai/) — integración y streaming con modelos de lenguaje.
- [Drizzle ORM](https://orm.drizzle.team/) — ORM tipo-seguro para SQLite.
- [SQLite](https://www.sqlite.org/) — base de datos local embebida.
- [tsx](https://github.com/privatenumber/tsx) — ejecución de TypeScript en desarrollo.

## Scripts

```bash
# Instalar dependencias
pnpm install

# Desarrollo con hot reload
pnpm dev

# Compilar TypeScript
pnpm build

# Ejecutar la versión compilada
pnpm start
```

Por defecto, el servidor de desarrollo se levanta en `http://localhost:3000`.

## Arquitectura dentro del monorepo

```
┌─────────────────┐
│   Frontend(s)   │  ← Vue/Nuxt + Tauri (móvil/escritorio)
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

## Notas importantes

- **Persistencia de la base de datos**: la base de datos SQLite debe montarse siempre sobre un volumen físico persistente (por ejemplo, `/DATA/AppData/navi/db`) para evitar la pérdida de memoria del agente durante actualizaciones del clúster.
- **Seguridad**: el frontend nunca almacena credenciales del LLM. Todas las claves residen exclusivamente en las variables de entorno de este backend.
- **Despliegue**: este servicio debe proporcionar un `Dockerfile` y un `docker-compose.yml` para su despliegue como contenedor dentro del Swarm.
