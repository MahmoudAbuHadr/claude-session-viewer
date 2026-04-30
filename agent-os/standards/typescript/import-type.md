---
name: import type for types
description: Use `import type` for type-only imports; keep value and type imports separate
type: standard
---

# import type for types

Use `import type` when importing only types/interfaces.

```ts
// types only -> use `import type`
import type {ParsedSession, Turn} from './types.js';

// values (functions, classes, components) -> regular import
import {parseSession} from './parser.js';
import {App} from './components/App.js';

// mixed: split into two statements
import {readFile} from 'node:fs/promises';
import type {RawEvent} from './types.js';
```

**Why:** `import type` statements are erased at compile time — they don't exist in the output JS. This avoids accidental runtime imports and prevents some circular-import bugs.

- If you import a class/function but only use it as a type, switch to `import type`.
- Prefer two separate statements over inline `import {type Foo, bar}`.
