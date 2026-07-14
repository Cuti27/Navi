import { describe, it, expect, vi, beforeEach } from "vitest"
import { CompactionService } from "../compaction-service.js"
import type { SessionRepository } from "../../db/repositories/session.repository.js"
import type { MessageRepository } from "../../db/repositories/message.repository.js"
import type { AIProvider } from "../../providers/ai-provider.js"
import type { Session, Message } from "../../db/schema.js"

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({
    text: "Resumen compactado de la conversación.",
  }),
}))

function createMockSession(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    title: "Test",
    contextSummary: "Resumen anterior.",
    lastCompactedMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function createMockMessage(
  id: string,
  sessionId: string,
  index: number,
): Message {
  return {
    id,
    sessionId,
    role: "user",
    content: `Mensaje ${index}`,
    imageUrl: null,
    toolCalls: null,
    parts: null,
    createdAt: new Date(Date.now() + index * 1000),
  }
}

function createMockProvider(): AIProvider {
  return {
    name: "openai" as never,
    getModel: vi.fn().mockReturnValue({} as never),
  }
}

describe("CompactionService", () => {
  let sessionRepo: SessionRepository
  let messageRepo: MessageRepository
  let provider: AIProvider
  let service: CompactionService

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

    provider = createMockProvider()

    service = new CompactionService({
      provider,
      modelId: "test-model",
      sessionRepository: sessionRepo,
      messageRepository: messageRepo,
      threshold: 5,
      maxHistoryMessages: 3,
    })
  })

  it("does nothing when session is not found", async () => {
    vi.mocked(sessionRepo.getById).mockResolvedValue(undefined)
    await service.checkAndCompact("nonexistent")
    expect(messageRepo.listAllBySessionChronological).not.toHaveBeenCalled()
  })

  it("does nothing when message count is below maxHistoryMessages", async () => {
    vi.mocked(sessionRepo.getById).mockResolvedValue(createMockSession("s1"))
    vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue(
      Array.from({ length: 2 }, (_, i) =>
        createMockMessage(`m${i}`, "s1", i),
      ),
    )
    await service.checkAndCompact("s1")
    expect(sessionRepo.update).not.toHaveBeenCalled()
  })

  it("does nothing when messages since last compaction are below threshold", async () => {
    const session = createMockSession("s1", { lastCompactedMessageId: "m0" })
    vi.mocked(sessionRepo.getById).mockResolvedValue(session)
    // 4 messages total (> maxHistoryMessages=3), but only 3 since watermark m0
    vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue(
      Array.from({ length: 4 }, (_, i) =>
        createMockMessage(`m${i}`, "s1", i),
      ),
    )
    await service.checkAndCompact("s1")
    expect(sessionRepo.update).not.toHaveBeenCalled()
  })

  it("triggers compaction when threshold is exceeded", async () => {
    const session = createMockSession("s1", { lastCompactedMessageId: null })
    vi.mocked(sessionRepo.getById).mockResolvedValue(session)

    const messages = Array.from({ length: 10 }, (_, i) =>
      createMockMessage(`m${i}`, "s1", i),
    )
    vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue(messages)

    await service.checkAndCompact("s1")

    const { generateText } = await import("ai")
    expect(generateText).toHaveBeenCalled()
    expect(sessionRepo.update).toHaveBeenCalledWith("s1", expect.objectContaining({
      contextSummary: "Resumen compactado de la conversación.",
      lastCompactedMessageId: expect.any(String),
    }))
  })

  it("preserves existing summary when compacting", async () => {
    const session = createMockSession("s1", {
      lastCompactedMessageId: null,
      contextSummary: "Resumen anterior.",
    })
    vi.mocked(sessionRepo.getById).mockResolvedValue(session)

    const messages = Array.from({ length: 10 }, (_, i) =>
      createMockMessage(`m${i}`, "s1", i),
    )
    vi.mocked(messageRepo.listAllBySessionChronological).mockResolvedValue(messages)

    await service.checkAndCompact("s1")

    const { generateText } = await import("ai")
    const callArgs = vi.mocked(generateText).mock.calls[0][0]
    const prompt = callArgs.prompt as string
    expect(prompt).toContain("Resumen anterior")
    expect(prompt).toContain("Mensaje 0")
    expect(prompt).toContain("Mensaje 6")
  })

  it("recovers from compaction error gracefully", async () => {
    vi.mocked(sessionRepo.getById).mockRejectedValue(new Error("DB error"))
    await expect(service.checkAndCompact("s1")).resolves.not.toThrow()
  })
})
