# Claude Replay MVP — Shaping Notes

## Scope

A Node + Ink + TypeScript CLI named `claude-replay` that reads a finished Claude Code session JSONL and replays it in a terminal as if it were happening live, advanced one user-turn at a time by pressing Enter. Lets the presenter demo Claude Code workflows at a watchable pace without waiting on real-time agent latency.

## Decisions

- **Terminal-faithful TUI, not a web app or video.** Built on Ink (the same React-for-terminal library Claude Code uses) so the rendering is visually indistinguishable from a live session.
- **Per-user-turn advance.** Enter advances one user turn at a time; assistant text, tool calls, and tool results inside a turn all play automatically.
- **Verbatim playback.** No pre-edit / curation flow. Point at a JSONL and play it. Curation is out of scope.
- **Runtime speed toggle.** A single hotkey (`f`) flips between accelerated character streaming and instant rendering. Lets the presenter slow down for the punchline turn and breeze through boilerplate.
- **No persistence.** No saved cursor, no resume, no config file. A demo is a one-shot thing.
- **Subagent panels and jump-back are Phase 2.** MVP renders the parent transcript's tool_result for `Task` calls and does not support jumping back to earlier turns.

## Context

- **Visuals:** None. Reference is the real Claude Code TUI itself — open it in another pane during development to eyeball-compare.
- **References:** Real Claude Code session JSONLs at `~/.claude/projects/-Users-mahmoudabuhadr-Documents-claude-session-viewer/*.jsonl` (the brainstorm session that produced this spec is one of them). Ink documentation at https://github.com/vadimdemedes/ink.
- **Product alignment:** Implements all four MVP features from `agent-os/product/roadmap.md` — JSONL parser + turn grouping, core renderers, Enter-to-advance + speed toggle, session picker. Tech stack matches `agent-os/product/tech-stack.md` exactly.

## Standards Applied

No project-specific standards exist yet (`agent-os/standards/` is empty for this greenfield repo). The single governing standard is **spec-discipline**: when implementation diverges from the design at `docs/plans/2026-04-30-claude-replay-design.md`, update the design first if intentional, fix the code if accidental.

## Behavior Contracts

The implementation tasks in `plan.md` each declare their behavior contract. Quick index:

- Task 2: Scaffolds package.json, tsconfig.json, .gitignore, src/cli.tsx — `npm run build` succeeds.
- Task 3: `src/types.ts` — discriminated unions for events, blocks, turns, parsed sessions.
- Task 4: `src/parser.ts` — `parseSession(path)` reads JSONL, filters, returns ParsedSession.
- Task 5: `src/turns.ts` — `groupIntoTurns(events)` walks events and produces Turn[].
- Task 6: `tests/parser.test.ts` — covers happy path, filtering, FileNotFoundError, MalformedSessionError.
- Task 7: `src/components/ToolPanel.tsx` — bordered tool-call box with spinner and truncated output.
- Task 8: `src/components/Turn.tsx` — async playback of one turn, streaming vs instant modes.
- Task 9: `src/components/{App,PromptBox}.tsx` + `cli.tsx` — turn cursor state machine, Enter/f/q keys.
- Task 10: `src/sessions.ts` + `src/components/Picker.tsx` — session discovery and selection UI.
