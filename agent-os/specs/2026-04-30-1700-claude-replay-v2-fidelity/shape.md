# Claude Replay v2 — Fidelity Pass — Shaping Notes

## Scope

The v1 replayer ships a working two-Enter playback loop, but three rendering surfaces don't pass a side-by-side glance against real Claude Code:

1. **Tool panels** wrap every call in a bordered box with the full result body inline. Real Claude Code renders tool calls inline with text, using a `●` header and a `⎿` continuation summary line — no box, no full body unless the user expands it.
2. **User prompts for slash commands** appear as raw `<command-name>foo</command-name>` tags. Real Claude Code shows `> /foo` (dim) plus the command's stdout below. The replayer also leaks `<local-command-caveat>` and `<system-reminder>` wrappers into the prompt area.
3. **Thinking blocks** collapse to a single `⏺ Thinking…` line. Real Claude Code shows the full thought body in dim grey, indented under a `✻ Thinking…` header.

v2 is a focused fidelity pass on these three. It is not a feature-expansion release.

## Decisions

Made via brainstorming Q&A on 2026-04-30:

- **Tool-panel rendering: full pivot.** Drop the bordered box entirely. Tool calls become inline siblings of text blocks. (Q3 → option a.)
- **Per-tool summarizers: hand-written for top 5 tools, fallback for the rest.** Top 5 = `Read`, `Edit`, `Write`, `Bash`, `Grep`. Fallback = first line of `tool_result.content`, truncated to ~60 chars. The 30-line `MAX_RESULT_LINES` body is gone. (Q4 → option c.)
- **Include `(ctrl+r to expand)` decoration.** Visual fidelity for the `Read` summary, even though no expansion is wired up in v2.
- **Thinking blocks: full body, streamed.** Same `streamText` machinery as text blocks (3 chars / ~10ms / jittered). Instant mode renders the whole body in one frame. (Q5 → option a.)
- **Slash-command stdout: render below the prompt.** Most-faithful path; selectively dropping per command would mean curating the session, which violates the verbatim policy in `CLAUDE.md`. (Q6 → option b.)
- **Wrapper stripping: whitelist approach.** Slash-command parser handles its own wrappers (`<command-name>`, `<command-args>`, `<command-message>`, `<local-command-stdout>`). For plain prompts, strip every `<…>...</…>` block (greedy, multiline) and keep only the residual prose. New wrapper types added by Claude Code in the future won't leak through. (Q7 → option c.)
- **`AskUserQuestion` exception kept.** It's the one tool where the body *is* the content. The structured body added in the v1 fix-up stays. No `⎿` summary line — the questions panel replaces that role.

Referenced incidents that drove this:
- Screenshot #3 (AskUserQuestion rendering as `[object Object]`) — already fixed in `src/components/ToolPanel.tsx` ahead of this spec.
- Screenshot #4 (`<local-command-caveat>` and `<command-name>` blocks rendering raw in the user prompt area).

## Context

- **Visuals:** Two screenshots from 2026-04-30 conversation showing the issues. No mockups — the reference is real Claude Code itself.
- **References:**
  - Existing v1 design at `docs/plans/2026-04-30-claude-replay-design.md` (§3 rendering, §6 v2 list).
  - Existing v2 design at `docs/plans/2026-04-30-claude-replay-v2-fidelity-design.md` (the brainstorming output that this spec is the implementation cut of).
  - Existing components: `src/components/ToolPanel.tsx`, `src/components/Turn.tsx`, `src/components/PromptBox.tsx`, `src/components/App.tsx`.
  - Existing `summarizeArgs` and `AskUserQuestionBody` in `ToolPanel.tsx` (kept as-is).
  - Existing `streamText` helper in `Turn.tsx` (reused for thinking-block streaming).
- **Product alignment:** Roadmap (`agent-os/product/roadmap.md`) Phase 2 lists "Jump-back / go-to-turn" and "Scroll history" but not the three items in this v2 cut. The product doc will need a follow-up edit to reflect the actual v2 scope, but that's not blocking.

## Standards Applied

No `agent-os/standards/` directory exists in this project, so no formal standards files to inline. The de-facto standards that apply:

- **CLAUDE.md** — verbatim-only rule. Decisions in this spec respect it: the slash-command stdout is rendered exactly as captured; per-tool summarizers do the same line-counting / first-line work that real Claude Code does, not editorial summarization.
- **Spec discipline** — handled via the Execution Protocol in `plan.md`. If implementation diverges from this spec, the design doc and this spec must be updated first.

## Drift recorded during execution

- **Slash command name de-duplication.** Real-data check on `treyd-2-dev/erp_invoices/6fcbe2e2…jsonl` showed `<command-name>/login</command-name>` (the captured name already includes a leading slash). The original parser produced `//login`. `parsePrompt` now strips a leading `/` from the captured name before joining with args.
- **Empty-after-strip fallback.** Real-data check showed caveat-only "turns" where `raw = "<local-command-caveat>...</local-command-caveat>"` and stripping leaves nothing. The original spec said "never render literally blank → fall back to raw.trim()", but that leaked the tag back into the prompt area. Updated to: strip leaves nothing → `display = ''`. Caller (`Turn.tsx`) skips the `> ` line when display is empty, matching how real Claude Code hides synthetic caveat-only turns.

## Out of Scope (deferred to v3 / later)

- Subagent panel tick-through (read `subagents/agent-<id>.jsonl` and animate it).
- Jump-back (`b`) and go-to-turn (`g`).
- Up/Down scrollback between turns.
- Status-line animation (`✻ Brewing…` / `✶ Crafting…`).
- Snapshot tests for the renderer (Ink `render` test helper).
- Color-palette / box-drawing audit beyond the box-removal in Task 6.

## Behavior Contracts

The implementation tasks in `plan.md` each declare their behavior contract following the Task Format Contract. This section is a quick index — see `plan.md` for the full task definitions.

- **Task 2:** `parsePrompt(raw)` whitelist parser → `src/prompt.ts`.
- **Task 3:** `Turn.prompt: RenderedPrompt` type rename + parser wiring → `src/types.ts`, `src/turns.ts`.
- **Task 4:** PromptBox accepts `RenderedPrompt`; App passes it through → `src/components/PromptBox.tsx`, `src/components/App.tsx`.
- **Task 5:** Turn renders `> display` line + optional stdout + streams thinking-block bodies → `src/components/Turn.tsx`.
- **Task 6:** ToolPanel pivot — drop box, `⎿` summary, per-tool summarizers → `src/components/ToolPanel.tsx`.
