/**
 * Voice input for the chat composer: records audio through the microphone
 * with MediaRecorder and returns the recorded Blob. The raw blob is a WebM
 * (or browser-default) container; the caller is responsible for converting it
 * to WAV before uploading (see `lib/audio.ts`).
 */

export function useVoiceInput() {
  const isRecording = ref(false)
  const error = ref<string | null>(null)
  const durationMs = ref(0)

  let mediaRecorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []
  let timer: ReturnType<typeof setInterval> | null = null
  let startedAt = 0

  function stopTracks() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }
  }

  function clearTimer() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    durationMs.value = 0
  }

  async function start() {
    if (isRecording.value) return
    error.value = null

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        error.value =
          'Permiso de micrófono denegado. Habilítalo en el navegador para usar la voz.'
      } else {
        error.value = 'No se pudo acceder al micrófono.'
      }
      stopTracks()
      return
    }

    chunks = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : ''
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    mediaRecorder.start()

    isRecording.value = true
    startedAt = Date.now()
    timer = setInterval(() => {
      durationMs.value = Date.now() - startedAt
    }, 100)
  }

  function stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const recorder = mediaRecorder
      if (!recorder || !isRecording.value) {
        resolve(new Blob([]))
        return
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || 'audio/webm',
        })
        isRecording.value = false
        clearTimer()
        stopTracks()
        mediaRecorder = null
        resolve(blob)
      }
      recorder.stop()
    })
  }

  function cancel() {
    const recorder = mediaRecorder
    if (recorder && recorder.state !== 'inactive') {
      // Prevent the onstop handler from resolving a blob we intend to discard.
      recorder.onstop = null
      try {
        recorder.stop()
      } catch {
        // Already stopped — ignore.
      }
    }
    isRecording.value = false
    clearTimer()
    stopTracks()
    mediaRecorder = null
    chunks = []
  }

  onBeforeUnmount(() => {
    cancel()
  })

  return { isRecording, error, durationMs, start, stop, cancel }
}
