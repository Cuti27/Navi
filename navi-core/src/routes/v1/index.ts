import { OpenAPIHono } from "@hono/zod-openapi"
import { swaggerUI } from "@hono/swagger-ui"
import type { ChatService } from "../../chat/chat-service.js"
import type { ToolExecutor } from "../../mcp/tool-executor.js"
import type { SessionRepository } from "../../db/repositories/session.repository.js"
import type { MessageRepository } from "../../db/repositories/message.repository.js"
import type { MemoryRepository } from "../../memory/memory-repository.js"
import { createChatRoute } from "./chat.route.js"
import { createApprovalRoute } from "./approval.route.js"
import { createMcpRoute } from "./mcp.route.js"
import { createSessionRoute } from "./session.route.js"
import { createMemoryRoute } from "./memory.route.js"

export interface V1RoutesOptions {
    chatService: ChatService
    toolExecutor: ToolExecutor
    sessionRepository: SessionRepository
    messageRepository: MessageRepository
    memoryRepository: MemoryRepository
}

export function createV1Routes(options: V1RoutesOptions) {
    const app = new OpenAPIHono()

    app.route("/", createChatRoute(options.chatService))
    app.route("/", createApprovalRoute(options.chatService))
    app.route("/", createMcpRoute(options.toolExecutor))
    app.route("/", createSessionRoute(options.sessionRepository, options.messageRepository))
    app.route("/", createMemoryRoute(options.memoryRepository))

    if (process.env.NODE_ENV && process.env.NODE_ENV !== "production") {
        app.doc("/openapi.json", {
            openapi: "3.0.0",
            info: {
                version: "1.0.0",
                title: "Navi Core API",
            },
            servers: [
                { url: "/api/v1" },
            ],
        })

        app.get("/docs", swaggerUI({ url: "/api/v1/openapi.json" }))
    }

    return app
}
