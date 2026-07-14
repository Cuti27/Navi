import { z, OpenAPIHono, createRoute } from "@hono/zod-openapi"
import type { ChatService } from "../../chat/chat-service.js"

const ChatRequestSchema = z.object({
    sessionId: z.string().uuid("sessionId is required"),
    message: z.string().min(1, "Message is required"),
    cancelPendingApprovals: z.boolean().optional().openapi("CancelPendingApprovals"),
}).openapi("ChatRequest")

const ChatResponseSchema = z.string().openapi("ChatResponse")

export function createChatRoute(chatService: ChatService) {
    const app = new OpenAPIHono()

    const route = createRoute({
        method: "post",
        path: "/chat",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: ChatRequestSchema,
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Streaming text response (SSE)",
                content: {
                    "text/plain": {
                        schema: ChatResponseSchema,
                    },
                },
            },
            404: {
                description: "Session not found",
            },
        },
    })

    app.openapi(route, async (c) => {
        const { sessionId, message, cancelPendingApprovals } = c.req.valid("json")
        // The streaming response is a plain Response, which does not match the
        // strict TypedResponse expected by OpenAPIHono. Casting is safe here
        // because the route schema documents the SSE text/plain contract.
        return chatService.streamResponse(sessionId, message, cancelPendingApprovals) as any
    })

    return app
}
