# Two-Enter rhythm — `composed` phase between Enter #1 and Enter #2

## Context

Today, pressing Enter once auto-types the prompt into the PromptBox and immediately transitions to streaming the assistant response. The presenter loses the natural beat between *"I finished composing my prompt"* and *"I'm submitting it"* — the rhythm of real Claude Code use, where a prompt sits visible on screen for a moment before the user hits Enter to submit.

The change introduces a 2-Enter rhythm:

- **Enter #1**: prompt instantly appears (full text) in the PromptBox. App enters a new `composed` phase. Hint changes to `↵ submit`.
- **Enter #2**: PromptBox clears, prompt moves up into the scroll area as `> ...`, assistant response begins streaming.

Decisions made during shaping (via AskUserQuestion):

- **Typing animation:** removed. The Enter #1 → instant fill model is tighter and matches the user's intent ("show what the user just typed"). The old per-character typing animation, the `typedChars` state, and the typing `useEffect` all go away.
- **`n` (skip) during `composed`:** no-op. There is nothing to skip — the user must press Enter to submit. `n` continues to skip during `playing` only.

## Approach

Introduce phase `composed` and remove phase `typing` from the App state machine.

**State machine before:** `idle → typing (animated) → playing → idle → ...`
**State machine after:**  `idle → composed (instant) → playing → idle → ...`

State changes in `src/components/App.tsx`:

- `Phase` type: `'idle' | 'typing' | 'playing' | 'done'` → `'idle' | 'composed' | 'playing' | 'done'`.
- Drop `typedChars` state and the typing `useEffect` entirely.
- Drop `PROMPT_CHAR_DELAY_MS`, `sleep`, `jitter` helpers (only used by typing).
- `startNextTurn()` sets `phase='composed'` (was `'typing'`).
- Enter handler: add `else if (phase === 'composed') setPhase('playing')`.
- `isTurnActive` (for the historical-vs-active turn split): becomes `phase === 'composed' || phase === 'playing'`.
- `n` handler: drop the `typing` branch — `n` only does work during `playing`.
- Hint switch: replace the `typing` case with a `composed` case that says `↵ submit   <speed>   q quit`.
- `promptText`: shows the full `userPrompt` during `composed`, empty otherwise.

## Critical Files

| Path | Purpose |
|---|---|
| `src/components/App.tsx` | The only source change — state machine, key handler, hint, prompt text source |
| `docs/plans/2026-04-30-claude-replay-design.md` | Update section 4 (state machine + keybindings + hint table) for spec consistency |
| `agent-os/specs/2026-04-30-1530-claude-replay-mvp/{shape,plan}.md` | Update Task 9 behavior and decisions to reflect the new phase |
| `agent-os/specs/2026-04-30-1645-two-enter-submit/{shape,plan,references}.md` | New spec folder for this change (Task 1 deliverable) |

## Reused Resources

- `App.tsx` already isolates `Turn` mount to `phase === 'playing'` — that mount logic stays correct after the rename, since `composed` is also "not yet playing".
- The Turn component (`src/components/Turn.tsx`) is unchanged. It already does instant prompt rendering as a header (the typewriter is only in App).
- The PromptBox component (`src/components/PromptBox.tsx`) is unchanged — it already accepts a `text` prop and renders whatever string it gets.

---

## Execution Protocol

For every implementation task:

1. **Re-attach the design** by referencing `@docs/plans/2026-04-30-claude-replay-design.md` and the new spec under `agent-os/specs/2026-04-30-1645-two-enter-submit/`.
2. **Stay within the Touch Boundary** declared on each task.
3. **On drift**: if intentional, update the design + new spec first, then code. If accidental, fix the code to match.
4. **Run `npm run build && npm test`** after each task before moving on.

---

## Tasks

### Task 1: Save spec documentation

Save the new spec for the two-Enter rhythm so subsequent tasks can re-attach it.

**Deliverables:**
- `agent-os/specs/2026-04-30-1645-two-enter-submit/shape.md` — scope, decisions (instant fill, no-op `n` in composed), context.
- `agent-os/specs/2026-04-30-1645-two-enter-submit/plan.md` — copy of this plan.
- `agent-os/specs/2026-04-30-1645-two-enter-submit/references.md` — pointers to App.tsx and the design doc section 4.

**Touch boundary:** May only create files under `agent-os/specs/2026-04-30-1645-two-enter-submit/`. May NOT touch source, test, or any other spec.

---

### Task 2: Add `composed` phase to App state machine

**Location:** `src/components/App.tsx`

**Signature:**
- `type Phase = 'idle' | 'composed' | 'playing' | 'done'` (was `'idle' | 'typing' | 'playing' | 'done'`)
- Component shape: `<App session={ParsedSession} />`. Internal state shape after change: `{ turnIndex, phase, mode, skipCurrent }` (drop `typedChars`).

**Behavior:**
- On `Enter` while `phase === 'idle'`: increment `turnIndex`, reset `skipCurrent`, set `phase='composed'`. PromptBox immediately shows the full `userPrompt`. Hint reads `↵ submit   f → instant   q quit`.
- On `Enter` while `phase === 'composed'`: set `phase='playing'`. PromptBox clears (`text=''`). Active `<Turn>` mounts with `mode={mode}`, `forceInstant={skipCurrent}`, runs to completion.
- On `<Turn onComplete>`: set `phase='idle'`, `skipCurrent=false`. Hint shows `↵ next turn (i+1/N)` or `✓ end of session   ↵ quit` if last.
- On `n` while `phase === 'playing'`: set `skipCurrent=true` (unchanged). On `n` during any other phase: no-op.
- On `f` (any phase): toggle `mode` (unchanged).
- On `q` / `Ctrl-C`: exit (unchanged).
- Rejects: N/A.
- Errors: N/A.

**Touch boundary:**
- May modify: `src/components/App.tsx`.
- May NOT modify: any other source, test, or spec file.

---

### Task 3: Update design and MVP spec for consistency

**Location:**
- `docs/plans/2026-04-30-claude-replay-design.md` — section 4 (state machine, keybindings, phase-aware hint table).
- `agent-os/specs/2026-04-30-1530-claude-replay-mvp/shape.md` — note that the original `typing` phase has been superseded by `composed`.
- `agent-os/specs/2026-04-30-1530-claude-replay-mvp/plan.md` — Task 9 behavior section.

**Signature:** N/A — documentation update.

**Behavior:**
- Replace `typing` with `composed` in the state machine description and the keybinding table.
- Update the hint table: drop the `typing` row; add `composed: ↵ submit   f → instant   q quit`.
- In the keybindings table, clarify that Enter advances `idle → composed → playing` (two presses per turn, not one).
- In the MVP shape.md decisions list, append a "**Superseded by 2026-04-30-1645-two-enter-submit:** the original `typing` animation phase has been replaced by an instant-fill `composed` phase." note so the historical spec doesn't read as drift.
- Rejects: N/A.
- Errors: N/A.

**Touch boundary:**
- May modify: the three files listed in Location.
- May NOT modify: any source code or test files.

---

## Verification

1. **Build & tests:** `npm run build` clean; `npm test` still 4/4 (parser tests unchanged).
2. **Smoke test — 2-Enter rhythm:** `node dist/cli.js <session>`.
   - On launch: hint reads `↵ play turn 1/N   f → instant   q quit`. PromptBox empty.
   - Press Enter (#1) → PromptBox immediately shows the full first user prompt; hint reads `↵ submit   f → instant   q quit`. No typewriter animation.
   - Wait — nothing should happen automatically in this state.
   - Press Enter (#2) → PromptBox clears; the prompt appears above as `> ...`; assistant content begins streaming.
   - When streaming finishes → hint reads `↵ next turn (2/N)   f → instant   q quit`. PromptBox empty.
   - Repeat for next turn.
3. **Smoke test — `n` no-op during composed:** Press Enter (#1) to enter composed. Press `n`. Nothing should happen — hint stays `↵ submit ...`. Press Enter (#2) to submit normally.
4. **Smoke test — `n` still works during playing:** Press Enter twice to start playing. Mid-stream, press `n`. The remainder of the turn should snap to instant.
5. **Smoke test — speed toggle during composed:** Press Enter (#1). Press `f`. Hint's speed marker flips. Press Enter (#2); assistant streams in the new mode.
6. **Spec consistency check:** Open `docs/plans/2026-04-30-claude-replay-design.md` section 4 and confirm the state machine, keybindings, and hint table all reflect the new flow. No mention of `typing` should remain.
