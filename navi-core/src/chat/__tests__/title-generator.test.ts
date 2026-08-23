import { describe, it, expect, vi, beforeEach } from "vitest"
import { LlmTitleGenerator } from "../title-generator.js"
import type { SessionRepository } from "../../db/repositories/session.repository.js"
import type { MessageRepository } from "../../db/repositories/message.repository.js"
import type { AIProvider } from "../../providers/ai-provider.js"
import type { Session, Message } from "../../db/schema.js"

vi.mock("ai", () => ({
    generateText: vi.fn().mockResolvedValue({ text: "Título generado" }),
}))

function createMockSession(id: string, overrides: Partial<Session> = {}): Session {
    return {
        id,
        title: "Nueva conversación",
        contextSummary: null,
        lastCompactedMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }
}

function createMockMessage(id: string, sessionId: string, content = "Hola"): Message {
    return {
        id,
        sessionId,
        role: "user",
        content,
        imageUrl: null,
        toolCalls: null,
        parts: null,
        createdAt: new Date(),
    }
}

function createMockProvider(): AIProvider {
    return {
        name: "openai" as never,
        getModel: vi.fn().mockReturnValue({} as never),
    }
}

describe("LlmTitleGenerator", () => {
    let sessionRepo: SessionRepository
    let messageRepo: MessageRepository
    let generator: LlmTitleGenerator

    beforeEach(() => {
        vi.clearAllMocks()

        sessionRepo = {
            create: vi.fn(),
            getById: vi.fn(),
            list: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        }

        messageRepo = {
            create: vi.fn(),
            listBySession: vi.fn(),
            listBySessionChronological: vi.fn(),
            listAllBySessionChronological: vi.fn(),
        }

        generator = new LlmTitleGenerator({
            provider: createMockProvider(),
            modelId: "test-model",
            sessionRepository: sessionRepo,
            messageRepository: messageRepo,
        })
    })

    it("generates a title via LLM when session is default and first message", async () => {
        vi.mocked(sessionRepo.getById).mockResolvedValue(createMockSession("s1"))
        vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue([
            createMockMessage("m1", "s1"),
        ])

        await generator.generateAndUpdate("s1", "Hola Navi")

        const { generateText } = await import("ai")
        expect(generateText).toHaveBeenCalledTimes(1)
        expect(sessionRepo.update).toHaveBeenCalledWith("s1", { title: "Título generado" })
    })

    it("falls back to heuristic when generateText throws", async () => {
        vi.mocked(sessionRepo.getById).mockResolvedValue(createMockSession("s1"))
        vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue([
            createMockMessage("m1", "s1"),
        ])
        const { generateText } = await import("ai")
        vi.mocked(generateText).mockRejectedValueOnce(new Error("timeout"))

        await generator.generateAndUpdate("s1", "Instala plex en el servidor")

        expect(sessionRepo.update).toHaveBeenCalledWith("s1", {
            title: "Instala plex en el servidor",
        })
    })

    it("falls back to heuristic when generateText returns empty text", async () => {
        vi.mocked(sessionRepo.getById).mockResolvedValue(createMockSession("s1"))
        vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue([
            createMockMessage("m1", "s1"),
        ])
        const { generateText } = await import("ai")
        vi.mocked(generateText).mockResolvedValueOnce({ text: "" })

        await generator.generateAndUpdate("s1", "Configura el servidor")

        expect(sessionRepo.update).toHaveBeenCalledWith("s1", {
            title: "Configura el servidor",
        })
    })

    it("does nothing when session title was already renamed", async () => {
        vi.mocked(sessionRepo.getById).mockResolvedValue(
            createMockSession("s1", { title: "Mi título personalizado" })
        )
        await generator.generateAndUpdate("s1", "Hola")

        expect(messageRepo.listAllBySessionChronological).not.toHaveBeenCalled()
        expect(sessionRepo.update).not.toHaveBeenCalled()
    })

    it("does nothing when it is not the first message", async () => {
        vi.mocked(sessionRepo.getById).mockResolvedValue(createMockSession("s1"))
        vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue([
            createMockMessage("m1", "s1"),
            createMockMessage("m2", "s1"),
        ])

        await generator.generateAndUpdate("s1", "Hola")

        const { generateText } = await import("ai")
        expect(generateText).not.toHaveBeenCalled()
        expect(sessionRepo.update).not.toHaveBeenCalled()
    })

    it("does nothing when the session does not exist", async () => {
        vi.mocked(sessionRepo.getById).mockResolvedValue(undefined)
        await generator.generateAndUpdate("missing", "Hola")

        expect(messageRepo.listAllBySessionChronological).not.toHaveBeenCalled()
        expect(sessionRepo.update).not.toHaveBeenCalled()
    })

    it("cleans the LLM title: strips quotes and truncates to maxWords", async () => {
        vi.mocked(sessionRepo.getById).mockResolvedValue(createMockSession("s1"))
        vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue([
            createMockMessage("m1", "s1"),
        ])
        const { generateText } = await import("ai")
        vi.mocked(generateText).mockResolvedValueOnce({
            text: '"configura un servidor de plex y hazlo accesible desde fuera"',
        })

        await generator.generateAndUpdate("s1", "Instala plex en el servidor")

        expect(sessionRepo.update).toHaveBeenCalledWith("s1", {
            title: "Configura un servidor de plex y",
        })
    })

    it("respects maxWords in the heuristic fallback", async () => {
        const short = new LlmTitleGenerator({
            provider: createMockProvider(),
            modelId: "test-model",
            sessionRepository: sessionRepo,
            messageRepository: messageRepo,
            maxWords: 2,
        })
        vi.mocked(sessionRepo.getById).mockResolvedValue(createMockSession("s1"))
        vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue([
            createMockMessage("m1", "s1"),
        ])
        const { generateText } = await import("ai")
        vi.mocked(generateText).mockRejectedValueOnce(new Error("timeout"))

        await short.generateAndUpdate("s1", "Quiero instalar plex y sonarr")

        expect(sessionRepo.update).toHaveBeenCalledWith("s1", { title: "Quiero instalar" })
    })
})