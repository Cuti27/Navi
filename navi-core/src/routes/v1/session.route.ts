import { randomUUID } from "node:crypto"
import { z, OpenAPIHono, createRoute } from "@hono/zod-openapi"
import type { SessionRepository } from "../../db/repositories/session.repository.js"
import type { MessageRepository } from "../../db/repositories/message.repository.js"

const SessionSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    contextSummary: z.string().nullable().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
}).openapi("Session")

const CreateSessionBodySchema = z.object({
    title: z.string().min(1).optional(),
}).openapi("CreateSessionBody")

const UpdateSessionBodySchema = z.object({
    title: z.string().min(1).optional(),
}).openapi("UpdateSessionBody")

const SessionParamsSchema = z.object({
    id: z.string().uuid(),
}).openapi("SessionParams")

const MessageSchema = z.object({
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    role: z.enum(["user", "assistant", "system", "tool"]),
    content: z.string(),
    imageUrl: z.string().nullable().optional(),
    toolCalls: z.unknown().optional(),
    parts: z.unknown().optional(),
    createdAt: z.date(),
}).openapi("Message")

export function createSessionRoute(
    sessionRepository: SessionRepository,
    messageRepository: MessageRepository
) {
    const app = new OpenAPIHono()

    const listRoute = createRoute({
        method: "get",
        path: "/sessions",
        responses: {
            200: {
                description: "List of sessions",
                content: {
                    "application/json": {
                        schema: z.array(SessionSchema).openapi("SessionsList"),
                    },
                },
            },
        },
    })

    app.openapi(listRoute, async (c) => {
        const sessions = await sessionRepository.list()
        return c.json(sessions)
    })

    const getRoute = createRoute({
        method: "get",
        path: "/sessions/:id",
        request: { params: SessionParamsSchema },
        responses: {
            200: {
                description: "Session with messages",
                content: {
                    "application/json": {
                        schema: z
                            .object({
                                session: SessionSchema,
                                messages: z.array(MessageSchema),
                            })
                            .openapi("SessionWithMessages"),
                    },
                },
            },
            404: { description: "Session not found" },
        },
    })

    app.openapi(getRoute, async (c) => {
        const { id } = c.req.valid("param")
        const session = await sessionRepository.getById(id)
        if (!session) {
            return c.json({ error: "Session not found" }, 404)
        }
        const messages = await messageRepository.listBySessionChronological(id)
        return c.json({ session, messages })
    })

    const postRoute = createRoute({
        method: "post",
        path: "/sessions",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: CreateSessionBodySchema,
                    },
                },
            },
        },
        responses: {
            201: {
                description: "Session created",
                content: {
                    "application/json": {
                        schema: SessionSchema,
                    },
                },
            },
        },
    })

    app.openapi(postRoute, async (c) => {
        const { title } = c.req.valid("json")
        const session = await sessionRepository.create({
            id: randomUUID(),
            title: title ?? "Nueva conversación",
        })
        return c.json(session, 201)
    })

    const patchRoute = createRoute({
        method: "patch",
        path: "/sessions/:id",
        request: {
            params: SessionParamsSchema,
            body: {
                content: {
                    "application/json": {
                        schema: UpdateSessionBodySchema,
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Session updated",
                content: {
                    "application/json": {
                        schema: SessionSchema,
                    },
                },
            },
            404: { description: "Session not found" },
        },
    })

    app.openapi(patchRoute, async (c) => {
        const { id } = c.req.valid("param")
        const { title } = c.req.valid("json")

        const existing = await sessionRepository.getById(id)
        if (!existing) {
            return c.json({ error: "Session not found" }, 404)
        }

        await sessionRepository.update(id, { title })
        const session = await sessionRepository.getById(id)
        return c.json(session)
    })

    const deleteRoute = createRoute({
        method: "delete",
        path: "/sessions/:id",
        request: { params: SessionParamsSchema },
        responses: {
            204: { description: "Session deleted" },
            404: { description: "Session not found" },
        },
    })

    app.openapi(deleteRoute, async (c) => {
        const { id } = c.req.valid("param")
        const existing = await sessionRepository.getById(id)
        if (!existing) {
            return c.json({ error: "Session not found" }, 404)
        }
        await sessionRepository.delete(id)
        return new Response(null, { status: 204 })
    })

    return app
}
