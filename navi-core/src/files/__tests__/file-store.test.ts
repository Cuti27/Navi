import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { FileStore } from "../file-store.js"

describe("FileStore", () => {
  let dir: string
  let store: FileStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "navi-files-"))
    store = new FileStore(dir)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("writes and reads a file roundtrip", async () => {
    const id = "11111111-1111-4111-8111-111111111111"
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    await store.writeFile("session-1", id, data)

    const read = await store.readFile(id)
    expect(read).toEqual(data)
  })

  it("creates the directory recursively", async () => {
    const nested = new FileStore(join(dir, "a", "b"))
    await nested.writeFile("session-1", "file-1", Buffer.from("hello"))
    const read = await nested.readFile("file-1")
    expect(read.toString()).toBe("hello")
  })

  it("throws when reading a non-existent file", async () => {
    await expect(store.readFile("missing")).rejects.toThrow("File not found")
  })
})
