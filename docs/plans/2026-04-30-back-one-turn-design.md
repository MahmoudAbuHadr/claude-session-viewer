# Back-one-turn (`b` key) — Design

A demo-mode escape hatch: pressing `b` rewinds the visible transcript by one turn, so the presenter can replay a turn the audience asked to revisit.

This is the smallest useful slice of the v1 design's Phase 2 navigation features. Forward direction is the existing `Enter`. Multi-turn jump and go-to-turn (`g`) remain deferred.

## Motivation

The most common audience interruption during a demo is "wait, can you show that part again?" Without `b`, the presenter has to restart the session. The v1 design doc anticipated this (`docs/plans/2026-04-30-claude-replay-design.md` §4) and reserved `b`/`g` as Phase 2 keybindings.

We're shipping `b` now and leaving `g` for later because:

- `b` covers the dominant case ("back one, replay it") and `b b b…` covers multi-step rewind.
- `g 7` requires a one-line input handler and another phase (`enteringJump`) — meaningful complexity for a less common case.

## Behavior

A single uniform rule lives in `App.tsx`'s `useInput`:

```
b → setTurnIndex(max(-1, turnIndex - 1)); setPhase('idle'); setSkipCurrent(false)
```

That's it. React reconciliation handles the rest.

Per-phase trace, verified against the rendering loop in `src/components/App.tsx`:

| Phase before | Action | Phase after | Visible effect |
|---|---|---|---|
| `idle/N` (N ≥ 0) | `b` | `idle/N-1` | Turn N's content unmounts from transcript |
| `idle/-1` | `b` | `idle/-1` | No-op (nothing to rewind) |
| `composed/N` | `b` | `idle/N-1` | PromptBox clears; transcript unchanged (was already 0..N-1) |
| `playing/N` | `b` | `idle/N-1` | Active Turn N unmounts; cleanup sets `cancelled = true`, the `run()` loop bails |
| `done/N` | `b` | `idle/N-1` | Last turn's content unmounts; hint switches off `✓ end of session` |

Forward via `Enter` after rewind: `startNextTurn()` uses `turnIndex + 1`, so the just-rewound turn replays from compose → play. No special re-entry path needed.

## Why this works without snapshots

The earlier v1 design proposed "clear the screen and replay turns 0..target instantly" as a re-rendering strategy for jump-back. That makes sense for `g` (absolute jump from anywhere), but for single-step `b`, every completed historical turn is *already mounted* in the React tree (rendered in `mode="instant"`). Decrementing `turnIndex` simply drops one Turn from the rendered list; the rest stay mounted with their state intact. No re-render, no flash.

This also dodges the question of "what if the streaming Turn N is mid-render when we jump back?" — the unmount triggers Turn's existing cleanup, which sets the closure-local `cancelled` flag the `run()` loop already checks every iteration. Cancellation latency is bounded by the longest internal `await sleep(...)` (≤ `TOOL_RUNNING_MAX_MS = 400` ms).

## Hint changes

The bottom-of-screen hint gains a `b ← prev` chip when `turnIndex >= 0`. Per phase:

| Phase | Hint |
|---|---|
| idle, no turns played | `↵ play turn 1/N   f → instant   q quit` |
| idle, mid-session | `↵ next turn (i+1/N)   b ← prev   f → instant   q quit` |
| idle, last turn finished | `✓ end of session   ↵ quit   b ← prev   f → instant` |
| composed | `↵ submit   b ← prev   f → instant   q quit` |
| playing | `▸ playing turn i/N   b ← prev   f → instant   n skip` |
| done | `✓ done   ↵ quit   b ← prev` |

The chip is the only audience-visible addition; the rewinding itself is invisible until the presenter triggers it.

## Out of scope

- `g` (go-to-turn) — defer to v3.
- Multi-turn jump prefix (e.g. `3b`) — defer; `b b b` covers it.
- Snapshot-based re-rendering — not needed for single-step.
- Forward redo key — `Enter` already does the right thing.
- Any animation polish on the unmount (no fade, no flash). The audience sees the most recent turn vanish in one frame.

## Conflict check

`b` is a single character. The keystroke handler only fires in non-text-input phases (idle/composed/playing/done) — there is no text-input mode in this app. So no conflict with prose that happens to start with `b`.

## Files touched

- `src/components/App.tsx` — `useInput` + hint string.
- `docs/plans/2026-04-30-claude-replay-design.md` §4 — promote `b` from Phase 2 to MVP, update hint table.
- `agent-os/product/roadmap.md` — note `b` ships, `g` stays deferred.
