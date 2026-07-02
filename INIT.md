Documento de Requisitos y Arquitectura: Navi (Homelab AI Agent)

1. Visión General del Proyecto

Crear un agente de Inteligencia Artificial llamado Navi, de dominio específico y multimodal, diseñado para administrar una infraestructura "Homelab" (Docker Swarm), actuar como un "Segundo Cerebro" e interactuar con servicios locales. El agente debe ser seguro, accesible en múltiples plataformas (Móvil y Escritorio), 100% privado en su recolección de datos y altamente extensible mediante el protocolo MCP (Model Context Protocol).

2. Arquitectura del Sistema (Cliente-Servidor en Monorepo)

Aunque el sistema es de uso estrictamente "Single-User" (mono-usuario), se adopta una arquitectura Cliente-Servidor para resolver dos problemas fundamentales: Sincronización multi-dispositivo (mismo historial en PC y móvil) y Topología de red (el backend actúa como puente seguro dentro de la red interna del clúster hacia los MCPs). Todo se gestionará bajo un patrón de Monorepo (ej. pnpm workspaces).

2.1. Capa de Presentación (Frontend)

Tecnología: Vue.js 3 / Nuxt (compilado a SSG/SPA).

Despliegue Multiplataforma: Empaquetable nativamente vía Tauri v2 para iOS, Android, Windows, macOS y Linux.

Responsabilidades:

Interfaz de chat (UI) responsiva con soporte para hilos/sesiones.

Consumo de Streaming (SSE) para renderizar mensajes palabra por palabra y evitar bloqueos en la UI.

Captura de audio nativa / web.

Subida y previsualización de imágenes desde la cámara o galería.

Inyección del Token Maestro (Autenticación) en todas las peticiones salientes.

2.2. Capa de Orquestación y Lógica (Backend Central)

Tecnología: Node.js (Hono por su compatibilidad nativa con Web Standards) + Vercel AI SDK.

Base de Datos Local: SQLite (con Drizzle ORM) para la persistencia centralizada del historial.

Responsabilidades:

Custodiar la API Key del LLM y validar el Token Maestro.

System Prompt Dinámico: Inyectar en cada petición la fecha local, hora actual e información básica de red para dotar a Navi de "conciencia temporal".

Streaming: Transmitir la respuesta generada y los eventos de estado (Tool Calling) en tiempo real hacia el Frontend usando funciones como streamText.

Gestión del contexto para el LLM (Estrategia Híbrida: ventana deslizante + resúmenes).

Actuar como Cliente MCP Principal: Conectándose a los servidores MCP internos (http://mcp-name:port).

2.3. Capa de Inferencia (IA y Procesamiento)

LLM Multimodal (Cerebro + Visión): DeepSeek V4 Flash (o similar). Integrado vía AI SDK.

Voz a Texto (STT): Contenedor local en el clúster ejecutando faster-whisper-server o similar.

2.4. Capa de Herramientas (Servidores MCP)

Microservicios independientes en el Swarm:

mcp-portainer: Desarrollo propio. Expone estado de contenedores y reinicios.

mcp-arr: Desarrollo propio. Expone búsquedas de series/películas y envíos a descargas.

mcp-filesystem: (Oficial/Existente). Mapeado a la base de conocimiento local (Obsidian).

3. Requisitos Funcionales (Casos de Uso)

Interacción Multimodal (Texto, Voz e Imágenes):

El usuario debe poder enviar órdenes por texto o grabando notas de voz.

El usuario debe poder adjuntar fotografías.

Gestión de Sesiones y Memoria (Estrategia Híbrida):

Historial Centralizado: El sistema almacenará todos los mensajes en SQLite (Backend).

Contexto LLM (Compactación): Payload compuesto por: [System Prompt Dinámico] + [Resumen del contexto] + [Últimos N mensajes].

Gestión de Orquestación (Portainer) & Multimedia (Arr):

Listar/reiniciar contenedores y enviar películas/series a descargar.

Gestión de Memoria y Conocimiento (Obsidian):

Buscar en las notas .md locales, redactar nuevas notas y archivar imágenes.

4. Requisitos No Funcionales y Seguridad

Autenticación Maestra (Pre-Shared Key): El backend estará protegido por un Token Maestro (ej. PIN en .env).

Seguridad de Credenciales Externas: El frontend no almacenará claves. Todo residirá de forma segura en las variables de entorno del Backend.

Persistencia Estricta de Base de Datos: Para evitar la amnesia del agente en las actualizaciones del clúster, la base de datos SQLite del backend DEBE montarse siempre sobre un volumen físico persistente (ej. /DATA/AppData/navi/db).

Despliegue Contenerizado: Todos los componentes de servidor deben proporcionar un Dockerfile y un docker-compose.yml.

Human-in-the-Loop (HITL) / Contrato de Ejecución: Para garantizar el control total sobre la infraestructura, cualquier llamada a una herramienta (Tool Calling) a través de MCP que modifique el estado del clúster o servicios, requerirá confirmación explícita. El Backend pausará la ejecución y enviará un evento al Frontend, esperando un booleano (Aprobado / Rechazado) antes de proceder.

5. Fases de Desarrollo (Roadmap Propuesto)

Fase 1: Core Base y Auth: Estructura del Monorepo. Frontend Vue y Backend Node (Hono).

Fase 2: Persistencia, Contexto y Visión: Integración de SQLite (Drizzle) con volúmenes persistentes y Estrategia Híbrida.

Fase 3: Arquitectura MCP Dinámica y HITL: Backend implementa el Cliente MCP y la lógica de interrupción para la aprobación de herramientas por parte del usuario.

Fase 4: Desarrollo de Tooling Propio: Programación e integración de mcp-portainer y mcp-arr.

Fase 5: Integración de Voz Local: Despliegue de Whisper en el clúster.

Fase 6: UI Reactiva y Multiplataforma: Implementación de las animaciones visuales (rostro reactivo en SVG) de Navi y empaquetado final usando Tauri v2.

6. Modelo de Datos (Preview de SQLite con Drizzle)

Tabla: sessions

Columna

Tipo

Descripción

id

UUID (PK)

Identificador único de la sesión de chat.

title

TEXT

Título generado automáticamente.

context_summary

TEXT

El resumen compactado de la conversación.

created_at

TIMESTAMP

Fecha de creación.

updated_at

TIMESTAMP

Última modificación.

Tabla: messages

Columna

Tipo

Descripción

id

UUID (PK)

Identificador único del mensaje.

session_id

UUID (FK)

Relación con la tabla sessions.

role

VARCHAR

Rol del emisor: user, assistant, system o tool.

content

TEXT

Contenido en texto del mensaje.

image_url

TEXT

(Opcional) Ruta de la imagen adjunta.

tool_calls

JSON

(Opcional) Registro de las herramientas MCP ejecutadas.

created_at

TIMESTAMP

Fecha de envío.

7. Interfaces de Usuario (UI/UX)

7.1. Vista Principal de Chat (El núcleo interactivo)

Banner Superior (Dashboard y Avatar): Un área fija en la parte superior que contiene:

Izquierda (El Rostro de Navi): Componente interactivo basado en un prototipo SVG. Se controla a través de un componente Vue y estilos CSS, permitiendo modificar atributos, formas y colores de manera reactiva según el estado del agente:

Idle: Reposo / Parpadeo ocasional mediante animaciones CSS.

Thinking: Procesando el prompt (modificación de variables SVG).

Tool Calling: Interactuando con el clúster (En progreso).

Awaiting Approval: Pausado, parpadeando con un indicador (esperando que el usuario acepte o rechace la acción).

Compacting: Resumiendo base de datos.

Error: Estado confuso o de alerta (falla de red, API rechazada).

Derecha (Métricas): Panel de telemetría (estado de red/backend).

Área de Chat: Espacio con scroll infinito, renderizado en streaming palabra por palabra.

Tarjetas de Aprobación de Tools (HITL): Cuando el LLM decide usar una herramienta, se renderiza una tarjeta interactiva en el chat que actúa como "contrato" antes de la ejecución:

Icono descriptivo y nombre de la herramienta (ej. mcp-portainer: restart_container).

Descripción amigable de lo que va a hacer (ej. "Navi quiere reiniciar el stack 'Jellyfin'").

Menú desplegable "Detalles técnicos" que muestre el payload en JSON (para poder depurar qué datos va a enviar exactamente).

Dos botones grandes y claros: 

$$Autorizar$$

 (Verde/Primario) y 

$$Cancelar Acción$$

 (Rojo/Secundario). Si se cancela, se informa al LLM de que el usuario abortó la operación.

Barra de Input Multimodal: Texto, adjuntos (cámara/galería) y micrófono.

7.2. Panel de Sesiones (Historial de Navegación)

Layout de Pantalla Dividida (Split Screen / Overlay):

Mitad Superior: Fondo negro con el avatar visual (SVG) de Navi a gran escala.

Mitad Inferior: Lista de chats previos agrupados por fechas.

Interacción de Scroll: Al scrollear la lista hacia arriba, esta se superpone gradualmente sobre el avatar de Navi mediante un difuminado elegante.

7.3. Vistas Secundarias

Pantalla de Vínculo (Login): Interfaz minimalista que solicita el Token Maestro en el primer inicio.

Vista de Configuración: Parámetros de red local, listado de MCPs activos, modificación del System Prompt y limpieza de caché.

8. Versionado y Releases

Para mantener estabilidad y trazabilidad en los despliegues del Homelab, el proyecto adoptará Semantic Versioning (SemVer 2.0.0) tanto para navi-core como para futuros componentes del monorepo.

- Versiones del software: `MAJOR.MINOR.PATCH` (por ejemplo, `0.1.0`).
- La API REST ya está versionada en path (`/api/v1`) para permitir evoluciones futuras sin romper clientes antiguos.
- Cada release se etiquetará con un git tag (`navi-core/v0.1.0`).
- Las imágenes Docker se publicarán con tags semánticos (`navi-core:0.1.0`, `navi-core:latest`).
- Se mantendrá un `CHANGELOG.md` por componente y se documentarán los cambios breaking en versiones mayores.

Este esquema permite desplegar mejoras de forma controlada, realizar rollback rápido y garantizar compatibilidad predecible entre frontend y backend.