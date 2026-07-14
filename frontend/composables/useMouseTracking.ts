import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

/**
 * Tracks mouse / touch position within a BOUNDARY_RADIUS from the SVG center,
 * and returns a `trackingStyle` with translate(X, Y) to apply to elements
 * that should follow the cursor. Converts page coords to viewBox (512×640).
 *
 * @example
 *   const svgRef = ref<SVGElement | null>(null)
 *   const { trackingStyle } = useMouseTracking(svgRef)
 *   // <svg ref="svgRef"> ... <g :style="trackingStyle"><!-- eyes --></g>
 */
const CENTER_X = 256
const CENTER_Y = 280
const MAX_OFFSET = 6
const DEAD_ZONE = 15
const BOUNDARY_RADIUS = 250

export function useMouseTracking(svgRef: Ref<SVGElement | null>) {
  const dx = ref(0)
  const dy = ref(0)

  const trackingStyle = computed(() => ({
    transform: `translate(${dx.value}px, ${dy.value}px)`,
  }))

  function handleMove(clientX: number, clientY: number) {
    const svg = svgRef.value
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const vx = (clientX - rect.left) / rect.width * 512
    const vy = (clientY - rect.top) / rect.height * 640

    const distX = vx - CENTER_X
    const distY = vy - CENTER_Y
    const distance = Math.sqrt(distX * distX + distY * distY)

    if (distance > BOUNDARY_RADIUS || distance < DEAD_ZONE) {
      dx.value = 0
      dy.value = 0
      return
    }

    const ratio = Math.min(distance / 80, 1)
    dx.value = (distX / distance) * MAX_OFFSET * ratio
    dy.value = (distY / distance) * MAX_OFFSET * ratio
  }

  function onMouseMove(e: MouseEvent) {
    handleMove(e.clientX, e.clientY)
  }

  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0]
    handleMove(t.clientX, t.clientY)
  }

  function onLeave() {
    dx.value = 0
    dy.value = 0
  }

  onMounted(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onLeave)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onLeave)
  })

  return { trackingStyle }
}
