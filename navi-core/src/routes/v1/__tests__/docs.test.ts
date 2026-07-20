import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createV1Routes } from "../index.js"
import type { ChatService } from "../../../chat/chat-service.js"
import type { ToolExecutor } from "../../../mcp/tool-executor.js"
import type { SessionRepository } from "../../../db/repositories/session.repository.js"
import type { MessageRepository } from "../../../db/repositories/message.repository.js"
import type { MemoryRepository } from "../../../memory/memory-repository.js"
import { vi } from "vitest"

function createMockV1Options() {
    return {
        chatService: {} as ChatService,
        toolExecutor: {} as ToolExecutor,
        sessionRepository: {} as SessionRepository,
        messageRepository: {} as MessageRepository,
        memoryRepository: {} as MemoryRepository,
    }
}

describe("Swagger docs", () => {
    let originalNodeEnv: string | undefined

    beforeEach(() => {
        originalNodeEnv = process.env.NODE_ENV
    })

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv
    })

    it("serves /docs in development", async () => {
        process.env.NODE_ENV = "development"
        const app = createV1Routes(createMockV1Options())
        const res = await app.request("/docs")
        expect(res.status).toBe(200)
    })

    it("serves /openapi.json in development", async () => {
        process.env.NODE_ENV = "development"
        const app = createV1Routes(createMockV1Options())
        const res = await app.request("/openapi.json")
        expect(res.status).toBe(200)
    })

    it("returns 404 for /docs in production", async () => {
        process.env.NODE_ENV = "production"
        const app = createV1Routes(createMockV1Options())
        const res = await app.request("/docs")
        expect(res.status).toBe(404)
    })

    it("returns 404 for /openapi.json in production", async () => {
        process.env.NODE_ENV = "production"
        const app = createV1Routes(createMockV1Options())
        const res = await app.request("/openapi.json")
        expect(res.status).toBe(404)
    })

    it("returns 404 when NODE_ENV is unset (treated as production by default)", async () => {
        delete process.env.NODE_ENV
        const app = createV1Routes(createMockV1Options())
        const res = await app.request("/docs")
        expect(res.status).toBe(404)
    })
})
