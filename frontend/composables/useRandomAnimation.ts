import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue'

/**
 * Toggles a reactive `active` ref for `duration` seconds at random intervals
 * between `min` and `max` seconds. Useful for one-shot animations with
 * unpredictable timing (blinks, gestures, organic motion).
 *
 * Pass `disabled` to pause the timer while the condition is true.
 *
 * @example
 *   const { active } = useRandomAnimation(5, 10, 0.7) // blink every 5-10s
 *   const { active } = useRandomAnimation(5, 10, 0.7, isPaused) // blink only when not paused
 */
export function useRandomAnimation(
  min: number,
  max: number,
  duration: number,
  disabled: Ref<boolean> | boolean = false,
) {
  const active = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let cleanup: ReturnType<typeof setTimeout> | null = null

  const disabledRef = computed(() => (typeof disabled === 'boolean' ? disabled : disabled.value))

  function getDelay() {
    return (Math.random() * (max - min) + min) * 1000
  }

  function schedule() {
    if (disabledRef.value) return
    timer = setTimeout(() => {
      active.value = true
      cleanup = setTimeout(() => {
        active.value = false
        schedule()
      }, duration * 1000)
    }, getDelay())
  }

  function stop() {
    if (timer !== null) clearTimeout(timer)
    if (cleanup !== null) clearTimeout(cleanup)
    active.value = false
  }

  onMounted(() => schedule())
  onUnmounted(() => stop())

  watch(disabledRef, (isDisabled) => {
    if (isDisabled) {
      stop()
    } else {
      schedule()
    }
  })

  return { active }
}
