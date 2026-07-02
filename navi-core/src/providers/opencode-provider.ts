import { PROVIDER_OPENCODE, type ProviderName } from "../config/provider.js"
import { OpenAIProvider } from "./openai-provider.js"

export class OpencodeProvider extends OpenAIProvider {
    readonly name: ProviderName = PROVIDER_OPENCODE
}
