import type { Tool } from "ai"
import type { ActiveService, AvailableTool } from "./mcp-types.js"

/**
 * Contract for a component that discovers and executes tools for the LLM.
 *
 * ChatService depends on this interface instead of a concrete MCP service,
 * keeping the core chat logic decoupled from the tool transport mechanism.
 */
export interface ToolExecutor {
    /**
     * Starts connecting to the configured tool sources in the background.
     */
    connect(): Promise<void>

    /**
     * Lists the configured tool sources with their current connection status.
     */
    getActiveServices(): ActiveService[]

    /**
     * Lists all discovered tools and whether each one is currently enabled.
     */
    getAvailableTools(): AvailableTool[]

    /**
     * Returns only the enabled tools, ready to be passed to Vercel AI SDK.
     */
    getEnabledTools(): Promise<Record<string, Tool>>

    /**
     * Enables or disables a specific tool by name (runtime only, in memory).
     */
    setToolEnabled(name: string, enabled: boolean): void

    /**
     * Returns true if the tool is considered read-only and can be auto-approved.
     * Falls back to false if the tool is not known.
     */
    isToolReadOnly(name: string): boolean
}
