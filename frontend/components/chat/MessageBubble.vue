<script setup lang="ts">
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ToolSummary from './ToolSummary.vue'
import type { UIMessage, ToolSummaryCall } from '~/lib/types'

const props = defineProps<{
  message: UIMessage
  streaming?: boolean
}>()

const isUser = computed(() => props.message.role === 'user')
const isSummary = computed(() => props.message.role === 'tool-summary')

const summaryCalls = computed(() => {
  const calls = (props.message.meta as { calls?: ToolSummaryCall[] } | undefined)?.calls
  return calls ?? []
})

const time = computed(() => {
  if (!props.message.createdAt) return ''
  return format(new Date(props.message.createdAt), 'HH:mm', { locale: es })
})
</script>

<template>
  <div :class="['flex w-full min-w-0', isUser ? 'justify-end' : 'justify-start']">
    <div :class="['max-w-[85%] md:max-w-[75%] lg:max-w-3xl min-w-0 flex flex-col', isUser ? 'items-end' : 'items-start']">
      <div
        v-if="!isSummary"
        :class="[
          'rounded-lg px-4 py-2 border break-words min-w-0 overflow-hidden',
          isUser ? 'bg-muted border-transparent text-foreground' : 'bg-card border-border text-foreground',
        ]"
      >
        <template v-if="isUser">
          <p class="whitespace-pre-wrap body-md">{{ message.content }}</p>
        </template>
        <MarkdownRenderer v-else :content="message.content" />
      </div>
      <ToolSummary
        v-else
        :calls="summaryCalls"
        class="px-1"
      />
      <span v-if="time && !isSummary" class="text-[10px] text-muted-foreground font-mono mt-1 px-1">{{ time }}</span>
    </div>
  </div>
</template>
