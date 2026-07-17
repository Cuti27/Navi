# frontend

User interface of **Navi**, the private AI Agent for Homelab.

This package contains the web application built with [Nuxt 3](https://nuxt.com/), designed to connect securely to [`navi-core`](../navi-core/README.md). It is distributed as a **PWA** (Progressive Web App) installable on iOS, Android, and desktop, and the code is also ready to be packaged later as a native app using [Tauri v2](https://v2.tauri.app/) if needed.

> 🇪🇸 [Versión en español](./README.es.md)

## Tech stack

- [Nuxt 3](https://nuxt.com/) — full-stack Vue framework.
- [Vue 3](https://vuejs.org/) + Composition API + TypeScript.
- [Tailwind CSS v4](https://tailwindcss.com/) — utility-first styles (configuration in `assets/css/tailwind.css`).
- [shadcn-nuxt](https://www.shadcn-vue.com/) — base UI components, `new-york` style, `stone` color.
- [Pinia](https://pinia.vuejs.org/) — state management.
- [@nuxtjs/google-fonts](https://google-fonts.nuxtjs.org/) — Inter and JetBrains Mono.
- [Vitest](https://vitest.dev/) with Nuxt environment for unit/component tests.
- [Playwright](https://playwright.dev/) for E2E tests.
- [@vite-pwa/nuxt](https://vite-pwa-org.netlify.app/) — installable PWA with manifest and service worker.

## Scripts

```bash
# Install dependencies (from the monorepo root)
pnpm install

# Development server at http://localhost:3001
pnpm dev:web

# Typecheck with vue-tsc
pnpm --filter frontend typecheck

# Build for production
pnpm --filter frontend build

# Generate static site
pnpm --filter frontend generate

# Preview generated build
pnpm --filter frontend preview

# Unit/component tests
pnpm --filter frontend test
pnpm --filter frontend test:watch
pnpm --filter frontend test:coverage

# E2E tests (Playwright)
pnpm --filter frontend test:e2e
```

## Folder structure

```
frontend/
├── assets/css/          # Tailwind + global styles
├── components/          # Vue components
│   ├── chat/            # Chat view components
│   ├── navi/            # Avatar / NaviFace
│   ├── session/         # Session list and cards
│   └── ui/              # shadcn-nuxt components
├── composables/         # Reusable composables (useNaviApi, useSseChat, ...)
├── layouts/             # Nuxt layouts (default, auth)
├── lib/                 # Utilities (cn, secureStorage, ...)
├── middleware/          # Nuxt middleware (auth.global.ts)
├── pages/               # Application routes
│   ├── index.vue        # Session list
│   ├── login.vue        # Authentication screen
│   ├── playground.vue   # Test area
│   └── chat/[id].vue    # Conversation view
├── plugins/             # Nuxt plugins
├── public/              # Static files
├── stores/              # Pinia stores (auth, agent)
├── test/                # Test infrastructure, factories, mocks, and E2E
└── nuxt.config.ts       # Nuxt configuration
```

## Environment variables

The frontend reads the API base URL from the public Nuxt variable:

| Variable | Description | Default |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | Base URL of `navi-core` | `http://localhost:3000/api/v1` |

No language model keys need to be configured in the frontend; all credentials live in the backend.

## Authentication

- The global middleware `middleware/auth.global.ts` redirects unauthenticated users to `/login`.
- The `stores/auth.ts` store manages the master token and persists it via `secureStorage` (`lib/secureStorage.ts`), compatible with Tauri.
- The login screen asks for the `MASTER_TOKEN` configured in `navi-core`.

## Tests

- **Vitest + @nuxt/test-utils**: mounts components with `mountSuspended` and uses active Pinia for stores.
- **MSW**: reusable HTTP mocks in `test/mock-server/handlers.ts`.
- **Playwright**: E2E tests in `test/e2e/`; the config automatically starts the dev server.

Run all frontend tests with:

```bash
pnpm --filter frontend test
pnpm --filter frontend test:e2e
```

## Design system

See [`DESIGN.md`](./DESIGN.md) for the "Analogue Blueprint" design system: visual principles, color palette, typography, spacing, and base components.

## PWA (Progressive Web App)

The frontend is packaged as a PWA via `@vite-pwa/nuxt`:

- Manifest in `nuxt.config.ts` with name, icons, colors, and standalone behavior.
- Automatically generated service worker with static asset caching.
- Install prompt on Android/desktop (`components/PwaInstallPrompt.vue`).
- On iOS installation is manual: Safari → Share → Add to Home Screen.

### Installation by platform

**iOS (Safari)**
1. Open the app in Safari.
2. Tap the Share button.
3. Select "Add to Home Screen".

**Android (Chrome)**
1. Open the app in Chrome.
2. Tap "Add to Home Screen" in the banner or menu.

**Desktop (Chrome/Edge)**
1. Open the app in the browser.
2. Tap the install icon in the address bar.

### Notifications and haptics

- Local notifications work in the PWA when the app is not visible, as long as the browser supports it.
- On iOS, notifications require the PWA to be installed and iOS >= 16.4.
- Haptics (`navigator.vibrate`) work on Android and some desktops, but **not on iOS**.

## Important notes

- The frontend `tsconfig.json` extends `.nuxt/tsconfig.json`; do not edit it by hand. Run `nuxt prepare` (triggered automatically on `postinstall`) to regenerate it.
- Tailwind v4 is configured via `@theme` directives in `assets/css/tailwind.css`; `tailwind.config.ts` is a minimal stub for the shadcn CLI.
- For joint development with the backend, use `pnpm dev` from the monorepo root.
- The master token is stored in IndexedDB in the PWA/web and in the Tauri Store plugin when the app runs inside Tauri.
