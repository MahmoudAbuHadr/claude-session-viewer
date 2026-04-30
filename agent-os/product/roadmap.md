# Product Roadmap

## Phase 1: MVP

The minimum demo-usable replayer.

- **JSONL parser + turn grouping** — read a Claude Code session JSONL, group events into turns (real user prompt → assistant text + thinking + tool_use blocks → tool_results → next user prompt). Pre-walk the file once at startup and index turns for `O(1)` advance.
- **Core renderers** — render `text` blocks, `tool_use` panels with spinners and bordered output, `tool_result` bodies inline below the matching tool panel, and the bottom prompt box. Visual parity with real Claude Code on a side-by-side glance.
- **Enter-to-advance + speed toggle** — Enter plays the next user turn end-to-end. A hotkey toggles between accelerated character-by-character streaming and instant render. This is the core interaction model.
- **Session picker** — when invoked with no args, list recent sessions across `~/.claude/projects/*` with the first user prompt as a preview, sorted by recency, and let the user pick. When invoked with a session UUID or path, jump straight in.

## Phase 2: Post-Launch

Polish and audience-friendly affordances, added once the MVP is stable.

- **Back one turn (`b`)** — *shipped 2026-04-30.* Single keypress rewinds the visible transcript by one turn from any phase (idle/composed/playing/done). Pressing `b` repeatedly walks back further. Forward direction is the existing `Enter`. See `docs/plans/2026-04-30-back-one-turn-design.md`.
- **Go-to-turn (`g`)** — still deferred. A `> 7` prompt that jumps to an absolute turn number. Subsumes multi-step `b b b…` for far jumps but needs an additional input phase, which `b` doesn't.
- **Scroll history** — Up/Down arrow keys scroll the rendered transcript between turns so the presenter can refer back to earlier output mid-demo without restarting.
