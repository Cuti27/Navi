import { randomUUID } from "node:crypto"
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises"
import { dirname, join, normalize, relative } from "node:path"

export interface MemoryFileInput {
    id?: string
    title: string
    category: string
    content: string
    tags?: string[]
    createdAt?: string
    updatedAt?: string
}

export interface MemoryFile {
    id: string
    filePath: string
    title: string
    category: string
    content: string
    tags: string[]
    createdAt: string
    updatedAt: string
}

interface ParsedFrontmatter {
    id: string
    title: string
    category: string
    tags: string[]
    createdAt: string
    updatedAt: string
}

const FRONTMATTER_DELIMITER = "---"

function sanitizeSlug(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
}

function parseTags(raw: string | undefined): string[] {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            return parsed.filter((t): t is string => typeof t === "string")
        }
    } catch {
        // fall through
    }
    return []
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
    const lines = raw.split("\n")
    const data: Record<string, string> = {}
    for (const line of lines) {
        const idx = line.indexOf(":")
        if (idx === -1) continue
        const key = line.slice(0, idx).trim()
        const value = line.slice(idx + 1).trim()
        data[key] = value
    }

    return {
        id: data.id || randomUUID(),
        title: data.title || "Untitled memory",
        category: data.category || "general",
        tags: parseTags(data.tags),
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
    }
}

function serializeFrontmatter(memory: MemoryFile): string {
    return [
        FRONTMATTER_DELIMITER,
        `id: ${memory.id}`,
        `title: ${memory.title}`,
        `category: ${memory.category}`,
        `tags: ${JSON.stringify(memory.tags)}`,
        `createdAt: ${memory.createdAt}`,
        `updatedAt: ${memory.updatedAt}`,
        FRONTMATTER_DELIMITER,
        "",
    ].join("\n")
}

function parseMemoryFile(filePath: string, raw: string): MemoryFile {
    const trimmed = raw.trimStart()
    let frontmatterRaw = ""
    let content = trimmed

    if (trimmed.startsWith(FRONTMATTER_DELIMITER)) {
        const endIdx = trimmed.indexOf("\n" + FRONTMATTER_DELIMITER)
        if (endIdx !== -1) {
            frontmatterRaw = trimmed.slice(FRONTMATTER_DELIMITER.length, endIdx).trim()
            content = trimmed.slice(endIdx + FRONTMATTER_DELIMITER.length + 1).trimStart()
        }
    }

    const frontmatter = parseFrontmatter(frontmatterRaw)
    return {
        ...frontmatter,
        filePath,
        content,
    }
}

export class MemoryStore {
    constructor(private readonly memoryRoot: string) {}

    /**
     * Writes a new memory markdown file. Returns the resolved MemoryFile
     * including the relative filePath chosen from category + title slug.
     */
    async save(input: MemoryFileInput): Promise<MemoryFile> {
        const now = new Date().toISOString()
        const memory: MemoryFile = {
            id: input.id || randomUUID(),
            filePath: this.resolveFilePath(input.category, input.title),
            title: input.title,
            category: input.category || "general",
            content: input.content,
            tags: input.tags ?? [],
            createdAt: input.createdAt || now,
            updatedAt: input.updatedAt || now,
        }

        const absolutePath = this.toAbsolutePath(memory.filePath)
        await mkdir(dirname(absolutePath), { recursive: true })
        await writeFile(absolutePath, serializeFrontmatter(memory) + memory.content, "utf-8")
        return memory
    }

    /**
     * Reads a memory file by its relative path. Returns undefined if not found.
     */
    async read(filePath: string): Promise<MemoryFile | undefined> {
        const absolutePath = this.toAbsolutePath(filePath)
        try {
            const raw = await readFile(absolutePath, "utf-8")
            return parseMemoryFile(filePath, raw)
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                return undefined
            }
            throw error
        }
    }

    /**
     * Updates the markdown content of an existing memory file.
     * Keeps existing frontmatter and refreshes the updatedAt timestamp.
     */
    async update(filePath: string, content: string): Promise<MemoryFile | undefined> {
        const existing = await this.read(filePath)
        if (!existing) return undefined

        const updated: MemoryFile = {
            ...existing,
            content,
            updatedAt: new Date().toISOString(),
        }

        const absolutePath = this.toAbsolutePath(filePath)
        await writeFile(absolutePath, serializeFrontmatter(updated) + updated.content, "utf-8")
        return updated
    }

    /**
     * Deletes a memory file by relative path.
     */
    async delete(filePath: string): Promise<void> {
        const absolutePath = this.toAbsolutePath(filePath)
        await unlink(absolutePath)
    }

    /**
     * Lists all memory markdown files recursively. Optionally filtered by category.
     */
    async list(category?: string): Promise<MemoryFile[]> {
        const root = category ? join(this.memoryRoot, category) : this.memoryRoot
        const files = await this.listMarkdownFiles(root)
        const result: MemoryFile[] = []
        for (const absolutePath of files) {
            const raw = await readFile(absolutePath, "utf-8")
            const relativePath = relative(this.memoryRoot, absolutePath)
            result.push(parseMemoryFile(relativePath, raw))
        }
        return result
    }

    private resolveFilePath(category: string, title: string): string {
        const safeCategory = sanitizeSlug(category || "general")
        const safeTitle = sanitizeSlug(title)
        const baseName = `${safeTitle}.md`
        return join(safeCategory, baseName)
    }

    private toAbsolutePath(filePath: string): string {
        const normalized = normalize(filePath)
        if (normalized.startsWith("..")) {
            throw new Error("Invalid memory path: path traversal detected")
        }
        return join(this.memoryRoot, normalized)
    }

    private async listMarkdownFiles(dir: string): Promise<string[]> {
        const entries = await readdir(dir, { withFileTypes: true, recursive: true })
        return entries
            .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
            .map((entry) => join(entry.parentPath ?? entry.path, entry.name))
    }
}
