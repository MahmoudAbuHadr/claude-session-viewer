# Check Spec

Detect drift between a saved `agent-os/specs/{date-slug}/shape.md` and the current implementation. Report divergences and recommend a side to fix.

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **Be specific** — divergences must cite spec section AND code location
- **Don't auto-fix** — this command reports drift; the user (per the `spec-discipline` skill at `.claude/skills/spec-discipline/SKILL.md`) decides which side to update
- **Behavior, not style** — pure refactors (renames, formatting, file moves) are not drift. Only flag changes that affect observable behavior

## Usage Modes

### Default — most recent spec

```
/check-spec
```

Targets the most recently modified folder under `agent-os/specs/`.

### Explicit — named spec

```
/check-spec 2026-04-29-1430-comment-moderation
```

Targets `agent-os/specs/2026-04-29-1430-comment-moderation/`.

### Range mode — against a base ref

```
/check-spec --base=main
/check-spec 2026-04-29-1430-comment-moderation --base=main
```

Compares the spec against the diff between `main` and `HEAD`. Useful before opening a PR.

## Process

### Step 1: Resolve Target Spec

If a folder slug was passed, validate it exists under `agent-os/specs/`. If not:

```
Spec not found: {slug}

Available specs (most recent first):
- 2026-04-29-1430-comment-moderation
- 2026-04-22-0915-user-comment-system
- 2026-04-15-1100-notification-preferences

Use /check-spec <slug> to target a specific spec.
```

If no slug was passed, list the contents of `agent-os/specs/`, sort by modification time, and use the most recent. Confirm with the user via AskUserQuestion only if there are multiple specs modified in the last 24 hours (likely ambiguous):

```
Two specs modified recently:
1. 2026-04-29-1430-comment-moderation (modified 2 hours ago)
2. 2026-04-29-0900-user-tags (modified 6 hours ago)

Which should I check? (1 or 2, or specify a slug)
```

### Step 2: Read the Spec

Read all of:

- `agent-os/specs/{slug}/shape.md` — the source of truth for behavior
- `agent-os/specs/{slug}/plan.md` — to identify the task list and any execution protocol footer
- `agent-os/specs/{slug}/standards.md` — to know which standards apply

If `shape.md` is missing, stop and report:

```
shape.md not found in agent-os/specs/{slug}/. Cannot check drift.
```

### Step 3: Identify Implementation Surface

Determine which files in the codebase the spec is supposed to have produced.

**If `--base=<ref>` was passed:** run `git diff --name-only {base}...HEAD` and use that file list.

**Otherwise:** parse `shape.md` and `plan.md` for explicit file path mentions (e.g. `src/services/comments.ts`, `src/api/routes/comments.ts`). Use those as the implementation surface.

If neither yields a file list, ask the user:

```
I couldn't infer which files this spec touches. How should I proceed?

1. **Compare against `git diff main...HEAD`** — uses your branch's diff
2. **Specify files** — I'll ask you to list the files this spec produced
3. **Cancel** — exit without checking

(Choose 1, 2, or 3)
```

### Step 4: Read the Implementation

For each file in the implementation surface, read its current contents. Note: read the *current* file state, not the diff — drift is about whether the code matches the spec *now*, not about what changed since some baseline.

### Step 5: Compare Behavior

For each task or behavior contract in `shape.md`, check the implementation:

**Behavior contract elements to verify:**

- **File path** — does the named file exist?
- **Method/component signature** — does the method exist with the specified inputs and outputs?
- **Behavior bullets** — does the implementation handle each *does / rejects / errors* bullet?
- **Touch boundary** — were any files modified that the spec said should not be touched? Were files outside the spec's named files modified?
- **Standards** — does the implementation respect the standards listed in `standards.md`?

For each finding, classify it:

- **MISSING** — spec says something exists or happens, code doesn't have it
- **EXTRA** — code has something not specified in the spec (potential scope creep)
- **CONTRADICTORY** — code does something different from what the spec says (e.g. spec says throws `ForbiddenError`, code throws `ValidationError`)
- **STANDARDS** — code violates a listed standard (e.g. response envelope shape wrong)

Pure refactors (renames where behavior is identical, file moves where the new path is consistent, formatting) are NOT drift. Don't flag them.

### Step 6: Generate Drift Report

Output a structured report:

```
# Drift Report — {spec-slug}

Checked {N} behavior contracts across {M} files.

## Summary

- ✓ {X} contracts verified
- ⚠ {Y} divergences found
- ⚙ {Z} potential refactors (not flagged as drift)

## Divergences

### 1. CONTRADICTORY — moderateComment error type

**Spec** (shape.md, Task 3):
> Throws `ForbiddenError` if caller lacks `moderate:comments` permission.

**Code** (src/services/comments.ts:142):
```ts
if (!hasPermission(user, 'moderate:comments')) {
  throw new UnauthorizedError('...');
}
```

**Recommended action** (per the `spec-discipline` skill):
- If `UnauthorizedError` is the new intent → update shape.md to say `UnauthorizedError`
- If this was an accident → change the code to throw `ForbiddenError`

### 2. MISSING — moderation_events row

**Spec** (shape.md, Task 3):
> Writes a `moderation_events` row.

**Code** (src/services/comments.ts:140-160):
No write to `moderation_events`.

**Recommended action:** likely accident — add the write to match the spec.

### 3. EXTRA — comment body sanitization

**Code** (src/services/comments.ts:135-138):
```ts
const sanitized = sanitizeHtml(comment.body);
comment.body = sanitized;
```

**Spec:** does not mention sanitization in Task 3. The Touch Boundary says "does not touch the comment body."

**Recommended action:** review — this looks like scope creep but may be a legitimate cross-cutting concern. If kept, update shape.md (or factor it into a separate task / standard).

## Potential refactors (not flagged)

- `commentsService` → `commentService` (rename, behavior identical)
- File moved: `src/services/comments.ts` → `src/features/comments/service.ts`. Spec still references the old path; update shape.md if this move is intentional.
```

### Step 7: Suggest Next Action

After the report, use AskUserQuestion only if there are divergences:

```
{Y} divergences found. How would you like to proceed?

1. **Update shape.md** — for divergences that are intentional behavior changes (I'll list them and ask which to apply)
2. **Fix the code** — for divergences that look accidental (I'll list them and ask which to apply)
3. **Mixed** — go through each divergence one by one
4. **Just report** — exit; you'll handle them yourself

(Choose 1, 2, 3, or 4)
```

If 0 divergences, just exit:

```
✓ Implementation matches spec. No drift detected.
```

## Output

A drift report printed to the conversation. No files are modified by `/check-spec` itself — fixes happen via subsequent edits or `/shape-spec` re-runs, governed by the `spec-discipline` skill.

## Tips

- **Run after each task** during early adoption — catches drift while context is fresh
- **Run before PR open** — `/check-spec --base=main` is the natural pre-PR check
- **If the report is full of EXTRA findings** — the spec is probably too narrow; consider splitting the feature
- **If the report is full of MISSING findings** — the implementation is incomplete; finish before checking again

## Related

- See `.claude/skills/spec-discipline/SKILL.md` for the decision rule used in recommendations.
- This command does not write to specs or code. To update a spec after intentional behavior change, edit `shape.md` directly or re-run `/shape-spec` for a fresh shape.
