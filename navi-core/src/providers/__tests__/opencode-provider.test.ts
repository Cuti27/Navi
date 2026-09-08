import { describe, it, expect, vi, beforeEach } from "vitest"
import { createOpenAI } from "@ai-sdk/openai"

vi.mock("@ai-sdk/openai", () => ({
    createOpenAI: vi.fn().mockReturnValue({ chat: vi.fn() }),
}))

import { OpencodeProvider } from "../opencode-provider.js"

const mockedCreateOpenAI = vi.mocked(createOpenAI)

describe("OpencodeProvider", () => {
    beforeEach(() => {
        mockedCreateOpenAI.mockClear()
    })

    it("always sends an x-opencode-session header", () => {
        new OpencodeProvider("sk-test")
        const [call] = mockedCreateOpenAI.mock.calls
        const headers = call?.[0]?.headers
        expect(headers?.["x-opencode-session"]).toBeDefined()
    })

    it("generates a stable session ID by default", () => {
        const provider = new OpencodeProvider("sk-test")
        expect(provider.name).toBe("opencode")
        const [call] = mockedCreateOpenAI.mock.calls
        expect(call?.[0]?.headers?.["x-opencode-session"]).toMatch(/^[0-9a-f-]{36}$/)
    })

    it("uses the provided session ID and base URL", () => {
        new OpencodeProvider("sk-test", "https://opencode.example.com", "mi-session")
        expect(mockedCreateOpenAI).toHaveBeenCalledWith({
            apiKey: "sk-test",
            baseURL: "https://opencode.example.com",
            headers: { "x-opencode-session": "mi-session" },
        })
    })
})