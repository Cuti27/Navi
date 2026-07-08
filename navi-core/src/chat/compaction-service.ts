import { generateText } from "ai"
import type { AIProvider } from "../providers/ai-provider.js"
import type { SessionRepository } from "../db/repositories/session.repository.js"
import type { MessageRepository } from "../db/repositories/message.repository.js"
import type { Message } from "../db/schema.js"
import { getLogger } from "../logger/logger.js"

export interface CompactionServiceOptions {
    provider: AIProvider
    modelId: string
    sessionRepository: SessionRepository
    messageRepository: MessageRepository
    threshold?: number
    maxHistoryMessages?: number
}

const log = getLogger("chat:compaction")

export class CompactionService {
    private readonly options: CompactionServiceOptions

    constructor(options: CompactionServiceOptions) {
        this.options = {
            threshold: 30,
            maxHistoryMessages: 20,
            ...options,
        }
    }

    /**
     * Checks whether the session has accumulated enough messages beyond the
     * sliding window to warrant a new compaction. If so, it summarizes the
     * oldest un-summarized messages, merges them with the existing summary,
     * and updates the session row.
     */
    async checkAndCompact(sessionId: string): Promise<void> {
        try {
            await this.doCompact(sessionId)
        } catch (error) {
            log.error({ sessionId, err: error }, "compaction failed, continuing without summary")
        }
    }

    private async doCompact(sessionId: string): Promise<void> {
        const { sessionRepository, messageRepository } = this.options
        const threshold = this.options.threshold ?? 30
        const maxHistoryMessages = this.options.maxHistoryMessages ?? 20

        const session = await sessionRepository.getById(sessionId)
        if (!session) {
            log.warn({ sessionId }, "session not found during compaction check")
            return
        }

        const allMessages = await messageRepository.listAllBySessionChronological(sessionId)
        if (allMessages.length <= maxHistoryMessages) {
            return
        }

        const watermarkIndex = session.lastCompactedMessageId
            ? allMessages.findIndex((m) => m.id === session.lastCompactedMessageId)
            : -1

        // If the watermark message no longer exists, reset it and consider the
        // whole history eligible for compaction.
        const effectiveWatermarkIndex = watermarkIndex >= 0 ? watermarkIndex : -1
        const messagesSinceCompaction = allMessages.length - (effectiveWatermarkIndex + 1)

        if (messagesSinceCompaction < threshold) {
            log.debug(
                { sessionId, messagesSinceCompaction, threshold },
                "compaction threshold not reached"
            )
            return
        }

        // We keep the most recent maxHistoryMessages in the sliding window.
        // Everything older (and newer than the watermark) gets folded into the
        // rolling summary.
        const cutoffIndex = Math.max(0, allMessages.length - maxHistoryMessages)
        const startIndex = effectiveWatermarkIndex + 1
        const endIndex = cutoffIndex

        if (startIndex >= endIndex) {
            log.debug(
                { sessionId, startIndex, endIndex },
                "no messages to compact outside sliding window"
            )
            return
        }

        const messagesToCompact = allMessages.slice(startIndex, endIndex)
        const lastCompactedMessage = messagesToCompact[messagesToCompact.length - 1]

        log.info(
            { sessionId, count: messagesToCompact.length },
            "compacting session messages"
        )

        const summary = await this.summarize(
            session.contextSummary,
            messagesToCompact
        )

        await sessionRepository.update(sessionId, {
            contextSummary: summary,
            lastCompactedMessageId: lastCompactedMessage.id,
        })

        log.info(
            { sessionId, previousLength: session.contextSummary?.length || 0, newLength: summary.length },
            "session context summary updated"
        )
    }

    private async summarize(
        previousSummary: string | null,
        messages: Message[]
    ): Promise<string> {
        const formattedMessages = messages
            .map((m) => {
                const role = m.role === "tool" ? "tool" : m.role
                const prefix = role.toUpperCase()
                return `[${prefix}] ${m.content.slice(0, 2000)}`
            })
            .join("\n---\n")

        const prompt = [
            "Resume la siguiente conversación entre un usuario y su asistente Navi. " +
                "El objetivo es conservar la información relevante para futuros turnos sin repetir detalles triviales.",
            "",
            previousSummary ? "## Resumen anterior\n" + previousSummary : "## Resumen anterior\n(ninguno)",
            "",
            "## Mensajes a incorporar",
            formattedMessages,
            "",
            "## Instrucciones",
            "- Preserva intenciones del usuario, decisiones tomadas, hechos aprendidos, preferencias expresadas y acciones ejecutadas.",
            "- No incluyas saludos, despedidas ni agradecimientos genéricos.",
            "- Escribe en español.",
            "- Sé conciso pero completo; prioriza datos que probablemente sean útiles más adelante.",
        ].join("\n")

        const { text } = await generateText({
            model: this.options.provider.getModel(this.options.modelId),
            system:
                "Eres un asistente de resumen. Generas resúmenes densos en español para que otro modelo de lenguaje los use como contexto.",
            prompt,
        })

        return text.trim()
    }
}
