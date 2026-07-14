<script setup lang="ts">
import { Send } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const text = defineModel<string>({ default: '' })

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: []
}>()

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (text.value.trim() && !props.disabled) {
      emit('send')
    }
  }
}
</script>

<template>
  <div class="flex items-end gap-2 w-full">
    <Textarea
      v-model="text"
      placeholder="Escribe un mensaje..."
      class="min-h-[44px] max-h-[160px] resize-none flex-1 bg-background"
      :disabled="props.disabled"
      @keydown="handleKeydown"
    />
    <Button size="icon" :disabled="!text.trim() || props.disabled" @click="emit('send')">
      <Send class="h-4 w-4" />
    </Button>
  </div>
</template>
