import { randomUUID } from "node:crypto"
import { streamText, isStepCount, type Tool, type ModelMessage } from "ai"
import type { AIProvider } from "../providers/ai-provider.js"
import type { ToolExecutor } from "../mcp/tool-executor.js"
import type { SystemPromptBuilder } from "../prompts/system-prompt-builder.js"
import type { SessionRepository } from "../db/repositories/session.repository.js"
import type { MessageRepository } from "../db/repositories/message.repository.js"
import type { Message } from "../db/schema.js"
import { getLogger } from "../logger/logger.js"

export interface ChatServiceOptions {
    provider: AIProvider
    modelId: string
    toolExecutor?: ToolExecutor
    systemPromptBuilder?: SystemPromptBuilder
    sessionRepository: SessionRepository
    messageRepository: MessageRepository
    maxHistoryMessages?: number
}

const log = getLogger("chat")

export class ChatService {
    private readonly options: ChatServiceOptions

    constructor(options: ChatServiceOptions) {
        this.options = options
    }

    /**
     * Genera una respuesta en streaming para un mensaje de usuario dentro de una sesión.
     *
     * El flujo:
     * 1. Valida que la sesión existe.
     * 2. Carga los últimos N mensajes del historial.
     * 3. Persiste el mensaje del usuario.
     * 4. Llama a streamText con system prompt dinámico + historial + tools.
     * 5. Al terminar el stream, persiste la respuesta completa del assistant.
     */
    async streamResponse(sessionId: string, userMessage: string): Promise<Response> {
        const {
            provider,
            modelId,
            toolExecutor,
            systemPromptBuilder,
            sessionRepository,
            messageRepository,
            maxHistoryMessages = 20,
        } = this.options

        const session = await sessionRepository.getById(sessionId)
        if (!session) {
            return new Response(JSON.stringify({ error: "Session not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            })
        }

        await messageRepository.create({
            id: randomUUID(),
            sessionId,
            role: "user",
            content: userMessage,
        })

        const historyMessages = await messageRepository.listBySession(sessionId, maxHistoryMessages)
        const messages = this.buildMessages(historyMessages)

        const tools = await toolExecutor?.getEnabledTools()
        const toolsNames = tools ? Object.keys(tools) : []

        log.info({ toolsCount: toolsNames.length }, "tools passed to LLM")
        log.debug({ toolsNames }, "enabled tools")

        const system = systemPromptBuilder?.build()

        const result = streamText({
            model: provider.getModel(modelId),
            system,
            messages,
            tools,
            stopWhen: isStepCount(5),
            onStepStart: ({ stepNumber }) => {
                log.debug({ stepNumber }, "step started")
            },
            onStepEnd: ({ stepNumber, finishReason, text, toolCalls, toolResults }) => {
                const textLength = text.length
                log.info({ stepNumber, finishReason, textLength }, "step finished")

                if (toolCalls && toolCalls.length > 0) {
                    log.info(
                        {
                            toolCalls: toolCalls.map((tc) =>
                                typeof tc.toolName === "string" ? tc.toolName : "unknown"
                            ),
                        },
                        "tool calls generated"
                    )
                } else {
                    log.debug({ stepNumber }, "no tool calls in this step")
                }

                if (textLength === 0 && (!toolCalls || toolCalls.length === 0)) {
                    log.warn({ stepNumber, finishReason }, "assistant returned empty response")
                }

                if (toolResults && toolResults.length > 0) {
                    log.debug(
                        {
                            toolResults: toolResults.map((tr) =>
                                typeof tr.toolName === "string" ? tr.toolName : "unknown"
                            ),
                        },
                        "tool results received"
                    )
                }
            },
            onToolExecutionStart: ({ toolCall }) => {
                log.info({ tool: toolCall.toolName, input: toolCall.input }, "executing tool")
            },
            onToolExecutionEnd: ({ toolCall, toolExecutionMs, toolOutput }) => {
                log.info(
                    { tool: toolCall.toolName, durationMs: toolExecutionMs },
                    "tool execution finished"
                )
                log.debug({ tool: toolCall.toolName, output: toolOutput }, "tool result")
            },
            onError: ({ error }) => {
                log.error({ err: error }, "stream error")
            },
            onEnd: async ({ text }) => {
                await messageRepository.create({
                    id: randomUUID(),
                    sessionId,
                    role: "assistant",
                    content: text,
                })
            },
        })

        const encoder = new TextEncoder()
        const sseStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.textStream) {
                        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
                    }
                    controller.close()
                } catch (error) {
                    log.error({ err: error }, "failed to read text stream")
                    controller.error(error)
                }
            },
        })

        return new Response(sseStream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
            },
        })
    }

    private buildMessages(history: Message[]): ModelMessage[] {
        // history comes ordered by createdAt DESC (newest first), so we reverse
        // it to obtain the chronological order expected by the LLM.
        return history
            .slice()
            .reverse()
            .map((message): ModelMessage => {
                if (message.role === "user") {
                    return { role: "user", content: message.content }
                }
                if (message.role === "assistant") {
                    return { role: "assistant", content: message.content }
                }
                if (message.role === "system") {
                    return { role: "system", content: message.content }
                }
                // Tool messages are not fully persisted yet; fall back to assistant.
                return { role: "assistant", content: message.content }
            })
    }
}
