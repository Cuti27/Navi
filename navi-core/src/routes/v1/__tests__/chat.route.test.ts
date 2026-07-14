import { describe, it, expect, vi, beforeEach } from "vitest"
import { createChatRoute } from "../chat.route.js"
import { randomUUID } from "node:crypto"
import type { ChatService } from "../../../chat/chat-service.js"

function createMockChatService(): ChatService {
  return {
    streamResponse: vi.fn(),
    streamApprovalResponse: vi.fn(),
    listPendingApprovals: vi.fn(),
  } as unknown as ChatService
}

describe("createChatRoute", () => {
  let chatService: ChatService
  let app: ReturnType<typeof createChatRoute>

  beforeEach(() => {
    chatService = createMockChatService()
    app = createChatRoute(chatService)
  })

  it("POST /chat streams a response", async () => {
    const sessionId = randomUUID()
    const sseResponse = new Response("data: hello\n\nevent: done\ndata: {\"reason\":\"complete\"}\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    })
    vi.mocked(chatService.streamResponse).mockResolvedValue(sseResponse)

    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: "Hello" }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("text/event-stream")
    expect(chatService.streamResponse).toHaveBeenCalledWith(sessionId, "Hello", undefined)
  })

  it("POST /chat forwards cancelPendingApprovals flag", async () => {
    const sessionId = randomUUID()
    const sseResponse = new Response("data: hello\n\nevent: done\ndata: {\"reason\":\"complete\"}\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    })
    vi.mocked(chatService.streamResponse).mockResolvedValue(sseResponse)

    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: "Hello", cancelPendingApprovals: true }),
    })
    expect(res.status).toBe(200)
    expect(chatService.streamResponse).toHaveBeenCalledWith(sessionId, "Hello", true)
  })

  it("POST /chat returns 400 with empty message", async () => {
    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: randomUUID(), message: "" }),
    })
    expect(res.status).toBe(400)
  })

  it("POST /chat returns 400 without sessionId", async () => {
    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    })
    expect(res.status).toBe(400)
  })
})
