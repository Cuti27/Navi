import type { MemoryRepository } from "./memory-repository.js"

export interface MemoryContextBuilderOptions {
    repository: MemoryRepository
    limit?: number
    maxExcerptLength?: number
}

export class MemoryContextBuilder {
    private readonly options: MemoryContextBuilderOptions

    constructor(options: MemoryContextBuilderOptions) {
        this.options = { limit: 5, maxExcerptLength: 300, ...options }
    }

    /**
     * Builds a system-message sized snippet of the most relevant long-term
     * memories for the current user message. Returns an empty string when no
     * relevant memories are found.
     */
    async build(userMessage: string): Promise<string> {
        const { repository } = this.options
        const limit = this.options.limit ?? 5
        const maxExcerptLength = this.options.maxExcerptLength ?? 300
        const results = await repository.search(userMessage, limit)
        if (results.length === 0) {
            return ""
        }

        const lines = [
            "## Recuerdos relevantes",
            "La siguiente información proviene de memorias guardadas en conversaciones anteriores. " +
                "Úsala solo si es pertinente para responder.",
        ]

        for (const result of results) {
            const excerpt = result.excerpt || result.content.slice(0, maxExcerptLength)
            const suffix = result.content.length > maxExcerptLength && !result.excerpt ? "…" : ""
            lines.push(`- **${result.title}** (${result.category}): ${excerpt}${suffix}`)
        }

        return lines.join("\n")
    }
}
