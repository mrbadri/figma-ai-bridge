# Deep Proposal: The Design Quality Engine

**Subject:** Evolving the MCP↔Figma bridge from a low-level "remote control" into a powerful, self-correcting design agent.
**Builds on:** [`proposal-claude-code-figma.md`](proposal-claude-code-figma.md) (bridge architecture) and [`ROADMAP.md`](ROADMAP.md) (variants, styles, async jobs, migration).
**Scope of this document:** Architecture and an executable task plan only. No code is written here.

---

## 1. Executive Summary

The bridge today works: Claude can read and write the Figma canvas through ~65 Plugin-API tools. But three problems hold it back from being a *powerful* tool:

1. **It ignores the design system and builds from scratch.** Output is inconsistent and off-brand.
2. **It burns tokens.** Full node-tree JSON dumps make every read expensive, capping how much the agent can attempt per session.
3. **Output is not beautiful.** It composes raw primitives blindly, with no imagery and no visual self-check.

This proposal addresses all three with **three primary pillars** plus **four supporting systems**. The unifying idea is a mental shift:

> **Stop making the agent *draw*. Make it *assemble and direct*.**

Professional designers don't place rectangles one at a time — they compose from a system, drop in real assets, and iterate by looking. This proposal gives the agent those same three abilities.

### The three pillars
| Pillar | Fixes | One-line description |
|--------|-------|----------------------|
| **A. Vision Loop** | Beauty | Screenshot → self-critique → refine, every step. The agent designs with eyes, not blind. |
| **B. Component-First Brain** | Design system + tokens | Search the DS, instantiate, override — building from scratch becomes the rare fallback. |
| **C. Asset/Image Pipeline** | Beauty + realism | Generate or fetch real images, icons, illustrations and drop them into fills. |

### The four supporting systems
| System | Fixes | One-line description |
|--------|-------|----------------------|
| **D. Token Diet** | Cost | Screenshots over JSON, depth limits, field selection, DS caching. Makes A–C affordable. |
| **E. Design Recipes** | Beauty | A library of opinionated taste (8pt spacing, type scale, layered shadows, color rules). |
| **F. Reference-Driven Design** | Beauty | "Make it look like *this*" — design against a screenshot/URL north-star. |
| **G. Dual-Engine Routing** | Design system | Use the official Figma MCP for DS intelligence; this bridge for granular control. |

**Recommended first slice (highest leverage):** D (Token Diet) → B (Component-First) → A (Vision Loop). D makes everything affordable, B fixes the most-complained-about behavior, A delivers the "wow" in quality. C, E, F, G follow.

---

## 2. Problem Statement & Root Causes

### 2.1 Ignores the design system
- `get_local_components` returns only `{id, name, key}` — **no semantics**. The agent can't tell what a component is *for*, its variants, or its props, so it can't confidently reuse it and defaults to primitives.
- **No published / team-library access.** `getTeamComponents()` is commented out in the plugin; only the currently-open file's local components are visible.
- **No enforced workflow.** The `design_strategy` prompt is advisory. Nothing makes the agent search-before-build.

### 2.2 High token consumption
- `read_my_design` and `get_node_info` call `exportAsync("JSON_REST_V1")`, dumping the **entire subtree** (fills, strokes, styles, text). A 50-node frame ≈ 10KB+ JSON.
- No `depth`, pagination, or field-selection on heavy reads.
- ~65 tool definitions sit in context on every turn — a fixed overhead.
- The design system (styles/variables/components) is re-read every time; nothing is cached.

### 2.3 Output not beautiful
- Low-level manual composition from primitives → primitive, inconsistent results.
- No image/asset generation — mockups are gray boxes.
- The agent designs **blind**: it never sees its own output to judge spacing, hierarchy, or contrast.

---

## 3. Pillar A — The Vision Loop

> *The single biggest unlock for quality.*

### 3.1 Concept
After each meaningful build step, the agent renders the canvas, **looks at it**, critiques against explicit criteria, and refines. Humans iterate visually; the agent currently doesn't. A 2–3 pass *design → render → critique → refine* loop produces dramatically more polished output than one-shot generation.

### 3.2 Mechanism (already partly available)
`export_node_as_image` returns an MCP image content block — the agent can already *see*. What's missing is the **disciplined loop and the critique rubric**.

```
build section ──> export_node_as_image ──> agent self-critique (rubric) ──┐
       ▲                                                                  │
       └──────────────── apply targeted fixes ◀───────────────────────────┘
                         (stop after N passes or "no major issues")
```

### 3.3 The critique rubric (the "taste checklist")
The agent scores each render against fixed dimensions and only fixes what fails:
- **Hierarchy** — is there a clear focal point and visual order?
- **Spacing & rhythm** — consistent, on-grid, balanced whitespace?
- **Alignment** — edges and baselines line up?
- **Contrast / accessibility** — text legible, WCAG AA where it matters?
- **Consistency** — colors/type/spacing pulled from the system, not arbitrary?
- **Density** — not cramped, not empty.

### 3.4 Cost control (depends on Pillar D)
- Export at **reduced scale** (e.g. 1×) for critique; full scale only for final review.
- Critique the **section just built**, not the whole page.
- Cap at **2–3 passes** with an early-exit when the rubric is clean.

### 3.5 Acceptance criteria
- After building a section, the agent automatically exports, critiques in writing against the rubric, and applies at least one targeted fix when warranted.
- Before/after screenshots show measurable improvement (alignment/spacing/contrast).
- The loop self-terminates (no infinite refine).

---

## 4. Pillar B — The Component-First Brain

> *Make building from scratch the exception, not the default.*

### 4.1 The enforced workflow
A hard rule, encoded in a skill/system prompt and supported by tooling:

```
1. Need a UI element?
2. → search the design system (semantic).
3. Match found?  → create_component_instance + override text/props.
4. No match?     → compose from primitives (last resort), then offer to componentize it.
```

### 4.2 The DS Manifest (cached, semantic)
The root cause of "ignores DS" is that the agent can't *understand* what's available. Fix: extract the design system **once** into a compact, semantic manifest the agent reads at session start.

Per component, one line of meaning instead of an opaque id:
```
Button/Primary   — primary CTA. variants: size(sm|md|lg), state(default|hover|disabled). props: label(text), icon(swap)
Card/Product     — product tile. slots: image, title, price, badge.
Input/Text       — text field. variants: state(default|focus|error). props: label, placeholder, helper
```
- Built from `get_local_components` + `get_variables` + `get_styles`, enriched with variant/prop introspection.
- **Cached** to disk; rebuilt only when the DS changes. Kills both the DS-blindness *and* most repeated-read token cost.

### 4.3 Enrichments needed
- Upgrade `get_local_components` to return variant axes, property definitions, and a short usage hint per component (not just id/name/key).
- A new `search_design_system` capability over the manifest (semantic match: "primary button" → `Button/Primary`).
- Token/variable surfacing so the agent binds to `color/brand/primary` instead of a hardcoded hex.

### 4.4 Acceptance criteria
- Given a DS with a Button component, "add a primary button" produces a **component instance**, not a hand-built rectangle+text.
- The agent references existing color/text styles and variables instead of literal values.
- When no component matches, it builds, then proposes componentizing the result.

---

## 5. Pillar C — The Asset / Image Pipeline

> *Real imagery is what makes a mockup look finished instead of wireframe-y.*

### 5.1 Capabilities
- **Generate** images from a text prompt (hero images, illustrations, textures, avatars) via an image model.
- **Fetch** from stock/icon sources (Unsplash, icon sets) as a cheaper, faster fallback.
- **Place**: upload the bytes and apply as an image fill on the target node (`set_image_fill` / `createImage` already exist on the write side).

### 5.2 Flow
```
agent writes asset brief ──> image model / stock API ──> bytes
        ──> upload to plugin ──> set_image_fill(targetNodeId) ──> verify via Vision Loop
```

### 5.3 Design decisions to lock
- **Which image model/API** (and whether generated images leaving the machine is acceptable vs. the bridge's local-only ethos — call this out explicitly to the user).
- **Caching** generated assets so re-runs don't regenerate.
- **Placeholder mode** (gray box with a label) when generation is disabled, so layouts still compose.

### 5.4 Acceptance criteria
- "Add a hero image of a mountain sunrise" results in a real image filling the hero frame.
- Icon requests resolve to crisp vector/SVG where possible.
- Works offline/degraded via placeholder mode.

---

## 6. Supporting Systems

### 6.1 D — Token Diet (enables everything above)
- **Screenshots over JSON** for "understand the layout" tasks — far cheaper than `JSON_REST_V1`.
- Add **`depth`** and **field-selection** params to `get_node_info` / `read_my_design` (e.g. layout-only, no fills).
- **Scan-before-get** workflow: cheap `scan_nodes_by_types` to locate, heavy `get_node_info` only on the few that matter.
- **Cache the DS manifest** (ties to Pillar B).
- **Tool grouping** — consider splitting the 65-tool surface into focused toolsets to cut fixed context overhead.

### 6.2 E — Design Recipes (codified taste)
A reusable library of opinionated systems the agent applies instead of inventing values:
- 8pt spacing grid; modular type scale; layered (multi-shadow) elevation; 60-30-10 color balance; component-state conventions; common layout patterns (bento, hero, dashboard shell).
Delivered as a **skill** the agent loads before composing.

### 6.3 F — Reference-Driven Design
User supplies a screenshot, Dribbble shot, or URL → agent extracts palette, layout, typography, mood → builds toward that north-star. Designing against a reference beats designing from prose.

### 6.4 G — Dual-Engine Routing
Run the **official Figma MCP** alongside this bridge and route by task:
- Official → `search_design_system`, `get_libraries`, team libraries, Code Connect, high-level generation.
- This bridge → fine-grained manipulation the official server can't do.
Gives the official server's DS intelligence *plus* the bridge's granular control.

---

## 7. Phased Task Plan

Status legend: ☐ planned · ◐ in progress · ✅ done

### Phase 0 — Token Diet (foundation) ✅
Makes every later phase affordable.
- [x] Add `depth` + field-selection options to `get_node_info`, `get_nodes_info`, and `read_my_design` (server Zod + plugin `filterFigmaNode`).
- [x] Establish "screenshot-first understanding" as the default read pattern (`read_design_strategy` prompt + `figma-design-flow` / `figma-bridge` skills).
- [x] Add DS manifest caching layer (`src/talk_to_figma_mcp/ds_cache.ts`, disk cache keyed on a DS fingerprint).
- [ ] Evaluate splitting the tool surface into focused toolsets. *(deferred — optional)*
- **Acceptance:** understanding an existing screen costs a screenshot + scan, not a full-tree dump; measured token drop on a benchmark file.

### Phase 1 — Component-First Brain ✅
- [x] Enrich `get_local_components` with variant axes, props, and usage hints (plugin scans COMPONENT + COMPONENT_SET, reads `variantGroupProperties` / `componentPropertyDefinitions`).
- [x] Build the **DS Manifest** generator (`buildDSManifest` in `server.ts` → compact semantic JSON, cached via `ds_cache`) exposed as `get_design_system_manifest`.
- [x] Add `search_design_system` over the manifest (token-overlap ranker).
- [x] Encode the **search-before-build** workflow as a mandatory rule (`design_strategy` prompt + `figma-design-flow` §0).
- **Acceptance:** §4.4 — primary button request yields an instance; styles/variables referenced, not hardcoded.

### Phase 2 — Vision Loop ✅
- [x] Define the critique **rubric** (§3.3) as a skill (`.claude/skills/figma-vision-loop/SKILL.md`).
- [x] Wire the **build → export → critique → refine** loop with N-pass cap and early-exit (skill + cross-link from `figma-design-flow` §6).
- [x] Reduced-scale exports for critique; full-scale for final (`export_node_as_image` `scale` param).
- **Acceptance:** §3.5 — auto self-critique + targeted fix + visible improvement + self-termination.

### Phase 3 — Asset / Image Pipeline ☐
- [ ] Decide image model/API + the local-data-leaves-machine tradeoff (surface to user).
- [ ] Generation path → upload → `set_image_fill`.
- [ ] Stock/icon fallback + placeholder mode + asset cache.
- **Acceptance:** §5.4 — real hero image, crisp icons, offline placeholder fallback.

### Phase 4 — Recipes, References, Dual-Engine ☐
- [ ] Ship the Design Recipes skill (§6.2).
- [ ] Reference-driven design intake (screenshot/URL → palette/layout/type) (§6.3).
- [ ] Dual-engine routing config + guidance on task→engine mapping (§6.4).
- **Acceptance:** reference image reproduced in spirit; recipes visibly applied; official MCP used for DS reads.

### Dependencies
```
Phase 0 ──> Phase 1 ──> Phase 2 ──> Phase 3 ──> Phase 4
(diet)     (DS brain)  (vision)    (assets)   (polish)
```
Each phase is independently shippable and adds value on its own.

---

## 8. Success Metrics

| Metric | Today (baseline) | Target |
|--------|------------------|--------|
| Tokens to understand a mid-size screen | full-tree dump (high) | screenshot + scan (≫ lower) |
| % of UI elements built as DS instances | ~0% | majority when a match exists |
| Hardcoded values vs. tokens/styles | mostly hardcoded | mostly token/style-bound |
| Visual self-correction | none (blind) | ≥1 critique pass per section |
| Imagery in mockups | gray boxes | real generated/stock assets |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Vision loop inflates token cost | Reduced-scale exports, section-scoped critique, hard pass cap. |
| Image generation breaks local-only privacy model | Make it opt-in; offer stock + placeholder modes; surface the tradeoff explicitly. |
| DS manifest drifts from the real file | Cache invalidation keyed on DS state; cheap rebuild. |
| Official Figma MCP write limits (paid seat) | Use official only for *reading* DS; keep all *writing* on the free bridge. |
| Tool-surface bloat keeps growing | Toolset grouping in Phase 0; retire redundant tools. |
| Plugin-API ceiling (no team libs on free plan) | Pair with official MCP reads (Pillar G); document the boundary. |

---

## 10. Open Decisions for the User
1. **Image generation:** which model/API, and is sending asset briefs off-machine acceptable given the bridge's local-only design?
2. **Dual-engine:** adopt the official Figma MCP for DS reads now, or stay single-engine and enrich this bridge only?
3. **First slice:** confirm the recommended order (Phase 0 → 1 → 2) vs. jumping straight to the "wow" (Vision Loop / Images) first.
