<script setup lang="ts">
import { ref, watch, onBeforeUpdate } from 'vue'
import './navi-animations.css'
import { useRandomAnimation } from '~/composables/useRandomAnimation'
import { useMouseTracking } from '~/composables/useMouseTracking'

export type NaviFaceState =
  | 'idle'
  | 'thinking'
  | 'tool-calling'
  | 'awaiting-approval'
  | 'error'
  | 'compacting'

export interface NaviFaceColors {
  bg?: string
  ring?: string
  core?: string
  eyes?: string
  accent?: string
  error?: string
  secondary?: string
  success?: string
  warning?: string
}

interface Props {
  state?: NaviFaceState
  colors?: NaviFaceColors
  withBackground?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  state: 'idle',
  colors: () => ({}),
  withBackground: true,
})

const { active: blinkActive } = useRandomAnimation(3, 7, 0.7)
const isIdle = computed(() => props.state === 'idle')
const { active: waveActive } = useRandomAnimation(10, 30, 2.5, computed(() => !isIdle.value))

const svgRef = ref<SVGElement | null>(null)
const stubWrapperRef = ref<SVGGElement | null>(null)
const orbitalNodesRef = ref<SVGGElement | null>(null)
const ringRef = ref<SVGCircleElement | null>(null)
const { trackingStyle } = useMouseTracking(svgRef)

const isAwaiting = computed(() => props.state === 'awaiting-approval')
const isRaising = ref(false)
const isRaised = ref(false)

function enterAwaiting() {
  isRaising.value = true
  setTimeout(() => {
    isRaising.value = false
    isRaised.value = true
  }, 700)
}

function leaveAwaiting() {
  const wrapper = stubWrapperRef.value
  if (wrapper) {
    const current = getComputedStyle(wrapper).transform
    if (current && current !== 'none') {
      wrapper.style.transform = current
    }
  }

  isRaising.value = false
  isRaised.value = false

  requestAnimationFrame(() => {
    if (wrapper) {
      wrapper.style.transform = ''
    }
  })
}

watch(isAwaiting, (val) => {
  if (val) {
    enterAwaiting()
  } else {
    leaveAwaiting()
  }
})

const previousState = ref<NaviFaceState>(props.state)

function hasOrbitalAnimation(state: NaviFaceState) {
  return state === 'thinking' || state === 'awaiting-approval' || state === 'compacting'
}

function hasRingRotation(state: NaviFaceState) {
  return state === 'thinking' || state === 'tool-calling' || state === 'compacting'
}

function freezeElement(element: SVGElement | null) {
  if (!element) return
  const current = getComputedStyle(element).transform
  if (current && current !== 'none') {
    element.style.transform = current
  }
}

function releaseElement(element: SVGElement | null) {
  if (!element) return
  element.style.transform = ''
}

function freezeOrbitalNodes() {
  freezeElement(orbitalNodesRef.value)
}

function releaseOrbitalNodes() {
  releaseElement(orbitalNodesRef.value)
}

function freezeRing() {
  freezeElement(ringRef.value)
}

function releaseRing() {
  releaseElement(ringRef.value)
}

onBeforeUpdate(() => {
  const nextState = props.state
  if (hasOrbitalAnimation(previousState.value) && !hasOrbitalAnimation(nextState)) {
    freezeOrbitalNodes()
  }
  if (hasRingRotation(previousState.value) && !hasRingRotation(nextState)) {
    freezeRing()
  }
})

watch(() => props.state, (newState) => {
  if (hasOrbitalAnimation(previousState.value) && !hasOrbitalAnimation(newState)) {
    requestAnimationFrame(releaseOrbitalNodes)
  }
  if (hasRingRotation(previousState.value) && !hasRingRotation(newState)) {
    requestAnimationFrame(releaseRing)
  }
  previousState.value = newState
})

const palette = computed(() => ({
  bg: props.colors.bg ?? 'transparent',
  ring: props.colors.ring ?? '#738F88',
  core: props.colors.core ?? '#E7EFEA',
  eyes: props.colors.eyes ?? '#221A17',
  accent: props.colors.accent ?? '#D97757',
  error: props.colors.error ?? '#ba1a1a',
  secondary: props.colors.secondary ?? '#3b82f6',
  success: props.colors.success ?? '#4ade80',
  warning: props.colors.warning ?? '#f59e0b',
}))

const stateClass = computed(() => `is-${props.state}`)

const ringFill = computed(() => {
  if (props.state === 'error') return palette.value.error
  if (props.state === 'awaiting-approval') return palette.value.secondary
  if (props.state === 'thinking' || props.state === 'tool-calling') return palette.value.success
  if (props.state === 'compacting') return palette.value.warning
  return palette.value.ring
})

const nodeFill = computed(() => {
  if (props.state === 'error') return palette.value.error
  if (props.state === 'thinking') return palette.value.secondary
  if (props.state === 'awaiting-approval') return palette.value.secondary
  if (props.state === 'tool-calling') return palette.value.success
  if (props.state === 'compacting') return palette.value.warning
  return ringFill.value
})

const coreFill = computed(() => {
  if (props.state === 'error') return palette.value.error
  if (props.state === 'awaiting-approval') return palette.value.secondary
  if (props.state === 'tool-calling') return palette.value.success
  if (props.state === 'compacting') return palette.value.warning
  return palette.value.core
})
</script>

<template>
  <svg
    ref="svgRef"
    :class="['navi-face w-full h-auto max-w-full', stateClass]"
    viewBox="120 144 272 272"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Navi agent avatar"
  >
    <rect
      v-if="withBackground"
      class="navi-bg"
      width="512"
      height="640"
      :fill="palette.bg"
    />

    <!-- SYSTEM RING -->
    <circle
      ref="ringRef"
      class="navi-ring"
      cx="256"
      cy="280"
      r="110"
      :stroke="ringFill"
      stroke-width="4"
      fill="none"
    />

    <!-- ORBITAL NODES -->
    <g ref="orbitalNodesRef" class="navi-orbital-nodes">
      <circle class="navi-node" cx="256" cy="170" r="7" :fill="nodeFill" />
      <circle class="navi-node" cx="366" cy="280" r="7" :fill="nodeFill" />
      <circle class="navi-node" cx="256" cy="390" r="7" :fill="nodeFill" />
      <circle class="navi-node" cx="146" cy="280" r="7" :fill="nodeFill" />
    </g>

    <!-- CORE -->
    <circle class="navi-core" cx="256" cy="280" r="62" :fill="coreFill" />

    <!-- EYES -->
    <g class="navi-eyes">
      <g class="navi-eye-track" :style="trackingStyle">
        <g class="navi-eye" :class="{ 'animate-blink': blinkActive }">
          <rect x="230" y="268" width="14" height="14" rx="2" :fill="palette.eyes" />
        </g>
      </g>
      <g class="navi-eye-track" :style="trackingStyle">
        <g class="navi-eye" :class="{ 'animate-blink': blinkActive }">
          <rect x="266" y="268" width="14" height="14" rx="2" :fill="palette.eyes" />
        </g>
      </g>
    </g>

    <!-- STUBS -->
    <rect class="navi-stub navi-stub--left" x="206" y="318" width="18" height="12" rx="6" :fill="coreFill" />
    <g
      ref="stubWrapperRef"
      class="navi-stub-wrapper navi-stub-wrapper--right"
      :class="{
        'animate-wave': props.state === 'idle' && waveActive,
        'animate-wave-raise': isRaising,
        'is-raised': isRaised,
      }"
    >
      <g class="navi-stub-wave" :class="{ 'animate-wave-hold': isRaised }">
        <rect class="navi-stub navi-stub--right" x="288" y="318" width="18" height="12" rx="6" :fill="coreFill" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.navi-face {
  display: block;
  overflow: hidden;
}

.navi-ring,
.navi-node,
.navi-core,
.navi-stub {
  transform-box: fill-box;
  transform-origin: center;
  transition: stroke 0.3s ease, fill 0.3s ease;
}

.navi-ring {
  transition: transform 0.4s ease-out, stroke 0.3s ease;
}

.navi-eye-track {
  transition: transform 0.15s ease-out;
}

.navi-eye {
  transform-box: fill-box;
  transform-origin: center;
}

.navi-stub-wrapper--right {
  transform-box: fill-box;
  transform-origin: 50% 0%;
  transition: transform 0.35s ease-out;
}

.navi-stub-wrapper--right.is-raised {
  transform: translate(0px, -80px) rotate(-50deg);
}

.navi-stub-wave {
  transform-box: fill-box;
  transform-origin: 50% 0%;
}

.navi-orbital-nodes {
  transform-origin: 256px 280px;
  transition: transform 0.6s ease-out;
}

/* IDLE */
.is-idle .navi-ring {
  animation: navi-idle-ring 4s ease-in-out infinite;
}

/* THINKING */
.is-thinking .navi-ring {
  animation: navi-spin 3s linear infinite;
  stroke-dasharray: 40 20;
}
.is-thinking .navi-core {
  animation: navi-pulse 1.4s ease-in-out infinite;
}
.is-thinking .navi-node {
  animation: navi-node-pulse 1.2s ease-in-out infinite;
}
.is-thinking .navi-node:nth-child(2) { animation-delay: 0s; }
.is-thinking .navi-node:nth-child(3) { animation-delay: 0.3s; }
.is-thinking .navi-node:nth-child(4) { animation-delay: 0.6s; }
.is-thinking .navi-node:nth-child(5) { animation-delay: 0.9s; }
.is-thinking .navi-orbital-nodes {
  animation: navi-nodes-orbit 16s ease-in-out infinite;
}

/* TOOL CALLING */
.is-tool-calling .navi-ring {
  animation: navi-spin 0.8s linear infinite;
  stroke-dasharray: 30 15;
}
.is-tool-calling .navi-core {
  animation: navi-pulse 0.6s ease-in-out infinite;
}
.is-tool-calling .navi-node {
  animation: navi-node-pop 0.7s ease-in-out infinite;
}

/* AWAITING APPROVAL */
.is-awaiting-approval .navi-ring {
  animation: navi-blink-ring 1.2s ease-in-out infinite;
}
.is-awaiting-approval .navi-core {
  animation: navi-dim 1.2s ease-in-out infinite;
}
.is-awaiting-approval .navi-eye {
  animation: navi-blink 1.5s infinite;
}
.is-awaiting-approval .navi-stub {
  animation: navi-dim 1.2s ease-in-out infinite;
}
.is-awaiting-approval .navi-orbital-nodes {
  animation: navi-nodes-orbit 16s ease-in-out infinite;
}

/* ERROR */
.is-error .navi-face {
  animation: navi-shake 0.5s ease-in-out infinite;
}
.is-error .navi-ring {
  animation: navi-blink-ring 0.6s ease-in-out infinite;
}

/* COMPACTING */
.is-compacting .navi-ring {
  animation: navi-spin-reverse 2.5s linear infinite;
  stroke-dasharray: 50 25;
}
.is-compacting .navi-core {
  animation: navi-breathe 1.8s ease-in-out infinite;
}
.is-compacting .navi-node {
  animation: navi-node-pulse 1s ease-in-out infinite;
}
.is-compacting .navi-orbital-nodes {
  animation: navi-nodes-orbit 12s ease-in-out infinite;
}

</style>
