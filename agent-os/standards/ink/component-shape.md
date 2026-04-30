---
name: component shape
description: Write Ink components as plain typed functions with a named `XxxProps` interface
type: standard
---

# Component shape

Write components as plain typed functions. Each component has a named `XxxProps` interface alongside it.

```tsx
interface PromptBoxProps {
  text: string;
  cwd: string;
  hint?: string;
}

export function PromptBox({text, cwd, hint}: PromptBoxProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{text}</Text>
    </Box>
  );
}
```

- Always destructure props in the parameter list.
- Optional props use `?:` (e.g. `hint?: string`), not `| undefined`.
- One exported component per file. Small private subcomponents may live in the same file.

**Migration:** Existing `React.FC<Props>` components are fine — convert opportunistically when you edit them. Don't churn untouched files.
