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

## Quality

```bash
npm run typecheck    # tsc --noEmit on both node and web tsconfigs
npm run lint
npm run test:run
npm run build        # Compile main + preload + renderer to out/
```

## Status

v0 — scaffolded. Parser, validator, and renderer come next. See [PROGRESS.md](PROGRESS.md).
