# Claude Replay — Implementation Plan

## Context

Greenfield project at `/Users/mahmoudabuhadr/Documents/claude-session-viewer`. We are building `claude-replay`, a terminal-faithful CLI that replays finished Claude Code sessions for live demos. The pain it addresses: demoing Claude Code live (or recording teaching sessions) is slow because every turn waits on real-time agent latency. A finished session JSONL at `~/.claude/projects/<encoded-cwd>/<uuid>.jsonl` already contains everything that happened — replaying it in a real terminal driven by Enter presses lets the presenter control pace while the audience sees something visually indistinguishable from a live session.

Product docs (`agent-os/product/{mission,roadmap,tech-stack}.md`) capture the broader vision. The five-section design (stack, data model, rendering, playback engine, edge cases) was agreed during brainstorming; Task 1 saves it as a standalone design doc.

## Approach

Node + Ink + TypeScript CLI that:

1. Parses a session JSONL.
2. Groups events into "turns" — each starting at a real user message (string `content`) and running until the next real user message. Tool calls and tool results inside the turn render as one chunk.
3. Renders turns through Ink components that mimic the real Claude Code TUI: streamed text, bordered tool-call panels with spinners, bottom prompt box that auto-types.
4. Advances one turn per Enter press; hotkey `f` toggles between accelerated streaming and instant.

The parser is tolerant — it keeps only the events the renderer cares about (`user` with string content, `user` with `tool_result` array content, `assistant` with `text`/`tool_use`/`thinking` blocks) and drops everything else (`system`, `attachment`, `summary`, sidechain entries). JSONL structure was confirmed by reading a real session file at `~/.claude/projects/-Users-mahmoudabuhadr-Documents-claude-session-viewer/a9092604-085b-4c16-992c-6a19594251e5.jsonl` — the design holds.

## Critical Files (to be created)

| Path | Purpose |
|---|---|
| `docs/plans/2026-04-30-claude-replay-design.md` | Full design doc (Task 1 deliverable, user-specified location) |
| `package.json` | Dependencies (ink, react, meow, ink-spinner), `bin.claude-replay` |
| `tsconfig.json` | TS config with `jsx: react-jsx`, ES2022, output to `dist/` |
| `src/cli.tsx` | Entry: arg parsing → session resolution → render `<App/>` |
| `src/types.ts` | Event, Block, Turn, ParsedSession discriminated unions |
| `src/parser.ts` | `parseSession(path)` — JSONL → typed events → ParsedSession |
| `src/turns.ts` | `groupIntoTurns(events)` — defines turn boundaries |
| `src/sessions.ts` | `findSessions()` — discovers sessions for the picker |
| `src/components/App.tsx` | Top-level Ink component: turn cursor, key dispatch |
| `src/components/Turn.tsx` | Renders one turn (user prompt + assistant work) |
| `src/components/ToolPanel.tsx` | Bordered tool-call box with spinner + truncated output |
| `src/components/PromptBox.tsx` | Bottom prompt box with auto-typing effect |
| `src/components/Picker.tsx` | Session list when no arg is passed |
| `tests/fixtures/*.jsonl` | Trimmed real sessions (scrubbed) for parser tests |
| `tests/parser.test.ts` | Unit tests on parser + turn grouping |

## Reused Resources

Greenfield repo, no internal code to reuse. External anchors:

- **Real JSONL sessions** at `~/.claude/projects/-Users-mahmoudabuhadr-Documents-claude-session-viewer/*.jsonl` — useful as smoke-test fixtures (the brainstorm session from this very conversation is one of them).
- **Ink** (the React-for-terminal library Claude Code itself uses) — gives free visual parity for boxes, borders, spinners, colored text.
- **meow** — minimal CLI arg parsing, idiomatic for Ink CLIs.

---

## Execution Protocol

For every implementation task:

1. **Re-attach the design** at the start of the task by referencing `@docs/plans/2026-04-30-claude-replay-design.md` — keeps it in working context.
2. **Stay within the Touch Boundary** declared on each task. Files outside the boundary are off-limits unless the design is updated first.
3. **On drift** (implementation diverges from the design): if intentional, update `docs/plans/2026-04-30-claude-replay-design.md` first, then code. If accidental, fix the code to match the design.
4. **Run `npm test`** after each task before moving on.

---

## Tasks

### Task 1: Save spec documentation

Save the full design from the brainstorm to disk so subsequent tasks can re-attach it.

**Deliverables:**
- `docs/plans/2026-04-30-claude-replay-design.md` — the full five-section design (Tech stack & shape, Data model, Rendering, Playback engine, Edge cases / scope) from the brainstorm.
- `agent-os/specs/2026-04-30-1530-claude-replay-mvp/shape.md` — scope, decisions, context.
- `agent-os/specs/2026-04-30-1530-claude-replay-mvp/plan.md` — copy of this plan.
- `agent-os/specs/2026-04-30-1530-claude-replay-mvp/references.md` — pointers to `~/.claude/projects/...` JSONLs and Ink.

**Touch boundary:** May create files under `docs/plans/` and `agent-os/specs/` only. May NOT touch any source or config.

---

### Task 2: Project scaffolding

**Location:** `package.json`, `tsconfig.json`, `.gitignore`, `src/cli.tsx`

**Signature:** N/A — scaffolding. Deliverable: `npm run build && node dist/cli.js --version` prints the version.

**Behavior:**
- `package.json`: `"bin": { "claude-replay": "dist/cli.js" }`, deps `ink@^5`, `react@^18`, `meow@^13`, `ink-spinner@^5`; devDeps `typescript@^5`, `vitest@^1`, `@types/react`, `tsx`; scripts `build` (`tsc`), `dev` (`tsx src/cli.tsx`), `test` (`vitest run`).
- `tsconfig.json`: `jsx: "react-jsx"`, `module: "esnext"`, `target: "es2022"`, `outDir: "dist"`, `strict: true`.
- `.gitignore`: `node_modules`, `dist`, `.DS_Store`.
- `src/cli.tsx`: minimal `<App/>` placeholder rendered via Ink's `render()`; meow parses args (no behavior yet).
- Rejects: build fails if any TS error.
- Errors: N/A.

**Touch boundary:** May create the four files in Location and `package-lock.json`. May NOT modify anything under `agent-os/` or `docs/`.

---

### Task 3: Type definitions

**Location:** `src/types.ts`

**Signature:**
```
type RawEvent = UserEvent | AssistantEvent | OtherEvent
type Block = TextBlock | ToolUseBlock | ThinkingBlock | ToolResultBlock
type Turn = { userPrompt: string; assistantBlocks: Block[]; toolResults: Map<string, ToolResultBlock>; index: number }
type ParsedSession = { sessionId: string; cwd: string; turns: Turn[] }
```

**Behavior:**
- Defines discriminated unions for raw events, content blocks, and grouped turns.
- `ToolUseBlock` carries `id`, `name`, `input`. `ToolResultBlock` carries `tool_use_id`, `content`, `is_error`.
- Pure types module — exports types only.
- Rejects: N/A.
- Errors: N/A.

**Touch boundary:** Only `src/types.ts`.

---

### Task 4: JSONL parser

**Location:** `src/parser.ts`

**Signature:** `parseSession(filePath: string) → Promise<ParsedSession>`

**Behavior:**
- Reads file line-by-line; `JSON.parse`s each non-empty line.
- Filters out events where `type` is `system`, `summary`, or `attachment`, OR `isSidechain === true`.
- Keeps `user` and `assistant` events.
- Builds `ParsedSession` with `sessionId` and `cwd` taken from the first kept event, and `turns` produced by calling `groupIntoTurns` from `src/turns.ts`.
- Rejects with `FileNotFoundError` if `filePath` does not exist.
- Throws `MalformedSessionError` if any non-empty line fails JSON parse, or if zero `user` events are found.

**Touch boundary:** Only `src/parser.ts`. May import from `src/turns.ts` and `src/types.ts`.

---

### Task 5: Turn grouping

**Location:** `src/turns.ts`

**Signature:** `groupIntoTurns(events: RawEvent[]) → Turn[]`

**Behavior:**
- Walks events in order. Starts a new `Turn` when a `user` event has `message.content` of type `string` (real prompt).
- Appends `assistant` events' content blocks to `currentTurn.assistantBlocks`.
- For `user` events with array `content` containing `tool_result` blocks, indexes them in `currentTurn.toolResults` keyed by `tool_use_id`.
- Returns the accumulated `Turn[]` indexed `0..n-1`.
- Throws `EmptySessionError` if no real user prompts are found in `events`.

**Touch boundary:** Only `src/turns.ts`.

---

### Task 6: Parser unit tests

**Location:** `tests/parser.test.ts`, `tests/fixtures/simple-session.jsonl`, `tests/fixtures/with-tools.jsonl`, `tests/fixtures/malformed.jsonl`

**Signature:** Vitest test suite.

**Behavior:**
- Fixture A (`simple-session.jsonl`): one user prompt + one assistant text reply. Asserts 1 turn, 1 text block, 0 tools.
- Fixture B (`with-tools.jsonl`): user → assistant tool_use → user(tool_result) → assistant text → user → assistant text. Asserts 2 turns; turn 0 has one tool with its result wired up; turn 1 has zero tools.
- Asserts `system` / `attachment` / `isSidechain:true` events are filtered out (mix them into fixture B).
- Asserts `parseSession('/nonexistent')` rejects with `FileNotFoundError`.
- Asserts `parseSession('tests/fixtures/malformed.jsonl')` rejects with `MalformedSessionError`.
- Rejects: N/A (test file).
- Errors: N/A.

**Touch boundary:** Only `tests/parser.test.ts` and `tests/fixtures/*.jsonl`. May NOT modify `src/`.

---

### Task 7: ToolPanel component

**Location:** `src/components/ToolPanel.tsx`

**Signature:** `<ToolPanel toolUse={ToolUseBlock} result={ToolResultBlock | null} status={'running' | 'done'} />`

**Behavior:**
- Renders an Ink `<Box>` with `borderStyle="round"`, header line `⏺ {toolUse.name}({summarizeArgs(input)})` in cyan.
- While `status === 'running'`, shows an `<ink-spinner>` plus dim "Running..." subtext underneath the header.
- When `status === 'done'` and `result` is provided, renders `result.content` truncated to 30 lines; appends a dim `… +N lines` footer if more.
- If `result.is_error === true`, renders the body in red.
- Rejects: N/A (presentational).
- Errors: N/A.

**Touch boundary:** Only `src/components/ToolPanel.tsx`.

---

### Task 8: Turn renderer

**Location:** `src/components/Turn.tsx`

**Signature:** `<Turn turn={Turn} mode={'stream' | 'instant'} forceInstant?={boolean} onComplete={() => void} />`

**Behavior:**
- On mount, kicks off async playback. The user prompt is NOT streamed here (App handles that); the `> prompt` line renders instantly as a header above the assistant blocks. Then walks `turn.assistantBlocks` in order.
- `text` blocks: streamed in chunks of 3 chars every ~10ms (~300 ch/s, with small jitter) in `stream`; instant in `instant`. Chunking matters — per-char `setState` was a measurable bottleneck on long blocks.
- `tool_use` blocks: renders `<ToolPanel status='running'>` for 150–400ms (random), then transitions to `status='done'` with the matching entry from `turn.toolResults`. In `instant` mode, the running phase is skipped.
- `thinking` blocks: renders a single collapsed line `⏺ Thinking…` in dim style; expanded body is not shown.
- `forceInstant` prop, when true, overrides `mode` and forces the rest of the playback to render instantly. Used by the `n` skip key in App without flipping the global mode.
- Calls `onComplete()` once all blocks have finished rendering.
- Rejects: N/A.
- Errors: N/A.

**Touch boundary:** Only `src/components/Turn.tsx`. May import `ToolPanel`, `PromptBox`.

---

### Task 9: PromptBox + App shell + keybindings

**Location:** `src/components/PromptBox.tsx`, `src/components/App.tsx`, `src/cli.tsx` (modify)

**Signature:**
- `<PromptBox text={string} typing={boolean} cwd={string} />`
- `<App session={ParsedSession} />`

**Behavior:**
- `PromptBox`: bordered box at bottom, shows `cwd` and a phase-aware hint in the gutter and the prompt text inside.
- `App` holds state `{ turnIndex, mode: 'stream'|'instant', phase: 'idle'|'typing'|'playing'|'done', typedChars, skipCurrent }`.
- On `Enter` (phase=idle, more turns remaining): set `phase='typing'`, `typedChars=0`, increment `turnIndex`. The typing effect streams the prompt character-by-character into PromptBox at ~6ms/char in `stream` mode, instant otherwise. When typing finishes, `phase='playing'`.
- On `Enter` (phase=idle, last turn already played): set `phase='done'`. Next `Enter` exits.
- On `f` (any phase): toggle `mode`. Affects both prompt typing and turn playback (mode is read via a ref so the change takes effect mid-stream).
- On `n` (phase=typing or playing): set `skipCurrent=true`. Forces the rest of the current turn (prompt typing or assistant blocks) to render instantly. Resets to `false` when the turn completes or the next turn starts.
- On `q` or `Ctrl-C`: `exit()`.
- Renders all completed turns above + the active `<Turn>` if playing (with `forceInstant={skipCurrent}`) + `<PromptBox>` at the bottom.
- `PromptBox.hint` is phase-aware: `↵ next turn (i+1/N)   f speed   q quit` (idle), `▸ playing turn i/N   f speed   n skip` (playing), `✓ done   ↵ quit` (done), etc. Without this the presenter can't distinguish slow streaming from an idle wait.
- `cli.tsx` is updated to call `parseSession()` and pass result to `<App/>`. Errors from `parseSession` print to stderr and exit 1.
- Rejects: N/A.
- Errors: invalid JSONL surfaces from `parseSession`.

**Touch boundary:** Only `src/components/PromptBox.tsx`, `src/components/App.tsx`, `src/cli.tsx`.

---

### Task 10: Session picker

**Location:** `src/sessions.ts`, `src/components/Picker.tsx`, `src/cli.tsx` (modify)

**Signature:**
- `findSessions() → Promise<SessionSummary[]>` where `SessionSummary = { id, path, cwd, firstPrompt, mtime }`.
- `<Picker sessions={SessionSummary[]} onPick={(s: SessionSummary) => void} />`

**Behavior:**
- `findSessions()` globs `~/.claude/projects/*/*.jsonl`, reads each file line-by-line until it finds a `user` event with string content (or hits 50 lines), uses that as `firstPrompt` (truncated 80 chars). Sorts by `mtime` descending. Returns top 50 results.
- Picker renders a numbered list. Up/Down navigates highlight; Enter calls `onPick`. Esc/q exits.
- `cli.tsx`: if no positional arg passed, render `<Picker>` first, then `<App>` once a session is picked.
- Rejects: N/A.
- Errors: throws `NoSessionsFoundError` if zero sessions are found.

**Touch boundary:** Only `src/sessions.ts`, `src/components/Picker.tsx`, `src/cli.tsx`.

---

## Verification

Run after Task 10 lands:

1. **Unit tests:** `npm test` — parser/turn-grouping suite all green.
2. **Type check:** `npm run build` — no TS errors; `dist/` produced.
3. **Smoke test 1 (no args, picker):** `node dist/cli.js` — picker shows recent sessions across all projects; arrow keys + Enter pick one; replay starts.
4. **Smoke test 2 (path arg):** `node dist/cli.js ~/.claude/projects/-Users-mahmoudabuhadr-Documents-claude-session-viewer/a9092604-085b-4c16-992c-6a19594251e5.jsonl` — replays the brainstorm session for this very project end-to-end.
5. **Smoke test 3 (interaction):** during replay, press `f` → speed toggles between stream and instant. Press `Enter` past the last turn → exits cleanly. Press `q` mid-run → exits cleanly.
6. **Visual check:** open a real Claude Code session in another terminal pane, run the replay in this pane, eyeball them side-by-side. Tool panels (border, header, spinner), prompt box, text streaming should be visually indistinguishable on a casual glance.

Phase 2 features from the roadmap (jump-back / go-to-turn, scroll history) are explicitly out of scope for this plan.
