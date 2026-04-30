# References for Two-Enter Rhythm

## Internal references

### `src/components/App.tsx`

- **Location:** `src/components/App.tsx`
- **Relevance:** Holds the entire interaction state machine (phase enum, Enter/f/n/q handlers, hint switch, prompt text source). All source changes for this feature live here.
- **Key patterns to preserve:**
  - `modeRef` ref + `useEffect(..., [mode])` pattern for keeping a mutable mirror of the `mode` prop usable inside async closures. Stays as-is.
  - Active-vs-historical split via the `isTurnActive` derived flag and `lastCompleted` index — the same idea applies, just gated on `composed || playing` instead of `typing || playing` after the change.

### `src/components/Turn.tsx`

- **Location:** `src/components/Turn.tsx`
- **Relevance:** Renders the active turn during `phase === 'playing'`. Already renders the `> prompt` header instantly (the typewriter only ever lived in App). No changes needed here.

### `src/components/PromptBox.tsx`

- **Location:** `src/components/PromptBox.tsx`
- **Relevance:** Bottom prompt box. Accepts a `text` prop and renders whatever it gets. No changes needed — the shape of the prop is the same.

## Design references

### `docs/plans/2026-04-30-claude-replay-design.md` section 4

- **Location:** `docs/plans/2026-04-30-claude-replay-design.md` (Playback engine & keybindings)
- **Relevance:** The authoritative design for the playback state machine, keybinding table, and phase-aware hint table. Must be updated to describe `composed` instead of `typing`.

### `agent-os/specs/2026-04-30-1530-claude-replay-mvp/`

- **Location:** `agent-os/specs/2026-04-30-1530-claude-replay-mvp/{shape,plan}.md`
- **Relevance:** The original MVP shaping. References the now-removed `typing` phase in Task 9's behavior contract. Annotated as superseded by this new spec to avoid the appearance of drift.

## External references

No external libraries change. Ink, React, ink-spinner, meow all stay on the same versions and are used the same way.
