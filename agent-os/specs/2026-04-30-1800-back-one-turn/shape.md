# Back-one-turn (`b` key) — Shaping Notes

## Scope

Add a single `b` keybinding that rewinds the visible transcript by one turn, regardless of the current phase. Forward direction is the existing `Enter` — no new key.

This is a focused, demo-driven escape hatch. The most common audience interruption is "wait, can you show that again?" Without `b`, the presenter has to restart the session.

## Decisions

Made via brainstorming Q&A on 2026-04-30:

- **Forward = Enter (no new key).** Symmetric pair (Q1 → option a). Multi-turn jump prefixes and an explicit forward redo key are deferred.
- **Back = `b`.** Mnemonic, single key (Q2 → option a). The v1 design doc already reserved this letter; first-letter conflict with prose isn't real because the keystroke handler only fires in non-text-input phases.
- **Unified state-machine rule.** `b` always: `turnIndex = max(-1, turnIndex - 1); phase = 'idle'; skipCurrent = false`. Same code path for `idle`, `composed`, `playing`, `done`. The single rule was discovered by tracing each phase manually — see the design doc for the per-phase table.
- **No snapshots, no screen flash.** Every completed historical turn is already mounted in the React tree (rendered with `mode="instant"`). Decrementing `turnIndex` drops one Turn from the list; the rest stay mounted. The earlier v1 idea of "clear and re-render up to target" was overkill for single-step back.
- **Cancellation relies on existing Turn cleanup.** `Turn.tsx`'s `useEffect` cleanup sets `cancelled = true` on unmount; the `run()` loop checks it every iteration. No new cancellation plumbing.
- **No new tests.** Component-level rendering tests would need `ink-testing-library` (not in deps); adding it for one keybinding isn't worth it. Smoke test is the verification path. Same posture as v2.
- **Hint chip.** A `b ← prev` chip appears in the bottom hint when `turnIndex >= 0` so the presenter knows the key is available.

## Context

- **Visuals:** None. Behavior is invisible to the audience until triggered; the only addition is the hint chip.
- **References:**
  - V1 design doc `docs/plans/2026-04-30-claude-replay-design.md` §4 (Phase 2 keybindings, hint table).
  - V1 roadmap `agent-os/product/roadmap.md` Phase 2 entry.
  - Existing `App.tsx` state machine (idle/composed/playing/done).
  - Existing `Turn.tsx` cleanup-driven cancellation pattern.
- **Product alignment:** Promotes `b` from Phase 2 to a shipped feature. `g` (go-to-turn) and Up/Down scrollback remain Phase 2.

## Standards Applied

No `agent-os/standards/` directory in this project. De-facto standards:

- **CLAUDE.md** — verbatim-only rule (no curation of session data). This change doesn't touch session data; it only adds an interaction layer over already-rendered turns.
- **Spec discipline** — handled via Execution Protocol in `plan.md`. Drift gets recorded here in shape.md.

## Out of Scope (deferred)

- `g` / go-to-turn.
- Multi-turn jump prefixes (e.g. `3b`).
- Up/Down arrow scrollback.
- Snapshot-based re-rendering.
- Animation polish on unmount.
- Component rendering tests.

## Behavior Contracts

The implementation tasks in `plan.md` each declare their behavior contract following the Task Format Contract. This section is a quick index — see `plan.md` for full task definitions.

- **Task 1:** save spec docs (`agent-os/specs/2026-04-30-1800-back-one-turn/`, `docs/plans/2026-04-30-back-one-turn-design.md`).
- **Task 2:** add `b` branch to `App.tsx`'s `useInput`, extend hint string for all phases.
- **Task 3:** update `roadmap.md` and v1 design doc §4 to reflect that `b` has shipped.
