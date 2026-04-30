# Markdown Rendering for Assistant Text — Hybrid (Block-aware on completion + Tables atomic mid-stream)

## Context

The replayer dumps assistant `text` blocks into Ink's `<Text>` verbatim (`src/components/Turn.tsx:155`), so any markdown — tables, headings, lists, code blocks, bold/italic — renders as literal pipes, hashes, asterisks, and dashes. Real Claude Code renders all of this. The bug the user reported was tables specifically; the underlying gap is broader.

Stated product goal (from `agent-os/product/mission.md`) is "visually indistinguishable from a live session." Neither the v1 design doc nor the v2 fidelity doc covered markdown — this is a v3-class fidelity item.

Chosen shape (after discussion):

- **Parser:** add `marked` as a dependency, use `marked.lexer()` to produce a typed token tree.
- **Snap granularity:** per assistant text block. While `charsRevealed < text.length` we render raw markdown source; the moment `charsRevealed === text.length` (or `instant` mode is on), the entire block snaps to fully formatted Ink output.
- **Tables exception:** tables render atomically *during* streaming the moment `charsRevealed` crosses into their source range — this is the user's reported pain point and pipes-mid-reveal look the worst.
- **Markdown scope:** full block + inline — headings, paragraphs (with `**bold**`, `*italic*`, `` `code` ``, `[links](url)`), lists (ordered/unordered/nested), fenced code blocks (no syntax highlighting — deferred), blockquotes, horizontal rules, GFM tables.
- **Code-block syntax highlighting:** explicitly out of scope for this PR.
- **Streaming reveal does not slice through inline-styled spans** — that complexity is avoided entirely by snapping at end-of-block.

## Approach

Two new modules under a new `src/markdown/` directory and a small wiring change in `Turn.tsx`. No type changes to `AssistantBlock` — markdown is parsed at render time and memoized via `useMemo` keyed on `block.text`. This keeps `parser.ts`, `turns.ts`, `App.tsx`, and `PromptBox.tsx` untouched.

`src/markdown/parse.ts` wraps `marked.lexer()` and returns `{ blocks: MdBlock[], tableRanges: TableRange[] }`. Tables get separate treatment because of the mid-stream-atomic requirement: we walk the lexer output once accumulating each token's `raw.length` to derive byte offsets, and capture `{ start, end, table }` for every table token. The render layer can then ask "is `charsRevealed >= range.start`?" to decide whether to inject the formatted table at that source position.

`src/markdown/render.tsx` exports one Ink component per block type plus a recursive `renderInline(tokens)` helper. The block components use Box/Text per the project's `agent-os/standards/ink/layout.md` (Box for layout, Text for content). The top-level `RenderedMarkdown` component takes a parsed doc and renders all blocks.

`Turn.tsx` `RenderedBlock` for `block.type === 'text'` becomes:
- If `charsRevealed === block.text.length` or `forceInstant` is true → render `<RenderedMarkdown doc={memo} />`.
- Otherwise → walk the source up to `charsRevealed`, splitting at table ranges. Anything outside a table renders as raw `<Text>`. Any table whose `start <= charsRevealed` renders as a fully-formatted `<MdTable>` Ink component. Tables whose `start > charsRevealed` are not yet revealed and don't render.

## Critical Files

| Path | Purpose |
|---|---|
| `src/markdown/parse.ts` | **New.** `parseMarkdown(text: string): MarkdownDoc`. Wraps `marked.lexer`, normalizes tokens to project-local types, computes table source ranges. |
| `src/markdown/render.tsx` | **New.** Ink components for each block type + `renderInline` for spans. |
| `src/markdown/types.ts` | **New.** `MarkdownDoc`, `MdBlock`, `MdInline`, `TableRange` types. |
| `src/components/Turn.tsx` | `RenderedBlock` for text blocks: `useMemo(parseMarkdown, [block.text])`, swap to `<RenderedMarkdown>` on completion, splice atomic tables during reveal. |
| `tests/markdown.test.ts` | **New.** Parser unit tests (block types, inline tokens, table-range offsets, edge cases). |
| `package.json` | Add `marked` to `dependencies`. |
| `agent-os/specs/2026-04-30-1900-markdown-rendering/` | **New spec folder** (Task 1). |

Files explicitly NOT touched:

- `src/types.ts`, `src/parser.ts`, `src/turns.ts`, `src/prompt.ts`, `src/cli.tsx`, `src/sessions.ts`
- `src/components/App.tsx`, `src/components/PromptBox.tsx`, `src/components/ToolPanel.tsx`, `src/components/Picker.tsx`
- Any existing test or fixture

## Reused Resources

- `BlockState.charsRevealed` in `Turn.tsx` already tracks per-block reveal — we read it; no change to its update path.
- `streamText` in `Turn.tsx` already streams char-by-char with jitter — unchanged. Reveal still operates on the raw source string; the rendering layer is what we change.
- `forceInstant` / `isInstant()` already collapse animation when `n` is pressed or `f` toggles to instant. Same flag drives the snap to formatted markdown.
- `marked` itself: we use only `marked.lexer(text)` and the public `Token` types (`Tokens.Heading`, `Tokens.Paragraph`, `Tokens.List`, `Tokens.Code`, `Tokens.Blockquote`, `Tokens.Hr`, `Tokens.Table`, `Tokens.Text`, `Tokens.Strong`, `Tokens.Em`, `Tokens.Codespan`, `Tokens.Link`, `Tokens.Br`, `Tokens.Del`).
- `Box`/`Text` from `ink` for all rendering — per `agent-os/standards/ink/layout.md`.

## Execution Protocol

For every implementation task:

1. **Re-attach the spec** by referencing `@agent-os/specs/2026-04-30-1900-markdown-rendering/plan.md` and `@agent-os/specs/2026-04-30-1900-markdown-rendering/shape.md`.
2. **Stay within the Touch Boundary** declared on each task.
3. **On drift:** if intentional, update `shape.md` first, then code. If accidental, fix the code to match.
4. **Run `npm run build && npm test`** after each task before moving on.
5. **TypeScript standards apply** (per `agent-os/standards/typescript/`): `.js` extensions on local imports, `import type` for type-only, named `XxxProps` interfaces for components.

---

## Tasks

### Task 1: Save spec documentation

Save the markdown-rendering spec so subsequent tasks can re-attach it.

**Deliverables:**
- `agent-os/specs/2026-04-30-1900-markdown-rendering/shape.md` — scope (full block + inline, tables atomic mid-stream, snap per text block, no syntax highlighting), parser choice (`marked`), out-of-scope list (syntax highlighting, per-markdown-block snap, streaming inline-styled spans, type changes to `AssistantBlock`).
- `agent-os/specs/2026-04-30-1900-markdown-rendering/plan.md` — copy of this plan.
- `agent-os/specs/2026-04-30-1900-markdown-rendering/references.md` — pointers to `src/components/Turn.tsx` (current raw render at line 155), `agent-os/specs/2026-04-30-1700-claude-replay-v2-fidelity/plan.md` (precedent for fidelity passes), `agent-os/standards/ink/layout.md`, `agent-os/standards/ink/component-shape.md`, `marked` docs (`https://marked.js.org/using_pro#lexer`).

**Touch boundary:**
- May only create files under `agent-os/specs/2026-04-30-1900-markdown-rendering/`.
- May NOT touch source, tests, design docs, or any other spec.

---

### Task 2: Add `marked` dep + `src/markdown/parse.ts` + parser tests

**Location:** `src/markdown/parse.ts` (new), `src/markdown/types.ts` (new), `tests/markdown.test.ts` (new), `package.json` (modified — add dep).

**Signature:**
```ts
// src/markdown/types.ts
export interface MarkdownDoc {
  blocks: MdBlock[];
  tableRanges: TableRange[];
}
export type MdBlock =
  | {type: 'heading'; depth: 1|2|3|4|5|6; inlines: MdInline[]}
  | {type: 'paragraph'; inlines: MdInline[]}
  | {type: 'list'; ordered: boolean; items: MdListItem[]}
  | {type: 'code'; lang: string | null; text: string}
  | {type: 'blockquote'; blocks: MdBlock[]}
  | {type: 'hr'}
  | {type: 'table'; align: Array<'left'|'right'|'center'|null>; header: MdInline[][]; rows: MdInline[][][]};
export interface MdListItem {
  blocks: MdBlock[];      // marked emits nested block tokens for each item
  task?: boolean;         // GFM task list
  checked?: boolean;
}
export type MdInline =
  | {type: 'text'; text: string}
  | {type: 'strong'; children: MdInline[]}
  | {type: 'em'; children: MdInline[]}
  | {type: 'codespan'; text: string}
  | {type: 'link'; href: string; children: MdInline[]}
  | {type: 'del'; children: MdInline[]}
  | {type: 'br'};
export interface TableRange {
  start: number;          // char offset in original source where the table block begins
  end: number;            // char offset where it ends (exclusive)
  block: Extract<MdBlock, {type: 'table'}>;
}

// src/markdown/parse.ts
export function parseMarkdown(text: string): MarkdownDoc;
```

**Behavior:**
- Calls `marked.lexer(text, {gfm: true})`. Walks the resulting top-level tokens once.
- Maintains a running `offset` initialized to 0; for each token, advances `offset += token.raw.length`. This gives `(start, end)` for every block-level token (relies on `marked`'s documented invariant that concatenating all tokens' `raw` reproduces the input).
- For each token, normalizes to an `MdBlock` per the shape above. `space`, `html`, and unknown token types are dropped (don't push a block).
- Inline normalization: walks `token.tokens` recursively; recognizes `text`, `strong`, `em`, `codespan`, `link`, `del`, `br`. Anything unknown collapses to `{type: 'text', text: tok.raw ?? tok.text ?? ''}`.
- For each `table` token, in addition to producing the `MdBlock`, pushes `{start, end, block}` into `tableRanges` (where `block` is the same normalized `MdBlock` reference, so the renderer doesn't reparse).
- Empty input → `{blocks: [], tableRanges: []}`.
- Pure function. No async. Never throws — wraps `marked.lexer` in a try/catch and returns `{blocks: [{type: 'paragraph', inlines: [{type: 'text', text}]}], tableRanges: []}` on parse failure (graceful degradation to raw paragraph).

**Test cases (in `tests/markdown.test.ts`):**
- Empty string → `{blocks: [], tableRanges: []}`.
- Plain text "hello world" → one paragraph block with one text inline.
- `# Heading` → one heading block, depth 1.
- Paragraph with `**bold**`, `*italic*`, `` `code` ``, and `[link](https://x)` → one paragraph block, four inlines with the right types.
- Unordered list `- a\n- b` → list block, ordered=false, two items each containing one paragraph.
- Fenced code block `` ```js\nconst x = 1;\n``` `` → code block with `lang: 'js'`, body preserved verbatim.
- Blockquote `> hi` → blockquote containing one paragraph.
- Horizontal rule `---` → hr block.
- Simple GFM table:
  ```
  | a | b |
  |---|---|
  | 1 | 2 |
  ```
  → one table block (header inlines `[a]`, `[b]`; rows `[[[1],[2]]]`; align `[null, null]`), and exactly one entry in `tableRanges` with `start === 0` and `end === text.length` (or just before trailing newline).
- Table with alignment markers `| a | b |\n|:--|--:|\n| 1 | 2 |` → align is `['left', 'right']`.
- Text-then-table: input `"prelude\n\n| a |\n|---|\n| 1 |\n"` → first block is a paragraph (text "prelude"), second block is a table; `tableRanges[0].start` equals length of prelude prefix (paragraph's `raw` length, including trailing blank line). Verify by slicing `text.slice(start, end)` and asserting it begins with `| a |`.
- Multiple tables in one doc → two entries in `tableRanges`, in order.
- Malformed input that throws inside `marked.lexer` → returns the graceful-fallback shape.

**Touch boundary:**
- May create: `src/markdown/parse.ts`, `src/markdown/types.ts`, `tests/markdown.test.ts`.
- May modify: `package.json` (add `marked` to `dependencies`), `package-lock.json` (lockfile update from `npm install marked`).
- May NOT modify: any other source, test, or component file.

---

### Task 3: Add `src/markdown/render.tsx` (Ink components for parsed markdown)

**Location:** `src/markdown/render.tsx` (new).

**Signature:**
```ts
interface RenderedMarkdownProps {
  doc: MarkdownDoc;
}
export function RenderedMarkdown({doc}: RenderedMarkdownProps): React.ReactElement;
```

Plus internal (non-exported) sub-components, one per block type:
- `MdHeading`, `MdParagraph`, `MdList`, `MdCode`, `MdBlockquote`, `MdHr`, `MdTable`.
- Internal helper `renderInline(inlines: MdInline[]): React.ReactNode` for inline spans.

**Behavior:**
- `RenderedMarkdown` maps `doc.blocks` to the corresponding sub-component, wrapping in `<Box flexDirection="column">`. Empty doc renders `null`.
- `MdHeading`: bold `<Text>`. Depth 1 → bold + uppercase prefix `# `. Depth 2 → bold `## `. Depths 3-6 → bold `###`/`####`/etc. Color cyan for depth 1-2, default for 3+. (Closest match to real CC's heading style; revisit if mismatched.)
- `MdParagraph`: single-line `<Text>` containing `renderInline(p.inlines)`. Preserves natural wrapping via Ink's flex.
- `MdList`: column `<Box>`. For each item: prefix `• ` (unordered) or `1.`, `2.`, … (ordered, 1-indexed). Indented 2 spaces. Recursively renders each item's `blocks`. GFM task lists render `[x]`/`[ ]` after the bullet.
- `MdCode`: column `<Box>` with `paddingLeft={2}`, dim grey `<Text>` per code line. No language tag, no border, no syntax highlighting (per scope decision). If the body has trailing newline strip it before splitting on `\n`.
- `MdBlockquote`: column `<Box>` with each rendered child block prefixed by `│ ` (dim grey gutter via a leading column).
- `MdHr`: single `<Text color="gray" dimColor>` line of `─` characters; width derived from terminal — use a fixed 40-char default since Ink doesn't trivially expose width here. Acceptable approximation; revisit if it looks wrong on smoke-test.
- `MdTable`:
  - Compute per-column width = max(headerRendered, ...rowsRendered) where rendered length is the inline-rendered visible character count (use a helper `inlineToPlain(inlines)` that returns just the text without ANSI for sizing).
  - Render header row: each cell padded/aligned per `align[i]` (default left if null), 2-space gutter between columns, header cells bold.
  - Render separator row: `─` repeated to column width, `  ` between columns, dim grey.
  - Render each data row similarly, no styling beyond inline tokens.
  - Outer `<Box flexDirection="column" marginY={0}>`.
- `renderInline`:
  - `text` → string passed through (Ink will accept it inside the parent `<Text>`).
  - `strong` → `<Text bold>{recurse(children)}</Text>`.
  - `em` → `<Text italic>{recurse(children)}</Text>`.
  - `codespan` → `<Text color="yellow">` + `` ` `` + text + `` ` `` + `</Text>` (yellow keeps inline code visually distinct without backgrounds).
  - `link` → `<Text color="blue" underline>{recurse(children)}</Text>` followed by ` (href)` in dim if `href !== rendered_text`.
  - `del` → `<Text strikethrough>{recurse(children)}</Text>`.
  - `br` → `\n` (or fragment containing literal newline).
  - Returns a `React.ReactNode` (string | element | array). Caller wraps in a single `<Text>` to satisfy Ink's "no bare strings in Box" rule.
- Components follow `agent-os/standards/ink/component-shape.md`: plain typed functions, named `XxxProps` interface, destructured props.
- Imports use `.js` extensions on local files per `agent-os/standards/typescript/import-extensions.md`.
- Rejects: N/A.
- Errors: N/A.

**Touch boundary:**
- May create: `src/markdown/render.tsx`.
- May NOT modify: any other source, test, or component file.

---

### Task 4: Integrate markdown rendering into `Turn.tsx`

**Location:** `src/components/Turn.tsx`.

**Signature:** No prop or external API changes to the `Turn` component. The `RenderedBlock` sub-component for `block.type === 'text'` gets rewritten internally.

**Behavior:**
- Add `import {parseMarkdown} from '../markdown/parse.js'` and `import {RenderedMarkdown} from '../markdown/render.js'`.
- In `RenderedBlock`, when `block.type === 'text'`:
  - `const doc = useMemo(() => parseMarkdown(block.text), [block.text])`.
  - `const isComplete = charsRevealed >= block.text.length`.
  - If `isComplete` → return `<RenderedMarkdown doc={doc} />`.
  - Otherwise → render a hybrid: walk `doc.tableRanges`, and for each range where `range.start <= charsRevealed`, inject a fully-formatted table at that point. Prose between tables (and before the first table, and after the last table within the revealed window) renders as raw `<Text>`. Concretely:
    ```
    let cursor = 0;
    const out: React.ReactNode[] = [];
    for (const range of doc.tableRanges) {
      if (range.start > charsRevealed) break;
      // raw text from cursor up to range.start
      if (range.start > cursor) {
        out.push(<Text>{block.text.slice(cursor, range.start)}</Text>);
      }
      out.push(<MdTable {...} />);  // imported from render.tsx; need to expose or use RenderedMarkdown with a single-table doc
      cursor = range.end;
    }
    // remaining raw text from cursor to charsRevealed
    if (charsRevealed > cursor) {
      out.push(<Text>{block.text.slice(cursor, charsRevealed)}</Text>);
    }
    return <Box flexDirection="column">{out}</Box>;
    ```
  - To render a single table standalone, expose a `MdTableStandalone` component (or simply call `<RenderedMarkdown doc={{blocks: [range.block], tableRanges: []}} />`). Use the latter — keeps the public surface minimal.
- The existing `block.type === 'thinking'` branch stays unchanged. The existing `block.type === 'tool_use'` branch stays unchanged.
- `useMemo` ensures repeated re-renders during streaming reveal don't reparse.
- The streaming machinery in `run()` is unchanged — it still increments `charsRevealed` against `block.text.length`. The visual snap happens because `RenderedBlock` re-renders with the new `charsRevealed` and the conditional flips.
- `forceInstant` / `isInstant()` already cause `streamText` to set `revealed = text.length` immediately; the `isComplete` check naturally becomes true and the formatted view renders. No additional wiring needed.
- Rejects: N/A.
- Errors: parse failures already return a fallback paragraph in Task 2; no extra handling here.

**Touch boundary:**
- May modify: `src/components/Turn.tsx`.
- May NOT modify: any other source, component, test, or fixture.

---

## Verification

1. **Build & types:** `npm run build` clean. `npx tsc --noEmit` clean.
2. **Tests:** `npm test` — existing 4 test suites green, plus new `markdown.test.ts` (≥10 cases) green.
3. **Smoke — markdown table mid-stream:** Pick a session whose assistant reply contains a markdown table (fall back to a hand-edited fixture in `tests/fixtures/` if no real session has one). Run `npm run dev <path>`. In stream mode, observe: as the table's source range begins revealing, the formatted table should appear atomically — no pipes/dashes flicker visible. Text before and after the table streams normally.
4. **Smoke — block snap on completion:** Same session, observe an assistant reply with `**bold**`, a heading, a list, and a fenced code block. While streaming, those render as raw markdown chars. The moment the reveal completes, the entire block snaps to formatted output (heading bold/large, bold spans bold, list bullets aligned, code block dim-grey indented).
5. **Smoke — instant mode:** Press `f` to toggle to instant mode before pressing Enter on a new turn. The whole text block including all markdown formatting renders in a single frame, no raw chars.
6. **Smoke — `n` skip:** Mid-stream, press `n`. The current block snaps to formatted. Subsequent blocks in the same turn render instantly and formatted.
7. **Side-by-side check:** Open the same session in real Claude Code (`claude --resume <id>`) and the replayer. Visually compare a markdown table, a list, and a code block. Differences should be cosmetic (exact glyph choice, hr width) rather than structural.
8. **No regressions:** Replay a session with NO markdown — plain text streams char-by-char as today, snaps to a single paragraph block on completion (visually identical).
9. **Error path:** Force a parse failure by feeding pathological input (e.g. `{{{{{{`); confirm fallback paragraph still renders without crashing the app.
