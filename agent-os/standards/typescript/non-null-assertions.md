---
name: non-null assertions
description: Use `!` only after a check that proves the value exists; otherwise narrow with a guard
type: standard
---

# Non-null `!` assertions

Use `!` only when surrounding code **proves** the value exists. A wrong `!` is a silent runtime crash.

```ts
// ok — bounds checked by the for-loop
for (let i = 0; i < turn.assistantBlocks.length; i++) {
  const block = turn.assistantBlocks[i]!;
  // ...
}

// ok — emptiness checked above
if (events.length === 0) throw new MalformedSessionError('...');
const first = events[0]!;

// wrong — no proof the array isn't empty
const first = events[0]!;
```

## When NOT to use `!`
- On user input or external JSON — validate, don't assert.
- After `.find()` / `.get()` without checking the result — use a guard or `??`.
- "I know it's there because I just put it there" — refactor to a local variable.

## Alternatives
```ts
const block = turn.assistantBlocks[i];
if (!block) continue;            // narrow with a guard
const name = match?.[1] ?? '';   // optional chain + default
```
