# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A terminal replayer for finished Claude Code sessions. The presenter advances per user turn with `Enter`; the audience sees a TUI indistinguishable from a live session. Used for demos where waiting on real model latency is the bottleneck.

The full design lives in `docs/plans/2026-04-30-claude-replay-design.md`. Read that before making non-trivial changes — it captures the agreed-upon interaction model, scope decisions, and the v1/v2 split.

## Stack

- Node + [Ink](https://github.com/vadimdemedes/ink), chosen because real Claude Code is built with Ink, so visual primitives (bordered boxes, spinners, streamed text) match by default.
- No daemon, no required config. Single CLI binary distributed via `npx claude-replay`.

## Commands

No build/test commands yet — `package.json` has not been added. Update this section once it lands.

## Architecture notes that aren't obvious from the code

- **Turn = unit of advancement.** A turn is one real user message plus every event up to (but not including) the next real user message — including all assistant turns, tool calls, and `tool_result` events in between. `Enter` advances by turn, never by individual event. The JSONL is pre-walked once at startup and grouped into an indexed `Turn[]`; playback is `turns[i++]`.
- **`tool_result` is a `user` event in the JSONL.** Don't treat tool results as their own event type. They are `user` events carrying structured `tool_result` content, and they render *inside* the matching `tool_use` panel rather than as a separate transcript line.
- **Subagents live in side files.** A `tool_use` with `name: "Task"` has its full transcript in `subagents/agent-<id>.jsonl` next to the main session JSONL. The replayer reads that file to animate the collapsed subagent panel; if the file is missing, fall back to the recorded `tool_result` payload in the parent.
- **`isSidechain: true` must be filtered before turn grouping.** These events belong to a subagent's stream and must not surface as top-level turns.
- **Streaming is faked.** The JSONL stores final messages, not the original token stream. "Accelerated" mode chunks final text char-by-char with jitter to simulate streaming; "instant" mode renders the whole block in one frame. Toggle is `f`.
- **Source path matters for the prompt box.** The cwd shown in the bottom prompt panel comes from decoding the JSONL's parent directory name (`-Users-foo-bar` → `/Users/foo/bar`), not from the current shell.

## Scope discipline

The design doc explicitly defers subagent panels, jump-back (`b`/`g`), slash-command rendering, and scroll history to v2. Don't pull these into v1 PRs unless v1 is already shipping.

The replayer is verbatim only — no editing, curation, or pre-processing of sessions. Don't add a "demo script" intermediate format without revisiting the design.
