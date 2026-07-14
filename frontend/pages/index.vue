<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import NaviFace from '@/components/navi/NaviFace.vue'
import SessionList from '@/components/session/SessionList.vue'
import type { Session } from '~/lib/types'

const api = useNaviApi()
const router = useRouter()
const agent = useAgentStore()

const sessions = ref<Session[]>([])
const isLoading = ref(false)

async function loadSessions() {
  isLoading.value = true
  try {
    sessions.value = await api.getSessions()
  } finally {
    isLoading.value = false
  }
}

async function createNewSession() {
  const session = await api.createSession('Nueva conversación')
  await router.push(`/chat/${session.id}`)
}

async function deleteSession(id: string) {
  await api.deleteSession(id)
  await loadSessions()
}

function goToSession(id: string) {
  router.push(`/chat/${id}`)
}

onMounted(() => {
  loadSessions()
})
</script>

<template>
  <div class="flex flex-col md:flex-row h-screen overflow-hidden bg-background">
    <!-- Navi column -->
    <div
      data-testid="home-navi-column"
      class="relative flex-[0.5] min-h-0 bg-background flex items-center justify-center overflow-hidden md:w-1/2 md:max-w-[520px] md:flex-none md:h-full md:bg-card/30 md:border-r md:border-border"
    >
      <NaviFace
        :state="agent.state"
        :with-background="false"
        class="w-3/5 max-w-xs max-h-full md:w-4/5 md:max-w-sm"
      />
    </div>

    <!-- Sessions column -->
    <div
      data-testid="home-sessions-column"
      class="relative z-10 flex-1 min-h-0 bg-background rounded-t-2xl -mt-6 flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:h-full md:rounded-none md:mt-0 md:shadow-none"
    >
      <div class="p-4 md:px-6 border-b border-border flex items-center justify-between shrink-0 bg-background rounded-t-2xl">
        <h1 class="headline-md">Conversaciones</h1>
        <Button size="sm" :disabled="isLoading" @click="createNewSession">
          <Plus class="mr-1 h-4 w-4" />
          Nueva
        </Button>
      </div>
      <ScrollArea class="flex-1 p-4">
        <SessionList
          :sessions="sessions"
          @select="goToSession"
          @delete="deleteSession"
        />
      </ScrollArea>
    </div>
  </div>
</template>
