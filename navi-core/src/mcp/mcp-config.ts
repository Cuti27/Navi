import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Configuration for a single MCP server.
 */
export interface McpServerConfig {
    name: string
    enabled?: boolean
    /**
     * Transport type. Defaults to "http" for backwards compatibility.
     */
    transport?: "http" | "sse" | "stdio"
    /**
     * URL for HTTP/SSE transports. Required when transport is "http" or "sse".
     * Supports environment variable expansion with `${VAR}` syntax.
     */
    url?: string
    headers?: Record<string, string>
    /**
     * Command for stdio transport. Required when transport is "stdio".
     * Supports environment variable expansion with `${VAR}` syntax.
     */
    command?: string
    /**
     * Arguments for stdio transport.
     * Supports environment variable expansion with `${VAR}` syntax.
     */
    args?: string[]
    /**
     * Environment variables for stdio transport.
     */
    env?: Record<string, string>
    /**
     * Working directory for stdio transport.
     */
    cwd?: string
    /**
     * Tool names that should be considered read-only and therefore auto-approved.
     * Useful when the MCP server does not publish `annotations.readOnlyHint`.
     */
    autoApproveTools?: string[]
}

/**
 * Root MCP configuration loaded from mcp.config.json.
 */
export interface McpConfig {
    servers: McpServerConfig[]
}

/**
 * Expand `${VAR}` placeholders inside string values using `process.env`.
 * Missing variables are left unchanged.
 */
export function expandEnvVars(value: unknown): unknown {
    if (typeof value === "string") {
        return value.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] ?? `\${${name}}`)
    }

    if (Array.isArray(value)) {
        return value.map(expandEnvVars)
    }

    if (value && typeof value === "object") {
        const result: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(value)) {
            result[key] = expandEnvVars(val)
        }
        return result
    }

    return value
}

export function loadMcpConfig(): McpConfig {
    const candidates = [
        // Development: src/mcp/ -> project root
        join(__dirname, "..", "..", "mcp.config.json"),
        // Production: dist/src/mcp/ -> project root
        join(__dirname, "..", "..", "..", "mcp.config.json"),
        // Fallback: current working directory
        join(process.cwd(), "mcp.config.json"),
    ]

    const path = candidates.find((candidate) => existsSync(candidate))
    if (!path) {
        throw new Error(
            `mcp.config.json not found. Searched: ${candidates.join(", ")}`
        )
    }

    const raw = readFileSync(path, "utf-8")
    const parsed = JSON.parse(raw) as McpConfig
    return expandEnvVars(parsed) as McpConfig
}

export const mcpConfig: McpConfig = loadMcpConfig()
