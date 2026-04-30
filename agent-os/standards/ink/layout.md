---
name: layout
description: Box for layout, Text for content; Ink layout cheat sheet
type: standard
---

# Layout with Box

Use `<Box>` for layout, `<Text>` for content. Box is flex-only; default direction is **row**.

## Cheat sheet

| Prop | Effect | Example |
|---|---|---|
| `flexDirection` | row / column | `<Box flexDirection="column">` |
| `paddingX` / `paddingY` | inside spacing | `<Box paddingX={1}>` |
| `marginTop` / `marginBottom` | outside spacing | `<Box marginTop={1}>` |
| `borderStyle` | draws a border | `<Box borderStyle="round">` |
| `gap` | space between children | `<Box gap={1}>` |

## Patterns

```tsx
// vertical stack with a border
<Box flexDirection="column" borderStyle="round" paddingX={1}>
  <Text color="cyan">⏺ Tool name</Text>
  <Text>{result}</Text>
</Box>

// row with leading prefix
<Box>
  <Text color="gray">{'> '}</Text>
  <Text>{prompt}</Text>
</Box>
```

## Rules
- All text must be inside `<Text>` — bare strings inside `<Box>` will throw.
- Numbers in margin/padding are *terminal cells*, not pixels.
- Default `flexDirection` is `row`. Use `column` whenever you stack vertically.
- Color names: `gray`, `cyan`, `green`, `red`. Use `dimColor` for hints/meta text.
