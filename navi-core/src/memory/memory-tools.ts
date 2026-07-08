import { tool, type Tool } from "ai"
import { z } from "zod"
import type { MemoryRepository } from "./memory-repository.js"

export const MEMORY_READ_ONLY_TOOLS: Set<string> = new Set(["memory_search", "memory_list"])

export interface MemoryTools extends Record<string, Tool> {
    memory_search: Tool
    memory_save: Tool
    memory_update: Tool
    memory_list: Tool
}

export function createMemoryTools(repository: MemoryRepository): MemoryTools {
    return {
        memory_search: tool({
            description:
                "Search the agent's long-term memory for relevant information. Use this when the user asks about preferences, setup details, or facts that may have been saved in previous conversations. Returns matching memories with excerpts.",
            inputSchema: z.object({
                query: z.string().describe("The search query. Use keywords, not full sentences."),
                limit: z
                    .number()
                    .min(1)
                    .max(10)
                    .default(5)
                    .describe("Maximum number of memories to return."),
            }),
            execute: async ({ query, limit }: { query: string; limit: number }) => {
                const results = await repository.search(query, limit)
                return {
                    count: results.length,
                    results: results.map((r) => ({
                        id: r.id,
                        title: r.title,
                        category: r.category,
                        excerpt: r.excerpt,
                        content: r.content,
                        tags: r.tags,
                    })),
                }
            },
        }),

        memory_save: tool({
            description:
                "Save a new fact, preference, instruction, or note to long-term memory. Use this when the user shares information they want remembered across sessions (e.g. 'recuerda que...'). Requires explicit user approval because it writes a markdown file.",
            inputSchema: z.object({
                title: z.string().describe("A concise, descriptive title for the memory."),
                category: z
                    .string()
                    .default("general")
                    .describe("A category slug used for folder organization (e.g. homelab, preferences, projects)."),
                content: z
                    .string()
                    .describe("The markdown content to remember. Be concise but complete."),
                tags: z
                    .array(z.string())
                    .default([])
                    .describe("Optional tags to improve future searches."),
            }),
            execute: async ({
                title,
                category,
                content,
                tags,
            }: {
                title: string
                category: string
                content: string
                tags: string[]
            }) => {
                const memory = await repository.save({ title, category, content, tags })
                return {
                    id: memory.id,
                    filePath: memory.filePath,
                    title: memory.title,
                    category: memory.category,
                }
            },
        }),

        memory_update: tool({
            description:
                "Update an existing long-term memory by its id. Use this to correct or extend a previously saved memory. Requires explicit user approval because it overwrites a markdown file.",
            inputSchema: z.object({
                id: z.string().describe("The id of the memory to update."),
                content: z.string().describe("The new markdown content. It replaces the entire previous content."),
            }),
            execute: async ({ id, content }: { id: string; content: string }) => {
                const existing = await repository.getById(id)
                if (!existing) {
                    return { error: `Memory not found: ${id}` }
                }
                const updated = await repository.update(existing.filePath, content)
                if (!updated) {
                    return { error: `Failed to update memory: ${id}` }
                }
                return {
                    id: updated.id,
                    filePath: updated.filePath,
                    title: updated.title,
                    category: updated.category,
                }
            },
        }),

        memory_list: tool({
            description:
                "List saved long-term memories, optionally filtered by category. Use this to give the user an overview of what the agent remembers.",
            inputSchema: z.object({
                category: z.string().optional().describe("Optional category filter."),
                limit: z.number().min(1).max(100).default(50).describe("Maximum number of memories to return."),
            }),
            execute: async ({ category, limit }: { category?: string; limit: number }) => {
                const results = await repository.list(category, limit)
                return {
                    count: results.length,
                    results: results.map((m) => ({
                        id: m.id,
                        title: m.title,
                        category: m.category,
                        filePath: m.filePath,
                        tags: m.tags,
                        updatedAt: m.updatedAt.toISOString(),
                    })),
                }
            },
        }),
    }
}
