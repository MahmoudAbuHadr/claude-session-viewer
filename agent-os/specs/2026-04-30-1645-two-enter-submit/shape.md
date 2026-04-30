# Two-Enter rhythm — Shaping Notes

## Scope

Change the per-turn interaction from a single Enter (which auto-typed the prompt and immediately streamed the assistant response) to a two-Enter rhythm:

- **Enter #1:** the user prompt instantly appears, full text, in the bottom PromptBox. App enters a new `composed` phase. Hint changes to `↵ submit`.
- **Enter #2:** PromptBox clears, the prompt moves up into the scroll area as `> ...`, and the assistant response begins streaming.

This restores the natural beat between *finishing a thought* and *submitting it* that real Claude Code use has.

## Decisions

- **Replace, don't extend.** The `typing` phase is removed entirely (not gated behind a flag). The state machine becomes `idle → composed → playing → idle → ...`. Single source of truth, no dead code.
- **Instant fill, no typewriter.** Enter #1 fills the PromptBox instantly with the full prompt — no character-by-character animation. The drama lives in the *pause before Enter #2*, not in the typing animation.

  **Why:** the user explicitly chose "Instant fill" over "Animate" during shaping. Tighter pacing: the audience reads the prompt immediately, suspense is just "when will the presenter hit Enter to submit." Also drops `typedChars` state, the typing `useEffect`, and the `sleep`/`jitter` helpers entirely — net code reduction.

  **How to apply:** the `composed` phase shows the full `userPrompt` in the PromptBox via a static prop. No animation logic at all.

- **`n` (skip) is a no-op during `composed`.** `n` continues to short-circuit streaming during `playing`, but does nothing during `composed`.

  **Why:** during `composed` there is nothing to skip — the user must press Enter to submit anyway. Re-using `n` as an alternate submit key would conflate two different concepts (skip-to-end-of-streaming vs submit) and confuse muscle memory.

  **How to apply:** drop the `typing` branch from the existing `n` handler; leave the `playing` branch untouched.

## Context

- **Visuals:** None. The change is small enough to verify by running `node dist/cli.js <session>` and pressing Enter twice.
- **References:**
  - `src/components/App.tsx` — the only source file changed. Holds the state machine, key handler, hint, and PromptBox text source.
  - `docs/plans/2026-04-30-claude-replay-design.md` section 4 — the design's playback engine + keybindings + phase-aware hint table. Must be updated to describe the new `composed` phase.
  - `agent-os/specs/2026-04-30-1530-claude-replay-mvp/` — the original MVP spec, which referenced the now-removed `typing` phase. A note is added there pointing to this new spec to avoid the appearance of drift.
- **Product alignment:** No change to `agent-os/product/{mission,roadmap,tech-stack}.md`. This is a refinement of the existing "Enter-to-advance" MVP feature — the *shape* of the interaction changes, not the goal.

## Standards Applied

No project-specific standards exist in `agent-os/standards/`. The governing standard is **spec-discipline**: this change supersedes the `typing` phase from the original MVP spec, so the design doc is updated *before* code (the design is the source of truth), and the original spec is annotated to point here so future readers can follow the trail.

## Behavior Contracts

- Task 2: `src/components/App.tsx` — replace `typing` phase with `composed`; Enter #1 enters composed (instant prompt fill), Enter #2 enters playing.
- Task 3: spec docs — `docs/plans/.../design.md` section 4 and `agent-os/specs/.../1530-claude-replay-mvp/{shape,plan}.md` updated for consistency.
