# Arch Viewer - Progress Summary

## Current Status

- **Phase:** Scaffolding complete. Awaiting design handoff before renderer work begins.
- **Repo:** Electron + electron-vite + React 19 + Tailwind 4 + React Flow shell that boots and lets the user pick a folder. No parser, no canvas yet.
- **Design:** UX brief handed to a separate Claude Design session. Engineering blocked on visual + interaction direction for the canvas, drill-down transition, and detail panel.

## Active Project: v1 Foundation

### Phase 1 — Scaffold (DONE 2026-05-09)
- [x] Save design doc and UX brief into `docs/`
- [x] Initialize Electron + electron-vite + React 19 + Tailwind 4
- [x] Wire `folder:open` IPC dialog
- [x] Add CLAUDE.md, PROGRESS.md, FINDINGS.md, README.md, .gitignore
- [x] Initial commit + push

### Phase 2 — Parser & validator (NEXT)
- [ ] Zod schema for the DSL (nodes, edges, closed vocabularies)
- [ ] YAML fence extractor + js-yaml parse
- [ ] HTML comment extractor (`@comment author target date` form)
- [ ] Structured error shape: `{ file, line?, col?, message }`
- [ ] Fixture directory: 10–15 valid + invalid `ARCHITECTURE.md` examples
- [ ] Snapshot tests on parser + validator output

### Phase 3 — Watcher & IPC
- [ ] chokidar watcher with debounce
- [ ] `model:update` and `model:error` push channels
- [ ] Diff between consecutive parses (preserve IDs for animation)

### Phase 4 — Renderer (blocked on design)
- [ ] React Flow canvas wired to model store
- [ ] ELK layout per level
- [ ] Custom node components per `kind`
- [ ] Breadcrumb + drill-down state
- [ ] Detail panel
- [ ] Drill-down transition (hero moment per UX brief)
- [ ] Diff animation

### Phase 5 — Polish & helpers
- [ ] Copy validation summary
- [ ] Copy context pack
- [ ] Starter template CTA
- [ ] Recent repos list (`recent-repos.json`)
- [ ] Keyboard shortcuts (Linear-fast)

## Future Ideas (Parked)

See "Out of scope for v1" in [docs/architecture-design.md](docs/architecture-design.md) — discussion threads, multi-file docs, additional lenses (deployment / runtime / data flow), exports, alternate shells (Tauri, VS Code extension).

## Recent Changes (2026-05-09)
- Initialized repo from design doc + UX brief.
- Picked tech stack: Electron 33, electron-vite, React 19, Vite, Tailwind 4, React Flow 12, ELK.js, Zod, js-yaml, chokidar.
- Adopted `worktrees/` convention from the global CLAUDE.md (initial scaffolding on `main` because worktrees require a first commit; subsequent work moves to worktrees).
