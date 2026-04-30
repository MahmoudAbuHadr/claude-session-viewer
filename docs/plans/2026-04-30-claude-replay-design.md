# Claude Replay — Design

A terminal-faithful replayer for finished Claude Code sessions, driven by Enter presses. The audience sees something visually indistinguishable from a live session; the presenter controls pace.

This document captures the design that subsequent implementation tasks must respect. When code drifts from this design, follow the spec-discipline rule: if intentional, update this document first; if accidental, fix the code.

---

## 1. Tech stack & shape

**Stack: Node + Ink + TypeScript.**

Ink is the React-for-the-terminal library Claude Code itself is built with. The same primitives — bordered boxes, spinners, colored status, streamed text — render identically out of the box. Anything else (Rich, Bubble Tea, Ratatui) means re-creating Claude Code's exact visual style by hand and probably falling short on a side-by-side glance.

**Distribution shape:**

- A single CLI binary, `claude-replay <session-id-or-path>`.
- `npx claude-replay` to run without installing — handy on demo machines.
- No daemon, no config file required. Just point at a JSONL.

**Session discovery:**

- If a path is passed, it is used directly.
- If a session UUID is passed with no path, the binary searches `~/.claude/projects/*/<uuid>.jsonl`.
- If nothing is passed, the binary lists recent sessions across all projects (mtime descending), each labeled with its first user prompt as a preview, and the user picks.

**Project name in the prompt box:** real Claude Code shows the cwd in the bottom prompt area. The replayer reads `cwd` from the first kept event and renders the same string, so the prompt box looks identical to the original.

---

## 2. Data model — what's in a JSONL and what's a "turn"

A Claude Code session JSONL is one JSON object per line. Each line is an event. Relevant types:

- **`user`** — a user message. Content is either a string (real prompt) or an array (carrying `tool_result` blocks for tool calls).
- **`assistant`** — an assistant message. Content is an array of blocks: `text`, `thinking`, `tool_use`.
- **`summary`** / **`system`** / **`attachment`** — metadata that is not shown during playback; we skip it.
- Each event has `parentUuid` linking it to the previous event, plus a `timestamp`. Events with `isSidechain: true` belong to subagents and are skipped at the top level.

**Turn definition (what one Enter-press plays):**

A turn starts at a *real* user message — a `user` event whose `message.content` is a plain string, not a tool_result array — and runs until, but not including, the next real user message. So a single turn can contain:

```
user "fix the auth bug"
  → assistant: thinking + text + tool_use(Read)
    → user: tool_result
  → assistant: text + tool_use(Edit)
    → user: tool_result
  → assistant: final text
```

That entire chain plays automatically once Enter is pressed. The replayer pre-walks the JSONL once at startup, groups events into turns, and stores them as an indexed array. Playback is just `turns[i++]`.

**Subagents (the `Task` tool):** when an assistant block is a `tool_use` with `name: "Task"`, its full transcript lives in `subagents/agent-<id>.jsonl` next to the main session. Real Claude Code collapses these into a panel that shows the subagent's progress. We do the same — parse the subagent file, render a collapsed panel that ticks through its tool calls, then shows its final result.

Subagent rendering is **out of scope for the MVP** and lives in Phase 2; the MVP renders a single collapsed panel containing the parent transcript's `tool_result` for the `Task` call.

---

## 3. Rendering — making it look like the real TUI

Each event type maps to a specific Claude Code visual:

- **User prompt** — On Enter #1, the full prompt instantly appears in the bottom prompt box (no character-by-character typing). The replayer enters `composed` phase and waits. On Enter #2, the box clears and the prompt appears above as `> the prompt text` in dim color, then the assistant blocks begin streaming. The two-Enter rhythm sells the illusion better than a typing animation: the audience sees the prompt sit composed for a beat before the presenter "submits."
- **Assistant `text` block** — Streamed top-down in the main pane. In streaming mode, characters appear in chunks of 3 every ~10ms (~300 chars/sec) with small jitter. The chunking matters: per-character React state updates were a noticeable bottleneck on long blocks (~900 chars), and 1-char-per-tick streaming felt deceptively slow on a TTY. In instant mode, the full block appears in one frame.
- **Assistant `thinking` block** — Rendered inside a collapsed `⏺ Thinking…` line in dim style. Body is not shown.
- **Assistant `tool_use` block** — A bordered tool-call panel: `⏺ ToolName(arg-summary)` header, spinner while "running", then the result inline (truncated to 30 lines with a `… +M lines` footer, like the real TUI). The "running" delay is faked: 150–400ms in streaming mode, ~0 in instant.
- **Tool result (`user` content with `tool_result`)** — Does not render as its own event; it fills in below the matching `tool_use` panel.
- **Subagent `Task`** — MVP: collapsed panel showing the parent transcript's `tool_result` for the call. Phase 2: tick through the subagent's own JSONL.

**Status line:** the bottom-of-screen status (`✻ Brewing…` / `✶ Crafting…` etc.) animates during a turn so the screen feels alive between events. Optional polish — not blocking for MVP.

**Scrollback:** the rendered transcript scrolls naturally as more turns play. Up/Down arrow scrollback between turns is Phase 2.

**What we deliberately skip:** the welcome banner, MCP server connection messages, model-switch chrome, hooks output. None of that helps a demo and rendering it pixel-perfect is a rabbit hole.

---

## 4. Playback engine & keybindings

**State machine** — the replayer is in exactly one of these states:

- `idle` — between turns, waiting for input. Hint shown: `↵ next turn`.
- `composed` — Enter #1 has been pressed; the prompt is fully visible in the bottom PromptBox, waiting for Enter #2 to submit. Models the natural beat between *finishing a thought* and *submitting it* in real Claude Code use.
- `playing` — running events from the current turn. Most keys are buffered until the turn finishes, except the speed toggle and `n` skip.
- `done` — past the last turn. Enter quits.

The flow per turn is `idle → (Enter #1) → composed → (Enter #2) → playing → idle → ...`. Two Enter presses per turn, not one. The `composed` phase shows the prompt instantly (no character-by-character animation) so the suspense lives in the pause before submit, not in a typing effect.

**Keybindings (MVP):**

| Key | Action |
|---|---|
| `Enter` | (idle) compose next prompt / (composed) submit / (done) quit |
| `f` | toggle stream ↔ instant playback speed |
| `n` | (playing) skip to end of current turn — renders the rest of this turn instantly without changing the global speed mode. No-op during `composed` (nothing to skip). |
| `b` | (idle/composed/playing/done) rewind one turn — drops the most recently played turn from the transcript and returns to `idle`. No-op when no turn has been played yet. Press repeatedly to walk back further. |
| `q` / `Ctrl-C` | quit |

**Phase 2 keybindings:**

| Key | Action |
|---|---|
| `Space` | (playing) pause-resume |
| `g` | go-to-turn prompt (`> 7`) |

**Status-line hint (visible at the bottom under the prompt box):** the hint must be phase-aware so the presenter can distinguish "still streaming, just be patient" from "ready, press Enter for next turn" from "ready, press Enter to submit." A `b ← prev` chip appears whenever a turn has been played (so the presenter knows the rewind is available). MVP wording:

| Phase | Hint |
|---|---|
| idle (before first turn) | `↵ play turn 1/N   f → instant   q quit` |
| idle (mid-session) | `↵ next turn (i+1/N)   b ← prev   f → instant   q quit` |
| idle (last turn finished) | `✓ end of session   ↵ quit   b ← prev   f → instant` |
| composed | `↵ submit   b ← prev   f → instant   q quit` |
| playing | `▸ playing turn i/N   b ← prev   f → instant   n skip` |
| done | `✓ done   ↵ quit   b ← prev` |

Without this, a slow-streaming turn looks identical to an idle one and the presenter can't tell whether to wait or press Enter — and worse, can't tell which Enter (compose vs submit) is next.

**Why a back/jump-to feature on a "just press Enter" tool:** during demos people ask "wait, can you show that bit again?" Without `b` you would have to restart the whole session. `b` ships in the MVP; `g` (go-to-turn) is still deferred — see `docs/plans/2026-04-30-back-one-turn-design.md`.

**How `b` rewinds without snapshots or screen flash:** every completed historical turn is already mounted in the React tree (rendered with `mode="instant"`). Decrementing `turnIndex` simply drops the most recent Turn from the rendered list; the rest stay mounted with their state intact. If a Turn is mid-streaming when `b` is pressed, its `useEffect` cleanup sets `cancelled = true`, the `run()` loop bails on its next iteration, and the partial content vanishes with the unmount. No snapshot table, no instant-replay loop. (The earlier "clear and replay 0..target" idea remains the right approach for `g`, when it ships.)

**Persistence:** none. No saved cursor, no resume. A demo is a one-shot thing; saving state adds complexity for no gain.

---

## 5. Edge cases, testing, scope

**Edge cases worth handling explicitly:**

- **Mid-turn `/clear` or `/compact`** — these appear as a special user event in the JSONL. Render the same chrome the real TUI shows (clear/separator) and treat the result as a turn boundary. Phase 2 polish — MVP simply treats them as ordinary string-content user events.
- **Slash commands** (`/review`, custom skills) — the `user` content includes a `<command-name>` tag. Auto-type the literal `/foo` form in the prompt box, not the expanded payload, so the audience sees what the presenter would actually type. Phase 2 polish.
- **Sidechain / interrupted turns** — events flagged `isSidechain: true` belong to a subagent's stream and must not appear as top-level turns. Filter at the parser pass.
- **Image attachments** — render as `[image]` placeholder. Faithful image rendering in a terminal is not worth it.
- **Huge tool outputs** — truncate at ~30 lines, append `… +N lines`.
- **Missing subagent file** — if `Task` references a subagent JSONL that is not on disk, render the panel with whatever the parent transcript captured (the final tool_result payload) and skip the tick-through. This is the MVP behavior anyway.

**Testing strategy:**

- **Unit tests** for the JSONL parser and turn-grouper using small fixture files in `tests/fixtures/` (trimmed, scrubbed real sessions).
- **Snapshot tests** for the renderer using Ink's `render` test helper — assert that turn N produces a known frame string. Catches accidental visual regressions. Defer to a follow-up after the MVP works manually.
- **No e2e/timing tests** — too brittle, low value. Manual smoke test before each demo.

**v1 scope (what ships first):**

JSONL parser → turn grouping → renderer for `text` / `tool_use` / `tool_result` / `thinking` → Enter advance → speed toggle → quit. Plus a session picker for ergonomics. That is the minimum demo-usable thing.

**v2 / later:** subagent panels with tick-through, jump-back / go-to-turn, slash-command rendering, scroll history, snapshot tests, status-line animation polish.
