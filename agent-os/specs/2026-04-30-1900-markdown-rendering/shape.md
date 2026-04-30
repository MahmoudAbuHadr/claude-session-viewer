# Markdown Rendering for Assistant Text — Shaping Notes

## Scope

The replayer renders assistant `text` blocks verbatim through Ink's `<Text>` (`src/components/Turn.tsx:155`), so any markdown source — tables, headings, lists, code blocks, bold/italic — appears as literal pipes, hashes, asterisks, and dashes. Real Claude Code renders markdown. The user's reported pain was tables specifically; the underlying gap is broader.

This change adds a hybrid markdown renderer:

- **Parse** assistant text once with `marked.lexer()` (memoized via React `useMemo`).
- **Snap per assistant text block:** while `charsRevealed < text.length`, render raw markdown source. The instant streaming reveal completes (or `instant`/`forceInstant` is on), the entire block snaps to fully formatted Ink output.
- **Tables exception (atomic mid-stream):** the moment streaming reveal crosses the source range of a markdown table, that table renders as a fully-formatted Ink block in place — no pipes/dashes flicker. Surrounding prose continues streaming raw.
- **Markdown features:** GFM — headings (h1–h6), paragraphs (with `**bold**`, `*italic*`, `` `code` ``, `[links](url)`, `~~del~~`), ordered/unordered/nested lists (incl. task lists), fenced code blocks (no syntax highlighting), blockquotes, horizontal rules, tables.

## Decisions

- **Parser library:** `marked` — mature, GFM-by-default via `{gfm: true}`, single small dep, ships its own TypeScript types.
- **Snap granularity:** per assistant text block (not per-markdown-block). One visible flicker at end of each text block, no per-paragraph bookkeeping.
- **No streaming through inline-styled spans.** During reveal, the source is raw text; only when the whole block is revealed does it snap. This avoids slicing through `<Text bold>…</Text>` mid-character.
- **No syntax highlighting** for code fences. Dim grey indented body. Deferred.
- **No type changes** to `AssistantBlock` in `src/types.ts`. Markdown is parsed at render time inside `Turn.tsx` and memoized.
- **Table renderer** uses simple aligned-columns + horizontal rule under the header (no inner pipes), 2-space gutter — closest to real Claude Code.
- **Graceful parse failure:** if `marked.lexer` throws, return a single paragraph block containing the raw text. Renderer never crashes the app.

## Out of Scope

- Code-block syntax highlighting.
- Per-markdown-block snap (streaming reveal that flips paragraph-by-paragraph).
- Streaming through inline-styled spans (e.g. `**bold**` rendering bold as it reveals one char at a time).
- Type changes to `AssistantBlock`.
- Changes to any non-text assistant block (`tool_use`, `thinking`).
- Heading style differentiation beyond bold + simple color (no rules under H1, no chunky underlines).
- Clickable links (real CC doesn't make them clickable in Ink either).
- Snapshot/component tests for markdown rendering — relies on smoke tests, matching the project's existing pattern.

## Context

- **Visuals:** None. Reference is real Claude Code output side-by-side.
- **References:** see `references.md`.
- **Product alignment:** `agent-os/product/mission.md` — "visually indistinguishable from a live session" is a stated mission. Markdown parity is a v3-class fidelity gap.

## Standards Applied

- `agent-os/standards/ink/component-shape.md` — plain typed functions, named `XxxProps` interfaces.
- `agent-os/standards/ink/layout.md` — Box for layout, Text for content; bare strings inside Box throw.
- `agent-os/standards/typescript/import-extensions.md` — `.js` extensions on local imports.
- `agent-os/standards/typescript/import-type.md` — `import type` for type-only imports.

## Behavior Contracts

The implementation tasks in `plan.md` each declare their behavior contract. Quick index:

- Task 2: `parseMarkdown(text)` produces `{blocks, tableRanges}` from raw markdown source — `src/markdown/parse.ts`.
- Task 3: `RenderedMarkdown({doc})` Ink component plus per-block sub-components + inline span rendering — `src/markdown/render.tsx`.
- Task 4: `Turn.tsx` `RenderedBlock` for text blocks integrates parsed doc with streaming reveal, snaps on completion, splices atomic tables during reveal.
