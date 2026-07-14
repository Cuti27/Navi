<template>
  <div
    v-if="visible"
    class="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80"
  >
    <Card class="border border-border shadow-lg">
      <CardContent class="space-y-3 p-4">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-semibold text-sm">Instalar Navi</p>
            <p class="text-xs text-muted-foreground mt-1">
              {{ message }}
            </p>
          </div>
          <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0" @click="dismiss">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <Button v-if="canInstall" class="w-full" size="sm" @click="install">
          Instalar app
        </Button>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const visible = ref(false)
const canInstall = ref(false)
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const isIOS = ref(false)

const message = computed(() => {
  if (canInstall.value) {
    return 'Añade Navi a tu pantalla de inicio para un acceso rápido.'
  }
  if (isIOS.value) {
    return 'En Safari, pulsa Compartir y selecciona "Añadir a pantalla de inicio".'
  }
  return 'Tu navegador permite instalar Navi como app.'
})

function detectIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua)
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault()
  deferredPrompt.value = event as BeforeInstallPromptEvent
  canInstall.value = true
  visible.value = true
}

async function install() {
  if (!deferredPrompt.value) return
  await deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  if (outcome === 'accepted') {
    deferredPrompt.value = null
    canInstall.value = false
    visible.value = false
  }
}

function dismiss() {
  visible.value = false
}

onMounted(() => {
  isIOS.value = detectIOS()
  if ('BeforeInstallPromptEvent' in window) {
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  } else if (isIOS.value && !window.matchMedia('(display-mode: standalone)').matches) {
    visible.value = true
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})
</script>
