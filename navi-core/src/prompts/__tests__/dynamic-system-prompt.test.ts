import { describe, it, expect, vi, beforeEach } from "vitest"
import { DynamicSystemPromptBuilder } from "../dynamic-system-prompt.js"

vi.mock("node:os", () => ({
  hostname: () => "test-host",
  networkInterfaces: () => ({
    eth0: [
      {
        family: "IPv4",
        address: "192.168.1.10",
        internal: false,
      },
    ],
  }),
}))

function createMockToolExecutor() {
  return {
    connect: vi.fn(),
    getActiveServices: () => [{ name: "test-service", url: "http://test", status: "connected" as const, tools: ["tool1"] }],
    getAvailableTools: () => [],
    getEnabledTools: () => Promise.resolve({}),
    setToolEnabled: vi.fn(),
    isToolReadOnly: () => false,
  }
}

describe("DynamicSystemPromptBuilder", () => {
  let builder: DynamicSystemPromptBuilder

  beforeEach(() => {
    builder = new DynamicSystemPromptBuilder({
      basePrompt: "Eres Navi, un asistente útil.",
      toolExecutor: createMockToolExecutor(),
    })
  })

  it("builds a system prompt containing the base prompt", () => {
    const result = builder.build()
    expect(result).toContain("Eres Navi, un asistente útil.")
  })

  it("includes environment context", () => {
    const result = builder.build()
    expect(result).toContain("test-host")
    expect(result).toContain("192.168.1.10")
    expect(result).toContain("test-service")
  })

  it("includes date in Spanish locale", () => {
    const result = builder.build()
    expect(result).toContain("Contexto temporal y de entorno")
    expect(result).toContain("Hora:")
  })

  it("includes HITL policy section", () => {
    const result = builder.build()
    expect(result).toContain("Política de ejecución de herramientas")
    expect(result).toContain("HITL")
    expect(result).toContain("aprobación explícita")
  })

  it("includes memory section when memory tool names are provided", () => {
    const builderWithMemory = new DynamicSystemPromptBuilder({
      basePrompt: "Eres Navi.",
      toolExecutor: createMockToolExecutor(),
      memoryToolNames: ["memory_search", "memory_save"],
    })
    const result = builderWithMemory.build()
    expect(result).toContain("Memoria a largo plazo")
    expect(result).toContain("memory_search")
    expect(result).toContain("memory_save")
  })

  it("omits memory section when no memory tools", () => {
    const result = builder.build()
    expect(result).not.toContain("Memoria a largo plazo")
  })

  it("mentions mobile-concise style instruction", () => {
    const result = builder.build()
    expect(result).toContain("telefono móvil")
  })
})
