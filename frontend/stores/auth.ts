import { useSecureStorage } from '~/lib/secureStorage'

export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  const hydrated = ref(false)

  const storage = useSecureStorage()

  async function hydrate() {
    if (hydrated.value) return
    const val = await storage.getItem('navi-token')
    if (val) token.value = val
    hydrated.value = true
  }

  function setToken(value: string) {
    token.value = value
    storage.setItem('navi-token', value)
    hydrated.value = true
  }

  function clearToken() {
    token.value = ''
    storage.removeItem('navi-token')
  }

  const isAuthenticated = computed(() => Boolean(token.value))

  return { token, hydrated, hydrate, setToken, clearToken, isAuthenticated }
})
