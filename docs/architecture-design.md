# Arch Viewer — v1 Design

*Working title. Date: 2026-05-09.*

A solo-first, read-mostly Electron app that renders architecture diagrams from a single source-of-truth markdown file living in the repo. LLMs (via Claude Code skills, designed separately) author the file; the app is a viewer, validator, and comment surface.

## Source format

One `ARCHITECTURE.md` at the repo root. Markdown prose for explanation, one fenced `arch` block carrying the structured DSL, HTML comments for annotations anchored to nodes.

````markdown
# <System> Architecture
Top-level prose: what the system does, why it exists.

```arch
system: <name>
nodes: [...]
edges: [...]
```

## Design notes
Long-form prose — surfaced in the renderer as "About this system".

<!-- @comment author:V target:<node-id> 2026-05-08 -->
<!-- Free-form annotation text, anchored to a node by id. -->
````

## DSL

YAML inside the fence. One primitive — `node` — that nests via `children:` for hierarchy. C4-portable: system / container / component collapse into nesting depth.

Per node — required: `id`, `kind`, `purpose`. Optional: `name`, `tech`, `children`.

Closed node-kind vocabulary: `service | ui | datastore | queue | library | external`.

Edges are a flat list. Each has `from`, `to`, `kind`, optional `description`. Closed edge-kind vocabulary: `calls | reads | writes | publishes | subscribes | depends_on | owns`.

IDs are dot-separated for human readability (`orchestrator.router`) but treated as opaque strings by the parser. Closed vocabularies prevent the LLM from inventing a 14th relationship type that breaks rendering. `purpose` being required forces the LLM to articulate the *why*, which becomes hover/detail content.

## Architecture

Electron, Vite-built React renderer.

**Main process.** `chokidar` watches `ARCHITECTURE.md` and debounces on change. Resolves the file via an "Open Folder" picker. Parses YAML + extracts HTML comments. Validates with Zod schema. Emits `model:update` (valid) or `model:error` (invalid) over IPC. No persistent storage beyond a `recent-repos.json` in `app.getPath('userData')`.

**Renderer.** React 19 + TypeScript 5 + Tailwind 4. React Flow 12 for canvas (custom node components per `kind`). ELK.js for hierarchical layout per level. js-yaml for parsing, Zod for validation. State management: Zustand (or plain React context — small surface).

**Panes.** Top: breadcrumb + zoom controls. Main: canvas. Right: detail panel (selected node's purpose, tech, anchored comments, "open in editor" link). Optional toggleable raw-markdown preview.

## Drill-down behavior

Stacked-level swap. Each zoom level renders only its level's nodes. Clicking a node-with-children swaps the canvas to that node's subtree. Breadcrumb shows the path: `traderank > orchestrator > router`.

Hover a parent → tooltip thumbnail of its children diagram. Saves a click in most cases.

URL-style state: `arch://<repo-handle>/<id-path>`. Every view is linkable. This is the foundation for future discussion threads, which will anchor to (repo, id-path).

## Visual encoding

Each `kind` gets a distinct React Flow node component:
service → rounded rectangle; ui → rectangle with a browser-frame icon; datastore → cylinder; queue → rectangle with stripe; library → small thin-border rectangle; external → dashed border, slightly faded.

Edges by `kind`: calls → solid arrow; reads/writes → solid with label icon; publishes/subscribes → dashed double-arrow; depends_on → dotted thin; owns → filled diamond head.

Layout: ELK `layered` algorithm per level. Node sizes constant per kind. No manual positioning in the DSL.

## Data flow

1. User opens folder → main process resolves `ARCHITECTURE.md`.
2. Main reads → parses YAML fence + HTML comments → validates with Zod.
3. On valid: emits `model:update` with the parsed AST.
4. On invalid: emits `model:error` with structured messages (file, line, col, message).
5. Renderer holds current model + current zoom-path. ELK lays out the visible level. React Flow renders.
6. File change → main re-parses → diffs → `model:update`. Renderer animates transitions where IDs match across diffs.

## Error handling

YAML parse errors → bottom error panel with line/col + link to open file in the OS editor.

Schema validation errors → same panel, structured messages ("node `orchestrator.router` references undeclared parent `orchestrator`"). Crucially, error text is shaped so an LLM reading it can self-correct on the next pass — this is what makes the format practically LLM-authorable without any LLM integration in the app.

Missing `ARCHITECTURE.md` → empty state with "Create starter" CTA that writes a stub (with an inline prompt comment for the LLM).

Edge referencing an unknown id → soft-error: render the rest, mark the bad edge in the panel.

File watcher errors (permissions, deletion) → toast + retry on next interaction.

## Helper features

- **Copy validation summary** — plain-text bundle of current errors for pasting into Claude.
- **Copy context pack** — repo tree (depth-limited), README, package.json / Cargo.toml / pyproject.toml + current ARCHITECTURE.md, copied to clipboard for pasting into Claude.
- **Starter template** — on a fresh repo, drops a stub with a prompt comment hinting at what to ask the LLM.

## UX

UX is the wedge. The competitive landscape (Lucidchart, Visio, Structurizr Lite, Confluence diagrams) all optimize for *building* diagrams; nothing optimizes for *reading* them. That gap is the entire opportunity, and engineering excellence alone won't capture it.

Visual and interaction design is handed off to a separate Claude Design session via a standalone brief: `arch-viewer-ux-brief.md`. The brief specifies intent, tone, references, hierarchy, and constraints — but not pixels. That's design's job. Engineering should treat the design output as a hard constraint to implement faithfully, not a suggestion.

Headline UX commitments encoded in the brief, repeated here so they shape engineering decisions:

- The default state is quiet. No always-visible toolbars or panels. UI surfaces appear when summoned (selection, hover, keyboard).
- The drill-down transition is the hero moment. Build the rendering pipeline so cinematic transitions between levels are actually possible, not retrofitted.
- Keyboard parity with mouse for every interaction.
- The renderer never mutates `ARCHITECTURE.md`. There is no "save," no "edit node." Authoring is elsewhere.
- Animate diff updates: new nodes fade in, moved nodes glide, removed nodes fade out, when the file is updated externally.

## Out of scope for v1 (noted, not designed)

- In-app LLM generation. Handled by Claude Code skills authored separately. The skill produces `ARCHITECTURE.md` compliant with the schema; the app validates and renders.
- Comment authoring UI. HTML comments are hand- or LLM-edited.
- Discussion threads. The (id-path) anchor model is in place; UI deferred.
- Multi-file architecture docs.
- Workflow / sequence diagrams.
- Multi-view (deployment, runtime, data flow lenses).
- PNG/SVG export.
- Multiple themes.
- Tauri / VS Code extension shells.

## Tech stack

Electron 30+, electron-builder, electron-vite. React 19, TypeScript 5, Tailwind 4. React Flow 12 (`@xyflow/react`), elkjs. js-yaml, zod, chokidar. Vitest + Playwright for tests.

## Testing

Fixtures: 10-15 `ARCHITECTURE.md` examples (valid + invalid) → snapshot tests on parser/validator output.

Renderer: react-testing-library on detail panel and breadcrumb logic.

Layout: ELK output is deterministic given fixed input → snapshot tests on layout coordinates for a couple of canonical fixtures.

E2E: Playwright opens Electron, picks a folder fixture, asserts canvas renders and drill-down navigates as expected.

## Open naming

Working name: "Arch Viewer". Real name TBD.
