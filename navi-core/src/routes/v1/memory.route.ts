import { z, OpenAPIHono, createRoute } from "@hono/zod-openapi"
import type { MemoryRepository } from "../../memory/memory-repository.js"

const MemorySchema = z
    .object({
        id: z.string().uuid(),
        filePath: z.string(),
        title: z.string(),
        category: z.string(),
        content: z.string(),
        tags: z.array(z.string()),
        contentHash: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
    })
    .openapi("Memory")

const MemorySearchResultSchema = z
    .object({
        id: z.string().uuid(),
        filePath: z.string(),
        title: z.string(),
        category: z.string(),
        content: z.string(),
        tags: z.array(z.string()),
        excerpt: z.string().optional(),
        score: z.number(),
    })
    .openapi("MemorySearchResult")

const MemoryParamsSchema = z.object({
    id: z.string().uuid(),
}).openapi("MemoryParams")

export function createMemoryRoute(memoryRepository: MemoryRepository) {
    const app = new OpenAPIHono()

    const listRoute = createRoute({
        method: "get",
        path: "/memory",
        request: {
            query: z.object({
                category: z.string().optional(),
                limit: z.coerce.number().min(1).max(500).optional(),
            }),
        },
        responses: {
            200: {
                description: "List of memories",
                content: {
                    "application/json": {
                        schema: z.array(MemorySchema).openapi("MemoriesList"),
                    },
                },
            },
        },
    })

    app.openapi(listRoute, async (c) => {
        const { category, limit } = c.req.valid("query")
        const memories = await memoryRepository.list(category, limit)
        return c.json(memories)
    })

    const searchRoute = createRoute({
        method: "get",
        path: "/memory/search",
        request: {
            query: z.object({
                q: z.string().min(1),
                limit: z.coerce.number().min(1).max(20).optional(),
            }),
        },
        responses: {
            200: {
                description: "Search results",
                content: {
                    "application/json": {
                        schema: z.array(MemorySearchResultSchema).openapi("MemorySearchResults"),
                    },
                },
            },
        },
    })

    app.openapi(searchRoute, async (c) => {
        const { q, limit } = c.req.valid("query")
        const results = await memoryRepository.search(q, limit)
        return c.json(results)
    })

    const reindexRoute = createRoute({
        method: "post",
        path: "/memory/reindex",
        responses: {
            200: {
                description: "Reindex completed",
                content: {
                    "application/json": {
                        schema: z.object({ ok: z.boolean() }).openapi("ReindexResult"),
                    },
                },
            },
        },
    })

    app.openapi(reindexRoute, async (c) => {
        await memoryRepository.reindexAll()
        return c.json({ ok: true })
    })

    const deleteRoute = createRoute({
        method: "delete",
        path: "/memory/:id",
        request: { params: MemoryParamsSchema },
        responses: {
            204: { description: "Memory deleted" },
            404: { description: "Memory not found" },
        },
    })

    app.openapi(deleteRoute, async (c) => {
        const { id } = c.req.valid("param")
        const existing = await memoryRepository.getById(id)
        if (!existing) {
            return c.json({ error: "Memory not found" }, 404)
        }
        await memoryRepository.delete(existing.filePath)
        return new Response(null, { status: 204 })
    })

    return app
}
