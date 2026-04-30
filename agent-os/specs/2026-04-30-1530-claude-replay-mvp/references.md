# References for Claude Replay MVP

## External libraries

### Ink

- **Location:** https://github.com/vadimdemedes/ink (npm: `ink`)
- **Relevance:** The React-for-terminal library Claude Code itself uses. Provides `<Box>`, `<Text>`, `borderStyle`, `useInput`, `useApp`, and the `render()` function that make the TUI behave like the real Claude Code.
- **Key patterns to borrow:**
  - `<Box flexDirection="column" borderStyle="round">` for tool-call panels.
  - `useInput((input, key) => …)` for keybindings (`Enter`, `f`, `q`, `Ctrl-C`).
  - `ink-spinner` for the "running" state on tool calls.

### meow

- **Location:** https://github.com/sindresorhus/meow (npm: `meow`)
- **Relevance:** Minimal CLI arg parser, idiomatic for Ink CLIs. Handles `--version`, `--help`, positional args.

### Vitest

- **Location:** https://vitest.dev (npm: `vitest`)
- **Relevance:** Test runner for the parser/turn-grouper unit tests. Native ESM and TypeScript support without extra config.

## Real session data

### Local Claude Code JSONLs

- **Location:** `~/.claude/projects/-Users-mahmoudabuhadr-Documents-claude-session-viewer/*.jsonl`
- **Relevance:** Real sessions for this very project, including the brainstorming conversation that produced the design. Use as smoke-test inputs and to derive trimmed test fixtures.
- **Verified structure (from one read at design time):**
  - One JSON object per line.
  - Top-level fields: `type`, `uuid`, `parentUuid`, `isSidechain`, `timestamp`, `userType`, `entrypoint`, `cwd`, `sessionId`, `version`, `gitBranch`, sometimes `forkedFrom`.
  - `type === 'user'` events carry `message.role` and `message.content` — `content` is a string for real prompts, an array (with `tool_result` blocks) for tool responses.
  - `type === 'system'` carries informational messages we skip.
  - `type === 'attachment'` carries hook outputs / deferred-tools deltas / etc., which we skip.
  - `type === 'assistant'` carries `message.content` as an array of `text` / `thinking` / `tool_use` blocks.

### Subagent transcripts

- **Location:** `~/.claude/projects/<encoded-cwd>/<session-uuid>/subagents/agent-<id>.jsonl`
- **Relevance:** Each `Task` tool call has its full subagent transcript here. Phase 2 will render these as ticking collapsed panels; the MVP only renders the parent transcript's `tool_result` for the call.

## Internal patterns

This is a greenfield repo — no internal code to reuse.
