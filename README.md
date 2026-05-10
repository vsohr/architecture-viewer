# Arch Viewer

A desktop app for *reading* the architecture of a codebase.

It renders a single source-of-truth markdown file (`ARCHITECTURE.md`) into interactive, drill-down diagrams. The diagram is authored elsewhere (typically by an LLM via Claude Code skills); this app is a viewer, validator, and comment surface.

## Where to start

- [docs/architecture-design.md](docs/architecture-design.md) — engineering design (DSL, parser, validator, IPC, layout, tech stack)
- [docs/ux-brief.md](docs/ux-brief.md) — UX brief handed to a separate Claude Design session
- [CLAUDE.md](CLAUDE.md) — working contract for Claude Code sessions
- [PROGRESS.md](PROGRESS.md) — current status and next steps

## Develop

```bash
npm install
npm run dev          # Launch the Electron app in watch mode
```

To see a populated diagram immediately, open this folder from the app:

```text
examples/traderank
```

## ARCHITECTURE.md format

Arch Viewer expects one `ARCHITECTURE.md` file at the opened folder root. The file should contain one fenced `arch` YAML block:

````markdown
```arch
system: traderank
nodes:
  - id: ingest
    kind: service
    purpose: Normalizes upstream market data.
    tech: Rust
  - id: orchestrator
    kind: service
    purpose: Sizes positions and dispatches orders.
    children:
      - id: risk
        kind: service
        purpose: Applies exposure and drawdown limits.
edges:
  - from: ingest
    to: orchestrator
    kind: calls
```

<!-- @comment author:vadim target:orchestrator date:2026-05-10 -->
<!-- Owns the decision loop and risk handoff. -->
````

Supported node kinds are `service`, `ui`, `datastore`, `queue`, `library`, and `external`.
Supported edge kinds are `calls`, `reads`, `writes`, `publishes`, `subscribes`, `depends_on`, and `owns`.

## Quality

```bash
npm run typecheck    # tsc --noEmit on both node and web tsconfigs
npm run lint
npm run test:run
npm run build        # Compile main + preload + renderer to out/
```

## Status

v0 foundation in progress. Renderer and backend data plumbing are in place: opening a folder reads and watches `ARCHITECTURE.md`, validates the DSL, persists recent repos, and pushes parsed models or structured errors to the renderer. Remaining work is tracked in [PROGRESS.md](PROGRESS.md).
