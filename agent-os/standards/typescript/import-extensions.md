---
name: import extensions
description: Use `.js` on local imports (even for `.ts`/`.tsx` sources), `node:` prefix for built-ins
type: standard
---

# Import file extensions

When importing local files, write `.js` even though the source is `.ts`/`.tsx`.

```ts
// correct
import {parseSession} from './parser.js';
import {Picker} from './components/Picker.js';
import type {ParsedSession} from './types.js';

// wrong — Node will fail at runtime
import {parseSession} from './parser';
import {parseSession} from './parser.ts';
```

**Why:** Project is ESM (`"type": "module"`) with `module: NodeNext` in `tsconfig.json`. Node's ESM resolver requires explicit extensions, and TypeScript expects the extension of the *output* file (`.js`), not the source.

- Node built-ins use `node:` prefix: `import {readFile} from 'node:fs/promises'`.
- Third-party packages don't need an extension: `import meow from 'meow'`.
