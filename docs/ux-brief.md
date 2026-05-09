# Arch Viewer — UX Design Brief

*A handoff document. Date: 2026-05-09.*

## What this is

This is a brief for the Claude Design session that will produce the visual and interaction design for Arch Viewer. It describes intent, tone, references, hierarchy, and constraints. It does **not** specify pixels — no colors, no fonts, no component drawings. That's design's job. The brief's job is to make sure design solves the right problem.

Read this end-to-end before producing any visuals. Then ask any clarifying questions before opening Figma.

---

## The product, in one paragraph

Arch Viewer is a desktop app for *reading* the architecture of a codebase. It renders a single source-of-truth markdown file (`ARCHITECTURE.md`) into interactive diagrams that drill down across abstraction levels. The diagram is authored by an LLM; the human is reading, exploring, and remembering — not building. The user is in a thinking posture, alone, looking at a system they want to understand.

## Why UX is the wedge

The competitive landscape is unusual. Lucidchart, Visio, Structurizr Lite, Draw.io, Confluence diagrams — every mainstream architecture tool optimizes for **building** diagrams. Toolbars, palettes, options, dialogs. They feel like CAD. None of them treat architecture diagrams as **something you read like a map or a book**.

That gap is the entire opportunity. Engineering excellence is necessary but not sufficient — the engineering design we already have (React Flow + ELK + a small DSL) is the same shape any competent team would arrive at. What will make this product remarkable is treating it as a reading instrument, not a productivity tool. UX excellence isn't decoration here; it's the product.

## The user

A senior developer or architect, alone, opening a repo to understand or recall how a system fits together. They might be:
- Onboarding to an unfamiliar codebase
- Coming back to their own system after months away
- Preparing to make a change and needing to remember the contracts
- Showing the system to themselves so they can think about it

They have a single monitor, sometimes two. They're concentrating. They have taste. They've used Linear, Notion, Figma. They will not tolerate visual clutter or fight a tool to do simple things. They are *not* trying to author the diagram — that happens elsewhere (in their editor, with an LLM).

## Tone

Calm. Confident. Quiet. Spacious. Fast. Considered. Dense-where-it-counts. Map-like. Reading-instrument. Inviting.

Not: busy, loud, corporate, utilitarian-grey, "engineered," icon-soup, or chrome-heavy.

## References — good

These shape the right vibe. Pull from them.

- **Linear** — keyboard-first, opinionated, ruthless about removing chrome. Every visible element is earning its place.
- **Apple Maps / Google Maps** — drill-down through zoom; rich tiles; UI hides until summoned; the content is the experience.
- **Are.na** — content-first, generous whitespace, thinking-tool posture rather than productivity-tool posture.
- **Notion in quiet reading mode** — hierarchy through type scale and weight, not boxes and color.
- **Reader by Readwise** — focused reading; everything serves the page.
- **Vercel and Linear marketing sites** — typography-led, dense but breathable, restraint as a design value.
- **Excalidraw** — warmth and play without losing professional credibility. (Especially relevant for the comments-as-marginalia idea.)

## References — bad

These embody what to avoid.

- **Lucidchart, Visio, Draw.io** — toolbar overload, builder posture, options surfaced everywhere.
- **Confluence diagrams** — corporate beige with no opinion.
- **Generic enterprise dashboards** — chart-junk, padding without purpose, no editorial voice.
- **Bootstrap admin templates** — soulless, every feature exposed because someone might want it.
- **Most node-graph viz tools** (force-directed graph viewers, dependency graph dashboards) — cold, screensaver-feeling, no narrative.

## The central interaction

Drill-down through abstraction levels is **the** core interaction. Everything else exists to support it. When the user clicks a node that has children, they should feel like they're moving through space — *into* a system, not *swapping* a panel.

The transition is what sells the metaphor. Apple Maps when you zoom from a country to a street is the right reference: smooth, intentional, with a sense of going somewhere. Hard cuts will kill the feeling. So will overdone animations.

When the user navigates back via the breadcrumb, they should feel like they're stepping out, not like the app reset to a previous state.

This single interaction, done with disproportionate care, will define how the product feels. Treat it as the hero moment.

## Information hierarchy

In descending order of dominance:

1. **The diagram.** The canvas is 80%+ of the visual real estate. The user came here to see this.
2. **The breadcrumb.** Small but persistent and beautiful. It's the user's locator and navigational spine. Think of it like a browser's URL bar — modest, central, always available.
3. **The selected node's detail panel.** Appears on selection. Rich, well-typeset, treats the user like a reader who can handle prose.
4. **Annotations / comments.** Marginalia, not chat. Should evoke handwritten notes in the margin of a book — calm, considered, anchored to a node.
5. **Validation errors.** Quiet by default; surface clearly when present; never alarmist.
6. **Toolbar / chrome.** Should barely exist. Open Folder, Recent, settings — tucked away, summonable.

## Default state — quiet

A user just looking at a diagram should see almost nothing but the diagram and the breadcrumb. No always-visible side panels. No floating toolbars. UI surfaces appear when summoned — by selection, hover, or keyboard. If a control isn't being used right now, it shouldn't be on screen.

This is the principle that most distinguishes Arch Viewer from its competitors. Every architecture tool puts toolbars and palettes around the diagram. Arch Viewer puts the diagram around the diagram.

## Density — earn the pixels you use

When information *does* appear — detail panel, comments, errors — be generous with content and restrained with chrome. Typography does the work, not borders and dividers. Padding should breathe, not pad. Hierarchy comes from scale and weight, not from boxing things.

The user is a developer who reads. Treat them like one.

## Cognitive ergonomics — easy

"Easy" here means the user understands what they're looking at within seconds, every time. Specifically:

- The diagram should be readable without a legend on first view. The visual encoding for node kinds and edge kinds should teach itself in roughly thirty seconds.
- The breadcrumb tells the user *where they are* in the hierarchy at all times, without them needing to track it.
- A node's purpose is one click (or hover) away — never buried.
- The user can always get back to the top with one keystroke or one click on the first breadcrumb segment.
- Empty states explain themselves. The user should never wonder "what do I do now?"

When in tension, choose ease over completeness. We can always surface more later.

## Keyboard parity

Every mouse-driven interaction has a keyboard equivalent. The product should feel Linear-fast for someone who never reaches for the trackpad. Suggested mapping (design can refine):

- Drill into selected node: Enter or →
- Ascend a level: Esc or ←
- Move selection between sibling nodes: arrow keys or hjkl
- Jump to a node by name: /
- Toggle detail panel: Tab
- Open folder: Cmd/Ctrl-O
- Recent repos: Cmd/Ctrl-P
- Copy context pack: Cmd/Ctrl-Shift-C

Keyboard hints should appear contextually and faded, never in an always-visible help bar.

## Visual encoding — intent, not specification

Each node kind (`service | ui | datastore | queue | library | external`) needs a recognizable visual identity. The encoding should be readable from a small thumbnail, hold up at multiple zoom levels, survive in greyscale (color is a secondary channel; shape and weight do the work), and avoid icon-soup. Restraint over decoration.

Each edge kind (`calls | reads | writes | publishes | subscribes | depends_on | owns`) needs a visual vocabulary too. Same principles. The user should learn the vocabulary in 30 seconds and not need a legend after that.

Design picks the actual encodings. The brief's only opinion: shape and weight first, color second.

## Empty states and edge cases

These are the moments most apps phone in. They're high-value here, because they shape the first impression and the recovery experience.

- **First open, no `ARCHITECTURE.md`.** Should feel inviting, not error-y. A canvas with a single CTA-as-content. Personality is welcome.
- **Validation errors.** Calm, structured, helpful. Never red-alarms-and-icons. The user (or their LLM) needs to fix something — treat that as a normal task, not a failure state.
- **File reload after external edit.** When the LLM updates `ARCHITECTURE.md` in another window, the diagram should *animate* the change. New nodes fade in. Moved nodes glide. Removed nodes fade out. The animation is information.

## Native feel

Even though it's Electron, the app should feel native to the OS. Frosted/translucent toolbars where the OS supports them. System UI font. Window chrome integrated cleanly with the OS. Resist Electron's pull toward generic web-app uniformity. macOS users should feel they're using a Mac app; Windows users should feel they're using a Windows app.

## Engineering constraints

These are fixed and shape what's possible:

- Renderer is React Flow + ELK.js. Custom node components are React components. Layout is computed by ELK and passed to React Flow. This means animation between levels is implementable but non-trivial — design should know it's a real frame to fit within.
- Drill-down is a "stacked-level swap" — the canvas swaps to render the children of a node, rather than expanding the parent in place. The transition between levels is where the cinematic feel goes.
- One source of truth: `ARCHITECTURE.md` in the repo. The renderer never mutates the file. The UI should never imply that it does — there is no "save," there is no "edit node." Authoring happens elsewhere.
- Light and (optional) dark themes — but commit to one as primary and execute it well. Both done OK is worse than one done excellently.

## Success criteria

A user who has used Lucidchart and Structurizr should open Arch Viewer for the first time and think: *this is what reading architecture should have always felt like.*

Specifically:
- They drill into a node and the transition makes them smile the first time.
- They notice the absence of toolbar clutter and feel relief.
- They use it for ten minutes and find a keyboard shortcut they didn't know they wanted.
- They show it to a colleague the same week.
- The detail panel makes them want to read every node's purpose, not skim.
- Empty states and errors don't break the spell.

## Anti-goals

- Do not design for diagram authoring. The user authors elsewhere.
- Do not include features just because competitors have them.
- Do not add a sidebar tree of all nodes; the breadcrumb plus the canvas is the navigation. The burden of proof is on adding the tree, not removing it.
- Do not animate things that do not need animation. The drill-down is the cinematic moment; almost nothing else needs choreography.
- Do not overdesign empty states into marketing pages. They're functional moments with personality, not landing pages.

## What to produce

A complete visual and interaction design covering:

- Default canvas state (typography, spacing, node and edge encoding per kind, breadcrumb)
- Selection state and the detail panel
- Drill-down transition (the hero moment — give it disproportionate attention)
- Hover-preview thumbnail of a parent's children
- Comments and annotations as marginalia
- Validation error panel and inline error markers
- Empty / first-run state
- Recent repos / open folder UI
- Keyboard hint surfacing pattern
- Primary theme (light or dark — pick one and execute it). Secondary theme can come later.

A handful of hi-fi mockups of canonical states is the right deliverable shape — top-level system view, drilled-in component view, selected node with comments, validation error state, empty first-run state. Component-level specs (variants, states, tokens) can follow once the direction lands.

## Open questions for design

These are deliberately not decided in this brief — design should propose:

- How does the drill-down transition actually look? (Reference: Apple Maps zoom; the brief is opinion-strong on intent, opinion-light on mechanics.)
- Where do keyboard hints surface? Inline-on-hover? Bottom hint bar that fades? Cmd-K palette only?
- How do comments visually relate to their anchor node? Connected by a line? Drawer that opens on the side? Floating cards?
- What does the breadcrumb look like at depth 1 vs 5? Does it ever truncate? How?
- Light vs dark as primary? Argue for one.
