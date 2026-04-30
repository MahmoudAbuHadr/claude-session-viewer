# claude-replay

Replay a finished Claude Code session in your terminal as if it were happening live. The presenter advances per user turn with `Enter`; the audience sees a TUI indistinguishable from a real session.

Built for demos, where waiting on real model latency is the bottleneck.

## Install

Not published to npm yet — build from source:

```sh
git clone <this-repo>
cd claude-session-viewer
npm install
npm run build
npm link        # optional: exposes `claude-replay` on your PATH
```

Requires Node 18+.

## Usage

Run from source during development:

```sh
npm run dev -- ~/path/to/session.jsonl
```

Or, after `npm run build` (and optionally `npm link`):

```sh
claude-replay                                 # picks from recent sessions in ~/.claude/projects/
claude-replay ~/path/to/session.jsonl         # explicit path
claude-replay abc-123-uuid                    # search ~/.claude/projects/*/<uuid>.jsonl
```

### Keys

| Key       | Action                                       |
| --------- | -------------------------------------------- |
| `Enter`   | Play next user turn (or quit when finished)  |
| `f`       | Toggle stream ↔ instant playback speed       |
| `q`       | Quit                                         |

A *turn* is one user message plus every assistant message, tool call, and tool result up to (but not including) the next user message. One `Enter` plays the whole chain.

## How it works

The replayer reads the session JSONL Claude Code writes to `~/.claude/projects/`, groups events into turns, and re-renders them through Ink — the same library Claude Code itself uses, so the visual primitives (bordered tool panels, spinners, streamed text) match by default.

Streaming is faked: the JSONL stores final messages, not the original token stream, so accelerated mode chunks final text char-by-char with jitter to simulate live output.

## Status

**v1 (in progress):** JSONL parser, turn grouping, renderer for `text` / `tool_use` / `tool_result` / `thinking`, `Enter` advance, speed toggle, session picker.

**v2 (later):** subagent panels with tick-through, jump-back / go-to-turn, slash-command rendering, scroll history.

The full design lives in [`docs/plans/2026-04-30-claude-replay-design.md`](docs/plans/2026-04-30-claude-replay-design.md).

## Develop

```sh
npm run dev -- ~/path/to/session.jsonl    # run from source
npm run build                              # compile to dist/
npm test                                   # vitest
```

## License

MIT
