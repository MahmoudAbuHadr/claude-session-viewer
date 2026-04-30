# References for Claude Replay v2 — Fidelity Pass

## Design documents

- **`docs/plans/2026-04-30-claude-replay-v2-fidelity-design.md`** — the brainstorming output. Captures the full design with worked examples for tool-panel rendering, slash-command parsing, and thinking-block streaming. This spec is the implementation cut of that document.
- **`docs/plans/2026-04-30-claude-replay-design.md` §3 (Rendering)** — the v1 rendering decisions that v2 supersedes for tool panels and thinking blocks.
- **`docs/plans/2026-04-30-claude-replay-design.md` §6 (v2 list)** — the original v2 backlog. Items lifted by this spec: slash-command rendering, thinking-block expansion (implicit), tool-panel polish.

## Existing components touched

### `src/components/ToolPanel.tsx`

- **Relevance:** the file that pivots away from a bordered box.
- **Reused as-is:** `summarizeArgs(name, input)` (handles `AskUserQuestion` headers and the no-`[object Object]` invariant), `AskUserQuestionBody` component, `flattenResult(content)` helper.
- **Removed:** `MAX_RESULT_LINES`, `ResultBody` component, the `borderStyle="round"` outer box.
- **Added:** `summarizeResult(toolUse, result)` (exported for tests), per-tool summarizer branches.

### `src/components/Turn.tsx`

- **Relevance:** renders the user prompt header (`> ...`) and walks the assistant blocks. v2 changes the prompt source (`turn.prompt.display` instead of `turn.userPrompt`), adds an optional stdout block below the prompt, and streams thinking-block bodies.
- **Reused as-is:** `streamText(text, set)` helper, `BlockState.charsRevealed` field, the `run()` cancellation pattern.
- **Extended:** `run()`'s `text` branch handles `thinking` too; `RenderedBlock` adds a `thinking` case rendering header + indented streamed body.

### `src/components/PromptBox.tsx`

- **Relevance:** the bottom prompt box. v2 changes its `text` prop to a `prompt: RenderedPrompt | null` so it knows whether the displayed string is a slash command.
- **Reused as-is:** rounded border, `> ` prefix, dim cwd + hint footer.

### `src/components/App.tsx`

- **Relevance:** owns the playback state machine. v2 only changes the value passed to `PromptBox` (the `prompt` object instead of a string).
- **Reused as-is:** the `idle → composed → playing → idle` flow, the `n` skip and `f` speed handlers.

## Existing parser code

### `src/parser.ts`

- **Relevance:** the JSONL reader. **Not touched** by v2 — the prompt parsing happens one layer down in `groupIntoTurns`.
- **Reused:** existing event filtering (`isSidechain`, dropped types), error classes.

### `src/turns.ts`

- **Relevance:** the turn-grouping pass. v2 wraps the raw user-message string in `parsePrompt(content)` before storing it on the turn. Single-line change.
- **Reused as-is:** every other branch — tool-result merging, sidechain filtering already done upstream, empty-session guard.

### `src/types.ts`

- **Relevance:** type owner. v2 renames `Turn.userPrompt: string` to `Turn.prompt: RenderedPrompt` and re-exports `RenderedPrompt` from this file (so component imports don't reach into `prompt.ts`).

## Existing tests

### `tests/parser.test.ts`

- **Relevance:** existing 4 fixture-based tests must keep passing after the type rename. Each `userPrompt` assertion becomes `prompt.display`.
- **Extended with:** one new test using the new `with-slash-and-thinking.jsonl` fixture, asserting the parsed `RenderedPrompt` shape and the assistant-block types.

### `tests/toolpanel.test.ts`

- **Relevance:** existing `summarizeArgs` tests stay green. Extended with per-tool summarizer cases (`Read`, `Edit`, `Write`, `Bash`, `Grep`, fallback, error path).

### `tests/fixtures/`

- **Relevance:** existing `simple-session.jsonl` and `with-tools.jsonl` keep working. New `with-slash-and-thinking.jsonl` covers the slash command + thinking + AskUserQuestion paths.

## External references

### Real Claude Code TUI

The fidelity target. Key visual conventions v2 mirrors:

- Tool calls render inline with text, no bordered box. Header `● ToolName(args)` (cyan), continuation `  ⎿  summary` (dim).
- Slash commands render as `> /foo args` (dim) in the prompt position; `<local-command-stdout>` renders directly below as a dim preformatted block.
- Thinking blocks render as `✻ Thinking…` header (dim) with the full body indented and dim-grey, streaming char-by-char.

### Recorded session JSONL examples

- `~/.claude/projects/-Users-mahmoudabuhadr-treyd-treyd-2-dev-erp-invoices/6fcbe2e2-6b20-4bf9-8ce2-4ad7e2fb8142.jsonl` — confirmed-shape `AskUserQuestion` tool_use call. Used to validate the `summarizeArgs` headers branch in the v1 fix-up.
- Any recent treyd session — many contain `<command-name>` user events with `<local-command-stdout>` payloads, plus thinking blocks. Useful for smoke-test verification.

## Non-references (deliberately not consulted)

- No `agent-os/standards/` directory exists in this project, so no formal standards files apply.
- No `.claude/skills/spec-discipline/` skill file is installed locally. Spec discipline is captured directly in the Execution Protocol of `plan.md`.
