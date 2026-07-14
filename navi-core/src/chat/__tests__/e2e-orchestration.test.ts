import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { randomUUID } from "node:crypto"
import { createV1Routes } from "../../routes/v1/index.js"
import { ChatService } from "../chat-service.js"
import { DynamicSystemPromptBuilder } from "../../prompts/dynamic-system-prompt.js"
import { createMockToolExecutor } from "../../test/mocks/mcp-service.mock.js"
import type { SessionRepository } from "../../db/repositories/session.repository.js"
import type { MessageRepository } from "../../db/repositories/message.repository.js"
import type { ApprovalRepository } from "../../db/repositories/approval.repository.js"
import type { AIProvider } from "../../providers/ai-provider.js"
import type { MemoryRepository } from "../../memory/memory-repository.js"

function createAsyncIterable<T>(chunks: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        next: async () => {
          if (i >= chunks.length) return { done: true, value: undefined as T }
          return { value: chunks[i++], done: false }
        },
        return: async () => ({ done: true, value: undefined as T }),
      }
    },
  }
}

const mockStreamText = vi.fn()
const mockGenerateText = vi.fn().mockResolvedValue({ text: "Resumen de prueba." })

vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  isStepCount: () => () => true,
}))

describe("e2e orchestration", () => {
  let sessionRepo: SessionRepository
  let messageRepo: MessageRepository
  let approvalRepo: ApprovalRepository
  let memoryRepo: MemoryRepository
  let sessionId: string
  let app: ReturnType<typeof createV1Routes>

  beforeEach(() => {
    vi.clearAllMocks()

    const provider: AIProvider = {
      name: "openai" as never,
      getModel: vi.fn().mockReturnValue({} as never),
    }

    const toolExecutor = createMockToolExecutor({
      getEnabledTools: async () => ({
        test_tool: {
          description: "Test tool",
          inputSchema: { safeParse: () => ({ success: true }) } as never,
          execute: async () => ({ result: "ok" }),
        },
      }),
    })

    const sessionRepoMock: SessionRepository = {
      create: vi.fn(),
      getById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }

    const messageRepoMock: MessageRepository = {
      create: vi.fn(),
      listBySession: vi.fn(),
      listBySessionChronological: vi.fn().mockResolvedValue([]),
      listAllBySessionChronological: vi.fn().mockResolvedValue([]),
    }

    const approvalRepoMock: ApprovalRepository = {
      create: vi.fn(),
      getById: vi.fn(),
      listPendingBySession: vi.fn(),
      updateStatus: vi.fn(),
    }

    const memoryRepoMock: MemoryRepository = {
      getById: vi.fn(),
      getByFilePath: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      search: vi.fn(),
      reindexAll: vi.fn(),
    } as unknown as MemoryRepository

    sessionRepo = sessionRepoMock
    messageRepo = messageRepoMock
    approvalRepo = approvalRepoMock
    memoryRepo = memoryRepoMock
    sessionId = randomUUID()

    vi.mocked(sessionRepo.getById).mockResolvedValue({
      id: sessionId,
      title: "E2E Test",
      contextSummary: null,
      lastCompactedMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const systemPromptBuilder = new DynamicSystemPromptBuilder({
      basePrompt: "Eres Navi.",
      toolExecutor,
    })

    const chatService = new ChatService({
      provider,
      modelId: "test-model",
      toolExecutor,
      systemPromptBuilder,
      sessionRepository: sessionRepoMock,
      messageRepository: messageRepoMock,
      approvalRepository: approvalRepoMock,
    })

    app = createV1Routes({
      chatService,
      toolExecutor,
      sessionRepository: sessionRepo,
      messageRepository: messageRepo,
      memoryRepository: memoryRepo,
    })

    process.env.MASTER_TOKEN = "test-token"
  })

  afterEach(() => {
    delete process.env.MASTER_TOKEN
  })

  async function readSseBody(res: Response): Promise<string[]> {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    const events: string[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      events.push(decoder.decode(value, { stream: true }))
    }
    return events
  }

  it("completes a full chat → tool-approval → approval → response flow", async () => {
    const approvalId = randomUUID()
    const toolCallId = randomUUID()

    // First streamText call (initial chat): emits text-delta + tool-approval-request
    mockStreamText.mockReturnValueOnce({
      fullStream: createAsyncIterable([
        { type: "text-delta", text: "Hola, veamos qué herramienta usar." },
        {
          type: "tool-approval-request",
          approvalId,
          toolCall: { toolCallId, toolName: "test_tool", input: { arg: "value" } },
        },
      ]),
      responseMessages: Promise.resolve([
        { role: "assistant", content: [{ type: "text", text: "Respuesta inicial" }] },
      ]),
    })

    // Post initial chat message
    const chatRes = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ sessionId, message: "Ejecuta una herramienta" }),
    })
    expect(chatRes.status).toBe(200)
    expect(chatRes.headers.get("Content-Type")).toBe("text/event-stream")

    // Read SSE events from the first stream
    const firstEvents = await readSseBody(chatRes)
    const allData = firstEvents.join("")

    expect(allData).toContain("Hola, veamos qué herramienta usar")
    expect(allData).toContain('event: tool-approval-request')
    expect(allData).toContain(approvalId)
    expect(allData).toContain('event: done')
    expect(allData).toContain('"reason":"awaiting-approval"')

    // Verify approval persisted
    expect(approvalRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: approvalId,
        sessionId,
        toolCallId,
        toolName: "test_tool",
        status: "pending",
      }),
    )

    // Mock approval repo responses for the second phase
    vi.mocked(approvalRepo.listPendingBySession).mockResolvedValue([
      {
        id: approvalId,
        sessionId,
        toolCallId,
        toolName: "test_tool",
        input: { arg: "value" } as never,
        description: "Test description",
        status: "pending",
        reason: null,
        signature: null,
        decidedAt: null,
        createdAt: new Date(),
      },
    ])

    vi.mocked(approvalRepo.getById).mockResolvedValue({
      id: approvalId,
      sessionId,
      toolCallId,
      toolName: "test_tool",
      input: { arg: "value" } as never,
      description: "Test description",
      status: "pending",
      reason: null,
      signature: null,
      decidedAt: null,
      createdAt: new Date(),
    })

    vi.mocked(approvalRepo.updateStatus).mockResolvedValue({
      id: approvalId,
      sessionId,
      toolCallId,
      toolName: "test_tool",
      input: { arg: "value" } as never,
      description: null,
      status: "approved",
      reason: null,
      signature: null,
      decidedAt: new Date(),
      createdAt: new Date(),
    })

    // Second streamText call (approval response): emits text-delta + done
    mockStreamText.mockReturnValueOnce({
      fullStream: createAsyncIterable([
        { type: "text-delta", text: "Herramienta ejecutada correctamente." },
      ]),
      responseMessages: Promise.resolve([
        { role: "tool", content: [{ type: "tool-result", toolName: "test_tool", output: { ok: true } }] },
        { role: "assistant", content: [{ type: "text", text: "Herramienta ejecutada correctamente." }] },
      ]),
    })

    // Post approval response
    const approvalRes = await app.request("/chat/approvals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        sessionId,
        responses: [{ approvalId, approved: true }],
      }),
    })
    expect(approvalRes.status).toBe(200)

    // Read SSE events from the second stream
    const secondEvents = await readSseBody(approvalRes)
    const secondData = secondEvents.join("")
    expect(secondData).toContain("Herramienta ejecutada correctamente.")
    expect(secondData).toContain('"reason":"complete"')
  })

  it("does not emit tool-approval-request for automatic approvals", async () => {
    mockStreamText.mockReturnValueOnce({
      fullStream: createAsyncIterable([
        { type: "text-delta", text: "Voy a consultar la wiki." },
        {
          type: "tool-approval-request",
          isAutomatic: true,
          approvalId: randomUUID(),
          toolCall: { toolCallId: randomUUID(), toolName: "read_wiki_structure", input: { repoName: "foo/bar" } },
        },
        {
          type: "tool-result",
          toolCallId: randomUUID(),
          toolName: "read_wiki_structure",
          output: { ok: true },
        },
      ]),
      responseMessages: Promise.resolve([
        { role: "assistant", content: [{ type: "text", text: "Voy a consultar la wiki." }] },
      ]),
    })

    const res = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ sessionId, message: "Consulta wiki" }),
    })
    expect(res.status).toBe(200)

    const events = await readSseBody(res)
    const allData = events.join("")

    expect(allData).toContain("Voy a consultar la wiki.")
    expect(allData).not.toContain("event: tool-approval-request")
    expect(allData).toContain("event: tool-result")
    expect(allData).toContain('"reason":"complete"')
  })

  it("returns 400 when not all pending approvals are answered", async () => {
    const approvalId1 = randomUUID()
    const approvalId2 = randomUUID()
    const toolCallId1 = randomUUID()
    const toolCallId2 = randomUUID()

    mockStreamText.mockReturnValueOnce({
      fullStream: createAsyncIterable([
        { type: "text-delta", text: "Necesito dos herramientas." },
        {
          type: "tool-approval-request",
          approvalId: approvalId1,
          toolCall: { toolCallId: toolCallId1, toolName: "test_tool", input: { arg: "value1" } },
        },
        {
          type: "tool-approval-request",
          approvalId: approvalId2,
          toolCall: { toolCallId: toolCallId2, toolName: "test_tool", input: { arg: "value2" } },
        },
      ]),
      responseMessages: Promise.resolve([
        { role: "assistant", content: [{ type: "text", text: "Necesito dos herramientas." }] },
      ]),
    })

    const chatRes = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ sessionId, message: "Ejecuta dos herramientas" }),
    })
    expect(chatRes.status).toBe(200)

    vi.mocked(approvalRepo.listPendingBySession).mockResolvedValue([
      {
        id: approvalId1,
        sessionId,
        toolCallId: toolCallId1,
        toolName: "test_tool",
        input: { arg: "value1" } as never,
        description: "Test description",
        status: "pending",
        reason: null,
        signature: null,
        decidedAt: null,
        createdAt: new Date(),
      },
      {
        id: approvalId2,
        sessionId,
        toolCallId: toolCallId2,
        toolName: "test_tool",
        input: { arg: "value2" } as never,
        description: "Test description",
        status: "pending",
        reason: null,
        signature: null,
        decidedAt: null,
        createdAt: new Date(),
      },
    ])

    const approvalRes = await app.request("/chat/approvals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        sessionId,
        responses: [{ approvalId: approvalId1, approved: true }],
      }),
    })
    expect(approvalRes.status).toBe(400)
    const body = await approvalRes.json()
    expect(body.error).toContain("All pending tool approvals")
    expect(body.missingApprovalIds).toContain(approvalId2)
  })

  it("returns 400 with invalid body", async () => {
    const res = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})
