Requirements and Architecture Document: Navi (Homelab AI Agent)

> 🇪🇸 [Versión en español](./INIT.es.md)

1. Project Overview

Create an Artificial Intelligence agent named Navi, domain-specific and multimodal, designed to manage a "Homelab" infrastructure (Docker Swarm), act as a "Second Brain", and interact with local services. The agent must be secure, accessible on multiple platforms (mobile and desktop), 100% private in data collection, and highly extensible through the MCP (Model Context Protocol).

2. System Architecture (Client-Server in Monorepo)

Although the system is strictly "Single-User", a Client-Server architecture is adopted to solve two fundamental problems: multi-device synchronization (same history on PC and mobile) and network topology (the backend acts as a secure bridge inside the cluster's internal network to the MCPs). Everything will be managed under a Monorepo pattern (e.g. pnpm workspaces).

2.1. Presentation Layer (Frontend)

Technology: Vue.js 3 / Nuxt (compiled to SSG/SPA).

Multiplatform Deployment: Packaged natively via Tauri v2 for iOS, Android, Windows, macOS, and Linux.

Responsibilities:

- Responsive chat UI with thread/session support.
- SSE streaming consumption to render messages word by word and avoid UI blocking.
- Native/web audio capture.
- Image upload and preview from camera or gallery.
- Injection of the Master Token (Authentication) in all outgoing requests.

2.2. Orchestration and Logic Layer (Core Backend)

Technology: Node.js (Hono for its native Web Standards compatibility) + Vercel AI SDK.

Local Database: SQLite (with Drizzle ORM) for centralized history persistence.

Responsibilities:

- Safeguard the LLM API Key and validate the Master Token.
- Dynamic System Prompt: Inject local date, current time, and basic network info into each request to give Navi "temporal awareness".
- Streaming: Transmit the generated response and status events (Tool Calling) in real time to the Frontend using functions such as `streamText`.
- LLM context management (Hybrid Strategy: sliding window + summaries).
- Act as Main MCP Client: Connecting to internal MCP servers (`http://mcp-name:port`).

2.3. Inference Layer (AI and Processing)

Multimodal LLM (Brain + Vision): DeepSeek V4 Flash (or similar). Integrated via AI SDK.

Speech-to-Text (STT): Local container in the cluster running faster-whisper-server or similar.

2.4. Tools Layer (MCP Servers)

Independent microservices in the Swarm:

- `mcp-portainer`: Custom development. Exposes container status and restarts.
- `mcp-arr`: Custom development. Exposes series/movie searches and sends to downloads.
- `mcp-filesystem`: (Official/Existing). Mapped to the local knowledge base (Obsidian).

3. Functional Requirements (Use Cases)

Multimodal Interaction (Text, Voice, and Images):

- The user must be able to send commands by text or by recording voice notes.
- The user must be able to attach photographs.

Session and Memory Management (Hybrid Strategy):

- Centralized History: The system will store all messages in SQLite (Backend).
- LLM Context (Compaction): Payload composed of: [Dynamic System Prompt] + [Context Summary] + [Last N messages].

Orchestration Management (Portainer) & Multimedia (Arr):

- List/restart containers and send movies/series to downloads.

Memory and Knowledge Management (Obsidian):

- Search local `.md` notes, draft new notes, and archive images.

4. Non-Functional Requirements and Security

Master Authentication (Pre-Shared Key): The backend will be protected by a Master Token (e.g. PIN in `.env`).

External Credential Security: The frontend will not store keys. Everything will reside securely in the Backend environment variables.

Strict Database Persistence: To prevent agent amnesia during cluster updates, the backend SQLite database MUST always be mounted on a persistent physical volume (e.g. `/DATA/AppData/navi/db`).

Containerized Deployment: All server components must provide a Dockerfile and a `docker-compose.yml`.

Human-in-the-Loop (HITL) / Execution Contract: To guarantee total control over the infrastructure, any tool call (Tool Calling) through MCP that modifies the cluster or service state will require explicit confirmation. The Backend will pause execution and send an event to the Frontend, waiting for a boolean (Approved / Rejected) before proceeding.

5. Development Phases (Proposed Roadmap)

Phase 1: Core Base and Auth: Monorepo structure. Vue Frontend and Node Backend (Hono).

Phase 2: Persistence, Context, and Vision: SQLite integration (Drizzle) with persistent volumes and Hybrid Strategy.

Phase 3: Dynamic MCP Architecture and HITL: Backend implements the MCP Client and interruption logic for user tool approval.

Phase 4: Custom Tooling Development: Programming and integration of `mcp-portainer` and `mcp-arr`.

Phase 5: Local Voice Integration: Whisper deployment in the cluster.

Phase 6: Reactive UI and Multiplatform: Implementation of Navi's visual animations (reactive SVG face) and final packaging using Tauri v2.

6. Data Model (SQLite with Drizzle Preview)

### Table: sessions

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Unique chat session identifier. |
| title | TEXT | Automatically generated title. |
| context_summary | TEXT | Compacted conversation summary. |
| created_at | TIMESTAMP | Creation date. |
| updated_at | TIMESTAMP | Last modification. |

### Table: messages

| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Unique message identifier. |
| session_id | UUID (FK) | Relation to the sessions table. |
| role | VARCHAR | Sender role: user, assistant, system, or tool. |
| content | TEXT | Text content of the message. |
| image_url | TEXT | (Optional) Path of the attached image. |
| tool_calls | JSON | (Optional) Record of executed MCP tools. |
| created_at | TIMESTAMP | Send date. |

7. User Interfaces (UI/UX)

7.1. Main Chat View (The Interactive Core)

Top Banner (Dashboard and Avatar): A fixed area at the top containing:

- Left (Navi's Face): Interactive component based on an SVG prototype. Controlled through a Vue component and CSS styles, allowing reactive modification of attributes, shapes, and colors according to the agent state:
  - Idle: Resting / occasional blinking via CSS animations.
  - Thinking: Processing the prompt (SVG variable modification).
  - Tool Calling: Interacting with the cluster (in progress).
  - Awaiting Approval: Paused, blinking with an indicator (waiting for the user to accept or reject the action).
  - Compacting: Summarizing the database.
  - Error: Confused or alert state (network failure, API rejected).
- Right (Metrics): Telemetry panel (backend/network status).

Chat Area: Infinite scroll space, rendered word by word in streaming.

Tool Approval Cards (HITL): When the LLM decides to use a tool, an interactive card is rendered in the chat acting as a "contract" before execution:

- Descriptive icon and tool name (e.g. `mcp-portainer: restart_container`).
- Friendly description of what it is going to do (e.g. "Navi wants to restart the 'Jellyfin' stack").
- "Technical details" dropdown showing the JSON payload (so it is possible to debug exactly what data will be sent).
- Two large, clear buttons: **Authorize** (Green/Primary) and **Cancel Action** (Red/Secondary). If cancelled, the LLM is informed that the user aborted the operation.

Multimodal Input Bar: Text, attachments (camera/gallery), and microphone.

7.2. Sessions Panel (Navigation History)

Split Screen / Overlay Layout:

- Top Half: Background with large-scale Navi avatar (SVG).
- Bottom Half: List of previous chats grouped by date.
- Scroll Interaction: As the list is scrolled up, it gradually overlaps the Navi avatar with an elegant blur effect.

7.3. Secondary Views

Link Screen (Login): Minimalist interface asking for the Master Token on first launch.

Settings View: Local network parameters, list of active MCPs, System Prompt modification, and cache cleanup.

8. Versioning and Releases

To maintain stability and traceability in Homelab deployments, the project will adopt Semantic Versioning (SemVer 2.0.0) for both `navi-core` and future monorepo components.

- Software versions: `MAJOR.MINOR.PATCH` (for example, `0.1.0`).
- The REST API is already path-versioned (`/api/v1`) to allow future evolution without breaking old clients.
- Each release will be tagged with a git tag (`navi-core/v0.1.0`).
- Docker images will be published with semantic tags (`navi-core:0.1.0`, `navi-core:latest`).
- A `CHANGELOG.md` will be kept per component and breaking changes will be documented in major versions.

This scheme allows controlled deployment of improvements, quick rollback, and predictable compatibility between frontend and backend.
