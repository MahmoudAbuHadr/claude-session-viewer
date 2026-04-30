# References for Markdown Rendering

## Code references in this repo

### `src/components/Turn.tsx`

- **Location:** `src/components/Turn.tsx:154-156` — `RenderedBlock` for `block.type === 'text'`.
- **Relevance:** This is the line being changed. Currently dumps `block.text.slice(0, charsRevealed)` into `<Text>`. New behavior parses markdown and either snaps to formatted on completion or splices atomic tables during reveal.
- **Reused:** the `streamText` helper, `BlockState.charsRevealed` field, and the `forceInstant`/`isInstant()` flow are all reused unchanged.

### `agent-os/specs/2026-04-30-1700-claude-replay-v2-fidelity/plan.md`

- **Location:** entire file.
- **Relevance:** Precedent for fidelity passes — same shape (one PR, multiple coupled tasks, shape.md + plan.md + references.md). Borrowed conventions for Task Format Contract, Touch Boundary, and Verification sections.

### `src/components/ToolPanel.tsx`

- **Location:** the file's structural patterns (named `XxxProps` interface, Box-with-column layout, dim-grey continuation lines).
- **Relevance:** Establishes the visual language for inline panels (e.g. `⎿` continuation glyphs, dim grey for secondary text). Markdown components borrow color/dimColor conventions but not structure.

### `agent-os/standards/ink/layout.md`

- **Location:** entire file.
- **Relevance:** Box-vs-Text rules; default flexDirection is row; bare strings inside Box throw. All markdown components must wrap content in `<Text>`.

### `agent-os/standards/ink/component-shape.md`

- **Location:** entire file.
- **Relevance:** Component shape — plain typed functions, named `XxxProps` interface, destructured props, optional `?:` not `| undefined`, one exported component per file (small private subcomponents may live in same file).

### `agent-os/standards/typescript/import-extensions.md`

- **Location:** entire file.
- **Relevance:** All local imports use `.js` extension even for `.ts`/`.tsx` source.

## External references

### `marked` lexer API

- **URL:** `https://marked.js.org/using_pro#lexer`.
- **Relevance:** `marked.lexer(text, options)` returns `Token[]` — the input to `parseMarkdown`. Documented invariant that concatenating each token's `raw` reproduces the input — used to derive table source-range offsets.
- **Token types we consume:** `heading`, `paragraph`, `list`, `code`, `blockquote`, `hr`, `table`, `space`, `text`, `strong`, `em`, `codespan`, `link`, `del`, `br`. All others fall through to dropped or text.
