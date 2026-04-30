# Shape Spec

Gather context and structure planning for significant work. **Run this command while in plan mode.**

## Important Guidelines

- **Always use AskUserQuestion tool** when asking the user anything
- **Offer suggestions** — Present options the user can confirm, adjust, or correct
- **Keep it lightweight** — This is shaping, not exhaustive documentation

## Prerequisites

This command **must be run in plan mode**.

**Before proceeding, check if you are currently in plan mode.**

If NOT in plan mode, **stop immediately** and tell the user:

```
Shape-spec must be run in plan mode. Please enter plan mode first, then run /shape-spec again.
```

Do not proceed with any steps below until confirmed to be in plan mode.

## Process

### Step 1: Clarify What We're Building

Use AskUserQuestion to understand the scope:

```
What are we building? Please describe the feature or change.

(Be as specific as you like — I'll ask follow-up questions if needed)
```

Based on their response, ask 1-2 clarifying questions if the scope is unclear. Examples:
- "Is this a new feature or a change to existing functionality?"
- "What's the expected outcome when this is done?"
- "Are there any constraints or requirements I should know about?"

### Step 2: Gather Visuals

Use AskUserQuestion:

```
Do you have any visuals to reference?

- Mockups or wireframes
- Screenshots of similar features
- Examples from other apps

(Paste images, share file paths, or say "none")
```

If visuals are provided, note them for inclusion in the spec folder.

### Step 3: Identify Reference Implementations

Use AskUserQuestion:

```
Is there similar code in this codebase I should reference?

Examples:
- "The comments feature is similar to what we're building"
- "Look at how src/features/notifications/ handles real-time updates"
- "No existing references"

(Point me to files, folders, or features to study)
```

If references are provided, read and analyze them to inform the plan.

### Step 4: Check Product Context

Check if `agent-os/product/` exists and contains files.

If it exists, read key files (like `mission.md`, `roadmap.md`, `tech-stack.md`) and use AskUserQuestion:

```
I found product context in agent-os/product/. Should this feature align with any specific product goals or constraints?

Key points from your product docs:
- [summarize relevant points]

(Confirm alignment or note any adjustments)
```

If no product folder exists, skip this step.

### Step 5: Surface Relevant Standards

Read `agent-os/standards/index.yml` to identify relevant standards based on the feature being built.

Use AskUserQuestion to confirm:

```
Based on what we're building, these standards may apply:

1. **api/response-format** — API response envelope structure
2. **api/error-handling** — Error codes and exception handling
3. **database/migrations** — Migration patterns

Should I include these in the spec? (yes / adjust: remove 3, add frontend/forms)
```

Read the confirmed standards files to include their content in the plan context.

**Always include the `spec-discipline` skill** by reading `.claude/skills/spec-discipline/SKILL.md`, regardless of feature type — it governs how drift is handled during execution.

### Step 6: Generate Spec Folder Name

Create a folder name using this format:

```
YYYY-MM-DD-HHMM-{feature-slug}/
```

Where:

- Date/time is current timestamp
- Feature slug is derived from the feature description (lowercase, hyphens, max 40 chars)

Example: `2026-01-15-1430-user-comment-system/`

**Note:** If `agent-os/specs/` doesn't exist, create it when saving the spec folder.

### Step 7: Structure the Plan

Now build the plan with **Task 1 always being "Save spec documentation"**.

Present this structure to the user:

```
Here's the plan structure. Task 1 saves all our shaping work before implementation begins.

---

## Execution Protocol

For every implementation task below:

1. **Re-attach the spec** at the start of the task by referencing:
   - `@agent-os/specs/{folder-name}/shape.md`
   - `@agent-os/specs/{folder-name}/standards.md`

   This keeps the spec in working context and prevents drift as the conversation grows.

2. **Stay within the Touch Boundary** declared in each task. Files outside the boundary are off-limits unless the spec is updated first.

3. **When implementation diverges from the spec**, apply the discipline in the `spec-discipline` skill (`.claude/skills/spec-discipline/SKILL.md`):
   - Behavior changed by intent → update `shape.md` first, then code follows
   - Behavior changed by accident → fix code to match `shape.md`

4. **Run `/check-spec`** after each task (or at minimum before commit) to detect drift.

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/{folder-name}/` with:

- **plan.md** — This full plan (including this Execution Protocol)
- **shape.md** — Shaping notes (scope, decisions, context from our conversation)
- **standards.md** — Relevant standards that apply to this work
- **references.md** — Pointers to reference implementations studied
- **visuals/** — Any mockups or screenshots provided

## Task 2: [First implementation task]

[Description following the Task Format Contract — see Step 8]

## Task 3: [Next task]

...

---

Does this plan structure look right? I'll fill in the implementation tasks next.
```

### Step 8: Complete the Plan — Task Format Contract

After Task 1 is confirmed, build out the remaining implementation tasks. **Every implementation task MUST satisfy the Task Format Contract below.** Vague tasks cause drift; precise tasks read like contracts and leave no room for interpretation.

#### Task Format Contract

Each implementation task must include four explicit fields:

1. **Location** — the file path(s) the task will create or modify (e.g. `src/services/comments.ts`).
2. **Signature shape** — the method/function/component being added or changed: name, key parameters (with shapes, not necessarily types), return shape. For UI components: name, key props, key state.
3. **Behavior contract** — 2-4 bullets in *does / rejects / errors* form:
   - What it does on the happy path (1-2 bullets, observable behavior).
   - What it rejects (validation, preconditions).
   - What error/exception it raises (named type, when).
4. **Touch boundary** — files this task may modify; files this task must NOT modify. If the task only touches the files in *Location*, say so explicitly.

If a task cannot be expressed in this form (e.g. "set up the project"), it's not an implementation task and should be a sub-task of Task 1 (Save Spec Documentation) or a separate scaffolding task with explicit deliverables.

#### Worked example — what a good task looks like

```
## Task 3: Add moderateComment service method

**Location:** `src/services/comments.ts`

**Signature:**
moderateComment(commentId: string, action: 'approve' | 'reject', reason?: string)
  → Promise<Comment>

**Behavior:**
- Loads the comment by id; updates `status` to `approved` or `rejected` per `action`
- Writes a `moderation_events` row (commentId, moderatorId, action, reason, timestamp)
- Returns the updated Comment
- Rejects with `ForbiddenError` if the calling user lacks `moderate:comments` permission
- Rejects with `NotFoundError` if the comment does not exist
- Throws `ValidationError` if `action` is not one of the allowed values

**Touch boundary:**
- May modify: `src/services/comments.ts`, `src/db/migrations/<new>.sql` (for moderation_events)
- May NOT modify: comment body content, comment author, comment timestamps
```

#### Counter-example — what to refuse

If you find yourself writing tasks like:

```
## Task 3: Implement comment moderation
```

Stop and rewrite. The contract is not optional.

#### When the user pushes back on precision

Some users feel the contract is heavy. Surface the trade-off:

> The Task Format Contract is what prevents implementation drift. Loose tasks like "implement comment moderation" will be interpreted by the AI during execution, and interpretation drifts. Tighter tasks read like contracts and produce mechanical execution.
>
> If a specific field genuinely doesn't apply (e.g. no UI, no error path), say "N/A" — but don't drop the field.

Build out each task following this contract, drawing on:

- The feature scope from Step 1
- Patterns from reference implementations (Step 3)
- Constraints from standards (Step 5)

### Step 9: Ready for Execution

When the full plan is ready:

```
Plan complete. When you approve and execute:

1. Task 1 will save all spec documentation first
2. Then implementation tasks will proceed

Each task follows the Execution Protocol (re-attach spec, respect touch boundary, apply spec-discipline on drift, run /check-spec).

Ready to start? (approve / adjust)
```

## Output Structure

The spec folder will contain:

```
agent-os/specs/{YYYY-MM-DD-HHMM-feature-slug}/
├── plan.md           # The full plan (with Execution Protocol header)
├── shape.md          # Shaping decisions and context
├── standards.md      # Which standards apply and key points
├── references.md     # Pointers to similar code
└── visuals/          # Mockups, screenshots (if any)
```

## shape.md Content

The shape.md file should capture:

```
# {Feature Name} — Shaping Notes

## Scope

[What we're building, from Step 1]

## Decisions

- [Key decisions made during shaping]
- [Constraints or requirements noted]

## Context

- **Visuals:** [List of visuals provided, or "None"]
- **References:** [Code references studied]
- **Product alignment:** [Notes from product context, or "N/A"]

## Standards Applied

- api/response-format — [why it applies]
- api/error-handling — [why it applies]
- spec-discipline (skill: `.claude/skills/spec-discipline/SKILL.md`) — governs drift handling during execution

## Behavior Contracts

The implementation tasks in plan.md each declare their behavior contract following the Task Format Contract. This section is a quick index — see plan.md for the full task definitions.

- Task 2: [one-line summary of what it adds + the file it touches]
- Task 3: [one-line summary]
- ...
```

## standards.md Content

Include the full content of each relevant standard:

```
# Standards for {Feature Name}

The following standards apply to this work.

---

## api/response-format

[Full content of the standard file]

---

## api/error-handling

[Full content of the standard file]

---

## spec-discipline

[Full content of the `.claude/skills/spec-discipline/SKILL.md` file]
```

## references.md Content

```
# References for {Feature Name}

## Similar Implementations

### {Reference 1 name}

- **Location:** `src/features/comments/`
- **Relevance:** [Why this is relevant]
- **Key patterns:** [What to borrow from this]

### {Reference 2 name}

...
```

## Tips

- **Keep shaping fast** — Don't over-document. Capture enough to start, refine as you build.
- **Visuals are optional** — Not every feature needs mockups.
- **Standards guide, not dictate** — They inform the plan but aren't always mandatory.
- **The Task Format Contract is not optional** — it's the lever that prevents drift. Loose tasks defeat the purpose of shape-spec.
- **Specs are discoverable** — Months later, someone can find this spec and understand what was built and why.
- **Drift is governed by `/check-spec`** — point users at it after the first task lands so they form the habit early.
