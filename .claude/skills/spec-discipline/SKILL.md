---
name: spec-discipline
description: Use when implementation behavior may have diverged from a saved agent-os/specs/{date-slug}/shape.md, after completing an implementation task, or before committing changes that touched behavior described in a shape.md spec.
---

# Spec Discipline

When implementation diverges from a saved `agent-os/specs/{date-slug}/shape.md`, classify the divergence and act accordingly.

## The two cases

**Behavior changed by intent.** You discovered something during implementation that should be the new truth (a missed edge case, a better API, a constraint you didn't see at planning time).

- Update `shape.md` first.
- Then commit the code.
- The spec follows the new truth; never let code be ahead of spec for behavior changes.

**Behavior changed by accident.** The AI took a shortcut, interpreted a vague task loosely, or quietly skipped a step.

- Fix the code to match `shape.md`.
- Leave the spec as the source of truth.

## Detection

Run `/check-spec` after each implementation task, or at minimum before commit. Drift caught fast is cheap to fix; drift caught at PR review is not.

## Refactoring

Pure refactors (no behavior change — renames, extracted constants, file moves) do not trigger this rule. Refactor freely; the spec is about behavior, not structure. Only sync structural changes back to the spec if `shape.md` references the old structure explicitly (e.g. "in `src/comments.ts`" and you moved the file — update the path).

## Why this rule exists

Without it, two things happen: (1) you accumulate silent drift that becomes visible only at integration or in production, and (2) the spec rots into useless documentation. The rule keeps the spec a living artifact and makes drift a decision rather than an accident.

This is the lightest possible borrow from SPDD's closed-loop discipline — see `agent-os/specs/.../shape.md` for per-feature intent and `/check-spec` for detection.
