# Product Roadmap

## Phase 1: MVP

The minimum demo-usable replayer.

- **JSONL parser + turn grouping** — read a Claude Code session JSONL, group events into turns (real user prompt → assistant text + thinking + tool_use blocks → tool_results → next user prompt). Pre-walk the file once at startup and index turns for `O(1)` advance.
- **Core renderers** — render `text` blocks, `tool_use` panels with spinners and bordered output, `tool_result` bodies inline below the matching tool panel, and the bottom prompt box. Visual parity with real Claude Code on a side-by-side glance.
- **Enter-to-advance + speed toggle** — Enter plays the next user turn end-to-end. A hotkey toggles between accelerated character-by-character streaming and instant render. This is the core interaction model.
- **Session picker** — when invoked with no args, list recent sessions across `~/.claude/projects/*` with the first user prompt as a preview, sorted by recency, and let the user pick. When invoked with a session UUID or path, jump straight in.

## Phase 2: Post-Launch

Polish and audience-friendly affordances, added once the MVP is stable.

- **Jump-back / go-to-turn** — hotkeys to jump back one turn (`b`) or jump to a specific turn number (`g 7`). Useful when an audience member asks the presenter to revisit something.
- **Scroll history** — Up/Down arrow keys scroll the rendered transcript between turns so the presenter can refer back to earlier output mid-demo without restarting.
