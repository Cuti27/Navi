import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { randomUUID } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createV1Routes } from "../../routes/v1/index.js"
import { ChatService } from "../chat-service.js"
import { createMockToolExecutor } from "../../test/mocks/mcp-service.mock.js"
import { FileStore } from "../../files/file-store.js"
import type { SessionRepository } from "../../db/repositories/session.repository.js"
import type { MessageRepository } from "../../db/repositories/message.repository.js"
import type { ApprovalRepository } from "../../db/repositories/approval.repository.js"
import type { FileRepository } from "../../db/repositories/file.repository.js"
import type { MemoryRepository } from "../../memory/memory-repository.js"
import type { AIProvider } from "../../providers/ai-provider.js"

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

vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  generateText: vi.fn().mockResolvedValue({ text: "Resumen." }),
  isStepCount: () => () => true,
}))

describe("file streaming", () => {
  let sessionRepo: SessionRepository
  let messageRepo: MessageRepository
  let approvalRepo: ApprovalRepository
  let fileRepo: FileRepository
  let fileStore: FileStore
  let memoryRepo: MemoryRepository
  let sessionId: string
  let app: ReturnType<typeof createV1Routes>
  let filesDir: string

  beforeEach(() => {
    vi.clearAllMocks()

    filesDir = mkdtempSync(join(tmpdir(), "navi-stream-files-"))
    fileStore = new FileStore(filesDir)

    const provider: AIProvider = {
      name: "openai" as never,
      getModel: vi.fn().mockReturnValue({} as never),
    }

    const toolExecutor = createMockToolExecutor({
      getEnabledTools: async () => ({}),
    })

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
      listBySessionChronological: vi.fn().mockResolvedValue([]),
      listAllBySessionChronological: vi.fn().mockResolvedValue([]),
    }
    approvalRepo = {
      create: vi.fn(),
      getById: vi.fn(),
      listPendingBySession: vi.fn(),
      updateStatus: vi.fn(),
    }
    fileRepo = {
      create: vi.fn(),
      getById: vi.fn(),
    }
    memoryRepo = {
      getById: vi.fn(),
      getByFilePath: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      search: vi.fn(),
      reindexAll: vi.fn(),
    } as unknown as MemoryRepository

    sessionId = randomUUID()

    vi.mocked(sessionRepo.getById).mockResolvedValue({
      id: sessionId,
      title: "Files Test",
      contextSummary: null,
      lastCompactedMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const chatService = new ChatService({
      provider,
      modelId: "test-model",
      toolExecutor,
      sessionRepository: sessionRepo,
      messageRepository: messageRepo,
      approvalRepository: approvalRepo,
      fileStore,
      fileRepository: fileRepo,
    })

    app = createV1Routes({
      chatService,
      toolExecutor,
      sessionRepository: sessionRepo,
      messageRepository: messageRepo,
      memoryRepository: memoryRepo,
      fileStore,
      fileRepository: fileRepo,
    })

    process.env.MASTER_TOKEN = "test-token"
  })

  afterEach(() => {
    delete process.env.MASTER_TOKEN
    rmSync(filesDir, { recursive: true, force: true })
  })

  async function readSseBody(res: Response): Promise<string> {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let all = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      all += decoder.decode(value, { stream: true })
    }
    return all
  }

  it("emits event:file, persists blob + row, and attaches file part to assistant message", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

    mockStreamText.mockReturnValueOnce({
      fullStream: createAsyncIterable([
        { type: "text-delta", text: "Aquí tienes la imagen:" },
        {
          type: "file",
          file: { base64: "iVBORw0KGgo=", uint8Array: bytes, mediaType: "image/png" },
        },
      ]),
      responseMessages: Promise.resolve([
        { role: "assistant", content: [{ type: "text", text: "Aquí tienes la imagen:" }] },
      ]),
    })

    const res = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ sessionId, message: "Genera una imagen" }),
    })
    expect(res.status).toBe(200)

    const allData = await readSseBody(res)
    expect(allData).toContain("event: file")
    expect(allData).toContain("mediaType")
    expect(allData).toContain("/api/v1/files/")

    // Blob persisted on disk + row in the repository
    const createdFile = vi.mocked(fileRepo.create).mock.calls[0][0]
    expect(createdFile).toMatchObject({
      sessionId,
      mediaType: "image/png",
      size: bytes.byteLength,
    })
    expect(createdFile.id).toBeDefined()
    expect(createdFile.id).toMatch(/^[0-9a-f-]{36}$/)

    const blob = await fileStore.readFile(createdFile.id)
    expect(blob).toEqual(Buffer.from(bytes))

    // Assistant message persisted with the file part attached
    const assistantCreate = vi
      .mocked(messageRepo.create)
      .mock.calls.find((call) => call[0].role === "assistant")!
    const parts = assistantCreate[0].parts as Array<{ type: string; id?: string; mediaType?: string }>
    const filePart = parts.find((p) => p.type === "file")
    expect(filePart).toMatchObject({
      id: createdFile.id,
      mediaType: "image/png",
    })
  })

  it("still streams fine when fileStore/fileRepository are not configured", async () => {
    mockStreamText.mockReturnValueOnce({
      fullStream: createAsyncIterable([
        { type: "text-delta", text: "Hola" },
        {
          type: "file",
          file: { base64: "aGVsbG8=", uint8Array: new Uint8Array([0x68]), mediaType: "text/plain" },
        },
      ]),
      responseMessages: Promise.resolve([
        { role: "assistant", content: [{ type: "text", text: "Hola" }] },
      ]),
    })

    const bareChatService = new ChatService({
      provider: { name: "openai" as never, getModel: vi.fn().mockReturnValue({} as never) },
      modelId: "test-model",
      sessionRepository: sessionRepo,
      messageRepository: messageRepo,
      approvalRepository: approvalRepo,
    })
    const bareApp = createV1Routes({
      chatService: bareChatService,
      toolExecutor: createMockToolExecutor({ getEnabledTools: async () => ({}) }),
      sessionRepository: sessionRepo,
      messageRepository: messageRepo,
      memoryRepository: memoryRepo,
    })

    const res = await bareApp.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ sessionId, message: "Hola" }),
    })
    expect(res.status).toBe(200)
    const allData = await readSseBody(res)
    expect(allData).toContain("Hola")
  })
})
