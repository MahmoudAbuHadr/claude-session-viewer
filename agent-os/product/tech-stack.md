# Tech Stack

## Frontend

- **Ink** (React for the terminal) — the same rendering library Claude Code itself is built with. Chosen for visual fidelity: bordered boxes, spinners, colored status, and streamed text render identically to the real CLI out of the box.
- **TypeScript** — type safety across the JSONL parser, turn-grouping logic, and Ink components.

## Backend

N/A — this is a local CLI. No server, no daemon, no network calls.

## Database

N/A — the only persistent input is the session JSONL files Claude Code already writes to `~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl`. The replayer reads them directly; nothing is written back.

## Other

- **Node.js** — runtime for the CLI.
- **Distribution** — published to npm; designed to run via `npx claude-replay` so demo machines do not need a global install.
- **Testing** — Vitest (or Node's built-in test runner) for unit tests on the parser and turn-grouper. Ink's `render` test helper for snapshot tests on the renderer. No end-to-end timing tests — too brittle for the value.
