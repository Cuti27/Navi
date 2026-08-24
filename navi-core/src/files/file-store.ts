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
        this.assertSafeId(id)
        await mkdir(this.dir, { recursive: true })
        await writeFile(join(this.dir, id), data)
    }

    async readFile(id: string): Promise<Buffer> {
        this.assertSafeId(id)
        try {
            return await readFile(join(this.dir, id))
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                throw new Error(`File not found: ${id}`)
            }
            throw error
        }
    }

    /**
     * Defense in depth: ids reach disk paths, so reject anything that could
     * escape `this.dir` (path separators, `..`, traversal via resolve).
     */
    private assertSafeId(id: string): void {
        if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) {
            throw new Error(`Invalid file id`)
        }
        const prefix = this.dir.endsWith("/") ? this.dir : this.dir + "/"
        if (!resolve(this.dir, id).startsWith(prefix)) {
            throw new Error(`Invalid file id`)
        }
    }
}
