---
name: figma-vision-loop
description: Self-correcting visual critique loop for Figma designs built through this project's bridge — after building a section, screenshot it, score it against a fixed taste rubric (hierarchy, spacing, alignment, contrast, consistency, density), apply targeted fixes, and re-export, capped at 2–3 passes. Use whenever you build or polish UI in Figma and want it to actually look good instead of being composed blind. Triggers on "make it look better", "polish this", "critique the design", "verify the section", and runs by default after each section in figma-design-flow.
user-invocable: true
---

# Figma Vision Loop (design with eyes, not blind)

The single biggest quality unlock: **stop composing blind.** After each meaningful build step,
render the canvas, *look at it*, critique it against an explicit rubric, and fix only what fails.
A 2–3 pass *build → render → critique → refine* loop produces dramatically more polished output
than one-shot generation.

Use this with [figma-design-flow](../figma-design-flow/SKILL.md) (it calls this loop in its
verify step) and the token rules in [shadcn-design-tokens](../shadcn-design-tokens/SKILL.md).

> The mechanism already exists: `export_node_as_image` returns an image you can see. What this
> skill adds is the **discipline and the rubric.**

## The loop

```
build a section
  └─> export_node_as_image({ nodeId, format:"PNG", scale:1 })   // reduced scale for critique
        └─> critique IN WRITING against the rubric below
              └─> apply ONLY the targeted fixes for what failed
                    └─> re-export and re-check
                          └─> stop when the rubric is clean OR after 3 passes
final review: one export at full scale (scale:2) before declaring done
```

### Rules that keep it cheap and terminating

- **Section-scoped.** Critique the section you just built, not the whole page.
- **Reduced scale for critique** (`scale:1`); full scale (`scale:2`) only for the final review.
- **Hard cap: 2–3 passes.** Early-exit the moment no dimension fails — don't refine for its own sake.
- **Targeted fixes only.** Change what the rubric flags; don't rework passing areas.

## The critique rubric (the taste checklist)

Score each render against these fixed dimensions and fix only what fails. Write the critique
explicitly — naming the failure is what drives the fix.

| Dimension | Ask | Common fixes |
|-----------|-----|--------------|
| **Hierarchy** | Is there a clear focal point and visual order? | Resize/reweight headings, add emphasis, reorder. |
| **Spacing & rhythm** | Consistent, on-grid (8pt), balanced whitespace? | `set_item_spacing`, `set_padding` to grid multiples. |
| **Alignment** | Do edges and baselines line up? | `set_axis_align`, auto-layout, snap stray nodes. |
| **Contrast / a11y** | Text legible, WCAG AA where it matters? | Swap to a paired foreground token; raise contrast. |
| **Consistency** | Colors/type/spacing pulled from the system, not arbitrary? | Replace ad-hoc values with styles/variables. |
| **Density** | Not cramped, not empty? | Adjust padding/gaps; balance content vs. whitespace. |

## Writing a good critique

For each dimension, state **pass** or **the specific problem** — concrete and located, e.g.:

- ❌ Spacing: "Card padding is 12/16/20px across the three cards — inconsistent. Normalize to 16."
- ❌ Contrast: "Helper text is gray-on-light-gray, ~2.1:1 — below AA. Bind to `muted-foreground`."
- ✅ Hierarchy: clear — title dominates, price secondary, CTA distinct.

Then apply only the fixes for the ❌ items and re-export.

## Acceptance checklist

- [ ] After building a section, exported and critiqued it in writing against the rubric.
- [ ] Applied at least one targeted fix when a dimension failed.
- [ ] Before/after screenshots show measurable improvement (alignment / spacing / contrast).
- [ ] Loop self-terminated (clean rubric or ≤3 passes) — no infinite refine.
- [ ] Fixes used styles/variables, not new hardcoded values.
