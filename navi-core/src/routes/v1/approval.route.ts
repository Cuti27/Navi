import { z, OpenAPIHono, createRoute } from "@hono/zod-openapi"
import type { ChatService } from "../../chat/chat-service.js"

const ApprovalResponseItemSchema = z.object({
    approvalId: z.string(),
    approved: z.boolean(),
    reason: z.string().optional(),
}).openapi("ApprovalResponseItem")

const SubmitApprovalsBodySchema = z.object({
    sessionId: z.string().uuid(),
    responses: z.array(ApprovalResponseItemSchema).min(1),
}).openapi("SubmitApprovalsBody")

const PendingApprovalSchema = z.object({
    id: z.string(),
    sessionId: z.string().uuid(),
    toolCallId: z.string(),
    toolName: z.string(),
    input: z.unknown(),
    description: z.string().nullable().optional(),
    status: z.enum(["pending", "approved", "denied"]),
    reason: z.string().nullable().optional(),
    signature: z.string().nullable().optional(),
    createdAt: z.date(),
}).openapi("PendingApproval")

export function createApprovalRoute(chatService: ChatService) {
    const app = new OpenAPIHono()

    const submitRoute = createRoute({
        method: "post",
        path: "/chat/approvals",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: SubmitApprovalsBodySchema,
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Streaming resumed response (SSE)",
            },
            400: { description: "Invalid request" },
            404: { description: "Session or approval not found" },
            409: { description: "Approval already decided" },
        },
    })

    app.openapi(submitRoute, async (c) => {
        const { sessionId, responses } = c.req.valid("json")
        return chatService.streamApprovalResponse(sessionId, responses) as any
    })

    const listRoute = createRoute({
        method: "get",
        path: "/chat/approvals",
        request: {
            query: z.object({
                sessionId: z.string().uuid(),
            }).openapi("ListPendingApprovalsQuery"),
        },
        responses: {
            200: {
                description: "List of pending tool approvals for the session",
                content: {
                    "application/json": {
                        schema: z.array(PendingApprovalSchema).openapi("PendingApprovalsList"),
                    },
                },
            },
            400: { description: "Invalid sessionId" },
        },
    })

    app.openapi(listRoute, async (c) => {
        const { sessionId } = c.req.valid("query")
        const pending = await chatService.listPendingApprovals(sessionId)
        return c.json(pending)
    })

    return app
}
