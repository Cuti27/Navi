import { Hono } from "hono"
import type { TranscriptionService } from "../../chat/transcription-service.js"

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
            const message = err instanceof Error ? err.message : String(err)
            return c.json({ error: "Transcription failed", message }, 500)
        }
    })

    return app
}
