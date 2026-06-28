---
name: shadcn-design-tokens
description: The shadcn/ui semantic design-system contract — token architecture, foreground/background pairs, component→token mappings, theming, ownership, extension rules, accessibility, and AI/Figma conversion guidance. Use when generating or reviewing UI with shadcn/ui tokens, mapping Figma variables to CSS/Tailwind, deciding whether to add a new token, converting a design or image to semantic Tailwind classes, or stopping hardcoded colors like bg-blue-500. Triggers on "semantic tokens", "design tokens", "--primary/--foreground", "@theme inline", "Figma variable mapping", "token-driven".
user-invocable: true
---

# shadcn/ui Design System Contract

shadcn/ui is **not a color system — it is a semantic design system.** A component never knows its actual color; it only knows its semantic role. This skill is the contract for *how tokens are used, extended, and translated* across design, code, and AI workflows.

> The single biggest mistake: treating `primary` as "blue" or `muted` as "gray". Tokens name **roles**, not appearances.

## Core architecture

Every color flows through one chain. A component sits at the end and is blind to the hex value.

```
Hex Color → Semantic Role → CSS Variable → Tailwind Utility → Component
#4F46E5   → Primary Action → --primary    → bg-primary       → <Button />
```

Token hierarchy (who feeds whom):

```
Brand Palette → Semantic Tokens → Tailwind Variables (@theme inline) → Utility Classes → Components
Brand Purple  → primary          → --color-primary                   → bg-primary      → <Button>
```

## Token pairs — never separate foreground from background

Every foreground token belongs to a background token. Always apply them together; accessibility contrast is defined on the **pair**, not on individual colors.

| Background | Foreground |
|---|---|
| `background` | `foreground` |
| `card` | `card-foreground` |
| `popover` | `popover-foreground` |
| `primary` | `primary-foreground` |
| `secondary` | `secondary-foreground` |
| `accent` | `accent-foreground` |
| `muted` | `muted-foreground` |
| `destructive` | `destructive-foreground` |
| `sidebar` | `sidebar-foreground` |
| `sidebar-primary` | `sidebar-primary-foreground` |

Standalone tokens (no foreground pair): `border`, `input`, `ring`, `radius`, `chart-1..5`.

## Component → token mapping

Generate components by consuming these tokens — never raw palette utilities.

**Button**

| Variant | Tokens |
|---|---|
| default | `primary` + `primary-foreground` |
| secondary | `secondary` + `secondary-foreground` |
| destructive | `destructive` + `destructive-foreground` |
| outline | `border` + `background` |
| ghost | `accent` + `accent-foreground` |
| link | `primary` |

- **Card** → `card`, `card-foreground`, `border`, `radius`
- **Input** → `background`, `foreground`, `border`, `input`, `ring`
- **Dialog** → `background`, `foreground`, `card`, `card-foreground`, `border`, `ring`
- **Dropdown / Popover** → `popover`, `popover-foreground`, `accent`, `accent-foreground`, `border`
- **Sidebar** → every `sidebar-*` token

## Theme switching

Components never change between light and dark — only the variables do.

```
Light: --background = white   →  <Button /> unchanged
Dark:  --background = black    →  <Button /> unchanged
```

## Token ownership — who may change what

| Token | Owned by |
|---|---|
| `background`, `foreground` | Theme |
| `primary` | Brand |
| `destructive`, `border`, `radius` | Design System |
| `chart-1..5` | Data Visualization |
| `sidebar-*` | Sidebar Component |

## Extension rules — when to add a new token

Reuse before you create. Walk this tree:

```
Need a new color?
  → Can `primary` express the role?  → yes: reuse
  → Can `accent` express it?         → yes: reuse
  → Can `muted` express it?          → yes: reuse
  → none fit                          → create a NEW SEMANTIC token
```

Name by **role**, never by appearance:

- ✅ `success` / `success-foreground`, `warning` / `warning-foreground`, `info` / `info-foreground`
- ❌ `yellow`, `green`, `orange`, `blue`

New tokens follow the same pair + `@theme inline` rules as built-ins.

## AI conversion rules

When generating UI, the question is **"what is the semantic role?"** — never "what color is this?".

| ❌ Never output | ✅ Output instead |
|---|---|
| `bg-blue-500` | `bg-primary` |
| `text-gray-900` | `text-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `border-zinc-200` / `border-gray-200` | `border-border` |
| new `blue`/`green`/`yellow` tokens | semantic `success`/`warning`/`info` |

AI image/design → code pipeline:

```
Image → Semantic Detection → Token Selection → Tailwind Utility → React Component
```

## Figma mapping (1:1)

Every Figma variable maps directly through the chain — keep names identical at each layer:

```
Figma `background` → CSS --background → Tailwind bg-background
```

This is what makes the bridge's `create_paint_style` / `create_variable` output round-trip cleanly between design and code. Prefer creating **semantic** Figma variables/styles (slash-grouped, e.g. `Primary`, `Card/Foreground`) over literal color names.

## Tailwind v4 architecture (CSS-first)

v4 has no `tailwind.config.js` theme block — theme variables live in CSS and are exposed through `@theme inline`, so the same variable serves Tailwind utilities, plain CSS, and JS.

```
:root → CSS Variables → @theme inline → --color-primary → bg-primary → Component
```

```css
:root {
  --primary: oklch(0.55 0.22 277);
  --primary-foreground: oklch(0.98 0 0);
}
@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}
```

## Complete lifecycle

```
Designer → Figma Variable → Design Token → CSS Variable → @theme inline → Tailwind Utility → Component → Browser → User
```

## Review checklist (the contract)

- [ ] No raw palette utilities (`bg-*-500`, `text-gray-*`, `border-zinc-*`).
- [ ] Every foreground used with its background pair.
- [ ] Each component consumes only its mapped tokens.
- [ ] New colors reuse existing semantic tokens, or add role-named (not color-named) ones.
- [ ] Contrast verified per token pair (light + dark).
- [ ] Figma variables map 1:1 to CSS/Tailwind names.

## References

- shadcn/ui Theming — https://ui.shadcn.com/docs/theming
- shadcn/ui Tailwind v4 — https://ui.shadcn.com/docs/tailwind-v4
- Vercel Academy, Exploring globals.css — https://vercel.com/academy/shadcn-ui/exploring-globals-css
- shadcn design, Theming — https://www.shadcndesign.com/docs/theming
