import type { LanguageModel } from "ai"
import { createOpenAI, type OpenAIProvider as OpenAIProviderConfig } from "@ai-sdk/openai"
import { PROVIDER_OPENAI, type ProviderName } from "../config/provider.js"
import type { AIProvider } from "./ai-provider.js"

export class OpenAIProvider implements AIProvider {
    readonly name: ProviderName = PROVIDER_OPENAI
    private readonly client: OpenAIProviderConfig

    constructor(apiKey: string, baseUrl?: string) {
        this.client = createOpenAI({ apiKey, baseURL: baseUrl })
    }

    getModel(modelId: string): LanguageModel {
        // Force the chat completions API, which is the OpenAI-compatible
        // endpoint supported by OpenCode and most OpenAI-compatible proxies.
        return this.client.chat(modelId)
    }
}
