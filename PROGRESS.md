# Arch Viewer - Progress Summary

## Current Status

- **Phase:** Backend data plumbing implemented. The app now opens a repo, reads/watches `ARCHITECTURE.md`, validates the DSL, pushes parsed models/errors over IPC, and renders parsed data instead of the Traderank fixture.
- **Repo:** Electron + electron-vite + React 19 + Tailwind 4 shell with a fully designed canvas: drill-down transition, detail panel, comments drawer with anchor lines, hover thumbnail, validation panel, command palette, empty state, keyboard parity.
- **Data:** Runtime data comes from a parsed `ARCHITECTURE.md`. The old `TRADERANK` fixture remains in the repo as sample/reference data but is no longer used by `App.tsx`.

## Active Project: v1 Foundation

### Phase 1 — Scaffold (DONE 2026-05-09)
- [x] Save design doc and UX brief into `docs/`
- [x] Initialize Electron + electron-vite + React 19 + Tailwind 4
- [x] Wire `folder:open` IPC dialog
- [x] Add CLAUDE.md, PROGRESS.md, FINDINGS.md, README.md, .gitignore
- [x] Initial commit + push

### Phase 2 — Renderer port (DONE 2026-05-10)
- [x] Pull Claude Design bundle, extract, read chat + sources
- [x] Lock variant: appleMaps · spacious · violet · drawer (Tweaks pane dropped)
- [x] Port styles.css verbatim (with tailwind import preserved)
- [x] Port `nodes` (KindGlyph, NodeCard, EdgeLine, edge geometry) to TS
- [x] Port `canvas` (Stage, HoverThumbnail, Breadcrumb) to TS
- [x] Port `panels` (DetailPanel, CommentsDrawer + AnchorLines, ValidationPanel, EmptyState, CommandPalette, KeyHints, Topbar) to TS
- [x] Port App orchestrator with Apple-Maps drill-down, drag-to-move + localStorage persistence, right-click pan
- [x] Wire `EmptyState.onOpenFolder` to the existing `folder:open` IPC channel
- [x] Typecheck, lint, build all clean

### Phase 3 — Parser & validator (DONE 2026-05-10)
- [x] Zod schema for the DSL (nodes, edges, closed vocabularies)
- [x] YAML fence extractor + js-yaml parse
- [x] HTML comment extractor (`@comment author target date` form)
- [x] Structured error shape: `{ file, line?, col?, message }`
- [ ] Fixture directory: 10–15 valid + invalid `ARCHITECTURE.md` examples
- [x] Focused parser + validator tests

### Phase 4 — Watcher & IPC plumbing
- [x] chokidar watcher with debounce
- [x] `model:update` and `model:error` push channels
- [ ] Diff between consecutive parses (preserve IDs for animation)
- [x] Replace `TRADERANK` fixture in renderer with the parsed model

### Phase 5 — Polish & helpers
- [ ] Real Copy validation summary (currently flashes a toast)
- [ ] Real Copy context pack (currently flashes a toast)
- [ ] Starter template CTA writes a stub file
- [x] Recent repos persistence (`recent-repos.json` in `app.getPath('userData')`)
- [ ] Keyboard shortcut to reset node positions / recenter view (was on the dropped Tweaks pane)

## Future Ideas (Parked)

See "Out of scope for v1" in [docs/architecture-design.md](docs/architecture-design.md) — discussion threads, multi-file docs, additional lenses, exports, alternate shells.

## Recent Changes
- **2026-05-10** — Ported Claude Design bundle to React 19 + TypeScript. Variant locked; Tweaks pane dropped per direction. Empty-state CTA wired to real folder IPC.
- **2026-05-10** — Added backend parser/validator, file loader, chokidar watch session, IPC push channels, renderer model/error subscriptions, and recent repo persistence.
- **2026-05-09** — Initialized repo from design doc + UX brief. Picked tech stack: Electron 33, electron-vite, React 19, Vite, Tailwind 4, React Flow 12, ELK.js, Zod, js-yaml, chokidar.
