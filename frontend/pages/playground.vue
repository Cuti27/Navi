<script setup lang="ts">
import NaviFace from '@/components/navi/NaviFace.vue'
import type { NaviFaceState } from '@/components/navi/NaviFace.vue'

const states: NaviFaceState[] = [
  'idle',
  'thinking',
  'tool-calling',
  'awaiting-approval',
  'error',
  'compacting',
]

const currentState = ref<NaviFaceState>('idle')
const withBackground = ref(true)
const waveKey = ref(0)

function setState(s: NaviFaceState) {
  currentState.value = s
}

function triggerWave() {
  waveKey.value++
}
</script>

<template>
  <div class="flex flex-col items-center gap-8 p-8 pt-safe pb-safe min-h-dvh bg-background text-foreground">
    <h1 class="text-xl font-semibold tracking-tight">NaviFace Playground</h1>

    <div class="w-80">
      <NaviFace
        :key="`face-${waveKey}`"
        :state="currentState"
        :with-background="withBackground"
      />
    </div>

    <div class="flex flex-wrap justify-center gap-2 max-w-md">
      <button
        v-for="s in states"
        :key="s"
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        :class="
          currentState === s
            ? 'bg-foreground text-background'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        "
        @click="setState(s)"
      >
        {{ s }}
      </button>
    </div>

    <div class="flex gap-4">
      <label class="flex items-center gap-2 text-sm text-neutral-400">
        <input v-model="withBackground" type="checkbox" class="rounded" />
        Background
      </label>
    </div>

    <p class="text-xs text-muted-foreground">
      Wave triggers randomly every 10–30s &middot; Blink every 3–7s
    </p>
  </div>
</template>
