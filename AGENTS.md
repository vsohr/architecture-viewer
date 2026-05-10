# Repository Guidelines

## Project Structure & Module Organization

This is an Electron + Vite + React TypeScript desktop app. Runtime code lives under `src/`:

- `src/main/` contains Electron main-process code.
- `src/preload/` contains preload bridge code and shared preload types.
- `src/renderer/` contains the React UI, including `App.tsx`, `main.tsx`, and `styles.css`.
- `docs/` holds product and architecture notes, especially `docs/architecture-design.md` and `docs/ux-brief.md`.
- Build output goes to `out/`; packaged artifacts go to `dist/`. Do not edit generated output.

## Build, Test, and Development Commands

Use npm scripts from the repository root:

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` launches the Electron app in watch mode.
- `npm run build` compiles main, preload, and renderer code into `out/`.
- `npm run preview` or `npm start` runs the built app preview.
- `npm run package` builds an unpacked Electron package.
- `npm run dist` creates distributable Electron artifacts.
- `npm run typecheck` runs both Node and web TypeScript checks.
- `npm run lint` runs ESLint across the repo.
- `npm run test:run` runs Vitest once; `npm test` starts Vitest in watch mode.
- `npm run test:e2e` runs Playwright tests when E2E specs are present.

## Coding Style & Naming Conventions

Use TypeScript modules and keep process boundaries explicit: main-process logic in `src/main`, preload API shape in `src/preload`, and UI code in `src/renderer`. Follow the existing four-space indentation used in configuration files. Prefer descriptive names, such as `architectureParser.ts`, `validateDiagram`, or `useDiagramStore`. Run `npm run lint` and `npm run typecheck` before handing off changes.

## Testing Guidelines

Use Vitest for unit tests and Playwright for end-to-end tests. Place tests near the code they cover or in a clearly named test folder. Use behavior-focused names, for example `architectureParser.test.ts` or `viewer-loads-architecture.spec.ts`. Add tests for parser, validator, IPC, and state-management behavior as those modules are introduced.

## Commit & Pull Request Guidelines

The current history uses Conventional Commit style, for example `chore: initial scaffold`. Continue with short, imperative messages such as `feat: add markdown parser` or `fix: validate duplicate node ids`. Pull requests should include a concise summary, verification commands run, linked issues if applicable, and screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

Push back on requests or implementation ideas that do not make technical or product sense. Explain the concern clearly, propose a practical alternative, and keep changes scoped to the repository's current architecture.
