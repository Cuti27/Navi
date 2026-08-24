import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import type { TranscriptionService } from "../../chat/transcription-service.js"
import { getMaxBodySize } from "../../config/limits.js"
import { getLogger } from "../../logger/logger.js"

const log = getLogger("http")

/**
 * POST /chat/transcribe — accepts a `multipart/form-data` upload with an
 * `audio` field (WAV/WebM), transcribes it locally with Whisper and returns
 * `{ text }`. Registered as a plain Hono handler: the multipart binary schema
 * of @hono/zod-openapi does not play well with the strict TypedResponse
 * contract, and the global `/api/v1/*` middleware (cors, auth, body limit,
 * rate limit, logger) applies the same way.
 */
export function createTranscribeRoute(transcriptionService: TranscriptionService) {
    const app = new Hono()
    const maxTranscribeSize = getMaxBodySize()

    // Enforce the size limit on the actual stream (the global middleware only
    // checks the declared content-length, which chunked requests can bypass).
    app.use(
        "/chat/transcribe",
        bodyLimit({
            maxSize: maxTranscribeSize,
            onError: (c) =>
                c.json(
                    {
                        error: "Payload Too Large",
                        message: `Request body exceeds the maximum size of ${maxTranscribeSize} bytes`,
                    },
                    413
                ),
        })
    )

    app.post("/chat/transcribe", async (c) => {
        const formData = await c.req.formData()
        const audio = formData.get("audio")
        if (!audio || !(audio instanceof File)) {
            return c.json(
                { error: "Missing audio file", message: "El campo 'audio' es obligatorio" },
                400
            )
        }

        try {
            const bytes = Buffer.from(await audio.arrayBuffer())
            const text = await transcriptionService.transcribe(bytes, audio.type)
            return c.json({ text })
        } catch (err) {
            // Never leak internal details (model paths, HF urls, etc.) to the
            // client; the detail is already logged by the transcription service.
            log.error({ err }, "transcription request failed")
            return c.json(
                { error: "Transcription failed", message: "No se pudo transcribir el audio" },
                500
            )
        }
    })

    return app
}