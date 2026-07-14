import { describe, it, expect, vi, beforeEach } from "vitest"
import { createSessionRoute } from "../session.route.js"
import { randomUUID } from "node:crypto"
import type { SessionRepository } from "../../../db/repositories/session.repository.js"
import type { MessageRepository } from "../../../db/repositories/message.repository.js"

describe("createSessionRoute", () => {
  let sessionRepo: SessionRepository
  let messageRepo: MessageRepository
  let app: ReturnType<typeof createSessionRoute>

  beforeEach(() => {
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
    app = createSessionRoute(sessionRepo, messageRepo)
  })

  it("GET /sessions returns session list", async () => {
    vi.mocked(sessionRepo.list).mockResolvedValue([])
    const res = await app.request("/sessions")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("POST /sessions creates a session", async () => {
    const fakeSession = {
      id: randomUUID(),
      title: "New chat",
      contextSummary: null,
      lastCompactedMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(sessionRepo.create).mockResolvedValue(fakeSession)

    const res = await app.request("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New chat" }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(fakeSession.id)
    expect(body.title).toBe("New chat")
  })

  it("POST /sessions creates session with default title", async () => {
    const fakeSession = {
      id: randomUUID(),
      title: "Nueva conversación",
      contextSummary: null,
      lastCompactedMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(sessionRepo.create).mockResolvedValue(fakeSession)

    const res = await app.request("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.title).toBe("Nueva conversación")
  })

  it("GET /sessions/:id returns session with messages", async () => {
    const sessionId = randomUUID()
    vi.mocked(sessionRepo.getById).mockResolvedValue({
      id: sessionId,
      title: "Test",
      contextSummary: null,
      lastCompactedMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(messageRepo.listBySessionChronological).mockResolvedValue([])

    const res = await app.request(`/sessions/${sessionId}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session.id).toBe(sessionId)
    expect(body.messages).toEqual([])
  })

  it("GET /sessions/:id returns 404 for missing session", async () => {
    vi.mocked(sessionRepo.getById).mockResolvedValue(undefined)
    const res = await app.request(`/sessions/${randomUUID()}`)
    expect(res.status).toBe(404)
  })

  it("PATCH /sessions/:id updates session title", async () => {
    const sessionId = randomUUID()
    vi.mocked(sessionRepo.getById).mockResolvedValue({
      id: sessionId,
      title: "Old",
      contextSummary: null,
      lastCompactedMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(sessionRepo.getById).mockResolvedValueOnce({
      id: sessionId,
      title: "Updated",
      contextSummary: null,
      lastCompactedMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request(`/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    })
    expect(res.status).toBe(200)
  })

  it("DELETE /sessions/:id deletes session", async () => {
    const sessionId = randomUUID()
    vi.mocked(sessionRepo.getById).mockResolvedValue({
      id: sessionId,
      title: "Test",
      contextSummary: null,
      lastCompactedMessageId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const res = await app.request(`/sessions/${sessionId}`, { method: "DELETE" })
    expect(res.status).toBe(204)
  })

  it("DELETE /sessions/:id returns 404 for missing session", async () => {
    vi.mocked(sessionRepo.getById).mockResolvedValue(undefined)
    const res = await app.request(`/sessions/${randomUUID()}`, { method: "DELETE" })
    expect(res.status).toBe(404)
  })
})
