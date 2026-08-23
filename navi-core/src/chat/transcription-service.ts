import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers"
import { getLogger } from "../logger/logger.js"

export interface TranscriptionService {
    transcribe(audio: Buffer, mimeType: string): Promise<string>
}

export interface WhisperTranscriptionOptions {
    model?: string
    language?: string
}

/**
 * Locally-typed subset of the transformers.js `pipeline` factory. We only use
 * the ASR task, so we cast the real (very large) generic factory signature to
 * this narrow type to keep TypeScript from trying to materialize the huge
 * `AllTasks` union type.
 */
type AsrPipelineFactory = (
    task: "automatic-speech-recognition",
    model: string,
    options: { dtype: "q8" }
) => Promise<AutomaticSpeechRecognitionPipeline>

/**
 * Speech-to-text transcription backed by a local Whisper model running in
 * Node via transformers.js (`@huggingface/transformers`). The pipeline is
 * loaded lazily on the first call and cached as a singleton promise, so the
 * model (and its onnxruntime native backend) only initializes once.
 */
export class WhisperTranscriptionService implements TranscriptionService {
    private readonly log = getLogger("stt")
    private pipelinePromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null

    constructor(private readonly options: WhisperTranscriptionOptions = {}) {}

    private get model(): string {
        return this.options.model ?? "Xenova/whisper-base"
    }

    private get language(): string {
        return this.options.language ?? "es"
    }

    private async getPipeline(): Promise<AutomaticSpeechRecognitionPipeline> {
        if (!this.pipelinePromise) {
            this.pipelinePromise = (async () => {
                const { pipeline, env } = await import("@huggingface/transformers")
                const cacheDir = process.env.STT_CACHE_DIR ?? "./data/transformers"
                env.cacheDir = cacheDir
                env.allowRemoteModels = true
                this.log.info({ model: this.model, cacheDir }, "loading whisper pipeline")
                const loadAsr = pipeline as unknown as AsrPipelineFactory
                return loadAsr("automatic-speech-recognition", this.model, { dtype: "q8" })
            })()
        }
        return this.pipelinePromise
    }

    async transcribe(audio: Buffer, mimeType: string): Promise<string> {
        const startedAt = Date.now()
        try {
            const pipe = await this.getPipeline()
            const audioFloat32 = decodeWavToFloat32(audio)
            const output = await pipe(audioFloat32, {
                language: this.language,
                task: "transcribe",
                return_timestamps: false,
            })
            // A single Float32Array input produces a single result, but the
            // typing allows an array as well. Normalize defensively.
            const result = Array.isArray(output) ? output[0] : output
            const text = String(result?.text ?? "").trim()
            if (!text) {
                throw new Error("La transcripción no produjo texto")
            }
            this.log.info(
                { model: this.model, language: this.language, mimeType, durationMs: Date.now() - startedAt },
                "transcription completed"
            )
            return text
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            this.log.error({ err, mimeType }, "transcription failed")
            throw new Error(`La transcripción falló: ${message}`)
        }
    }
}

/**
 * Parses a RIFF/WAVE buffer into a normalized mono Float32Array in [-1, 1].
 *
 * Supports PCM16 (`audioFormat = 1`) and IEEE float32 (`audioFormat = 3`),
 * any channel count (averaged to mono) and any sample rate. No external
 * dependencies.
 */
export function decodeWavToFloat32(buffer: Buffer): Float32Array {
    if (buffer.length < 44) {
        throw new Error("Audio demasiado corto para ser un WAV")
    }
    if (buffer.toString("ascii", 0, 4) !== "RIFF") {
        throw new Error("Firma RIFF no encontrada")
    }
    if (buffer.toString("ascii", 8, 12) !== "WAVE") {
        throw new Error("Formato WAVE no encontrado")
    }

    const audioFormat = buffer.readUInt16LE(20)
    const numChannels = buffer.readUInt16LE(22)
    const sampleRate = buffer.readUInt32LE(24)
    const bitsPerSample = buffer.readUInt16LE(34)

    if (audioFormat !== 1 && audioFormat !== 3) {
        throw new Error(`Formato de audio no soportado: ${audioFormat} (se espera PCM=1 o float=3)`)
    }
    if (numChannels === 0) {
        throw new Error("Número de canales inválido")
    }
    if (sampleRate === 0) {
        throw new Error("Frecuencia de muestreo inválida")
    }

    let offset = 12
    let dataOffset = -1
    let dataSize = 0
    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString("ascii", offset, offset + 4)
        const chunkSize = buffer.readUInt32LE(offset + 4)
        if (chunkId === "data") {
            dataOffset = offset + 8
            dataSize = chunkSize
            break
        }
        // Chunks are word-aligned (padded to even size)
        offset += 8 + chunkSize + (chunkSize % 2)
    }

    if (dataOffset === -1 || dataSize === 0 || dataOffset >= buffer.length) {
        throw new Error("Chunk de datos no encontrado")
    }

    const bytesPerSample = bitsPerSample / 8
    if (bytesPerSample === 0 || numChannels === 0) {
        throw new Error("Parámetros de audio inválidos")
    }

    const frameCount = Math.min(
        Math.floor(dataSize / (bytesPerSample * numChannels)),
        Math.floor((buffer.length - dataOffset) / (bytesPerSample * numChannels))
    )
    const samples = new Float32Array(frameCount)

    if (audioFormat === 1) {
        // PCM16
        if (bitsPerSample !== 16) {
            throw new Error(`Solo se soporta PCM16, se recibió PCM${bitsPerSample}`)
        }
        for (let i = 0; i < frameCount; i++) {
            let sum = 0
            for (let ch = 0; ch < numChannels; ch++) {
                const sampleOffset = dataOffset + (i * numChannels + ch) * 2
                sum += buffer.readInt16LE(sampleOffset) / 32768
            }
            samples[i] = sum / numChannels
        }
    } else {
        // IEEE float32
        if (bitsPerSample !== 32) {
            throw new Error(`Solo se soporta float32, se recibió ${bitsPerSample} bits`)
        }
        for (let i = 0; i < frameCount; i++) {
            let sum = 0
            for (let ch = 0; ch < numChannels; ch++) {
                const sampleOffset = dataOffset + (i * numChannels + ch) * 4
                sum += buffer.readFloatLE(sampleOffset)
            }
            samples[i] = sum / numChannels
        }
    }

    return samples
}
