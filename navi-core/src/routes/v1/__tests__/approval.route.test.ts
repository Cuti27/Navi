import { describe, it, expect, vi, beforeEach } from "vitest"
import { createApprovalRoute } from "../approval.route.js"
import { randomUUID } from "node:crypto"
import type { ChatService } from "../../../chat/chat-service.js"

function createMockChatService(): ChatService {
  return {
    streamResponse: vi.fn(),
    streamApprovalResponse: vi.fn(),
    listPendingApprovals: vi.fn(),
  } as unknown as ChatService
}

describe("createApprovalRoute", () => {
  let chatService: ChatService
  let app: ReturnType<typeof createApprovalRoute>

  beforeEach(() => {
    chatService = createMockChatService()
    app = createApprovalRoute(chatService)
  })

  it("POST /chat/approvals returns 400 when body is empty", async () => {
    const res = await app.request("/chat/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("POST /chat/approvals streams approval response", async () => {
    const sessionId = randomUUID()
    const sseResponse = new Response("data: test\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    })
    vi.mocked(chatService.streamApprovalResponse).mockResolvedValue(sseResponse)

    const res = await app.request("/chat/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        responses: [{ approvalId: "a1", approved: true }],
      }),
    })
    expect(res.status).toBe(200)
    expect(chatService.streamApprovalResponse).toHaveBeenCalledWith(sessionId, [
      { approvalId: "a1", approved: true },
    ])
  })

  it("POST /chat/approvals returns 400 with empty responses array", async () => {
    const res = await app.request("/chat/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: randomUUID(), responses: [] }),
    })
    expect(res.status).toBe(400)
  })

  it("GET /chat/approvals lists pending approvals for a session", async () => {
    const sessionId = randomUUID()
    vi.mocked(chatService.listPendingApprovals).mockResolvedValue([])

    const res = await app.request(`/chat/approvals?sessionId=${sessionId}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(chatService.listPendingApprovals).toHaveBeenCalledWith(sessionId)
  })
})
