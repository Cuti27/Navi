import { describe, it, expect, vi, afterEach } from 'vitest'
import { encodeWav, blobToWav16k } from '../audio'

function makeFakeBuffer(
  channels: number,
  sampleRate: number,
  length = 4
): AudioBuffer {
  return {
    numberOfChannels: channels,
    sampleRate,
    length,
    duration: length / sampleRate,
    getChannelData: (ch: number) => {
      const data = new Float32Array(length)
      for (let i = 0; i < length; i++) data[i] = ch === 0 ? 0.5 : -0.25
      return data
    },
  } as unknown as AudioBuffer
}

describe('encodeWav', () => {
  it('produces a valid RIFF/WAVE header at 16 kHz mono', async () => {
    const blob = encodeWav(makeFakeBuffer(2, 48000))
    expect(blob.type).toBe('audio/wav')

    const view = new DataView(await blob.arrayBuffer())
    expect(new TextDecoder().decode(new Uint8Array(view.buffer, 0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(new Uint8Array(view.buffer, 8, 4))).toBe('WAVE')
    expect(new TextDecoder().decode(new Uint8Array(view.buffer, 12, 4))).toBe('fmt ')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(new TextDecoder().decode(new Uint8Array(view.buffer, 36, 4))).toBe('data')
  })

  it('encodes mono data without touching channel logic', () => {
    const blob = encodeWav(makeFakeBuffer(1, 16000, 2))
    expect(blob.size).toBeGreaterThan(44)
  })

  it('clamps samples outside [-1, 1]', async () => {
    const buffer = {
      numberOfChannels: 1,
      sampleRate: 16000,
      getChannelData: () => new Float32Array([2, -2, 0]),
    } as unknown as AudioBuffer
    const blob = encodeWav(buffer)
    const view = new DataView(await blob.arrayBuffer())
    // First sample clamps to 0x7fff, second to -0x8000.
    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
  })
})

describe('blobToWav16k', () => {
  class FakeAudioContext {
    decodeAudioData = vi.fn().mockResolvedValue(makeFakeBuffer(1, 16000, 2))
    close = vi.fn()
    constructor() {
      captured = this
    }
  }
  let captured: FakeAudioContext | null = null

  afterEach(() => {
    captured = null
    vi.unstubAllGlobals()
  })

  it('decodes a blob and re-encodes it as WAV', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext)

    const input = new Blob(['fake-webm'], { type: 'audio/webm' })
    const wav = await blobToWav16k(input)
    expect(wav.type).toBe('audio/wav')
    expect(captured?.decodeAudioData).toHaveBeenCalled()
    expect(captured?.close).toHaveBeenCalled()
  })
})