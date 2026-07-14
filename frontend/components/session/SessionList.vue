<script setup lang="ts">
import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Session } from '~/lib/types'
import SessionItem from './SessionItem.vue'

const props = defineProps<{
  sessions: Session[]
  activeId?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
}>()

interface Group {
  label: string
  sessions: Session[]
}

const grouped = computed<Group[]>(() => {
  const map = new Map<string, Session[]>()
  for (const session of [...props.sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )) {
    const date = new Date(session.updatedAt)
    let label: string
    if (isToday(date)) label = 'Hoy'
    else if (isYesterday(date)) label = 'Ayer'
    else label = format(date, 'MMMM yyyy', { locale: es })

    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(session)
  }
  return Array.from(map.entries()).map(([label, sessions]) => ({ label, sessions }))
})
</script>

<template>
  <div class="space-y-6">
    <div v-for="group in grouped" :key="group.label">
      <h3 class="label-caps text-muted-foreground mb-2">{{ group.label }}</h3>
      <div class="space-y-2">
        <SessionItem
          v-for="session in group.sessions"
          :key="session.id"
          :session="session"
          :active="session.id === activeId"
          @select="emit('select', $event)"
          @delete="emit('delete', $event)"
        />
      </div>
    </div>
    <p v-if="sessions.length === 0" class="body-sm text-muted-foreground text-center py-8">
      No hay conversaciones. Crea una nueva para empezar.
    </p>
  </div>
</template>
