import "dotenv/config"

import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { createProviderFromEnv } from "./providers/factory-provider.js"
import { mcpConfig } from "./mcp/mcp-config.js"
import { McpToolService } from "./mcp/mcp-tool-service.js"
import { ChatService } from "./chat/chat-service.js"
import { createV1Routes } from "./routes/v1/index.js"
import { requestLogger } from "./middleware/request-logger.js"
import { getLogger } from "./logger/logger.js"
import { masterAuth } from "./middleware/auth.js"

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`${name} is required`)
    }
    return value
}

// Initialize the AI provider, model, and tool executor based on environment variables.
const provider = createProviderFromEnv()
const modelId = requireEnv("AI_MODEL")

const toolExecutor = new McpToolService(mcpConfig.servers)
void toolExecutor.connect()

// Create the chat service with the specified provider, model, system prompt, and tool executor.
const chatService = new ChatService({
    provider,
    modelId,
    systemPrompt: process.env.AI_SYSTEM_PROMPT,
    toolExecutor,
})

const app = new Hono()

// Configure CORS 
app.use("/api/v1/*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type"],
}))

// Add request logging middleware for all API routes
app.use("/api/v1/*", requestLogger)

// Add master authentication middleware for all API routes
app.use("/api/v1/*", masterAuth) 

// Mount the version 1 API routes under the "/api/v1" path
app.route("/api/v1", createV1Routes({ chatService, toolExecutor }))

const log = getLogger("server")

serve({
    fetch: app.fetch,
    port: 3000,
}, (info) => {
    log.info(`Server is running on http://localhost:${info.port}`)
})
