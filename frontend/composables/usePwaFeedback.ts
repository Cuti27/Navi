export interface FeedbackOptions {
  title: string
  body?: string
  icon?: string
  tag?: string
  vibrate?: number | number[]
}

export function usePwaFeedback() {
  const permission = ref<NotificationPermission>('default')

  async function ensurePermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') {
      permission.value = 'granted'
      return true
    }
    const result = await Notification.requestPermission()
    permission.value = result
    return result === 'granted'
  }

  function isAppVisible(): boolean {
    if (typeof document === 'undefined') return true
    return document.visibilityState === 'visible'
  }

  function vibrate(pattern: number | number[] = 50): void {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    try {
      navigator.vibrate(pattern)
    } catch {
      // Ignore unsupported vibration patterns
    }
  }

  async function notify(options: FeedbackOptions): Promise<void> {
    const { title, body, icon = '/icon.png', tag, vibrate: vibratePattern = [100, 50, 100] } = options

    // Haptics work on Android/desktop; iOS Safari ignores this silently.
    vibrate(vibratePattern)

    // Local notifications only make sense when the app is not in foreground.
    if (isAppVisible()) return

    const granted = await ensurePermission()
    if (!granted) return

    try {
      // eslint-disable-next-line no-new
      new Notification(title, {
        body,
        icon,
        tag,
      })
    } catch {
      // Notification constructor may fail in some PWA contexts.
    }
  }

  return {
    permission,
    ensurePermission,
    isAppVisible,
    vibrate,
    notify,
  }
}
