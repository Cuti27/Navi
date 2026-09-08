import { randomUUID } from "node:crypto"
import { PROVIDER_OPENCODE, type ProviderName } from "../config/provider.js"
import { OpenAIProvider } from "./openai-provider.js"

/**
 * OpenCode Go requires a stable session ID in the `x-opencode-session` header
 * on every request to optimize routing and prompt caching. Without it, the
 * provider rejects requests with a 400 `MissingSessionID` error.
 *
 * The session ID is generated once per provider instance (random UUID by
 * default) and can be overridden via `OPENCODE_SESSION_ID` to keep it stable
 * across restarts.
 */
export class OpencodeProvider extends OpenAIProvider {
    readonly name: ProviderName = PROVIDER_OPENCODE

    constructor(apiKey: string, baseUrl?: string, sessionId: string = randomUUID()) {
        super(apiKey, baseUrl, { "x-opencode-session": sessionId })
    }
}