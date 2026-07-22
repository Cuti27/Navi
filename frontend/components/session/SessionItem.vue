<script setup lang="ts">
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Trash2 } from 'lucide-vue-next'
import type { Session } from '~/lib/types'

const props = defineProps<{
  session: Session
  active?: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
}>()

const formattedDate = computed(() =>
  format(new Date(props.session.updatedAt), 'd MMM yyyy, HH:mm', { locale: es })
)
</script>

<template>
  <button
    :class="[
      'w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between group',
      active ? 'bg-accent border-ring' : 'bg-card border-border hover:bg-accent',
    ]"
    @click="emit('select', session.id)"
  >
    <div class="min-w-0">
      <p class="font-medium text-sm truncate">{{ session.title }}</p>
      <p class="text-xs text-muted-foreground font-mono mt-1">{{ formattedDate }}</p>
    </div>
    <button
      type="button"
      aria-label="Eliminar conversación"
      class="ml-2 -mr-2 p-2.5 rounded-md hover:bg-accent active:bg-accent/80 transition-colors touch-manipulation shrink-0"
      @click.stop="emit('delete', session.id)"
    >
      <Trash2 class="h-4 w-4 text-muted-foreground" />
    </button>
  </button>
</template>
