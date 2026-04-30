# Product Mission

## Problem

Live demos and teaching sessions for Claude Code are painfully slow. Real-time agent latency means the presenter spends most of the demo waiting for tool calls and streamed responses, which kills audience attention and makes recorded walkthroughs hard to share. There is no good way to replay a finished session at a watchable pace while still feeling live.

## Target Users

- **The presenter (you)** — demoing Claude Code workflows live to coworkers or an audience and wanting the demo to flow at a watchable pace.
- **Coworkers and teammates** — engineers learning how to use Claude Code effectively by watching shared replays.
- **The wider developer community** — conference talks, YouTube/Twitch streams, blog post embeds, and OSS users learning Claude Code patterns.

## Solution

A terminal-faithful replayer that takes a finished Claude Code session JSONL and plays it back in a real terminal as if it were happening live, driven by Enter presses. What makes it different from a screen recording or asciinema capture:

- **Real Claude Code TUI fidelity** — built on Ink (the same React-for-terminal library Claude Code itself uses), so the rendering is visually indistinguishable from a live session, not a video.
- **Interactive pacing** — the presenter drives the demo: Enter advances one user turn, hotkeys toggle between accelerated streaming and instant rendering, jump-back lets you revisit a prior turn when the audience asks. A video can't do that.
- **Uses existing JSONLs** — no re-recording, no instrumentation. Point at any session Claude Code already wrote to `~/.claude/projects/` and replay it. Zero capture overhead.
- **Live-feel illusion** — auto-types prompts into the prompt box, fakes streaming and tool-call spinners, so the audience genuinely cannot tell it is a replay.
