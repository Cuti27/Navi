<script setup lang="ts">
import type { MessageImage } from '~/lib/types'

const props = defineProps<{
  image: MessageImage
}>()

const api = useNaviApi()
const objectUrl = ref<string | null>(null)
const failed = ref(false)

onMounted(async () => {
  try {
    const blob = await api.getFile(props.image.id)
    objectUrl.value = URL.createObjectURL(blob)
  } catch (err) {
    console.error('Failed to load image', err)
    failed.value = true
  }
})

onBeforeUnmount(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
})
</script>

<template>
  <div class="mt-2 overflow-hidden rounded-lg border border-border bg-muted">
    <img
      v-if="objectUrl"
      :src="objectUrl"
      :alt="image.id"
      class="block h-auto max-w-full"
    />
    <div
      v-else
      class="flex items-center justify-center px-4 py-8 text-sm font-mono text-muted-foreground"
    >
      {{ failed ? 'No se pudo cargar la imagen' : 'Cargando imagen…' }}
    </div>
  </div>
</template>
