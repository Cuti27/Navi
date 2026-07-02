import { streamText, isStepCount, type Tool } from "ai"
import type { AIProvider } from "../providers/ai-provider.js"
import type { ToolExecutor } from "../mcp/tool-executor.js"
import { getLogger } from "../logger/logger.js"

export interface ChatServiceOptions {
    provider: AIProvider
    modelId: string
    systemPrompt?: string
    toolExecutor?: ToolExecutor
}

const log = getLogger("chat")

export class ChatService {
    private readonly options: ChatServiceOptions

    constructor(options: ChatServiceOptions) {
        this.options = options
    }

    /**
     * Genera una respuesta en streaming para un mensaje de usuario.
     *
     * Usa `streamText` de Vercel AI SDK y devuelve una respuesta SSE lista
     * para ser enviada desde Hono. Si hay un ToolExecutor configurado,
     * sus tools habilitadas se exponen al modelo para que pueda invocarlas.
     */
    async streamResponse(userMessage: string): Promise<Response> {
        const { provider, modelId, systemPrompt, toolExecutor } = this.options

        const tools = await toolExecutor?.getEnabledTools()
        const toolsNames = tools ? Object.keys(tools) : []

        log.info({ toolsCount: toolsNames.length }, "tools passed to LLM")
        log.debug({ toolsNames }, "enabled tools")

        const result = streamText({
            model: provider.getModel(modelId),
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
            tools,
            stopWhen: isStepCount(5),
            onStepStart: ({ stepNumber }) => {
                log.debug({ stepNumber }, "step started")
            },
            onStepEnd: ({ stepNumber, finishReason, toolCalls, toolResults }) => {
                log.info({ stepNumber, finishReason }, "step finished")

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
                    log.warn({ stepNumber }, "no tool calls in this step")
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
        })

        const encoder = new TextEncoder()
        const sseStream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.textStream) {
                    controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
                }
                controller.close()
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
}
