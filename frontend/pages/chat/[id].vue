<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import NaviFace from '@/components/navi/NaviFace.vue'
import MessageList from '@/components/chat/MessageList.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import ApprovalCard from '@/components/chat/ApprovalCard.vue'

const route = useRoute()
const router = useRouter()
const api = useNaviApi()
const agent = useAgentStore()
const {
  messages,
  isStreaming,
  error,
  pendingApprovals,
  sendMessage,
  submitApproval,
  loadHistory,
  loadPendingApprovals,
  resetMessages,
  cancel,
} = useSseChat()

const sessionId = computed(() => route.params.id as string)
const sessionTitle = ref('Cargando...')
const inputText = ref('')

async function loadSession() {
  try {
    const { session, messages: msgs } = await api.getSession(sessionId.value)
    sessionTitle.value = session.title
    loadHistory(msgs)
    await loadPendingApprovals(sessionId.value)
  } catch (err) {
    console.error(err)
    error.value = 'No se pudo cargar la conversación'
    agent.setState('error')
  }
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  await sendMessage(sessionId.value, text)
}

async function handleApprove(approvalId: string) {
  await submitApproval(sessionId.value, approvalId, true)
}

async function handleDeny(approvalId: string) {
  await submitApproval(sessionId.value, approvalId, false, 'Usuario canceló la acción')
}

onMounted(() => {
  loadSession()
})

onBeforeUnmount(() => {
  cancel()
})

watch(sessionId, () => {
  resetMessages()
  loadSession()
})
</script>

<template>
  <div class="flex flex-col md:flex-row h-screen bg-background max-w-full overflow-hidden">
    <!-- Left: large Navi on desktop -->
    <div
      data-testid="chat-navi-column"
      class="hidden md:flex md:w-1/2 md:max-w-[520px] md:flex-none md:h-full md:items-center md:justify-center md:bg-card/30 md:border-r md:border-border md:overflow-hidden"
    >
      <NaviFace
        :state="agent.state"
        :with-background="false"
        class="w-4/5 max-w-sm"
      />
    </div>

    <!-- Right: chat -->
    <div
      data-testid="chat-content-column"
      class="flex flex-col flex-1 min-w-0 md:h-full"
    >
      <!-- Navbar -->
      <div class="shrink-0 h-14 border-b border-border flex items-center px-4 md:px-6 gap-3 bg-card min-w-0">
        <Button variant="ghost" size="icon" class="shrink-0" @click="router.push('/')">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <h1 class="text-sm font-semibold truncate flex-1 min-w-0">{{ sessionTitle }}</h1>
      </div>

      <!-- Small Navi strip: mobile only -->
      <div
        data-testid="chat-mobile-navi"
        class="shrink-0 h-20 border-b border-border bg-card/40 flex items-center justify-center overflow-hidden min-w-0 md:hidden"
      >
        <NaviFace
          :state="agent.state"
          class="h-full w-auto max-w-full"
          :with-background="false"
        />
      </div>

      <!-- Messages -->
      <div class="flex-1 min-h-0 overflow-hidden min-w-0">
        <MessageList
          :messages="messages"
          :is-streaming="isStreaming"
        />
      </div>

      <!-- Error bar -->
      <div
        v-if="error"
        class="shrink-0 px-4 py-2 bg-destructive/10 text-destructive text-sm font-mono border-t border-destructive/20"
      >
        {{ error }}
      </div>

      <!-- Composer: pending approvals + input -->
      <div class="shrink-0 border-t border-border bg-card p-3 flex flex-col gap-2">
        <ApprovalCard
          v-for="approval in pendingApprovals"
          :key="approval.approvalId"
          :payload="approval"
          @approve="handleApprove(approval.approvalId)"
          @deny="handleDeny(approval.approvalId)"
        />
        <ChatInput
          v-model="inputText"
          :disabled="isStreaming"
          @send="handleSend"
        />
      </div>
    </div>
  </div>
</template>
