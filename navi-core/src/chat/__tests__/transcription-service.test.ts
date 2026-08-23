import { describe, it, expect, vi, beforeEach } from "vitest"
import {
    WhisperTranscriptionService,
    decodeWavToFloat32,
    readSampleRate,
} from "../transcription-service.js"

const { mockPipeline, mockEnv } = vi.hoisted(() => ({
  mockPipeline: vi.fn(),
  mockEnv: {} as Record<string, unknown>,
}))

vi.mock("@huggingface/transformers", () => ({
  pipeline: (...args: unknown[]) => mockPipeline(...args),
  env: mockEnv,
}))

/** Builds a minimal PCM16 RIFF/WAVE buffer. Samples are interleaved. */
function makeWavPcm16(samples: Int16Array, numChannels: number, sampleRate = 16000): Buffer {
  const dataSize = samples.length * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write("RIFF", 0, "ascii")
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write("WAVE", 8, "ascii")
  buffer.write("fmt ", 12, "ascii")
  buffer.writeUInt32LE(16, 16) // fmt chunk size
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * numChannels * 2, 28) // byte rate
  buffer.writeUInt16LE(numChannels * 2, 32) // block align
  buffer.writeUInt16LE(16, 34) // bits per sample
  buffer.write("data", 36, "ascii")
  buffer.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2)
  }
  return buffer
}

describe("WhisperTranscriptionService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.cacheDir = undefined
    mockEnv.allowRemoteModels = undefined
  })

  it("transcribes audio and returns trimmed text", async () => {
    const pipe = vi.fn().mockResolvedValue({ text: "  Hola mundo  " })
    mockPipeline.mockResolvedValue(pipe)

    const service = new WhisperTranscriptionService()
    const wav = makeWavPcm16(new Int16Array([0, 0, 0]), 1)
    const text = await service.transcribe(wav, "audio/wav")

    expect(text).toBe("Hola mundo")
    expect(mockPipeline).toHaveBeenCalledWith(
      "automatic-speech-recognition",
      "Xenova/whisper-base",
      { dtype: "q8" }
    )
    expect(pipe).toHaveBeenCalledWith(expect.any(Float32Array), {
      language: "es",
      task: "transcribe",
      return_timestamps: false,
    })
    expect(mockEnv.cacheDir).toBe("./data/transformers")
    expect(mockEnv.allowRemoteModels).toBe(true)
  })

  it("loads the pipeline lazily (only once) and caches it", async () => {
    const pipe = vi.fn().mockResolvedValue({ text: "primera" })
    mockPipeline.mockResolvedValue(pipe)

    const service = new WhisperTranscriptionService()
    const wav = makeWavPcm16(new Int16Array([0, 0]), 1)

    await service.transcribe(wav, "audio/wav")
    await service.transcribe(wav, "audio/wav")

    expect(mockPipeline).toHaveBeenCalledTimes(1)
    expect(pipe).toHaveBeenCalledTimes(2)
  })

  it("honors model and language options", async () => {
    const pipe = vi.fn().mockResolvedValue({ text: "hola" })
    mockPipeline.mockResolvedValue(pipe)

    const service = new WhisperTranscriptionService({ model: "custom/model", language: "en" })
    const wav = makeWavPcm16(new Int16Array([0, 0]), 1)
    await service.transcribe(wav, "audio/wav")

    expect(mockPipeline).toHaveBeenCalledWith(
      "automatic-speech-recognition",
      "custom/model",
      { dtype: "q8" }
    )
    expect(pipe).toHaveBeenCalledWith(expect.any(Float32Array), {
      language: "en",
      task: "transcribe",
      return_timestamps: false,
    })
  })

  it("propagates a clear error when the pipeline fails", async () => {
    mockPipeline.mockRejectedValue(new Error("modelo no encontrado"))

    const service = new WhisperTranscriptionService()
    const wav = makeWavPcm16(new Int16Array([0, 0]), 1)

    await expect(service.transcribe(wav, "audio/wav")).rejects.toThrow(
      "La transcripción falló: modelo no encontrado"
    )
  })

  it("throws a clear error when the output has no text", async () => {
    const pipe = vi.fn().mockResolvedValue({ text: "   " })
    mockPipeline.mockResolvedValue(pipe)

    const service = new WhisperTranscriptionService()
    const wav = makeWavPcm16(new Int16Array([0, 0]), 1)

    await expect(service.transcribe(wav, "audio/wav")).rejects.toThrow(
      "La transcripción no produjo texto"
    )
  })

  it("rejects audio longer than maxAudioSeconds before running inference", async () => {
    const pipe = vi.fn().mockResolvedValue({ text: "hola" })
    mockPipeline.mockResolvedValue(pipe)

    // 3 seconds of audio at 16000 Hz mono.
    const service = new WhisperTranscriptionService({ maxAudioSeconds: 2 })
    const wav = makeWavPcm16(new Int16Array(16000 * 3).fill(0), 1, 16000)

    await expect(service.transcribe(wav, "audio/wav")).rejects.toThrow(
      "Audio demasiado largo"
    )
    expect(pipe).not.toHaveBeenCalled()
  })
})

describe("decodeWavToFloat32", () => {
  it("decodes PCM16 mono with normalized values", () => {
    const samples = new Int16Array([16384, -16384, 32767])
    const wav = makeWavPcm16(samples, 1, 16000)
    const decoded = decodeWavToFloat32(wav)

    expect(decoded).toHaveLength(3)
    expect(decoded[0]).toBeCloseTo(0.5, 5)
    expect(decoded[1]).toBeCloseTo(-0.5, 5)
    expect(decoded[2]).toBeCloseTo(32767 / 32768, 5)
  })

  it("averages stereo channels to mono", () => {
    // Interleaved L/R/L/R
    const samples = new Int16Array([16384, 16384, -16384, -16384])
    const wav = makeWavPcm16(samples, 2, 44100)
    const decoded = decodeWavToFloat32(wav)

    expect(decoded).toHaveLength(2)
    expect(decoded[0]).toBeCloseTo(0.5, 5)
    expect(decoded[1]).toBeCloseTo(-0.5, 5)
  })

  it("decodes IEEE float32 WAV", () => {
    const buffer = Buffer.alloc(44 + 3 * 4)
    buffer.write("RIFF", 0, "ascii")
    buffer.writeUInt32LE(36 + 3 * 4, 4)
    buffer.write("WAVE", 8, "ascii")
    buffer.write("fmt ", 12, "ascii")
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(3, 20) // IEEE float
    buffer.writeUInt16LE(1, 22)
    buffer.writeUInt32LE(16000, 24)
    buffer.writeUInt32LE(16000 * 4, 28)
    buffer.writeUInt16LE(4, 32)
    buffer.writeUInt16LE(32, 34)
    buffer.write("data", 36, "ascii")
    buffer.writeUInt32LE(3 * 4, 40)
    buffer.writeFloatLE(0.25, 44)
    buffer.writeFloatLE(-0.5, 48)
    buffer.writeFloatLE(0.75, 52)

    const decoded = decodeWavToFloat32(buffer)
    expect(decoded).toHaveLength(3)
    expect(decoded[0]).toBeCloseTo(0.25, 5)
    expect(decoded[1]).toBeCloseTo(-0.5, 5)
    expect(decoded[2]).toBeCloseTo(0.75, 5)
  })

  it("rejects a non-WAV buffer", () => {
    expect(() => decodeWavToFloat32(Buffer.alloc(44).fill(0))).toThrow(
      "Firma RIFF no encontrada"
    )
  })

  it("rejects an unsupported audio format", () => {
    const wav = makeWavPcm16(new Int16Array([0, 0]), 1)
    wav.writeUInt16LE(6, 20) // A-law / unsupported
    expect(() => decodeWavToFloat32(wav)).toThrow("Formato de audio no soportado")
  })
})

describe("readSampleRate", () => {
  it("reads the sample rate from a WAV header", () => {
    expect(readSampleRate(makeWavPcm16(new Int16Array([0]), 1, 44100))).toBe(44100)
    expect(readSampleRate(makeWavPcm16(new Int16Array([0]), 1, 16000))).toBe(16000)
  })

  it("rejects a non-WAV buffer", () => {
    expect(() => readSampleRate(Buffer.alloc(30).fill(0))).toThrow("Formato WAVE no encontrado")
  })
})
