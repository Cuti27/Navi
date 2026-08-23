import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

/**
 * Stores generated file blobs on disk, keyed by id. Files are written as
 * `<dir>/<id>` (no extension, media type tracked in the DB).
 */
export class FileStore {
    private readonly dir: string

    constructor(dir?: string) {
        this.dir = resolve(dir ?? process.env.FILES_DIR ?? "./data/files")
    }

    async writeFile(sessionId: string, id: string, data: Buffer): Promise<void> {
        await mkdir(this.dir, { recursive: true })
        await writeFile(join(this.dir, id), data)
    }

    async readFile(id: string): Promise<Buffer> {
        try {
            return await readFile(join(this.dir, id))
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                throw new Error(`File not found: ${id}`)
            }
            throw error
        }
    }
}
