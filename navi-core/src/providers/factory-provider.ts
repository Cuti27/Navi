import { PROVIDER_OPENAI, PROVIDER_OPENCODE, type ProviderName } from "../config/provider.js"
import { getLogger } from "../logger/logger.js"
import type { AIProvider } from "./ai-provider.js"
import { OpenAIProvider } from "./openai-provider.js"
import { OpencodeProvider } from "./opencode-provider.js"

const log = getLogger("provider")

/**
 * Creates an AI provider instance based on environment variables.
 * @returns An instance of the specified AI provider.
 */
export function createProviderFromEnv(): AIProvider {
    const rawName = process.env.AI_PROVIDER ?? ''
    const name = rawName.toLowerCase() as ProviderName

    const apiKey = process.env.AI_PROVIDER_API_KEY
    if (!apiKey) {
        throw new Error('AI_PROVIDER_API_KEY is required')
    }

    return createProviderFactory(name, apiKey)
}

/**
 * Creates an AI provider factory based on the given provider name and API key.
 * @param name The name of the AI provider.
 * @param apiKey The API key for the AI provider.
 * @returns An instance of the specified AI provider.
 * @throws Error if the provider is not supported or not implemented.
 */
export function createProviderFactory(name: ProviderName, apiKey: string): AIProvider {
    log.debug({ provider: name }, "creating provider")

    switch (name) {
        case PROVIDER_OPENAI:
            return new OpenAIProvider(apiKey)
        case PROVIDER_OPENCODE:
            return new OpencodeProvider(apiKey, process.env.AI_PROVIDER_API_URL)
        default:
            throw new Error(`Unsupported provider: ${name}`)
    }
}
