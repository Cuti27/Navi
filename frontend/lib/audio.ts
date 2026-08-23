/**
 * Audio helpers for the voice-input feature.
 *
 * The MediaRecorder API produces WebM/Opus blobs, but the backend Whisper
 * transcriber decodes RIFF/WAVE. These helpers convert any decoded AudioBuffer
 * into a mono 16-bit PCM WAV at 16 kHz (the sample rate Whisper expects).
 */

const TARGET_SAMPLE_RATE = 16000

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/**
 * Converts an AudioBuffer into a WAV PCM16 mono 16 kHz Blob.
 * Channels are mixed to mono and the signal is resampled with linear
 * interpolation when the source sample rate differs from 16 kHz.
 */
export function encodeWav(audioBuffer: AudioBuffer): Blob {
  const channelCount = audioBuffer.numberOfChannels
  const sourceRate = audioBuffer.sampleRate

  // Mix all channels to mono.
  const first = audioBuffer.getChannelData(0)
  let mono: Float32Array
  if (channelCount === 1) {
    mono = first
  } else {
    mono = new Float32Array(first.length)
    for (let ch = 0; ch < channelCount; ch++) {
      const data = audioBuffer.getChannelData(ch)
      for (let i = 0; i < mono.length; i++) {
        mono[i] += data[i]
      }
    }
    for (let i = 0; i < mono.length; i++) {
      mono[i] /= channelCount
    }
  }

  // Resample to 16 kHz using linear interpolation.
  const ratio = sourceRate / TARGET_SAMPLE_RATE
  const resampledLength = Math.max(1, Math.round(mono.length / ratio))
  const resampled = new Float32Array(resampledLength)
  for (let i = 0; i < resampledLength; i++) {
    const position = i * ratio
    const index = Math.floor(position)
    const fraction = position - index
    const sample0 = mono[Math.min(index, mono.length - 1)]
    const sample1 = mono[Math.min(index + 1, mono.length - 1)]
    resampled[i] = sample0 + (sample1 - sample0) * fraction
  }

  // Encode as 16-bit little-endian PCM.
  const dataSize = resampledLength * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < resampledLength; i++) {
    const sample = Math.max(-1, Math.min(1, resampled[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Decodes any audio blob (e.g. WebM/Opus from MediaRecorder) in the browser
 * and re-encodes it as a mono 16 kHz WAV blob suitable for the backend.
 */
export async function blobToWav16k(blob: Blob): Promise<Blob> {
  const audioContext = new AudioContext()
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    return encodeWav(audioBuffer)
  } finally {
    void audioContext.close()
  }
}
