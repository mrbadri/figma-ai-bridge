---
name: figma-design-flow
description: Bridge-native workflow for designing in Figma through THIS project's Plugin-API MCP tools (talk-to-figma) — create components, build multi-variant component sets, add component properties, place and override instances, apply token-driven styles, and verify with screenshots. Use when the user wants to create a component, make variants / a component set, build a button/card/input with states, design a screen on the free-plan bridge (no Dev Mode, no use_figma), or convert an old design into a new token-driven one. Triggers on "create component", "make variants", "component set", "multi-variant", "build a design in Figma", "create a button with states".
user-invocable: true
---

# Figma Design Flow (bridge-native)

The end-to-end workflow for **building design** through this project's bridge — the local
Plugin-API MCP server (`talk-to-figma`), **not** Figma's paid `use_figma` MCP. For setup,
pairing, and troubleshooting see [figma-bridge](../figma-bridge/SKILL.md). For semantic token
rules see [shadcn-design-tokens](../shadcn-design-tokens/SKILL.md). For full screens from a
published library, `figma-generate-design` is a *reference* only (it targets the paid MCP).

> **Always `join_channel` first.** Every tool below is a no-op until the plugin channel is paired.

## Golden rules

- **Search before you build.** Before hand-building ANY element, `search_design_system("<need>")`
  and reuse a match as an instance. Building from primitives is the last resort (see §0).
- **Read cheaply (Token Diet).** Prefer screenshot → scan → depth/field-limited reads over full
  JSON dumps (see §0.1). Full-tree dumps only when you truly need every detail.
- **Load fonts before text.** Text tools load fonts internally; if you script raw text, the
  font must exist (Inter weight is `"Semi Bold"`, not `"SemiBold"`).
- **Pass node ids, not nodes.** Figma nodes don't serialize — work with returned ids.
- **Tokens, not hex.** Bind colors to styles/variables (see token contract). Don't hardcode.
- **Verify visually.** After each section, run the [figma-vision-loop](../figma-vision-loop/SKILL.md)
  critique pass before continuing.
- **Build once, instance many.** One main component → N instances with overrides; never N near-identical frames.

## 0. Component-First (do this before building anything)

The design system is the source of truth — reuse it instead of composing primitives.

1. **Load the manifest once.** `get_design_system_manifest()` returns the cached, compact
   inventory of components (with variants/props/hints), styles and variables. It's disk-cached
   and rebuilt only when the DS changes, so it's cheap to read at the start of a task.
2. **Search per element.** `search_design_system("primary button")` → ranked matches with their
   variants and properties.
   - **Match** → `create_component_instance` + override text/props/variants (§3). Do NOT hand-build.
   - **No match** → compose from primitives (§1) as a last resort, then **offer to componentize**
     the result (`create_component_from_node`) so the DS grows.
3. **Bind to tokens.** Use the manifest's styles/variables via `apply_style` / `set_bound_variable`
   instead of literal hex/spacing values.

### 0.1 Token-Diet reads

When you need to understand existing canvas content, read in this order — cheapest first:

- **Screenshot** — `export_node_as_image` and look; far cheaper than JSON for layout/structure.
- **Scan** — `scan_nodes_by_types` to locate the few nodes that matter.
- **Targeted get** — `get_node_info` / `get_nodes_info` / `read_my_design` with `depth` (limit
  nesting) and `fields:"layout"` (geometry + hierarchy + text only, drops fills/strokes/styles).
- Only drop `depth`/`fields` for a full dump when you genuinely need every detail.

## 1. Create a component

```
create_frame → set_layout_mode(auto-layout) → set_padding / set_item_spacing →
add children (create_text, create_rectangle, create_svg for icons) →
create_component_from_node({ nodeId, name })
```

- Mirror source boundaries: one source component (`<Button>`, `<Card>`) → one main component.
- Keep main components off to the side (a "Components" area); place only **instances** in views.
- Name with slash grouping if it has variants later (see step 2).

## 2. Variant flow (multi-variant component set)

The core multi-state pattern. Build one base, derive states, then combine.

1. **Base component** — build it (step 1) and name it with `Prop=Value` pairs:
   `create_component_from_node({ name: "Size=Medium, State=Default" })`.
2. **Derive each variant** — `clone_node` the base, restyle it (fills/text/effects via tokens),
   then `set_variant_properties({ nodeId, properties: { Size:"Medium", State:"Hover" } })`
   (this renames the clone so Figma reads the axis). Repeat across the full matrix
   (e.g. Size × State × Type).
3. **Combine** — `combine_as_variants({ nodeIds: [...all variant ids], name: "Button" })`
   → one component set; the response lists the derived `variantProperties` axes.
4. **Add non-axis props** — for booleans/text/swaps that aren't variant axes:
   `create_component_property({ nodeId: <set id>, propertyName: "Has Icon", type: "BOOLEAN", defaultValue: false })`
   (also `TEXT` for labels, `INSTANCE_SWAP` for swappable icons).

Matrix tip: enumerate the axes as nested loops, clone+rename per cell, collect ids, combine once.

## 3. Place and override instances

```
create_component_instance({ componentKey, x, y })   // from a main component / set
get_instance_overrides({ nodeId: <styled source instance> })   // capture customizations
set_instance_overrides({ sourceInstanceId, targetNodeIds: [...] })  // apply to others
```

Override per-item content (text, swaps) on instances instead of rebuilding frames.

## 4. Token-driven styling (do this, not hex)

Create shared styles once, then reference them — this is what makes output themeable and
keeps it inside the [shadcn-design-tokens](../shadcn-design-tokens/SKILL.md) contract.

- `create_paint_style({ name:"Primary", color:{r,g,b,a} })` — colors (0–1 RGBA, slash-grouped).
- `create_text_style({ name:"Heading/H1", fontFamily, fontStyle, fontSize, lineHeight })`.
- `create_effect_style({ name:"Elevation/Card", effects:[…] })` — shadows/blur.
- `create_grid_style` — layout grids.
- Bind nodes with `set_bound_variable` (field `fills`/`strokes`) or `apply_style`.

Always apply foreground **with** its background pair (`primary`+`primary-foreground`, etc.).

## 5. Old design → new design

1. Read the source: `get_document_info`, `get_styles`, `get_local_components`, `get_variables`,
   `scan_nodes_by_types`, plus `export_node_as_image` for visual grounding.
2. Map old colors/typography → **semantic** styles (step 4); name by role, not appearance.
3. Rebuild components + variants (steps 1–2) consuming the new styles.
4. Verify each section against the original via the screenshot loop.

## 6. Verify loop (every section) — the Vision Loop

After building each meaningful section, run the structured critique pass from
[figma-vision-loop](../figma-vision-loop/SKILL.md): export the section, score it against the
rubric (hierarchy, spacing, alignment, contrast, consistency, density), apply targeted fixes,
and re-export — capped at 2–3 passes, early-exit when clean.

```
export_node_as_image({ nodeId, format:"PNG", scale:1 }) → critique vs rubric →
fix only what fails → re-export → stop when clean or after 3 passes
```

## Acceptance checklist

- [ ] Channel joined before any write.
- [ ] Searched the design system before hand-building; reused matches as instances.
- [ ] Reads used screenshot/scan/depth-limited gets, not full-tree dumps.
- [ ] One main component per source component; views contain only instances.
- [ ] Full variant matrix combined into a single component set with correct axes.
- [ ] Non-axis props added (boolean/text/instance-swap) where needed.
- [ ] No hardcoded hex — all colors via paint styles / bound variables, foreground paired.
- [ ] Each section visually verified by exported image.
