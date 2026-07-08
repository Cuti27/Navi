import "dotenv/config"

import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { createProviderFromEnv } from "./providers/factory-provider.js"
import { mcpConfig } from "./mcp/mcp-config.js"
import { McpToolService } from "./mcp/mcp-tool-service.js"
import { ChatService } from "./chat/chat-service.js"
import { CompactionService } from "./chat/compaction-service.js"
import { createV1Routes } from "./routes/v1/index.js"
import { requestLogger } from "./middleware/request-logger.js"
import { getLogger } from "./logger/logger.js"
import { masterAuth } from "./middleware/auth.js"
import { createDb } from "./db/client.js"
import { DrizzleSessionRepository } from "./db/repositories/session.repository.js"
import { DrizzleMessageRepository } from "./db/repositories/message.repository.js"
import { DrizzleApprovalRepository } from "./db/repositories/approval.repository.js"
import { DynamicSystemPromptBuilder } from "./prompts/dynamic-system-prompt.js"
import { MemoryStore } from "./memory/memory-store.js"
import { MemoryRepository } from "./memory/memory-repository.js"
import { createMemoryTools, MEMORY_READ_ONLY_TOOLS } from "./memory/memory-tools.js"
import { MemoryContextBuilder } from "./memory/memory-context.js"

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`${name} is required`)
    }
    return value
}

const log = getLogger("server")

const provider = createProviderFromEnv()
const modelId = requireEnv("AI_MODEL")
const databaseUrl = process.env.DATABASE_URL ?? "./data/navi.db"
const memoryDir = process.env.MEMORY_DIR ?? "./data/memory"
const compactionThreshold = Number(process.env.COMPACTION_THRESHOLD ?? "30")

mkdirSync(dirname(databaseUrl), { recursive: true })
mkdirSync(memoryDir, { recursive: true })

const db = createDb(databaseUrl)
migrate(db, { migrationsFolder: "./drizzle" })
log.info({ databaseUrl }, "database migrated")

const sessionRepository = new DrizzleSessionRepository(db)
const messageRepository = new DrizzleMessageRepository(db)
const approvalRepository = new DrizzleApprovalRepository(db)

const toolExecutor = new McpToolService(mcpConfig.servers)
void toolExecutor.connect()

const memoryStore = new MemoryStore(memoryDir)
const memoryRepository = new MemoryRepository(db, memoryStore)
await memoryRepository.reindexAll()
log.info({ memoryDir }, "memory index ready")

const memoryTools = createMemoryTools(memoryRepository)
const memoryToolNames = Object.keys(memoryTools)

const systemPromptBuilder = new DynamicSystemPromptBuilder({
    basePrompt: process.env.AI_SYSTEM_PROMPT ?? "",
    toolExecutor,
    memoryToolNames,
})

const compactionService = new CompactionService({
    provider,
    modelId,
    sessionRepository,
    messageRepository,
    threshold: compactionThreshold,
})

const memoryContextBuilder = new MemoryContextBuilder({ repository: memoryRepository })

const chatService = new ChatService({
    provider,
    modelId,
    toolExecutor,
    systemPromptBuilder,
    sessionRepository,
    messageRepository,
    approvalRepository,
    compactionService,
    memoryTools,
    readOnlyToolNames: MEMORY_READ_ONLY_TOOLS,
    memoryContextBuilder,
})

const app = new Hono()

app.use("/api/v1/*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
}))

app.use("/api/v1/*", requestLogger)
app.use("/api/v1/*", masterAuth)

app.route(
    "/api/v1",
    createV1Routes({ chatService, toolExecutor, sessionRepository, messageRepository, memoryRepository })
)

serve({
    fetch: app.fetch,
    port: 3000,
}, (info) => {
    log.info(`Server is running on http://localhost:${info.port}`)
})
