<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { createAvatar, type AvatarController } from '@bible-strong/avatar-web'
import definition from './v2/navi.avatar.json'
import type { NaviFaceState } from './NaviFace.vue'

const STATE_ANIMATION: Record<NaviFaceState, string> = {
  idle: 'idle',
  thinking: 'thinking',
  'tool-calling': 'tool-calling',
  'awaiting-approval': 'awaiting-approval',
  error: 'error',
  compacting: 'compacting',
}

const STATE_RING_COLOR: Record<NaviFaceState, string> = {
  idle: '#738f88',
  thinking: '#4ade80',
  'tool-calling': '#4ade80',
  'awaiting-approval': '#3b82f6',
  error: '#ba1a1a',
  compacting: '#f59e0b',
}

interface Props {
  state?: NaviFaceState
  size?: number | string
  withBackground?: boolean
  decorations?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  state: 'idle',
  size: 240,
  withBackground: true,
  decorations: true,
  ariaLabel: 'Navi agent avatar',
})

const containerRef = ref<HTMLDivElement | null>(null)
let controller: AvatarController | null = null

const wrapperStyle = computed(() => {
  const sizeCss = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    width: sizeCss,
    height: sizeCss,
    '--navi-ring': STATE_RING_COLOR[props.state],
  } as Record<string, string>
})

function stateAnimation(state: NaviFaceState): string {
  return STATE_ANIMATION[state]
}

const SVG_NS = 'http://www.w3.org/2000/svg'

const ORBIT_RADIUS = 114
const ORBIT_DOT_R = 7
// Base angles (degrees, screen space y-down) in creation order: bottom, top, right, left.
const ORBIT_BASE_ANGLES = [90, -90, 0, 180]
const ORBIT_DURATION: Partial<Record<NaviFaceState, number>> = {
  thinking: 16000,
  'awaiting-approval': 16000,
  compacting: 12000,
}

let orbitCircles: SVGCircleElement[] = []
let orbitRaf = 0

function orbitTheta(progress: number): number {
  if (progress < 0.4) {
    const e = progress / 0.4
    return 180 * (0.5 - 0.5 * Math.cos(Math.PI * e))
  }
  if (progress < 0.55) return 180
  if (progress < 0.9) {
    const e = (progress - 0.55) / 0.35
    return 180 * (0.5 + 0.5 * Math.cos(Math.PI * e))
  }
  return 0
}

function applyOrbit(theta: number) {
  for (let i = 0; i < orbitCircles.length; i++) {
    const angle = ((ORBIT_BASE_ANGLES[i] + theta) * Math.PI) / 180
    orbitCircles[i].setAttribute('cx', String(Math.round(ORBIT_RADIUS * Math.cos(angle) * 10) / 10))
    orbitCircles[i].setAttribute('cy', String(Math.round(ORBIT_RADIUS * Math.sin(angle) * 10) / 10))
  }
}

function stopOrbit() {
  if (orbitRaf) cancelAnimationFrame(orbitRaf)
  orbitRaf = 0
  applyOrbit(0)
}

function runOrbit(durationMs: number) {
  stopOrbit()
  const start = performance.now()
  const tick = (now: number) => {
    const progress = ((now - start) % durationMs) / durationMs
    applyOrbit(orbitTheta(progress))
    orbitRaf = requestAnimationFrame(tick)
  }
  orbitRaf = requestAnimationFrame(tick)
}

function updateOrbit(state: NaviFaceState) {
  const duration = ORBIT_DURATION[state]
  if (duration) runOrbit(duration)
  else stopOrbit()
}

function setupOrbitalDots(svg: SVGElement | null) {
  if (!svg) return
  const group = document.createElementNS(SVG_NS, 'g')
  group.setAttribute('class', 'navi-orbital-g')
  const positions: Array<[number, number]> = [
    [0, ORBIT_RADIUS],
    [0, -ORBIT_RADIUS],
    [ORBIT_RADIUS, 0],
    [-ORBIT_RADIUS, 0],
  ]
  orbitCircles = []
  for (const [cx, cy] of positions) {
    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('cx', String(cx))
    circle.setAttribute('cy', String(cy))
    circle.setAttribute('r', String(ORBIT_DOT_R))
    circle.setAttribute('class', 'navi-orbit-dot')
    group.appendChild(circle)
    orbitCircles.push(circle)
  }
  svg.appendChild(group)
}

function mountAvatar() {
  if (!containerRef.value) return
  controller?.destroy()
  controller = createAvatar(containerRef.value, {
    definition,
    defaultAnimation: stateAnimation(props.state),
    size: props.size,
    className: 'navi-face-v2__avatar',
    ariaLabel: props.ariaLabel,
  })
  setupOrbitalDots(containerRef.value.querySelector('svg'))
  updateOrbit(props.state)
}

watch(
  () => props.state,
  (state) => {
    const result = controller?.play(stateAnimation(state))
    if (result && !result.ok) {
      console.error(`[NaviFaceV2] ${result.error.message}`)
    }
    updateOrbit(state)
  },
)

watch(
  () => props.size,
  () => {
    if (controller) {
      const el = containerRef.value?.querySelector('.bs-avatar') as HTMLElement | null
      if (el) {
        el.style.width = typeof props.size === 'number' ? `${props.size}px` : props.size
        el.style.height = typeof props.size === 'number' ? `${props.size}px` : props.size
      }
    }
  },
)

onMounted(mountAvatar)

onBeforeUnmount(() => {
  stopOrbit()
  controller?.destroy()
  controller = null
})
</script>

<template>
  <div
    :class="[
      'navi-face-v2',
      `is-${state}`,
      {
        'navi-face-v2--background': withBackground,
        'navi-face-v2--decorations': decorations,
      },
    ]"
    :style="wrapperStyle"
  >
    <div ref="containerRef" class="navi-face-v2__mount" />
    <span class="navi-face-v2__shade" aria-hidden="true" />
  </div>
</template>

<style scoped>
.navi-face-v2 {
  position: relative;
  display: inline-block;
  overflow: hidden;
  border-radius: 9999px;
}

.navi-face-v2--background::before {
  content: '';
  position: absolute;
  inset: 20%;
  border-radius: inherit;
  background:
    radial-gradient(120% 120% at 50% 30%, rgba(255, 248, 246, 0.95), rgba(232, 214, 210, 0.85));
}

.navi-face-v2__mount {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Decorative ring — colored per state. Plain border (wide support). */
.navi-face-v2--decorations::after {
  content: '';
  position: absolute;
  inset: 12%;
  border-radius: inherit;
  border: 2px solid var(--navi-ring, #738f88);
  opacity: 0.9;
  pointer-events: none;
  filter: drop-shadow(0 0 9px color-mix(in srgb, var(--navi-ring, #738f88) 45%, transparent));
}

/* Shading overlay — soft-light highlight; falls back to a faint white wash. */
.navi-face-v2__shade {
  display: none;
}

.navi-face-v2--decorations .navi-face-v2__shade {
  display: block;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(70% 70% at 28% 18%, rgba(255, 255, 255, 0.55), transparent 62%);
}

@supports (mix-blend-mode: soft-light) {
  .navi-face-v2--decorations .navi-face-v2__shade {
    mix-blend-mode: soft-light;
  }
}
</style>

<style>
/* ── Orbital nodes (v1 style) ───────────────────────────────────────────── */
/* These elements are injected at runtime (DOM post-processing), so they are
   styled globally with prefixed selectors instead of being scoped. */

.navi-orbit-dot {
  fill: var(--navi-ring, #738f88);
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes navi-v2-node-pulse {
  0%, 100% { opacity: 0.6; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
}

@keyframes navi-v2-node-pop {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.4); }
}

@keyframes navi-v2-node-dim {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.navi-face-v2.is-thinking .navi-orbit-dot {
  animation: navi-v2-node-pulse 1.2s ease-in-out infinite;
}
.navi-face-v2.is-thinking .navi-orbit-dot:nth-child(2) { animation-delay: 0.3s; }
.navi-face-v2.is-thinking .navi-orbit-dot:nth-child(3) { animation-delay: 0.6s; }
.navi-face-v2.is-thinking .navi-orbit-dot:nth-child(4) { animation-delay: 0.9s; }

.navi-face-v2.is-tool-calling .navi-orbit-dot {
  animation: navi-v2-node-pop 0.7s ease-in-out infinite;
}

.navi-face-v2.is-awaiting-approval .navi-orbit-dot {
  animation: navi-v2-node-dim 1.2s ease-in-out infinite;
}

.navi-face-v2.is-compacting .navi-orbit-dot {
  animation: navi-v2-node-pulse 1s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .navi-orbit-dot {
    animation: none !important;
  }
}
</style>