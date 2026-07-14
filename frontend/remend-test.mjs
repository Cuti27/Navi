import remend from 'remend'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, breaks: true, linkify: true, typographer: true })

const full = `## Hola

Me llamo Navi y soy tu asistente para el homelab.

Funciono sobre un conjunto de herramientas conectadas a través del protocolo MCP.

Aquí tienes tres cosas clave que puedo hacer por ti:

1. **Consultar documentación** técnica al instante desde wikis de GitHub.
2. **Recordar configuraciones** de tu homelab entre sesiones.
3. **Responder preguntas** contextuales sobre repositorios.`

// Simulate partial streaming: cut at various offsets
const cuts = [20, 80, 160, 260, 400, full.length]
for (const n of cuts) {
  const partial = full.slice(0, n)
  console.log('=== cut at', n, '===')
  console.log('INPUT:', JSON.stringify(partial))
  const healed = remend(partial)
  console.log('HEALED:', JSON.stringify(healed))
  console.log('HTML:', md.render(healed))
  console.log()
}