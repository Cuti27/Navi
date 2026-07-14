import type { Tool } from "ai"
import type { ToolExecutor } from "../../mcp/tool-executor.js"
import type { ActiveService, AvailableTool } from "../../mcp/mcp-types.js"

export function createMockToolExecutor(
  overrides?: Partial<ToolExecutor>,
): ToolExecutor {
  return {
    connect: async () => {},
    getActiveServices: (): ActiveService[] => [],
    getAvailableTools: (): AvailableTool[] => [],
    getEnabledTools: async (): Promise<Record<string, Tool>> => ({}),
    setToolEnabled: (_name: string, _enabled: boolean) => {},
    isToolReadOnly: (_name: string): boolean => false,
    ...overrides,
  }
}
