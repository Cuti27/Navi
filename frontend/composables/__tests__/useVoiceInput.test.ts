import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useVoiceInput } from '../useVoiceInput'

type Composable = ReturnType<typeof useVoiceInput>

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  state = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  constructor(public stream: MediaStream, _options?: MediaRecorderOptions) {}

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio-chunk']) })
    this.onstop?.()
  }
}

function mountComposable(): { wrapper: ReturnType<typeof mount>; voice: Composable } {
  let voice!: Composable
  const Comp = defineComponent({
    setup() {
      voice = useVoiceInput()
      return () => null
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, voice }
}

function stubMediaDevices(resolve: () => MediaStream | Promise<MediaStream>) {
  const stream = {
    getTracks: () => [{ stop: vi.fn() }],
  }
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockImplementation(resolve),
    },
  })
  return stream
}

describe('useVoiceInput', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts recording and captures audio into a blob on stop', async () => {
    const { voice } = mountComposable()
    stubMediaDevices(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream))

    await voice.start()
    expect(voice.isRecording.value).toBe(true)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })

    vi.advanceTimersByTime(500)
    expect(voice.durationMs.value).toBeGreaterThan(0)

    const blob = await voice.stop()
    expect(blob.size).toBeGreaterThan(0)
    expect(voice.isRecording.value).toBe(false)
  })

  it('records in webm opus mime type when supported', async () => {
    const { voice } = mountComposable()
    stubMediaDevices(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream))

    await voice.start()
    expect(FakeMediaRecorder.isTypeSupported).toHaveBeenCalledWith('audio/webm;codecs=opus')
    await voice.stop()
  })

  it('sets a friendly error when permission is denied', async () => {
    const { voice } = mountComposable()
    stubMediaDevices(() => {
      const err = new DOMException('denied', 'NotAllowedError')
      return Promise.reject(err)
    })

    await voice.start()
    expect(voice.isRecording.value).toBe(false)
    expect(voice.error.value).toContain('micrófono')
  })

  it('sets a generic error on other microphone failures', async () => {
    const { voice } = mountComposable()
    stubMediaDevices(() => Promise.reject(new Error('boom')))

    await voice.start()
    expect(voice.error.value).toContain('No se pudo acceder')
  })

  it('stop with no active recorder resolves an empty blob', async () => {
    const { voice } = mountComposable()
    const blob = await voice.stop()
    expect(blob.size).toBe(0)
  })

  it('cancel discards the recording and stops tracks', async () => {
    const stream = stubMediaDevices(() => Promise.resolve(stream))
    const track = { stop: vi.fn() }
    Object.assign(stream, { getTracks: () => [track] })

    const { voice } = mountComposable()
    await voice.start()
    expect(voice.isRecording.value).toBe(true)

    voice.cancel()
    await nextTick()
    expect(voice.isRecording.value).toBe(false)
    expect(track.stop).toHaveBeenCalled()
  })
})