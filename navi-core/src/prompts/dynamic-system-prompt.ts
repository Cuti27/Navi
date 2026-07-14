import { hostname, networkInterfaces } from "node:os"
import type { SystemPromptBuilder } from "./system-prompt-builder.js"
import type { ToolExecutor } from "../mcp/tool-executor.js"

export interface DynamicSystemPromptOptions {
    basePrompt: string
    toolExecutor: ToolExecutor
    memoryToolNames?: string[]
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

        const sections = [
            this.options.basePrompt,
            "",
            "## Contexto temporal y de entorno",
            `Fecha: ${date}`,
            `Hora: ${time}`,
            `Hostname: ${host}`,
            `IPs locales: ${ips.join(", ") || "no detectadas"}`,
            `Servicios MCP disponibles: ${services.map((s) => s.name).join(", ") || "ninguno"}`,
            "",
            "## Política de ejecución de herramientas (HITL)",
            "Cualquier herramienta que pueda modificar el estado del sistema requiere aprobación explícita del usuario.",
            "Si el usuario rechaza una herramienta, NO la reintentes. Informa del rechazo y ofrece alternativas si procede.",
            "Las herramientas de solo lectura están permitidas sin confirmación adicional.",
            "Tienes que intentar responder de una manera útil, pero concisa, ya que principalmente se va a ver en un telefono móvil."
        ]

        const memoryToolNames = this.options.memoryToolNames
        if (memoryToolNames && memoryToolNames.length > 0) {
            sections.push(
                "",
                "## Memoria a largo plazo",
                "Dispones de un sistema de memoria persistente implementado como ficheros markdown editables.",
                `Herramientas de memoria disponibles: ${memoryToolNames.join(", ")}.`,
                "- Cuando el usuario comparta una preferencia, hecho o instrucción que deba recordarse entre sesiones (por ejemplo: 'recuerda que...', 'mi setup tiene...'), usa `memory_save` con un título claro y una categoría apropiada.",
                "- Antes de responder sobre configuraciones, preferencias o detalles técnicos del usuario, usa `memory_search` para recuperar contexto relevante.",
                "- Usa `memory_list` para dar al usuario un resumen de lo recordado cuando te lo pida.",
                "- `memory_save` y `memory_update` escriben ficheros; requieren aprobación explícita. No guardes trivialidades ni información sensible.",
                "- `memory_search` y `memory_list` son de solo lectura y se ejecutan sin confirmación adicional."
            )
        }

        return sections.join("\n")
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
