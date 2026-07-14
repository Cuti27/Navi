import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { DrizzleSessionRepository } from "../session.repository.js"
import { createTestDb } from "../../../test/setup.js"
import type { DB } from "../../client.js"
import type { TestDb } from "../../../test/setup.js"
import { buildSession } from "../../../test/factories.js"

describe("DrizzleSessionRepository", () => {
  let db: DB
  let repo: DrizzleSessionRepository
  let testDb: TestDb

  beforeEach(() => {
    testDb = createTestDb()
    db = testDb.db
    repo = new DrizzleSessionRepository(db)
  })

  afterEach(() => {
    testDb.destroy()
  })

  it("creates and retrieves a session", async () => {
    const input = buildSession()
    const created = await repo.create(input)
    expect(created.id).toBe(input.id)
    expect(created.title).toBe("Test session")
    expect(created.createdAt).toBeInstanceOf(Date)
    expect(created.updatedAt).toBeInstanceOf(Date)
  })

  it("returns undefined for non-existent session", async () => {
    const result = await repo.getById("nonexistent")
    expect(result).toBeUndefined()
  })

  it("lists sessions", async () => {
    await repo.create(buildSession({ title: "A" }))
    await repo.create(buildSession({ title: "B" }))

    const sessions = await repo.list()
    expect(sessions).toHaveLength(2)
  })

  it("updates session title", async () => {
    const created = await repo.create(buildSession())
    await repo.update(created.id, { title: "Updated" })
    const updated = await repo.getById(created.id)
    expect(updated!.title).toBe("Updated")
  })

  it("updates session context summary", async () => {
    const created = await repo.create(buildSession())
    await repo.update(created.id, { contextSummary: "Summary text" })
    const updated = await repo.getById(created.id)
    expect(updated!.contextSummary).toBe("Summary text")
  })

  it("updates session lastCompactedMessageId", async () => {
    const created = await repo.create(buildSession())
    await repo.update(created.id, { lastCompactedMessageId: "msg-1" })
    const updated = await repo.getById(created.id)
    expect(updated!.lastCompactedMessageId).toBe("msg-1")
  })

  it("deletes an existing session", async () => {
    const created = await repo.create(buildSession())
    await repo.delete(created.id)
    const found = await repo.getById(created.id)
    expect(found).toBeUndefined()
  })

  it("deleting non-existent session does not throw", async () => {
    await expect(repo.delete("nonexistent")).resolves.not.toThrow()
  })
})
