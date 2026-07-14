import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { DrizzleSessionRepository } from "../session.repository.js"
import { DrizzleMessageRepository } from "../message.repository.js"
import { createTestDb } from "../../../test/setup.js"
import type { TestDb } from "../../../test/setup.js"
import type { DB } from "../../client.js"
import { buildSession, buildMessage } from "../../../test/factories.js"

describe("DrizzleMessageRepository", () => {
  let db: DB
  let testDb: TestDb
  let sessionRepo: DrizzleSessionRepository
  let messageRepo: DrizzleMessageRepository
  let sessionId: string

  beforeEach(() => {
    testDb = createTestDb()
    db = testDb.db
    sessionRepo = new DrizzleSessionRepository(db)
    messageRepo = new DrizzleMessageRepository(db)

    const session = buildSession()
    sessionRepo.create(session)
    sessionId = session.id
  })

  afterEach(() => {
    testDb.destroy()
  })

  it("creates and retrieves a message", async () => {
    const input = buildMessage(sessionId)
    const created = await messageRepo.create(input)
    expect(created.id).toBe(input.id)
    expect(created.sessionId).toBe(sessionId)
    expect(created.role).toBe("user")
    expect(created.content).toBe("Hello")
    expect(created.createdAt).toBeInstanceOf(Date)
  })

  it("listBySession returns messages with limit", async () => {
    for (let i = 0; i < 5; i++) {
      await messageRepo.create(buildMessage(sessionId, { content: `msg-${i}` }))
    }

    const messages = await messageRepo.listBySession(sessionId, 3)
    expect(messages).toHaveLength(3)
  })

  it("listBySessionChronological returns messages in order", async () => {
    for (let i = 0; i < 3; i++) {
      await messageRepo.create(buildMessage(sessionId, { content: `msg-${i}` }))
    }

    const messages = await messageRepo.listBySessionChronological(sessionId)
    expect(messages).toHaveLength(3)
    expect(messages.map((m) => m.content)).toEqual(["msg-0", "msg-1", "msg-2"])
  })

  it("listAllBySessionChronological returns all messages", async () => {
    for (let i = 0; i < 10; i++) {
      await messageRepo.create(buildMessage(sessionId, { content: `msg-${i}` }))
    }

    const all = await messageRepo.listAllBySessionChronological(sessionId)
    expect(all).toHaveLength(10)
  })

  it("stores assistant messages with toolCalls and parts", async () => {
    const input = buildMessage(sessionId, {
      role: "assistant",
      content: "Tool result",
      toolCalls: [{ type: "tool-call", toolName: "test_tool" }] as never,
      parts: [{ type: "tool-call", toolName: "test_tool" }] as never,
    })
    const created = await messageRepo.create(input)
    expect(created.role).toBe("assistant")
    expect(created.toolCalls).toEqual([{ type: "tool-call", toolName: "test_tool" }])
  })
})
