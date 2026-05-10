# Arch Viewer Architecture

Arch Viewer is an Electron desktop app for reading architecture diagrams from a single source-of-truth `ARCHITECTURE.md` file in a repository. The main process owns native integration, file loading, validation, watching, and IPC. The preload bridge exposes a narrow API to the renderer. The renderer presents the map-like reading experience: drill-down canvas, node details, comments, validation errors, recent repos, keyboard navigation, node dragging, and pan state.

```arch
system: arch-viewer
name: Arch Viewer
nodes:
  - id: electron-platform
    kind: external
    name: Electron platform
    purpose: Provides BrowserWindow, native folder dialogs, shell integration, IPC, app lifecycle, and the sandboxed preload boundary.
    tech: Electron 33
  - id: main
    kind: service
    name: Main process
    purpose: Owns native desktop orchestration, repository opening, file watching, architecture parsing, validation, recent repo persistence, and model/error events.
    tech: TypeScript, Electron main, chokidar, js-yaml, Zod
    primary: true
    children:
      - id: window
        kind: service
        name: Window host
        purpose: Creates the BrowserWindow, configures sandboxed web preferences, loads Vite or built renderer output, and routes external URLs to the OS shell.
        tech: Electron BrowserWindow
      - id: ipc
        kind: service
        name: IPC router
        purpose: Handles folder/repo/recent-repo requests from preload and pushes parsed models or validation errors back to the renderer.
        tech: ipcMain
      - id: session
        kind: service
        name: Architecture session
        purpose: Tracks the active repository, starts the file watcher, debounces reloads, and dispatches parser results to IPC emitters.
        tech: TypeScript
      - id: repository
        kind: library
        name: Architecture repository
        purpose: Reads `ARCHITECTURE.md` from the selected folder and converts missing-file cases into structured validation errors.
        tech: Node fs
      - id: parser
        kind: library
        name: Parser and validator
        purpose: Extracts the `arch` YAML fence and HTML comments, validates the DSL, normalizes levels and edges, and returns renderer-ready model data.
        tech: js-yaml, Zod
      - id: recents
        kind: library
        name: Recent repo store
        purpose: Reads and writes the ordered recent repository list in Electron userData.
        tech: JSON, Node fs
  - id: preload
    kind: service
    name: Preload bridge
    purpose: Exposes the safe `window.archViewer` API for folder opening, recent repo loading, repo opening, and model/error subscriptions.
    tech: Electron contextBridge
  - id: renderer
    kind: ui
    name: Renderer UI
    purpose: Renders the architecture reading experience and manages canvas interaction state without mutating the source architecture file.
    tech: React 19, Vite, Tailwind CSS
    children:
      - id: app
        kind: service
        name: App orchestrator
        purpose: Holds loaded model state, current drill path, selected/hovered nodes, validation errors, command palette state, comments state, pan state, and persisted node position overrides.
        tech: React hooks, localStorage
      - id: canvas
        kind: ui
        name: Canvas stage
        purpose: Fits each rendered level into the viewport, draws edges and nodes, supports hover thumbnails, breadcrumb navigation, and Apple-Maps-style drill transitions.
        tech: React, SVG, CSS transforms
      - id: nodes
        kind: ui
        name: Node and edge components
        purpose: Encodes node and edge kinds visually, supports node selection, drill affordances, dragging, and edge highlighting.
        tech: React, SVG
      - id: panels
        kind: ui
        name: Panels and overlays
        purpose: Shows detail panels, comments drawer with anchor lines, validation panel, empty state, command palette, key hints, and topbar controls.
        tech: React
      - id: geometry
        kind: library
        name: Geometry helpers
        purpose: Computes fit transforms, node-fill zoom transforms, edge paths, and edge visual style data.
        tech: TypeScript
  - id: architecture-file
    kind: datastore
    name: Repository ARCHITECTURE.md
    purpose: Source-of-truth Markdown document containing prose, one `arch` YAML DSL block, and optional HTML comment annotations.
  - id: recent-repos-file
    kind: datastore
    name: recent-repos.json
    purpose: Persists recently opened repository paths in Electron's userData directory.
  - id: browser-storage
    kind: datastore
    name: Renderer localStorage
    purpose: Persists user-adjusted node positions by level and node id.
  - id: examples
    kind: library
    name: Example architectures
    purpose: Provides tracked sample `ARCHITECTURE.md` files used for manual exploration and parser coverage.
edges:
  - from: main
    to: electron-platform
    kind: calls
  - from: preload
    to: electron-platform
    kind: calls
  - from: renderer
    to: preload
    kind: calls
  - from: preload
    to: main
    kind: calls
  - from: main
    to: renderer
    kind: publishes
    description: Sends `model:update` and `model:error` IPC events.
  - from: main
    to: architecture-file
    kind: reads
  - from: main
    to: architecture-file
    kind: subscribes
    description: Watches the selected repository's architecture file with chokidar.
  - from: main
    to: recent-repos-file
    kind: reads
  - from: main
    to: recent-repos-file
    kind: writes
  - from: renderer
    to: browser-storage
    kind: reads
  - from: renderer
    to: browser-storage
    kind: writes
  - from: examples
    to: architecture-file
    kind: depends_on
  - from: main.ipc
    to: main.session
    kind: calls
  - from: main.ipc
    to: main.recents
    kind: calls
  - from: main.session
    to: main.repository
    kind: calls
  - from: main.session
    to: main.parser
    kind: calls
  - from: main.repository
    to: main.parser
    kind: calls
  - from: renderer.app
    to: renderer.canvas
    kind: calls
  - from: renderer.app
    to: renderer.panels
    kind: calls
  - from: renderer.app
    to: renderer.geometry
    kind: calls
  - from: renderer.canvas
    to: renderer.nodes
    kind: calls
  - from: renderer.canvas
    to: renderer.geometry
    kind: calls
  - from: renderer.nodes
    to: renderer.geometry
    kind: calls
```

<!-- @comment author:codex target:preload date:2026-05-10 -->
<!-- The preload bridge is intentionally narrow: renderer code gets `window.archViewer`, not direct Node or Electron access. Keep new native capabilities behind explicit preload methods. -->

<!-- @comment author:codex target:main.parser date:2026-05-10 -->
<!-- Edge validation is level-sensitive. A child-level edge must use endpoints visible in the child level, usually with dotted endpoints in the raw DSL that normalize to local node IDs. -->

<!-- @comment author:codex target:renderer.app date:2026-05-10 -->
<!-- Renderer state preserves node position overrides in localStorage, but it does not write back to `ARCHITECTURE.md`; authoring stays outside the app. -->

<!-- @comment author:codex target:main.session date:2026-05-10 -->
<!-- Watcher reloads are debounced and emit either a complete parsed model or structured validation errors. Full diff animation between consecutive parses is still planned work. -->
