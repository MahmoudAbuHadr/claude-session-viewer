---
name: keyboard handling
description: useInput patterns; every interactive screen must handle Ctrl+C and `q` as exit
type: standard
---

# Keyboard handling with useInput

Every interactive screen must handle **Ctrl+C** and **q** as exit. Always handle them first in the `useInput` callback.

```tsx
import {useApp, useInput} from 'ink';

export function MyScreen() {
  const {exit} = useApp();

  useInput((input, key) => {
    if (key.ctrl && input === 'c') { exit(); return; }
    if (input === 'q') { exit(); return; }

    // screen-specific keys after the exit checks
    if (key.return) submit();
    if (key.upArrow) moveUp();
  });

  return <Box>...</Box>;
}
```

## Common keys
- `key.return` — Enter
- `key.escape` — Esc
- `key.upArrow` / `key.downArrow` — arrows
- `key.ctrl && input === 'c'` — Ctrl+C (`input` is lowercase letter, `key.ctrl` is the modifier)
- `input === 'q'` — plain letter keys come through `input`

## Rules
- **Always `return` after handling a key.** Falling through causes accidental double-handling.
- Single-letter shortcuts (`f`, `n`, etc.) compare on `input`, not `key`.
- Pickers/menus may also accept `key.escape` as exit.
