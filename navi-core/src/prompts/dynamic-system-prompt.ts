import { hostname, networkInterfaces } from "node:os"
import type { SystemPromptBuilder } from "./system-prompt-builder.js"
import type { ToolExecutor } from "../mcp/tool-executor.js"

export interface DynamicSystemPromptOptions {
    basePrompt: string
    toolExecutor: ToolExecutor
}

export class DynamicSystemPromptBuilder implements SystemPromptBuilder {
    constructor(private readonly options: DynamicSystemPromptOptions) {}

    build(): string {
        const now = new Date()
        const date = now.toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        const time = now.toLocaleTimeString("es-ES")
        const host = hostname()
        const ips = this.getLocalIps()
        const services = this.options.toolExecutor.getActiveServices()

        return [
            this.options.basePrompt,
            "",
            "## Contexto temporal y de entorno",
            `Fecha: ${date}`,
            `Hora: ${time}`,
            `Hostname: ${host}`,
            `IPs locales: ${ips.join(", ") || "no detectadas"}`,
            `Servicios MCP disponibles: ${services.map((s) => s.name).join(", ") || "ninguno"}`,
        ].join("\n")
    }

    private getLocalIps(): string[] {
        const ips: string[] = []
        const interfaces = networkInterfaces()
        for (const [name, addresses] of Object.entries(interfaces)) {
            if (!addresses) continue
            for (const address of addresses) {
                if (address.family === "IPv4" && !address.internal) {
                    ips.push(`${name}:${address.address}`)
                }
            }
        }
        return ips
    }
}
