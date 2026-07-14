export default defineNuxtRouteMiddleware(async (to) => {
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
