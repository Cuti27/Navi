<template>
  <div class="w-full max-w-sm">
    <Card>
      <CardHeader class="space-y-1">
        <CardTitle class="headline-md tracking-tight">
          Vincular con Navi
        </CardTitle>
        <CardDescription class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Token Maestro requerido
        </CardDescription>
      </CardHeader>
      <form @submit.prevent="handleSubmit">
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="token" class="font-mono text-xs uppercase tracking-wider">
              Token
            </Label>
            <div class="relative">
              <Input
                id="token"
                v-model="tokenInput"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                :disabled="isLoading"
                class="font-mono pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
                @click="showPassword = !showPassword"
                :disabled="isLoading"
                tabindex="-1"
              >
                <Eye v-if="showPassword" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </CardContent>
        <CardFooter>
          <Button type="submit" class="w-full" :disabled="isLoading || !tokenInput">
            <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
            Entrar
          </Button>
        </CardFooter>
      </form>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Eye, EyeOff, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

definePageMeta({ layout: 'auth' })

const tokenInput = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const error = ref('')

const auth = useAuthStore()
const api = useNaviApi()
const router = useRouter()

async function handleSubmit() {
  error.value = ''
  isLoading.value = true

  try {
    // Guardar token temporalmente para validar
    auth.setToken(tokenInput.value.trim())
    await api.getSessions()
    await router.push('/')
  } catch (err) {
    auth.clearToken()
    error.value = 'Token inválido o backend no disponible'
    console.error(err)
  } finally {
    isLoading.value = false
  }
}
</script>
