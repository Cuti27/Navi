import { createHash } from "node:crypto"
import { sql, eq, like, and, desc } from "drizzle-orm"
import type { DB } from "../db/client.js"
import { memories } from "../db/schema.js"
import type { Memory, NewMemory } from "../db/schema.js"
import type { MemoryFile, MemoryStore } from "./memory-store.js"
import { getLogger } from "../logger/logger.js"

export interface MemorySearchResult {
    id: string
    filePath: string
    title: string
    category: string
    content: string
    tags: string[]
    excerpt?: string
    score: number
}

export interface SaveMemoryInput {
    title: string
    category?: string
    content: string
    tags?: string[]
}

const log = getLogger("memory:repository")

function hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex")
}

function toFts5Query(query: string): string {
    const tokens = query
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\s]/gi, " ")
        .split(/\s+/)
        .filter(Boolean)
    if (tokens.length === 0) return "*"
    return tokens.join(" AND ")
}

export class MemoryRepository {
    constructor(
        private readonly db: DB,
        private readonly store: MemoryStore
    ) {
        this.initFts()
    }

    private initFts(): void {
        this.db.run(sql`
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                title,
                category,
                tags,
                content,
                content='memories',
                content_rowid='rowid'
            );
        `)

        this.db.run(sql`
            CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
                INSERT INTO memories_fts(rowid, title, category, tags, content)
                VALUES (new.rowid, new.title, new.category, new.tags, new.content);
            END;
        `)

        this.db.run(sql`
            CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, title, category, tags, content)
                VALUES ('delete', old.rowid, old.title, old.category, old.tags, old.content);
            END;
        `)

        this.db.run(sql`
            CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
                INSERT INTO memories_fts(memories_fts, rowid, title, category, tags, content)
                VALUES ('delete', old.rowid, old.title, old.category, old.tags, old.content);
                INSERT INTO memories_fts(rowid, title, category, tags, content)
                VALUES (new.rowid, new.title, new.category, new.tags, new.content);
            END;
        `)
    }

    async save(input: SaveMemoryInput): Promise<Memory> {
        const file = await this.store.save({
            title: input.title,
            category: input.category || "general",
            content: input.content,
            tags: input.tags ?? [],
        })

        return this.upsertFromFile(file)
    }

    async update(filePath: string, content: string): Promise<Memory | undefined> {
        const updated = await this.store.update(filePath, content)
        if (!updated) return undefined

        return this.upsertFromFile(updated)
    }

    async delete(filePath: string): Promise<void> {
        await this.store.delete(filePath)
        await this.db.delete(memories).where(eq(memories.filePath, filePath))
    }

    async getById(id: string): Promise<Memory | undefined> {
        return this.db.query.memories.findFirst({
            where: eq(memories.id, id),
        })
    }

    async getByFilePath(filePath: string): Promise<Memory | undefined> {
        return this.db.query.memories.findFirst({
            where: eq(memories.filePath, filePath),
        })
    }

    async list(category?: string, limit = 100): Promise<Memory[]> {
        return this.db.query.memories.findMany({
            where: category ? eq(memories.category, category) : undefined,
            orderBy: [desc(memories.updatedAt)],
            limit,
        })
    }

    async search(query: string, limit = 5): Promise<MemorySearchResult[]> {
        const safeQuery = toFts5Query(query)

        type SearchRow = {
            id: unknown
            filePath: unknown
            title: unknown
            category: unknown
            content: unknown
            tags: unknown
            excerpt: unknown
            score: unknown
        }

        const rows = this.db.all(sql`
            SELECT
                m.id AS id,
                m.file_path AS filePath,
                m.title AS title,
                m.category AS category,
                m.content AS content,
                m.tags AS tags,
                snippet(memories_fts, 3, '«', '»', '...', 24) AS excerpt,
                rank AS score
            FROM memories_fts
            JOIN memories m ON m.rowid = memories_fts.rowid
            WHERE memories_fts MATCH ${safeQuery}
            ORDER BY rank
            LIMIT ${limit}
        `) as SearchRow[]

        return rows.map((row) => ({
            id: String(row.id),
            filePath: String(row.filePath),
            title: String(row.title),
            category: String(row.category),
            content: String(row.content),
            tags: parseTags(row.tags),
            excerpt: row.excerpt ? String(row.excerpt) : undefined,
            score: Number(row.score),
        }))
    }

    /**
     * Scans MEMORY_DIR, parses markdown files, and reconciles the SQLite index.
     * Deletes DB rows whose files no longer exist, inserts missing ones, and
     * updates rows whose content hash changed (e.g. edited in Obsidian).
     */
    async reindexAll(): Promise<void> {
        const files = await this.store.list()
        const indexed = await this.db.query.memories.findMany()
        const indexedByPath = new Map(indexed.map((m) => [m.filePath, m]))

        let inserted = 0
        let updated = 0
        let removed = 0

        for (const file of files) {
            const existing = indexedByPath.get(file.filePath)
            const newHash = hashContent(file.content)
            if (!existing) {
                await this.insertFromFile(file, newHash)
                inserted++
            } else if (existing.contentHash !== newHash) {
                await this.updateFromFile(existing.id, file, newHash)
                updated++
            }
            indexedByPath.delete(file.filePath)
        }

        for (const orphan of indexedByPath.values()) {
            await this.db.delete(memories).where(eq(memories.id, orphan.id))
            removed++
        }

        log.info({ inserted, updated, removed }, "memory reindex complete")
    }

    private async upsertFromFile(file: MemoryFile): Promise<Memory> {
        const existing = await this.getByFilePath(file.filePath)
        const hash = hashContent(file.content)
        if (existing) {
            await this.updateFromFile(existing.id, file, hash)
            const refreshed = await this.getById(existing.id)
            if (!refreshed) throw new Error("Failed to refresh memory after update")
            return refreshed
        }

        return this.insertFromFile(file, hash)
    }

    private async insertFromFile(file: MemoryFile, hash: string): Promise<Memory> {
        const input: NewMemory = {
            id: file.id,
            filePath: file.filePath,
            title: file.title,
            category: file.category,
            content: file.content,
            tags: file.tags,
            contentHash: hash,
            createdAt: new Date(file.createdAt),
            updatedAt: new Date(file.updatedAt),
        }

        await this.db.insert(memories).values(input)
        const created = await this.getById(file.id)
        if (!created) throw new Error("Failed to create memory")
        return created
    }

    private async updateFromFile(id: string, file: MemoryFile, hash: string): Promise<void> {
        await this.db
            .update(memories)
            .set({
                title: file.title,
                category: file.category,
                content: file.content,
                tags: file.tags,
                contentHash: hash,
                updatedAt: new Date(file.updatedAt),
            })
            .where(eq(memories.id, id))
    }
}

function parseTags(raw: unknown): string[] {
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === "string")
        } catch {
            return []
        }
    }
    if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string")
    return []
}
