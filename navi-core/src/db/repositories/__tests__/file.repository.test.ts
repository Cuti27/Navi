import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { randomUUID } from "node:crypto"
import { DrizzleFileRepository } from "../file.repository.js"
import { DrizzleSessionRepository } from "../session.repository.js"
import { createTestDb } from "../../../test/setup.js"
import type { DB } from "../../client.js"
import type { TestDb } from "../../../test/setup.js"
import { buildSession } from "../../../test/factories.js"

describe("DrizzleFileRepository", () => {
  let db: DB
  let repo: DrizzleFileRepository
  let sessionRepo: DrizzleSessionRepository
  let testDb: TestDb
  let sessionId: string

  beforeEach(async () => {
    testDb = createTestDb()
    db = testDb.db
    repo = new DrizzleFileRepository(db)
    sessionRepo = new DrizzleSessionRepository(db)
    const session = await sessionRepo.create(buildSession())
    sessionId = session.id
  })

  afterEach(() => {
    testDb.destroy()
  })

  it("creates and retrieves a file", async () => {
    const id = randomUUID()
    const created = await repo.create({
      id,
      sessionId,
      mediaType: "image/png",
      size: 1024,
    })
    expect(created.id).toBe(id)
    expect(created.sessionId).toBe(sessionId)
    expect(created.mediaType).toBe("image/png")
    expect(created.size).toBe(1024)
    expect(created.createdAt).toBeInstanceOf(Date)

    const found = await repo.getById(id)
    expect(found).toEqual(created)
  })

  it("returns undefined for non-existent file", async () => {
    const result = await repo.getById(randomUUID())
    expect(result).toBeUndefined()
  })

  it("deletes files when the session is deleted (cascade)", async () => {
    const id = randomUUID()
    await repo.create({ id, sessionId, mediaType: "image/jpeg", size: 10 })

    await sessionRepo.delete(sessionId)

    const found = await repo.getById(id)
    expect(found).toBeUndefined()
  })
})
