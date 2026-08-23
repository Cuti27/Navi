import { z, OpenAPIHono, createRoute } from "@hono/zod-openapi"
import type { FileStore } from "../../files/file-store.js"
import type { FileRepository } from "../../db/repositories/file.repository.js"

const FileParamsSchema = z.object({
    id: z.string().uuid(),
}).openapi("FileParams")

/**
 * Serves generated file blobs. The global masterAuth middleware (applied in
 * index.ts) protects this route, so no per-route auth is added here.
 */
export function createFileRoute(
    fileStore: FileStore,
    fileRepository: FileRepository
) {
    const app = new OpenAPIHono()

    const getRoute = createRoute({
        method: "get",
        path: "/files/:id",
        request: { params: FileParamsSchema },
        responses: {
            200: {
                description: "File content",
                content: {
                    "*/*": {
                        schema: z.instanceof(Blob),
                    },
                },
            },
            404: { description: "File not found" },
        },
    })

    app.openapi(getRoute, async (c) => {
        const { id } = c.req.valid("param")
        const file = await fileRepository.getById(id)
        if (!file) {
            return c.json({ error: "File not found" }, 404)
        }
        let buffer: Buffer
        try {
            buffer = await fileStore.readFile(id)
        } catch {
            return c.json({ error: "File not found" }, 404)
        }
        return new Response(new Uint8Array(buffer), {
            headers: {
                "Content-Type": file.mediaType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        })
    })

    return app
}
