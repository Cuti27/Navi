# frontend

Interfaz de usuario de **Navi**, el agente de IA privado para Homelab.

Este paquete contiene la aplicación web construida con [Nuxt 3](https://nuxt.com/), diseñada para conectarse de forma segura a [`navi-core`](../navi-core/README.md). Está preparada para poder empaquetarse posteriormente como aplicación de escritorio o móvil mediante [Tauri v2](https://v2.tauri.app/).

## Stack tecnológico

- [Nuxt 3](https://nuxt.com/) — framework full-stack de Vue.
- [Vue 3](https://vuejs.org/) + Composition API + TypeScript.
- [Tailwind CSS v4](https://tailwindcss.com/) — estilos utilitarios (configuración en `assets/css/tailwind.css`).
- [shadcn-nuxt](https://www.shadcn-vue.com/) — componentes UI base, estilo `new-york`, color `stone`.
- [Pinia](https://pinia.vuejs.org/) — gestión de estado.
- [@nuxtjs/google-fonts](https://google-fonts.nuxtjs.org/) — Inter y JetBrains Mono.
- [Vitest](https://vitest.dev/) con entorno Nuxt para tests unitarios/de componentes.
- [Playwright](https://playwright.dev/) para tests E2E.

## Scripts

```bash
# Instalar dependencias (desde la raíz del monorepo)
pnpm install

# Servidor de desarrollo en http://localhost:3001
pnpm dev:web

# Typecheck con vue-tsc
pnpm --filter frontend typecheck

# Compilar para producción
pnpm --filter frontend build

# Generar sitio estático
pnpm --filter frontend generate

# Previsualizar build generada
pnpm --filter frontend preview

# Tests unitarios/de componentes
pnpm --filter frontend test
pnpm --filter frontend test:watch
pnpm --filter frontend test:coverage

# Tests E2E (Playwright)
pnpm --filter frontend test:e2e
```

## Estructura de carpetas

```
frontend/
├── assets/css/          # Tailwind + estilos globales
├── components/          # Componentes Vue
│   ├── chat/            # Componentes de la vista de chat
│   ├── navi/            # Avatar / NaviFace
│   ├── session/         # Lista y tarjetas de sesiones
│   └── ui/              # Componentes de shadcn-nuxt
├── composables/         # Composables reutilizables (useNaviApi, useSseChat, ...)
├── layouts/             # Layouts de Nuxt (default, auth)
├── lib/                 # Utilidades (cn, secureStorage, ...)
├── middleware/          # Middleware de Nuxt (auth.global.ts)
├── pages/               # Rutas de la aplicación
│   ├── index.vue        # Listado de sesiones
│   ├── login.vue        # Pantalla de autenticación
│   ├── playground.vue   # Zona de pruebas
│   └── chat/[id].vue    # Vista de conversación
├── plugins/             # Plugins de Nuxt
├── public/              # Archivos estáticos
├── stores/              # Stores Pinia (auth, agent)
├── test/                # Infraestructura de tests, factories, mocks y E2E
└── nuxt.config.ts       # Configuración de Nuxt
```

## Variables de entorno

El frontend lee la URL base de la API desde la variable pública de Nuxt:

| Variable | Descripción | Por defecto |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | Base URL de `navi-core` | `http://localhost:3000/api/v1` |

No es necesario configurar claves de modelo de lenguaje en el frontend; todas las credenciales residen en el backend.

## Autenticación

- El middleware global `middleware/auth.global.ts` redirige a `/login` a los usuarios no autenticados.
- El store `stores/auth.ts` gestiona el token maestro y lo persiste mediante `secureStorage` (`lib/secureStorage.ts`), compatible con Tauri.
- La pantalla de login solicita el `MASTER_TOKEN` configurado en `navi-core`.

## Tests

- **Vitest + @nuxt/test-utils**: montan componentes con `mountSuspended` y usan Pinia activa para stores.
- **MSW**: mocks de HTTP reutilizables en `test/mock-server/handlers.ts`.
- **Playwright**: tests E2E en `test/e2e/`; la configuración levanta automáticamente el servidor de desarrollo.

Ejecuta todos los tests del frontend con:

```bash
pnpm --filter frontend test
pnpm --filter frontend test:e2e
```

## Sistema de diseño

Consulta [`DESIGN.md`](./DESIGN.md) para conocer el sistema de diseño "Analogue Blueprint": principios visuales, paleta de color, tipografía, espaciado y componentes base.

## Notas importantes

- El `tsconfig.json` del frontend extiende `.nuxt/tsconfig.json`; no lo edites a mano. Ejecuta `nuxt prepare` (se lanza automáticamente en `postinstall`) para regenerarlo.
- Tailwind v4 se configura mediante directivas `@theme` en `assets/css/tailwind.css`; `tailwind.config.ts` es un stub mínimo para la CLI de shadcn.
- Para desarrollo conjunto con el backend, usa `pnpm dev` desde la raíz del monorepo.
