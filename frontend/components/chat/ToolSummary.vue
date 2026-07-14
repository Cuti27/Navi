<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { ToolSummaryCall } from '~/lib/types'

const props = defineProps<{
  calls: ToolSummaryCall[]
}>()

const open = ref(false)

const label = computed(() => {
  const count = props.calls.length
  return `${count} tool${count > 1 ? 's' : ''} llamada${count > 1 ? 's' : ''}`
})
</script>

<template>
  <Collapsible v-model:open="open" class="w-full">
    <CollapsibleTrigger
      class="flex items-center gap-1 text-xs text-muted-foreground font-mono hover:text-foreground transition-colors cursor-pointer"
    >
      <ChevronDown class="h-3 w-3 transition-transform" :class="{ 'rotate-180': open }" />
      {{ label }}
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="mt-2 flex flex-col gap-2">
        <div
          v-for="(call, idx) in calls"
          :key="idx"
          class="rounded bg-muted px-2 py-1.5 text-xs font-mono"
        >
          <p class="font-semibold text-foreground">{{ call.toolName }}</p>
          <pre class="mt-1 text-[10px] text-muted-foreground overflow-x-auto">{{ JSON.stringify(call.input, null, 2) }}</pre>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
