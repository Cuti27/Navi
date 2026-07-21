export default defineNuxtRouteMiddleware(async (to) => {
  // Auth state lives in secureStorage (IndexedDB/localStorage), which is only
  // available on the client. Redirects must happen client-side after hydration;
  // doing it during SSR would always send unauthenticated users to /login even
  // when their token is already stored in the browser.
  if (import.meta.server) return

  const auth = useAuthStore()
  await auth.hydrate()

  if (to.path === '/login') {
    if (auth.isAuthenticated) {
      return navigateTo('/')
    }
    return
  }

  if (!auth.isAuthenticated) {
    return navigateTo('/login')
  }
})
