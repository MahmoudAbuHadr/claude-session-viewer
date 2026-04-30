# Claude Replay v2 — Fidelity Pass

## Context

The v1 replayer renders sessions correctly but mismatches real Claude Code on three audience-visible surfaces:

1. **Tool panels** are wrapped in a bordered box with the full tool result inline. Real Claude Code renders tool calls inline with text, using a `●` header and a `⎿` continuation summary line — no box, no full body unless the user expands it.
2. **User prompts** for slash commands appear as raw `<command-name>foo</command-name>` tags. Real Claude Code shows `> /foo` (dim) and the command's stdout below. The replayer also leaks `<local-command-caveat>` and `<system-reminder>` wrappers into the prompt area.
3. **Thinking blocks** collapse to a one-line `⏺ Thinking…`. Real Claude Code shows the full thought body, dim grey, indented under a `✻ Thinking…` header.

These were all explicitly deferred from v1 (see `docs/plans/2026-04-30-claude-replay-design.md` §3 and §6). This plan implements them and lifts them out of the v2 backlog.

The full design with shaping decisions (per-tool summarizers, whitelist parsing rules, body streaming) is at `docs/plans/2026-04-30-claude-replay-v2-fidelity-design.md`.

**Deliberately still out of scope (deferred to v3):** subagent panel tick-through, jump-back (`b`) / go-to-turn (`g`), Up/Down scrollback, status-line animation (`✻ Brewing…`), snapshot tests for the renderer.

---

## Approach

Three coupled changes in a single PR:

1. **Pre-process user prompts** at parse time into a structured `RenderedPrompt` (display text, slash-command flag, optional stdout). Rendering reads from this structured shape rather than parsing tags at render time.
2. **Pivot tool-panel rendering** from "bordered box with full body" to "inline `●` header + `⎿` summary line". Hand-written summarizers for the top 5 tools (Read/Edit/Write/Bash/Grep), first-line fallback for the rest. The `AskUserQuestion` body branch stays — it's the one tool where the body *is* the content.
3. **Stream thinking-block bodies** the same way text blocks already stream. Reuses the `streamText` machinery in `Turn.tsx`.

The type rename `Turn.userPrompt: string → Turn.prompt: RenderedPrompt` ripples through `parser.ts`, `turns.ts`, `App.tsx`, `Turn.tsx`, and `PromptBox.tsx`. That's the bulk of the file diff; the actual logic changes are localized.

---

## Critical Files

| Path | Purpose |
|---|---|
| `src/prompt.ts` | **New.** `parsePrompt(raw: string): RenderedPrompt` — whitelist parser. |
| `src/types.ts` | Replace `Turn.userPrompt` with `Turn.prompt`; export `RenderedPrompt`. |
| `src/turns.ts` | Call `parsePrompt` when starting a new turn. |
| `src/components/PromptBox.tsx` | Accept `RenderedPrompt` instead of raw `text`; show `/foo` form for slash commands. |
| `src/components/Turn.tsx` | Render `> display` line + optional stdout block; stream thinking-block bodies; new `RenderedBlock` branch for thinking. |
| `src/components/App.tsx` | Pass `prompt` (not `userPrompt`) to PromptBox; update `promptText` derivation. |
| `src/components/ToolPanel.tsx` | Drop bordered box; add `⎿` summary line + per-tool summarizers; keep `AskUserQuestion` body branch. |
| `tests/prompt.test.ts` | **New.** Whitelist parser cases. |
| `tests/toolpanel.test.ts` | Extend with per-tool summarizer cases. |
| `tests/fixtures/with-slash-and-thinking.jsonl` | **New.** Fixture covering slash command, thinking block, AskUserQuestion. |
| `tests/parser.test.ts` | Extend with one test asserting `parseSession` produces the expected `Turn.prompt` shape on the new fixture. |
| `agent-os/specs/2026-04-30-1700-claude-replay-v2-fidelity/` | **New spec folder** (Task 1). |
| `docs/plans/2026-04-30-claude-replay-v2-fidelity-design.md` | Already exists (the brainstorming output). Referenced from the new spec. |

---

## Reused Resources

- `summarizeArgs(name, input)` in `src/components/ToolPanel.tsx` already handles `AskUserQuestion` headers and the no-`[object Object]` invariant. Stays as-is.
- `AskUserQuestionBody` component in `src/components/ToolPanel.tsx` already renders questions + options. Stays as-is.
- `streamText` helper inside `Turn.tsx` already chunks characters with jitter. Reused for thinking-block streaming — extend the dispatch in `run()`, no new helper.
- `BlockState.charsRevealed` already tracks per-block reveal progress for text blocks. Same field is reused for thinking blocks.
- `flattenResult(content)` in `ToolPanel.tsx` already normalizes `string | Array<{text}>` shapes. Used by the new per-tool summarizers.
- The `groupIntoTurns` event-walker in `src/turns.ts` already emits a turn at every string-content user event. The only change is wrapping the raw string in `parsePrompt` before storing it.

---

## Execution Protocol

For every implementation task:

1. **Re-attach the spec** by referencing `@docs/plans/2026-04-30-claude-replay-v2-fidelity-design.md` and `@agent-os/specs/2026-04-30-1700-claude-replay-v2-fidelity/`.
2. **Stay within the Touch Boundary** declared on each task.
3. **On drift:** if intentional, update the design doc + new spec first, then code. If accidental, fix the code.
4. **Run `npm run build && npm test`** after each task before moving on.

---

## Tasks

### Task 1: Save spec documentation

Save the v2 spec so subsequent tasks can re-attach it.

**Deliverables:**
- `agent-os/specs/2026-04-30-1700-claude-replay-v2-fidelity/shape.md` — scope, brainstorming decisions (full pivot for tool panels, hand-written top-5 summarizers + fallback, full body for thinking, whitelist parsing for prompts, render command stdout), out-of-scope list (subagents, jump-back, scrollback, status-line, snapshot tests).
- `agent-os/specs/2026-04-30-1700-claude-replay-v2-fidelity/plan.md` — copy of this plan.
- `agent-os/specs/2026-04-30-1700-claude-replay-v2-fidelity/references.md` — pointers to `docs/plans/2026-04-30-claude-replay-v2-fidelity-design.md`, `src/components/ToolPanel.tsx`, `src/components/Turn.tsx`, `src/components/PromptBox.tsx`, and the existing v1 design (§3 rendering, §6 v2 list).

**Touch boundary:** May only create files under `agent-os/specs/2026-04-30-1700-claude-replay-v2-fidelity/`. May NOT touch source, tests, design docs, or any other spec.

---

### Task 2: Add `parsePrompt` module + tests

**Location:** `src/prompt.ts` (new), `tests/prompt.test.ts` (new).

**Signature:**
```ts
export interface RenderedPrompt {
  display: string;          // "/review main" or "fix the auth bug"
  isSlashCommand: boolean;
  stdout: string | null;    // body of <local-command-stdout>, else null
}
export function parsePrompt(raw: string): RenderedPrompt;
```

**Behavior:**
- If `raw` contains `<command-name>X</command-name>` → `isSlashCommand=true`. Build `display` as `/X` joined with the trimmed contents of `<command-args>` (single space separator; omit if args empty). Capture `<local-command-stdout>...</local-command-stdout>` body into `stdout` (multiline, greedy). Ignore `<command-message>`.
- Otherwise → `isSlashCommand=false`, `stdout=null`. Strip every `<…>...</…>` block (greedy, multiline, `s` flag) from `raw`, trim the residue, set `display` to that.
- If `display` is empty after stripping, fall back to the first non-whitespace line of `raw` that does not contain `<` or `>` characters; if none, `display = raw.trim()` (so we never render literally blank).
- Pure function — no I/O, no async.
- Rejects: nothing — accepts any string.
- Errors: never throws.

**Test cases (in `tests/prompt.test.ts`):**
- Plain prompt with `<system-reminder>` noise → display equals the prose with reminder stripped, isSlashCommand=false, stdout=null.
- Plain prompt with `<local-command-caveat>` followed by `<command-name>foo</command-name>` → isSlashCommand=true, display=`/foo`, stdout=null.
- Slash command with args: `<command-name>review</command-name><command-args>main</command-args>` → display=`/review main`.
- Slash command with stdout: `...<local-command-stdout>line1\nline2</local-command-stdout>` → stdout=`line1\nline2`.
- Empty-after-strip: `<system-reminder>foo</system-reminder>` alone → display equals empty fallback (the trimmed raw).
- Multiline plain prompt with embedded reminder mid-text → reminder stripped, surrounding prose preserved with single trim.

**Touch boundary:**
- May create: `src/prompt.ts`, `tests/prompt.test.ts`.
- May NOT modify: any other source or test file.

---

### Task 3: Wire `RenderedPrompt` through types and parser

**Location:** `src/types.ts`, `src/turns.ts`, `tests/parser.test.ts`, `tests/fixtures/with-slash-and-thinking.jsonl`.

**Signature:**
- `Turn.userPrompt: string` → `Turn.prompt: RenderedPrompt` (in `src/types.ts`).
- Re-export `RenderedPrompt` from `src/types.ts` (so consumers don't import from `prompt.ts` directly).
- `groupIntoTurns(events)` (unchanged shape) — internally calls `parsePrompt(content)` instead of storing `userPrompt: content`.

**Behavior:**
- For every string-content user event, `groupIntoTurns` constructs `{ index, prompt: parsePrompt(content), assistantBlocks: [], toolResults: new Map() }`.
- `tool_result`-bearing user events still merge into the current turn's `toolResults` map — unchanged.
- Existing parser tests (`simple-session`, `with-tools`) continue to pass after updating their `userPrompt` assertions to `prompt.display`.
- New fixture `tests/fixtures/with-slash-and-thinking.jsonl` contains: (1) one slash-command user event with `<command-name>review</command-name><command-args>main</command-args><local-command-stdout>📋 reviewing</local-command-stdout>`, (2) an assistant turn with a `thinking` block + a `text` block + an `AskUserQuestion` `tool_use` + matching `tool_result`.
- New parser test asserts: `turns[0].prompt.isSlashCommand === true`, `turns[0].prompt.display === '/review main'`, `turns[0].prompt.stdout === '📋 reviewing'`, and the assistant blocks include one `thinking` and one `tool_use` named `AskUserQuestion`.
- Rejects: N/A.
- Errors: existing `EmptySessionError` and `MalformedSessionError` paths unchanged.

**Touch boundary:**
- May modify: `src/types.ts`, `src/turns.ts`, `tests/parser.test.ts`.
- May create: `tests/fixtures/with-slash-and-thinking.jsonl`.
- May NOT modify: any component file or `parser.ts` itself (which doesn't need changes).

---

### Task 4: Update `PromptBox` and `App` for `RenderedPrompt`

**Location:** `src/components/PromptBox.tsx`, `src/components/App.tsx`.

**Signature:**
- `PromptBox` props: `{ prompt: RenderedPrompt | null, cwd: string, hint?: string }` (was `{ text: string, cwd: string, hint?: string }`). `null` means "empty box" (idle/playing phases).
- `App.tsx` `promptText` derivation replaced by `promptForBox: RenderedPrompt | null`.

**Behavior:**
- When `prompt` is `null` → render empty box (single space placeholder, same as today's empty `text`).
- When `prompt.isSlashCommand === true` → render `display` (which already starts with `/`) inside the box, no special chrome.
- When `prompt.isSlashCommand === false` → render `display` inside the box.
- The box itself stays unchanged (rounded border, `> ` prefix, dim cwd + hint footer below). Visual change is purely in the content of the prompt area.
- `App.tsx` passes `phase === 'composed' ? session.turns[turnIndex]!.prompt : null` to PromptBox.
- Rejects: N/A.
- Errors: N/A.

**Touch boundary:**
- May modify: `src/components/PromptBox.tsx`, `src/components/App.tsx`.
- May NOT modify: `Turn.tsx`, `ToolPanel.tsx`, types, parser, or tests.

---

### Task 5: Render `> display` line + stdout block + thinking-block streaming in `Turn`

**Location:** `src/components/Turn.tsx`.

**Signature:**
- `BlockState` extends to cover thinking blocks (no shape change — `charsRevealed` already exists).
- New internal `ThinkingBlockView` sub-component: `{ text: string, charsRevealed: number }` → header + indented streamed body.
- `RenderedBlock` adds branch for `block.type === 'thinking'` rendering `ThinkingBlockView`.

**Behavior:**
- Top of `Turn` JSX renders `> {turn.prompt.display}` (dim grey) instead of the raw `userPrompt`. If `turn.prompt.stdout != null`, render a 2-space-indented dim grey `<Text>` block with the stdout content directly below the `>` line, before any `assistantBlocks` map.
- `run()` loop's `text` branch extends to also handle `thinking`: shared streaming, with the source string being `block.text` for text and `block.thinking` for thinking. Concretely: `if (block.type === 'text' || block.type === 'thinking') { const source = block.type === 'text' ? block.text : block.thinking; await streamText(source, …); }`.
- `ThinkingBlockView` renders `✻ Thinking…` header (dim grey) plus an indented `<Text color="gray" dimColor>{thinking.slice(0, charsRevealed)}</Text>`. Empty thinking (zero-length body) renders only the header.
- Instant mode (existing `isInstant()` check) skips the streaming as before — full body in one frame.
- The `n` skip key still routes through `forceInstant`, which finishes the rest of the turn including any thinking blocks instantly.
- Rejects: N/A.
- Errors: N/A.

**Touch boundary:**
- May modify: `src/components/Turn.tsx`.
- May NOT modify: `App.tsx`, `PromptBox.tsx`, `ToolPanel.tsx`, types, or any test file.

---

### Task 6: Pivot `ToolPanel` to inline rendering with `⎿` summaries

**Location:** `src/components/ToolPanel.tsx`, `tests/toolpanel.test.ts`.

**Signature:**
- `ToolPanel` props unchanged (`{ toolUse, result, status }`).
- New internal helper: `summarizeResult(toolUse: ToolUseBlock, result: ToolResultBlock | null): { line: string; isError: boolean }`.
- `summarizeResult` is exported for testability.

**Behavior:**
- Outer `<Box flexDirection="column">` no longer has `borderStyle="round"` or `paddingX={1}`. Tool calls flow inline with surrounding text.
- Header line unchanged: `● {name}({summarizeArgs(name, input)})` in cyan. (Glyph `●` replaces `⏺` to match real Claude Code; verify in passing — if `⏺` is what real Claude Code uses, keep it.)
- For `AskUserQuestion`: keep the existing `AskUserQuestionBody`. Skip the `⎿` summary line entirely. No other change.
- For all other tools when `status === 'running'`: render a 2-space-indented dim spinner line `⎿ ` + `<Spinner /> Running...`.
- For all other tools when `status === 'done'` and `result != null`:
  - Compute `summarizeResult(toolUse, result)`.
  - Render single-line `⎿  {summary}` (two trailing spaces after `⎿`). Color: dim grey, or red if `isError`.
- Per-tool summary rules in `summarizeResult`:
  - `Read`: count newlines in `flattenResult(result.content)` → `Read N lines (ctrl+r to expand)`.
  - `Edit`: `Updated file with N changes` where N = 1 unless `toolUse.input.replace_all === true`, in which case N = number of occurrences in `flattenResult(result.content)`'s match-count line, fallback to "Updated file".
  - `Write`: `Wrote N lines to {file_path}` (truncate path to 40 chars).
  - `Bash`: First line is `exit {code}` (parse from common patterns; default `exit 0` on success, `exit 1` on `is_error`). Then up to 5 lines of stdout from `flattenResult(result.content)`. If more lines, append `… +M lines`.
  - `Grep`: parse `flattenResult(result.content)` for "Found N matches" or count lines for fallback → `Found N matches in M files` or `No matches found`.
  - Fallback (any other tool): first non-empty line of `flattenResult(result.content)`, truncated to 60 chars.
- Errors (`is_error === true`): summary becomes `Error: {first line truncated to 60 chars}`, line color red.
- The 30-line `MAX_RESULT_LINES` constant and `ResultBody` component are removed.

**Test cases added to `tests/toolpanel.test.ts`:**
- `Read` with multi-line content → `Read N lines (ctrl+r to expand)` where N matches the line count.
- `Edit` non-`replace_all` → `Updated file with 1 changes` (literal "1 changes" — match real Claude Code wording, even though grammatically odd; or "1 change" if confirmed). Pick the wording that matches a real session and document the choice.
- `Write` → `Wrote N lines to {path}` with truncation.
- `Bash` success → first line `exit 0`, up to 5 stdout lines, footer if more.
- `Grep` with matches → `Found N matches in M files`.
- Fallback for unknown tool → first line truncated to 60 chars.
- Error path → red `Error: ...` line.

**Touch boundary:**
- May modify: `src/components/ToolPanel.tsx`, `tests/toolpanel.test.ts`.
- May NOT modify: `Turn.tsx`, `App.tsx`, `PromptBox.tsx`, types, parser, or other tests.

---

## Verification

1. **Build & tests:** `npm run build` clean. `npm test` — existing 4 parser tests + extended toolpanel tests + new prompt tests, all green.
2. **Smoke test — slash command:** Run `npm run dev <session-with-slash-command>`. Press Enter. PromptBox should show `/foo args` (not `<command-name>foo</command-name>`). Press Enter again. The prompt should appear above as `> /foo args` (dim), and if the command had `<local-command-stdout>`, it should render directly below in dim grey.
3. **Smoke test — thinking block:** Pick a session with a long thinking block (any recent treyd session). Press Enter twice through to it. The thinking body should stream character-by-character in dim grey under a `✻ Thinking…` header. Press `f` to switch to instant mode mid-stream — body should snap to full.
4. **Smoke test — tool panels:** In any session, observe a `Read` tool call. It should render with no border, just `● Read(path)` and `  ⎿  Read N lines (ctrl+r to expand)`. Same for `Bash`, `Edit`, `Write`, `Grep`. The bordered-box look should be gone everywhere except `AskUserQuestion`, which keeps its structured body.
5. **Smoke test — `<local-command-caveat>` no longer leaks:** Find a session with the rendering issue from screenshot #4 (a slash command turn). The `<local-command-caveat>` block should NOT appear anywhere. Only `> /foo args` and the optional stdout.
6. **Side-by-side check:** Open the same session in real Claude Code (`claude --resume <session-id>`) and the replayer. Visually compare a tool call, a thinking block, and a slash command turn. Diffs should be minor (timing, exact spinner glyph) rather than structural.
7. **`npm test` types check:** `npx tsc --noEmit` — clean. The `Turn.userPrompt → Turn.prompt` rename should produce no orphaned references.
