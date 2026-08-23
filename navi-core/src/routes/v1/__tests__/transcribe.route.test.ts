import { describe, it, expect, vi, beforeEach } from "vitest"
import { createTranscribeRoute } from "../transcribe.route.js"
import type { TranscriptionService } from "../../../chat/transcription-service.js"

function buildFormData(includeAudio = true): FormData {
  const formData = new FormData()
  if (includeAudio) {
    formData.append(
      "audio",
      new File([new Uint8Array([1, 2, 3, 4])], "voice.wav", { type: "audio/wav" })
    )
  }
  return formData
}

describe("createTranscribeRoute", () => {
  let transcriptionService: TranscriptionService

  beforeEach(() => {
    transcriptionService = {
      transcribe: vi.fn().mockResolvedValue("texto transcrito"),
    }
  })

  it("POST /chat/transcribe returns { text }", async () => {
    const app = createTranscribeRoute(transcriptionService)

    const res = await app.request("/chat/transcribe", {
      method: "POST",
      body: buildFormData(),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ text: "texto transcrito" })
    expect(transcriptionService.transcribe).toHaveBeenCalledTimes(1)
    const [bytes, mimeType] = vi.mocked(transcriptionService.transcribe).mock.calls[0]
    expect(Buffer.isBuffer(bytes)).toBe(true)
    expect(mimeType).toBe("audio/wav")
  })

  it("POST /chat/transcribe returns 400 when audio is missing", async () => {
    const app = createTranscribeRoute(transcriptionService)

    const res = await app.request("/chat/transcribe", {
      method: "POST",
      body: buildFormData(false),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Missing audio file")
    expect(transcriptionService.transcribe).not.toHaveBeenCalled()
  })

  it("POST /chat/transcribe returns 500 when transcription fails", async () => {
    transcriptionService.transcribe = vi
      .fn()
      .mockRejectedValue(new Error("La transcripción falló: modelo caído"))
    const app = createTranscribeRoute(transcriptionService)

    const res = await app.request("/chat/transcribe", {
      method: "POST",
      body: buildFormData(),
    })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Transcription failed")
    expect(body.message).toContain("La transcripción falló")
  })
})
