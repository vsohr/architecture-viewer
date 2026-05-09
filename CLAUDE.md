# CLAUDE.md - Arch Viewer

This file provides guidance for Claude Code (claude.ai/code) when working with this codebase.

## Project Overview

Arch Viewer is an Electron desktop app for *reading* the architecture of a codebase. It renders a single source-of-truth markdown file (`ARCHITECTURE.md`) into interactive diagrams that drill down across abstraction levels. The diagram is authored elsewhere (typically by an LLM via Claude Code skills); the human is reading, exploring, and remembering — not building.

The wedge is UX: the competitive landscape (Lucidchart, Visio, Structurizr Lite, Confluence diagrams) all optimize for *building* diagrams. Arch Viewer treats architecture as **something you read like a map or a book**.

See:
- [docs/architecture-design.md](docs/architecture-design.md) — engineering design (DSL, parser, validator, IPC, layout, tech stack)
- [docs/ux-brief.md](docs/ux-brief.md) — UX brief (intent, tone, references, hierarchy, constraints)
- [PROGRESS.md](PROGRESS.md) — current status, milestones, next steps
- [FINDINGS.md](FINDINGS.md) — non-obvious discoveries from prior sessions

## Tech Stack

### Shell
- **Runtime:** Electron 33+ (ESM main + preload + renderer)
- **Bundler:** electron-vite
- **Language:** TypeScript 5+ (strict)
- **Lint:** ESLint 9 (flat config) + typescript-eslint
- **Tests:** Vitest (unit), Playwright (E2E against the packaged Electron app)

### Renderer
- **UI:** React 19, Vite
- **Styling:** Tailwind CSS 4 (CSS-first, `@tailwindcss/vite`)
- **Canvas:** React Flow 12 (`@xyflow/react`) with custom node components per kind
- **Layout:** ELK.js (`elkjs`) — `layered` algorithm per zoom level
- **State:** Zustand
- **Parsing:** js-yaml + Zod schema validation

### Main process
- **File watching:** chokidar (debounced)
- **IPC:** `model:update` (parsed AST), `model:error` (structured), `folder:open` (dialog)
- **Persistence:** `recent-repos.json` in `app.getPath('userData')` only — no DB

## Common Commands

```bash
# Development
npm run dev              # Start electron-vite in watch mode (opens app window)

# Build
npm run build            # Compile main + preload + renderer to out/
npm run package          # Package unsigned binary into dist/ (electron-builder --dir)
npm run dist             # Build distributable installers

# Quality
npm run typecheck        # tsc --noEmit on both node and web tsconfigs
npm run lint             # ESLint
npm run test:run         # Vitest, single run
npm run test             # Vitest watch mode
npm run test:e2e         # Playwright E2E (requires built app)
```

## Source Format (the file the app reads)

The viewer renders a single `ARCHITECTURE.md` file at the consumed-repo root. Format:

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

### DSL (YAML inside the fence)

One primitive — `node` — that nests via `children:` for hierarchy. C4-portable: system / container / component collapse into nesting depth.

Per node — required: `id`, `kind`, `purpose`. Optional: `name`, `tech`, `children`.

Closed node-kind vocabulary: `service | ui | datastore | queue | library | external`.

Edges are flat. Each: `from`, `to`, `kind`, optional `description`. Closed edge-kind vocabulary: `calls | reads | writes | publishes | subscribes | depends_on | owns`.

The closed vocabularies are load-bearing: they prevent the LLM from inventing a 14th relationship type that breaks rendering. `purpose` being required forces the LLM to articulate the *why*, which becomes hover/detail content.

## Architecture (this app)

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer (React + Vite)                   │
│  Canvas (React Flow + ELK)  │  Detail panel  │  Breadcrumb   │
└────────────────────────┬────────────────────────────────────┘
                         │ contextBridge IPC
┌────────────────────────▼────────────────────────────────────┐
│                       Main (Electron)                        │
│  chokidar watcher  │  YAML parser  │  Zod validator         │
└────────────────────────┬────────────────────────────────────┘
                         │ fs
                         ▼
                ARCHITECTURE.md (in opened folder)
```

### IPC Contracts

| Channel | Direction | Payload |
|---------|-----------|---------|
| `folder:open` | renderer → main (invoke) | returns `string \| null` (chosen folder, or null if canceled) |
| `model:update` | main → renderer (push) | parsed `ArchModel` AST |
| `model:error` | main → renderer (push) | `{ file, line?, col?, message }[]` |

Add new IPC by extending [src/preload/index.ts](src/preload/index.ts) and the corresponding handler in [src/main/index.ts](src/main/index.ts). Never expose `ipcRenderer` directly to the renderer — `contextIsolation` and `sandbox` are on by design.

## Project Structure

```
src/
  main/
    index.ts              # BrowserWindow setup, IPC handlers, app lifecycle
    watcher.ts            # chokidar wrapper, debounced (TODO)
    parser.ts             # YAML fence + HTML comment extraction (TODO)
    validator.ts          # Zod schemas → structured errors (TODO)
  preload/
    index.ts              # contextBridge exposing `window.archViewer`
    index.d.ts            # ambient typings for the renderer
  renderer/
    index.html
    src/
      main.tsx
      App.tsx
      components/         # React Flow nodes, breadcrumb, detail panel (TODO)
      stores/             # Zustand stores (TODO)
      lib/                # layout (ELK), URL-state, utilities (TODO)
      styles.css          # Tailwind entry
docs/
  architecture-design.md  # engineering design (this app)
  ux-brief.md             # UX brief (handoff to design)
out/                      # build output (gitignored)
worktrees/                # local worktrees (gitignored)
```

(File structure evolves; trust the working tree over this map. Update this map at major milestones.)

## Coding Conventions

### TypeScript
- **Strict mode** — no implicit any, strict null checks, no `any`
- **Type imports** — `import type { X }` for type-only
- **Error handling** — `catch (err: unknown)` with `instanceof Error` guards

### Naming
- **Files:** kebab-case (`watcher.ts`, `detail-panel.tsx`)
- **Classes / types:** PascalCase
- **Functions / variables:** camelCase
- **Constants:** SCREAMING_SNAKE_CASE
- **Interfaces:** PascalCase, no `I` prefix

### React
- Functional components only
- Hooks: useState, useEffect, useCallback, useRef, useMemo
- Colocate state close to usage; lift to Zustand only when shared

### File limits
- Max 800 lines per file (split if larger)
- Max 50 lines per function (extract if longer)
- Max 3 parameters; use objects for more

## Design Principles (carry over from the UX brief)

These shape engineering decisions, not just visuals:

1. **The renderer never mutates `ARCHITECTURE.md`.** No save buttons, no edit-node UI. Authoring happens elsewhere.
2. **Default state is quiet.** No always-visible toolbars or panels. UI surfaces appear when summoned.
3. **Drill-down is the hero moment.** Build the rendering pipeline so cinematic level-to-level transitions are *possible*, not retrofitted later. ID continuity across diffs is required.
4. **Keyboard parity with mouse for every interaction.**
5. **Animate diff updates** when the file changes externally. New nodes fade in; moved glide; removed fade out.
6. **Errors are calm and helpful**, never red-alarms-and-icons. Error text must be shaped so an LLM reading it can self-correct on the next pass.

## Pre-Push Gate (REQUIRED)

Before pushing to git, ALL of the following must pass:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Do not push if any of these fail. Fix the issues first.

## Git Worktrees

- **Always use a git worktree for any code changes.** Never work directly on main.
- Create worktrees inside this repo: `git worktree add worktrees/<branch> -b <branch>`
- Worktrees MUST live within the parent repo folder under `worktrees/` (gitignored).
- Exception: the very first scaffolding commit on an empty repo (no commits yet) cannot use a worktree because `git worktree add` requires at least one commit. From the second change onward, worktree always.

## Development Workflow

### Plan Mode and Execution Mode
1. You are ALWAYS the orchestrator. Use sub-agents for execution.
2. Make sure when planning that changes are small enough to 'one-shot' them. Keep scope small.
3. Execute in parallel with sub-agents whenever tasks are independent.

### After Every Code Change
1. Typecheck: `npm run typecheck`
2. Tests: `npm run test:run`
3. Code review: dispatch a sub-agent (`deep-review` skill for high-stakes work) before merging.

### Verification Checklist
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test:run` passes
- [ ] `npm run build` produces `out/` cleanly
- [ ] Manual verification in dev (`npm run dev`) if UI changed
- [ ] PROGRESS.md updated

## Gotchas

1. **ESM everywhere.** `"type": "module"` in package.json. The main and preload bundles are ESM. Match imports accordingly.
2. **`contextIsolation` + `sandbox` are ON.** The renderer can only talk to main via the bridge in [src/preload/index.ts](src/preload/index.ts). Add new IPC by extending that bridge — never expose `ipcRenderer` directly.
3. **CSP** is set in the renderer HTML. If you add a remote font/script source, update the CSP first.
4. **chokidar on Windows** can fire multiple events for one save. Debounce in the watcher (~150 ms) before re-parsing.
5. **ID continuity across reparses.** When the file changes, preserve node IDs across diffs so the renderer can animate moves rather than full re-mount. The parser/validator output is the single source of truth for IDs.
6. **ELK is async.** Layout returns a Promise. Keep layout off the React render path; compute, then commit.
7. **React Flow node rerender cost.** Memoize custom node components, or large diagrams will lag during transitions.
8. **Renderer is read-only.** No code path should write to `ARCHITECTURE.md`. If a feature seems to want to, the feature is wrong, not the constraint.

## Out of Scope for v1

- In-app LLM generation (handled by separate Claude Code skills authoring `ARCHITECTURE.md`)
- Comment authoring UI (HTML comments are hand- or LLM-edited)
- Discussion threads (anchor model in place; UI deferred)
- Multi-file architecture docs
- Workflow / sequence / deployment / data-flow lenses
- PNG/SVG export
- Tauri / VS Code extension shells
