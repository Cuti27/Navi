export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  await auth.hydrate()

  const route = useRoute()
  const router = useRouter()

  if (route.path === '/login') {
    if (auth.isAuthenticated) {
      await router.replace('/')
    }
    return
  }

  if (!auth.isAuthenticated) {
    await router.replace('/login')
  }
})
