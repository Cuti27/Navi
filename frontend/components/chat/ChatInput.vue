<script setup lang="ts">
import { Loader2, Mic, Send, Square } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { blobToWav16k } from '~/lib/audio'

const text = defineModel<string>({ default: '' })

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: []
  transcribed: [text: string]
  transcribing: [transcribing: boolean]
  'transcribed-error': [message: string]
}>()

const api = useNaviApi()
const { isRecording, error, durationMs, start, stop } = useVoiceInput()
const isTranscribing = ref(false)
const inlineError = ref<string | null>(null)

const formattedDuration = computed(() => {
  const totalSeconds = Math.floor(durationMs.value / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

watch(error, (message) => {
  if (message) {
    inlineError.value = message
    emit('transcribed-error', message)
  }
})

async function toggleRecording() {
  if (isRecording.value) {
    await finishRecording()
  } else {
    inlineError.value = null
    await start()
  }
}

async function finishRecording() {
  const blob = await stop()
  if (blob.size === 0) return

  isTranscribing.value = true
  emit('transcribing', true)
  inlineError.value = null

  try {
    const wav = await blobToWav16k(blob)
    const { text: transcribedText } = await api.transcribeAudio(wav)
    const trimmed = transcribedText.trim()
    if (trimmed) {
      emit('transcribed', trimmed)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo transcribir el audio'
    inlineError.value = message
    emit('transcribed-error', message)
  } finally {
    isTranscribing.value = false
    emit('transcribing', false)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (text.value.trim() && !props.disabled && !isRecording.value && !isTranscribing.value) {
      emit('send')
    }
  }
}
</script>

<template>
  <div class="flex flex-col w-full gap-2">
    <div class="flex items-end gap-2 w-full">
      <Button
        data-testid="mic-button"
        size="icon"
        variant="ghost"
        class="shrink-0"
        :class="isRecording ? 'animate-pulse text-destructive' : ''"
        :disabled="props.disabled || isTranscribing"
        :aria-label="isRecording ? 'Detener grabación' : 'Grabar audio'"
        @click="toggleRecording"
      >
        <Mic v-if="!isRecording" class="h-4 w-4" />
        <Square v-else class="h-4 w-4" />
      </Button>

      <Textarea
        v-model="text"
        placeholder="Escribe un mensaje..."
        class="min-h-[44px] max-h-[160px] resize-none flex-1 bg-background"
        :disabled="props.disabled"
        @keydown="handleKeydown"
      />

      <Button
        data-testid="send-button"
        size="icon"
        :disabled="!text.trim() || props.disabled || isRecording || isTranscribing"
        @click="emit('send')"
      >
        <Send class="h-4 w-4" />
      </Button>
    </div>

    <div
      v-if="isRecording || isTranscribing || inlineError"
      class="flex items-center gap-2 px-1 text-xs font-mono min-h-[16px]"
    >
      <template v-if="isTranscribing">
        <Loader2 class="h-3 w-3 animate-spin" />
        <span>Transcribiendo...</span>
      </template>
      <template v-else-if="isRecording">
        <span class="h-2 w-2 rounded-full bg-destructive animate-pulse" />
        <span data-testid="recording-timer">{{ formattedDuration }}</span>
      </template>
      <span v-if="inlineError" class="text-destructive" data-testid="voice-error">
        {{ inlineError }}
      </span>
    </div>
  </div>
</template>
