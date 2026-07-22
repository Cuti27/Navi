<script setup lang="ts">
import MessageBubble from './MessageBubble.vue'
import type { UIMessage } from '~/lib/types'

const props = defineProps<{
  messages: UIMessage[]
  isStreaming?: boolean
}>()

const streamingMessageId = computed(() => {
  if (!props.isStreaming) return null
  for (let i = props.messages.length - 1; i >= 0; i--) {
    const msg = props.messages[i]
    if (msg.role === 'assistant') return msg.id
  }
  return null
})

const listEl = ref<HTMLElement | null>(null)
const isNearBottom = ref(true)

function onScroll() {
  const el = listEl.value
  if (!el) return
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight
  isNearBottom.value = gap < 80
}

function maybeScrollToBottom() {
  if (!isNearBottom.value) return
  nextTick(() => {
    const el = listEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function forceScrollToBottom() {
  nextTick(() => {
    const el = listEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(() => props.messages.length, maybeScrollToBottom, { flush: 'post' })
watch(() => props.messages[props.messages.length - 1]?.content, maybeScrollToBottom, { flush: 'post' })

onMounted(() => {
  forceScrollToBottom()
})
</script>

<template>
  <div ref="listEl" class="h-full overflow-y-auto touch-pan-y" style="-webkit-overflow-scrolling: touch" @scroll.passive="onScroll">
    <div class="flex flex-col gap-4 p-4">
      <MessageBubble
        v-for="(msg, idx) in messages"
        :key="msg.id + idx"
        :message="msg"
        :streaming="msg.id === streamingMessageId"
      />
    </div>
  </div>
</template>
