# References for back-one-turn (`b` key)

## Design documents

- **`docs/plans/2026-04-30-back-one-turn-design.md`** — the design doc for this feature. Captures the unified state-machine rule, per-phase trace, and rationale for skipping snapshots / screen-flash.
- **`docs/plans/2026-04-30-claude-replay-design.md` §4** — the v1 design's keybinding table and hint table; updated by Task 3 to promote `b` from Phase 2 to MVP.

## Existing components touched

### `src/components/App.tsx`

- **Relevance:** the only source file modified. The `b` branch slots into `useInput` alongside existing `q`/`f`/`n`/`Enter` handlers.
- **Reused as-is:**
  - `useInput` handler (`App.tsx:46–68`).
  - `turnElements` build loop (`App.tsx:70–95`) — already mounts/unmounts turns based on `turnIndex` and `phase`. No structural change.
  - `startNextTurn()` (`App.tsx:26–35`) — handles forward direction after a rewind without modification.
  - `handleTurnComplete()` (`App.tsx:41–44`) — unchanged.

### `src/components/Turn.tsx`

- **Relevance:** the unmount-cancellation pattern is what makes `playing/N + b` clean. Not modified by this spec.
- **Key code path:** `useEffect` cleanup at `Turn.tsx:115–117` sets `cancelled = true`. The `run()` loop (`Turn.tsx:77–112`) checks `if (cancelled) return` every iteration.
- **Cancellation latency:** bounded by `TOOL_RUNNING_MAX_MS = 400` ms (the longest internal `await sleep(...)`). Acceptable for demo use.

### React 18 behavior we rely on

When `setBlocks` is called from a closure on an unmounted component, React 18's hook implementation silently ignores it. So the orphan promises in `streamText` and the `tool_use` branch don't need explicit guards beyond the existing `cancelled` checks.

## Existing tests

No tests are added or modified by this spec. The existing 30 tests across `tests/parser.test.ts`, `tests/prompt.test.ts`, and `tests/toolpanel.test.ts` keep passing — none of them exercise the App component.

## External references

- The v1 roadmap entry at `agent-os/product/roadmap.md` Phase 2: "Jump-back / go-to-turn — hotkeys to jump back one turn (`b`) or jump to a specific turn number (`g 7`)." Task 3 splits this into "shipped" (`b`) and "deferred" (`g`).

## Non-references (deliberately not consulted)

- `superpowers:test-driven-development` skill — we're not adding tests for this change. The smoke-test posture matches v2.
- `ink-testing-library` — would be needed for a programmatic test of the keybinding. Not in deps; adding it for one feature isn't worth it.

## Other specs in this project

- `agent-os/specs/2026-04-30-1530-claude-replay-mvp/` — original MVP spec (deferred `b` to Phase 2).
- `agent-os/specs/2026-04-30-1645-two-enter-submit/` — most recent App.tsx change. Same file we're editing now; pattern for the touch.
- `agent-os/specs/2026-04-30-1700-claude-replay-v2-fidelity/` — preceding spec. Did not touch the keybinding handlers.
