import { describe, it, expect, vi, beforeEach } from "vitest"
import type { McpServerConfig } from "../mcp-config.js"

const mockClient = {
  listTools: vi.fn(),
  tools: vi.fn(),
}

const mockStdioTransport = vi.fn()

vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: vi.fn().mockResolvedValue(mockClient),
}))

vi.mock("@ai-sdk/mcp/mcp-stdio", () => ({
  Experimental_StdioMCPTransport: mockStdioTransport,
}))

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("McpToolService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("connects to a server and exposes its tools", async () => {
    mockClient.listTools.mockResolvedValue({
      tools: [
        { name: "tool1", description: "A test tool", annotations: {} },
      ],
    })
    mockClient.tools.mockResolvedValue({ tool1: { description: "A test tool" } })

    const { McpToolService } = await import("../mcp-tool-service.js")
    const configs: McpServerConfig[] = [
      { name: "test-server", url: "http://localhost:9999/mcp" },
    ]
    const service = new McpToolService(configs)
    service.connect()
    await flushMicrotasks()

    const services = service.getActiveServices()
    expect(services).toHaveLength(1)
    expect(services[0].name).toBe("test-server")
    expect(services[0].status).toBe("connected")
    expect(services[0].tools).toEqual(["tool1"])
  })

  it("marks server as disabled when configured", async () => {
    const { McpToolService } = await import("../mcp-tool-service.js")
    const configs: McpServerConfig[] = [
      { name: "disabled-server", url: "http://localhost:9999/mcp", enabled: false },
    ]
    const service = new McpToolService(configs)
    service.connect()
    await flushMicrotasks()

    const services = service.getActiveServices()
    expect(services[0].status).toBe("disabled")
  })

  it("returns empty tools when no servers are connected", async () => {
    mockClient.listTools.mockRejectedValue(new Error("Connection refused"))

    const { McpToolService } = await import("../mcp-tool-service.js")
    const configs: McpServerConfig[] = [
      { name: "broken", url: "http://localhost:1/mcp" },
    ]
    const service = new McpToolService(configs)
    service.connect()
    await flushMicrotasks()

    const tools = await service.getEnabledTools()
    expect(Object.keys(tools)).toHaveLength(0)
  })

  it("isToolReadOnly returns true for autoApproveTools when tool is found", async () => {
    mockClient.listTools.mockResolvedValue({
      tools: [
        { name: "safe_tool", description: "A safe tool", annotations: { readOnlyHint: false } },
        { name: "unsafe_tool", description: "Needs approval", annotations: {} },
      ],
    })
    mockClient.tools.mockResolvedValue({
      safe_tool: { description: "A safe tool" },
      unsafe_tool: { description: "Needs approval" },
    })

    const { McpToolService } = await import("../mcp-tool-service.js")
    const configs: McpServerConfig[] = [
      {
        name: "test",
        url: "http://localhost:9999/mcp",
        autoApproveTools: ["safe_tool"],
      },
    ]
    const service = new McpToolService(configs)
    service.connect()
    await flushMicrotasks()

    expect(service.isToolReadOnly("safe_tool")).toBe(true)
    expect(service.isToolReadOnly("unsafe_tool")).toBe(false)
    expect(service.isToolReadOnly("unknown")).toBe(false)
  })

  it("connects to a stdio server and exposes its tools", async () => {
    mockClient.listTools.mockResolvedValue({
      tools: [{ name: "stdio_tool", description: "A stdio tool", annotations: {} }],
    })
    mockClient.tools.mockResolvedValue({ stdio_tool: { description: "A stdio tool" } })

    const { McpToolService } = await import("../mcp-tool-service.js")
    const { createMCPClient } = await import("@ai-sdk/mcp")
    const configs: McpServerConfig[] = [
      {
        name: "test-stdio",
        transport: "stdio",
        command: "node",
        args: ["server.js"],
        env: { FOO: "bar" },
      },
    ]
    const service = new McpToolService(configs)
    service.connect()
    await flushMicrotasks()

    expect(mockStdioTransport).toHaveBeenCalledWith({
      command: "node",
      args: ["server.js"],
      env: { FOO: "bar" },
      cwd: undefined,
    })
    expect(createMCPClient).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: expect.anything(),
      })
    )

    const services = service.getActiveServices()
    expect(services[0].name).toBe("test-stdio")
    expect(services[0].status).toBe("connected")
    expect(services[0].url).toBeUndefined()
    expect(services[0].tools).toEqual(["stdio_tool"])
  })

  it("marks stdio server as error when command is missing", async () => {
    const { McpToolService } = await import("../mcp-tool-service.js")
    const configs: McpServerConfig[] = [
      {
        name: "bad-stdio",
        transport: "stdio",
      } as McpServerConfig,
    ]
    const service = new McpToolService(configs)
    service.connect()
    await flushMicrotasks()

    const services = service.getActiveServices()
    expect(services[0].status).toBe("error")
    expect(services[0].error).toContain('missing "command"')
  })

  it("marks http server as error when url is missing", async () => {
    const { McpToolService } = await import("../mcp-tool-service.js")
    const configs: McpServerConfig[] = [
      {
        name: "bad-http",
        transport: "http",
      } as McpServerConfig,
    ]
    const service = new McpToolService(configs)
    service.connect()
    await flushMicrotasks()

    const services = service.getActiveServices()
    expect(services[0].status).toBe("error")
    expect(services[0].error).toContain('missing "url"')
  })
})
