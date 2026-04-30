# Claude Replay — Back-one-turn (`b` key)

## Context

During demos, the most common audience interruption is "wait, can you show that part again?" Without a way to step back, the presenter has to restart the entire session. The v1 design doc (`docs/plans/2026-04-30-claude-replay-design.md` §4) sketched `b` (jump back) and `g` (go-to-turn) as Phase 2 keybindings; the roadmap in `agent-os/product/roadmap.md` lists them under "Phase 2: Post-Launch."

This spec lands the smallest useful slice: a single `b` key that rewinds the visible transcript by one turn. Forward direction is the existing `Enter` (no new key needed). Multi-turn jump and go-to-turn are deferred to a later spec — `b` covers the common demo case ("back one, then re-play it") and is small enough to ship in one App.tsx edit.

The intended outcome: pressing `b` removes the most recently played turn from the transcript and lets `Enter` replay it from the start. Works in any phase (idle/composed/playing/done).

## Approach

A single unified rule in the `useInput` handler:

```
b → setTurnIndex(max(-1, turnIndex - 1)); setPhase('idle'); setSkipCurrent(false)
```

Trace per phase (verified against the existing rendering logic in `src/components/App.tsx:70–95`):

- **idle/N** → idle/N-1. The `turnElements` loop now iterates `0..N-1`, so Turn N unmounts.
- **composed/N** → idle/N-1. PromptBox clears (it only shows when `phase === 'composed'`). Historical `0..N-1` was already rendered; no visible transcript change.
- **playing/N** → idle/N-1. Active Turn N unmounts (its `useEffect` cleanup in `src/components/Turn.tsx:115–117` sets `cancelled = true`, so the run loop bails on its next `if (cancelled) return` check). Partial content disappears with the unmount.
- **done/N** → idle/N-1. Last turn's content unmounts. Hint switches from `✓ end of session` back to `↵ next turn (...)`.
- **idle/-1** → no-op.

Forward via Enter after rewind: `startNextTurn()` uses `turnIndex + 1`, so the just-rewound turn (now at `turnIndex + 1`) replays cleanly from compose → play.

The hint string also gets a `b ← prev` chip, conditionally shown when `turnIndex >= 0`.

## Critical Files

| Path | Purpose |
|---|---|
| `src/components/App.tsx` | Add `b` branch to `useInput`; thread the `b ← prev` hint into `idle`/`composed`/`playing`/`done` cases. |
| `docs/plans/2026-04-30-back-one-turn-design.md` | **New.** Short design doc capturing the unified rule and per-phase trace. |
| `agent-os/specs/2026-04-30-1800-back-one-turn/` | **New spec folder** (Task 1). |
| `agent-os/product/roadmap.md` | Move "Jump-back / go-to-turn" entry note to reflect that single-step back has shipped (go-to-turn remains deferred). |
| `docs/plans/2026-04-30-claude-replay-design.md` | Update §4 keybindings table: move `b` row from Phase 2 to MVP. |

No new tests planned — rendering tests would need ink-testing-library which isn't in deps. Smoke test against a real session is the verification path. (Same testing posture v2 used.)

## Reused Resources

- `src/components/App.tsx:46–68` — existing `useInput` handler. The `b` branch slots in alongside `q`/`f`/`n`/Enter.
- `src/components/App.tsx:70–95` — existing `turnElements` build loop. Already mounts/unmounts turns based on `turnIndex` and `phase`. No structural change needed.
- `src/components/Turn.tsx:50–120` — existing `useEffect` cleanup that sets `cancelled = true` on unmount. The cancellation propagates through `streamText` (which checks `cancelled` every loop iteration) and the tool-running `await sleep(...)` branch (cancellation lag bounded by `TOOL_RUNNING_MAX_MS = 400` ms — acceptable).
- React 18's behavior of silently ignoring `setState` calls from unmounted components (so we don't need explicit guards in any orphan promise paths).

## Execution Protocol

For every implementation task:

1. **Re-attach the spec** by referencing `@docs/plans/2026-04-30-back-one-turn-design.md` and `@agent-os/specs/2026-04-30-1800-back-one-turn/`.
2. **Stay within the Touch Boundary** declared on each task.
3. **On drift:** if intentional, update the design doc + new spec first, then code. If accidental, fix the code to match.
4. **Run `npm run build && npm test`** after each task before moving on. Smoke test interactively for the keybinding behavior (no automated UI test).

---

## Tasks

### Task 1: Save spec documentation

**Deliverables:**
- `agent-os/specs/2026-04-30-1800-back-one-turn/shape.md` — scope (`b` key for back-one-turn), the unified rule, per-phase trace, decisions (no `g`/go-to-turn this round, no multi-turn-jump this round, no test infra additions), out-of-scope items.
- `agent-os/specs/2026-04-30-1800-back-one-turn/plan.md` — copy of this plan.
- `agent-os/specs/2026-04-30-1800-back-one-turn/references.md` — pointers to `src/components/App.tsx` (the only source file touched), `src/components/Turn.tsx` (for the unmount-cancellation pattern relied on), `docs/plans/2026-04-30-claude-replay-design.md` §4 (Phase 2 keybindings), and the new design doc.
- `docs/plans/2026-04-30-back-one-turn-design.md` — the freshly written design doc.

**Touch boundary:**
- May create: files under `agent-os/specs/2026-04-30-1800-back-one-turn/`, `docs/plans/2026-04-30-back-one-turn-design.md`.
- May NOT touch: source, tests, or any other spec/design.

---

### Task 2: Add `b` keybinding to App state machine

**Location:** `src/components/App.tsx`.

**Signature:**
- New internal handler (inlined into `useInput`): `goBack()` — decrements `turnIndex` (clamped at -1), forces `phase = 'idle'`, resets `skipCurrent = false`.
- Component shape and props unchanged. Internal state shape unchanged.

**Behavior:**
- On `b` (any phase): if `turnIndex < 0` → no-op. Otherwise `setTurnIndex(turnIndex - 1)`, `setPhase('idle')`, `setSkipCurrent(false)`.
- React reconciliation drops the previously-rendered most-recent turn from `turnElements` and (if applicable) unmounts the active `playing` Turn, whose cleanup `cancelled = true` aborts the run loop.
- All other key handlers (`q`, `Ctrl-C`, `f`, `n`, `Enter`) unchanged.
- Hint text gets a `b ← prev` chip when `turnIndex >= 0`. Specifically:
  - `idle (turnIndex < 0)`: unchanged, `↵ play turn 1/N   f → instant   q quit` (no prev to show).
  - `idle (turnIndex >= 0, more turns left)`: `↵ next turn (i+1/N)   b ← prev   f → instant   q quit`.
  - `idle (turnIndex >= 0, last turn done)`: `✓ end of session   ↵ quit   b ← prev   f → instant`.
  - `composed`: `↵ submit   b ← prev   f → instant   q quit`.
  - `playing`: `▸ playing turn i/N   b ← prev   f → instant   n skip`.
  - `done`: `✓ done   ↵ quit   b ← prev`.
- Rejects: N/A.
- Errors: N/A.

**Touch boundary:**
- May modify: `src/components/App.tsx`.
- May NOT modify: `Turn.tsx`, `PromptBox.tsx`, `ToolPanel.tsx`, types, parser, or any test/fixture.

---

### Task 3: Update roadmap and v1 design doc

**Location:**
- `agent-os/product/roadmap.md` — Phase 2 entry for jump-back.
- `docs/plans/2026-04-30-claude-replay-design.md` — §4 keybindings table.

**Signature:** N/A — documentation update.

**Behavior:**
- In `roadmap.md`: split the "Jump-back / go-to-turn" Phase 2 bullet into two — note that `b` (back one turn) ships as part of the post-MVP `b` feature; `g` (go-to-turn) remains Phase 2 deferred.
- In the design doc §4 MVP keybindings table: add a `b` row (`(idle/composed/playing/done) rewind one turn (no-op at turn 0)`) between the existing `n` and `q` rows.
- In §4 Phase 2 keybindings table: remove the `b` row (kept only `g` and `Space`).
- In §4 hint table: extend each phase's hint with the `b ← prev` chip per Task 2's behavior contract.
- Rejects: N/A.
- Errors: N/A.

**Touch boundary:**
- May modify: the two files listed in Location.
- May NOT modify: any source code, test, or other doc.

---

## Verification

1. **Build & tests:** `npm run build` clean. `npm test` — existing 30 tests still pass (no new tests in this spec).
2. **Type-check:** `npx tsc --noEmit` clean.
3. **Smoke test — back from idle:** Run `npm run dev <session>`. Press Enter twice to play turn 1. Press `b`. Turn 1 content should disappear from the transcript; hint should read `↵ play turn 1/N   b ← prev   f → instant   q quit` (or no `b ← prev` if at -1). Press Enter twice — turn 1 should replay from the top.
4. **Smoke test — back from composed:** Press Enter once (compose turn 1). PromptBox shows the prompt. Press `b`. PromptBox should clear; phase returns to idle. Press Enter twice to replay turn 1.
5. **Smoke test — back from playing:** Press Enter twice to start playing a turn with a long thinking block (treyd session). Mid-stream, press `b`. The streaming should stop and turn content disappear within ~10ms (or up to ~400ms if mid tool-running pause). Press Enter twice — turn should replay cleanly.
6. **Smoke test — back from done:** Step through to the end of a short session. After the last turn, hint reads `✓ end of session`. Press `b`. The last turn unmounts; hint reads `↵ next turn (N/N)   b ← prev   ...`. Press Enter twice — last turn replays.
7. **Smoke test — back at the start:** Without playing any turns, press `b`. Should be a no-op. Hint stays `↵ play turn 1/N`.
8. **Smoke test — back several times:** Step forward 4 turns, then press `b` four times. Each press should remove one turn from the transcript. After four presses, transcript empty, hint at start state.
9. **Side-by-side fidelity:** the back-one-turn behavior is replayer-only (real Claude Code doesn't support it). Visual diff from real Claude Code is intentional — the `b ← prev` chip in the hint is the only addition.
