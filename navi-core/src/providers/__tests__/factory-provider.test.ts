import { describe, it, expect, vi, beforeEach } from "vitest"
import { createProviderFactory, createProviderFromEnv } from "../factory-provider.js"
import { OpenAIProvider } from "../openai-provider.js"

describe("createProviderFactory", () => {
  it("creates an OpenAIProvider for 'openai'", () => {
    const provider = createProviderFactory("openai", "sk-test")
    expect(provider.name).toBe("openai")
    expect(provider).toBeInstanceOf(OpenAIProvider)
  })

  it("creates an OpencodeProvider for 'opencode'", () => {
    const provider = createProviderFactory("opencode", "sk-test")
    expect(provider.name).toBe("opencode")
  })

  it("throws for unsupported provider", () => {
    expect(() => createProviderFactory("anthropic" as never, "sk-test")).toThrow(
      "Unsupported provider: anthropic",
    )
  })

  it("throws for empty string provider", () => {
    expect(() => createProviderFactory("" as never, "sk-test")).toThrow(
      "Unsupported provider:",
    )
  })
})

describe("createProviderFromEnv", () => {
  beforeEach(() => {
    vi.stubEnv("AI_PROVIDER", "openai")
    vi.stubEnv("AI_PROVIDER_API_KEY", "sk-test")
  })

  it("creates provider from env variables", () => {
    const provider = createProviderFromEnv()
    expect(provider.name).toBe("openai")
  })

  it("throws when AI_PROVIDER_API_KEY is missing", () => {
    vi.stubEnv("AI_PROVIDER_API_KEY", "")
    expect(() => createProviderFromEnv()).toThrow("AI_PROVIDER_API_KEY is required")
  })
})
