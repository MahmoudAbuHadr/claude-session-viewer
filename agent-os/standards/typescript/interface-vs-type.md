---
name: interface vs type
description: When to use `interface` (object shapes) vs `type` (unions, aliases) in TypeScript
type: standard
---

# interface vs type

Use `interface` for **object shapes** (Props, records, data structures).
Use `type` only for **unions, string literals, or aliases**.

```ts
// object shape -> interface
interface TurnProps {
  turn: Turn;
  mode: Mode;
}

// union -> type
type Mode = 'stream' | 'instant';
type Phase = 'idle' | 'composed' | 'playing' | 'done';

// don't: use interface for object shapes instead
type TurnProps = { turn: Turn; mode: Mode };
```

- `interface` can be extended later (`interface Foo extends Bar`); unions can't.
- One rule everywhere = less mental overhead when reading code.
