# Claude Replay v2 — Fidelity Pass

The v1 replayer ships a working two-Enter playback loop, but several pieces of the rendering don't match real Claude Code closely enough to pass a side-by-side glance. v2 is a focused fidelity pass on the audience-visible mismatches we have already identified. It is not a feature-expansion release.

This document supersedes the "v2 / later" section of `2026-04-30-claude-replay-design.md` for the items it covers.

---

## 1. Goals and non-goals

**Goal:** make a typical session indistinguishable from real Claude Code on the rendering surface — tool calls, thinking blocks, slash commands, and the user-prompt area.

**Non-goals (still deferred):**

- Subagent panel tick-through (read `subagents/agent-<id>.jsonl` and animate it).
- Jump-back (`b`) and go-to-turn (`g`).
- Up/Down scrollback between turns.
- Status-line animation (`✻ Brewing…` / `✶ Crafting…`).
- Snapshot tests for the renderer.

These remain on the roadmap and are additive — they do not conflict with the v2 changes here.

---

## 2. Tool panels — drop the bordered box

v1 wraps every tool call in a bordered box. Real Claude Code does not. Tool calls flow inline with text, marked by a header glyph and a continuation glyph for the result.

**v2 rendering:**

```
● Read(src/components/ToolPanel.tsx)
  ⎿  Read 156 lines (ctrl+r to expand)
```

- Header line: `●` + tool name + summarized args, cyan, normal weight. `summarizeArgs` (existing) keeps producing the args.
- Result line: indented 2 spaces, `⎿  ` glyph (two trailing spaces), then a tool-specific summary, dim grey.
- No bordered box. No `MAX_RESULT_LINES` truncated body.

**Per-tool summarizers (hand-written for the top 5 tools):**

| Tool | Summary text |
|---|---|
| `Read` | `Read N lines (ctrl+r to expand)` |
| `Edit` | `Updated file with N changes` |
| `Write` | `Wrote N lines to <path>` |
| `Bash` | first line `exit <code>`, then up to 5 lines of stdout, then `… +M lines` if more |
| `Grep` | `Found N matches in M files` (or `No matches`) |

**Fallback** for any other tool: first line of `tool_result.content`, truncated to ~60 chars, prefixed with `⎿  `. No body.

**Errors:** if `tool_result.is_error`, the summary line is red and reads `Error: <first line of content, truncated>`.

**`(ctrl+r to expand)` decoration:** appears verbatim in the `Read` summary. Does nothing — pure visual decoration. Wiring up actual expansion is out of scope.

**`AskUserQuestion` exception:** keeps the structured body added in v1 (questions + options). The header still uses the headers-joined summary (`AskUserQuestion(Env var name, Scope)`). It does not get a `⎿` summary line — its body replaces that role.

---

## 3. Slash commands and user-prompt sanitization

User messages in the JSONL are strings, but those strings are frequently wrapped in synthetic XML the audience must not see (`<command-name>`, `<local-command-caveat>`, `<system-reminder>`, etc.). v2 parses these once at load time.

**Parsed shape:**

```ts
interface RenderedPrompt {
  display: string;           // "/review main" or "fix the auth bug"
  isSlashCommand: boolean;
  stdout: string | null;     // from <local-command-stdout>, or null
}
```

**Whitelist parsing rules (in order):**

1. If raw contains `<command-name>X</command-name>` → slash command. Build `display` as `/X` joined with trimmed `<command-args>`. Strip a leading `/` from the captured name first — JSONL captures sometimes already include it (e.g. `<command-name>/login</command-name>`), and we don't want `//login`. Capture `<local-command-stdout>...</local-command-stdout>` separately if present. Ignore `<command-message>` (it duplicates the name).
2. Otherwise → plain prompt. Strip every `<…>…</…>` block (greedy, multiline) and trim. The remaining prose is `display`.
3. If `display` is empty after stripping → set `display = ''`. Caller is expected to skip rendering the `> ` line for empty displays (synthetic caveat-only "turns" should be invisible to the audience). Originally specified as "fall back to first non-tag line", but real-data sessions surface caveat-only turns where that fallback leaks the tag back into the prompt; an empty display matches the rendering real Claude Code would produce.

**Module:** new `src/prompt.ts` exporting `parsePrompt(raw: string): RenderedPrompt`. Pure, easy to unit-test.

**Rendering changes:**

- `PromptBox` (composed phase) — accepts `RenderedPrompt`. Renders `display` as the user typed it. Slash commands appear with the leading `/`. `stdout` is not shown here.
- After Enter #2 (in `Turn.tsx`) — the prompt moves up to `> /review main` (dim). If `stdout` is non-null, a dim, preformatted block renders directly under the `>` line, before any assistant blocks. Indented 2 spaces, no extra chrome.

**Out of the whitelist's scope:** `<system-reminder>` blocks that appear inside *assistant* text. Those are rare and not user-prompt content, so the whitelist does not touch them. (If they become a problem we add a separate pass — but not in v2.)

---

## 4. Thinking blocks — full body, streamed

v1 collapses every thinking block to a single `⏺ Thinking…` line. Real Claude Code shows the full body of the thought in dim grey. v2 matches.

**Rendering:**

```
✻ Thinking…
  The user is asking about X. I should consider Y because Z when…
  …continued reasoning…
```

- Header: `✻ Thinking…`, dim grey, italic if the terminal supports it.
- Body: indented 2 spaces, dim grey, no other styling.
- Streamed character-by-character using the same `streamText` machinery `text` blocks already use (3 chars / ~10ms / jittered).
- Instant mode renders the whole body in one frame.
- Empty thinking block → only the header renders.
- No truncation. Long thinks stream at the same rate as text. The presenter can skip with `n` (already wired).

**Implementation:** extend `Turn.tsx`'s `run()` loop so the `text`-streaming branch also handles `thinking` (use `block.text ?? block.thinking`). `RenderedBlock` gets a new branch that renders the header + sliced body.

---

## 5. Data-model and file-change summary

**Type changes (`src/types.ts`):**

- `Turn.userPrompt: string` → `Turn.prompt: RenderedPrompt`.

**File touch list:**

- `src/prompt.ts` — *new*. `parsePrompt(raw: string): RenderedPrompt`.
- `src/types.ts` — replace `userPrompt` with `prompt`, export `RenderedPrompt`.
- `src/parser.ts` — call `parsePrompt` during turn grouping.
- `src/components/PromptBox.tsx` — accept `RenderedPrompt` instead of a raw string.
- `src/components/Turn.tsx` — render `> display` + optional stdout block + thinking-block streaming.
- `src/components/ToolPanel.tsx` — remove bordered box, add `⎿` summary line, add per-tool summarizers, keep `AskUserQuestion` body branch.
- `tests/prompt.test.ts` — *new*.
- `tests/toolpanel.test.ts` — extend for per-tool summarizers.
- `tests/fixtures/with-slash-and-thinking.jsonl` — *new* fixture covering the new code paths.

**Migration:** there is no on-disk persistence, so no migration. The replayer is reload-then-replay; the type change is internal.

---

## 6. Testing

- **Unit tests** for `parsePrompt`: slash command with args, slash command with stdout, plain prompt with `<system-reminder>` noise, empty-after-strip fallback, malformed (mismatched tag) input.
- **Unit tests** for per-tool summarizers in `tests/toolpanel.test.ts`: each of the 5 hand-written entries plus the fallback. Plus the existing `AskUserQuestion` and `summarizeArgs` cases stay green.
- **Fixture-based parser test:** add a session JSONL containing one slash command, one thinking block, and one `AskUserQuestion`; verify `parseSession` produces the expected `Turn[]` shape.
- **Snapshot tests:** still deferred. Manual smoke test against a real session before any demo.

---

## 7. Order of work

A single PR is fine — the changes are coupled (the type rename ripples through the components). Suggested commit-by-commit order inside it:

1. `parsePrompt` + tests (no rendering changes yet).
2. `Turn.prompt` type rename + parser wiring.
3. `PromptBox` + `Turn.tsx` rendering for slash commands and stdout.
4. Thinking-block streaming.
5. ToolPanel pivot + per-tool summarizers + tests.

Each step keeps tests green. Step 5 is the loudest visual diff and the riskiest — landing it last keeps the earlier steps reviewable in isolation.
