# Changelog

## Design Quality Engine — Phase 0 → 1 → 2

> Full proposal: [`proposal-design-quality-engine.md`](proposal-design-quality-engine.md)

---

### Phase 0 — Token Diet

**Goal:** Make every read cheap by default. Stop dumping full node trees when a screenshot + scan is enough.

#### New params on read tools

`get_node_info`, `get_nodes_info`, and `read_my_design` now accept two optional params:

| Param | Type | What it does |
|-------|------|-------------|
| `depth` | `number` | Max levels of children to return. Omit for the full subtree. |
| `fields` | `"layout" \| "full"` | `"layout"` drops fills/strokes/effects/styles — keeps geometry, hierarchy, and text only. Much cheaper. |

When `depth` trims children, the response includes a `childCount` field so the agent knows more exists.

**Files changed:**
- `src/talk_to_figma_mcp/server.ts` — Zod schemas, `CommandParams` types, `filterFigmaNode` updated to accept `{depth, fields, _level}`.
- `src/cursor_mcp_plugin/code.js` — `filterFigmaNode`, `getNodeInfo`, `getNodesInfo`, `readMyDesign` all thread through `opts`.

#### DS manifest disk cache

New module: `src/talk_to_figma_mcp/ds_cache.ts`

- Stores the derived design-system manifest to disk under `$TMPDIR/figma-ai-bridge/ds-cache/<channel>.json`.
- Cache key = SHA-1 fingerprint of component ids/names/keys + styles + variables.
- Exports: `fingerprintDS`, `readCache`, `writeCache`, `invalidateCache`.

#### Screenshot-first read guidance

- `read_design_strategy` MCP prompt rewritten: **screenshot → scan → targeted depth/field-limited get → full dump only as last resort**.
- `figma-design-flow` skill updated with §0.1 Token Diet read order.
- `figma-bridge` skill updated with the new param descriptions and read-order note.

---

### Phase 1 — Component-First Brain

**Goal:** Make the agent reuse the design system instead of composing from primitives every time.

#### Enriched `get_local_components`

The plugin now scans both `COMPONENT` and `COMPONENT_SET` nodes. Components whose parent is a set are skipped (rolled up into the set). Each entry now includes:

| Field | Source |
|-------|--------|
| `type` | `"COMPONENT"` or `"COMPONENT_SET"` |
| `hint` | `{ category, role }` derived from the slash-grouped name |
| `variants` | `variantGroupProperties` (sets only) — the variant axes and their values |
| `properties` | Compacted `componentPropertyDefinitions` — `{type, defaultValue, options?}` per prop (strips the `#id` suffix from key names) |

Two new plugin helper functions: `deriveComponentHint(name)` and `compactPropertyDefinitions(defs)`.

**Files changed:**
- `src/cursor_mcp_plugin/code.js` — `getLocalComponents` rewritten; two helper functions added before it.

#### New tool: `get_design_system_manifest`

Builds a compact semantic manifest from the enriched `get_local_components` + `get_styles` + `get_variables`, caches it via `ds_cache`, and returns the cached version on subsequent calls (rebuild only when the fingerprint changes).

```
get_design_system_manifest({ forceRebuild?: boolean })
→ { components: [...], styles: {...}, variables: {...} }
```

#### New tool: `search_design_system`

Searches the cached manifest with a token-overlap scorer. Returns ranked matches with their variants and properties.

```
search_design_system({ query: string, limit?: number })
→ { query, matchCount, matches: [{ score, id, name, hint, variants, properties }] }
```

**Files changed:**
- `src/talk_to_figma_mcp/server.ts` — `buildDSManifest` function, `get_design_system_manifest` and `search_design_system` tools, `scoreComponentMatch` scorer, `DSManifest` type, `ds_cache` import.

#### Search-before-build rule

- `design_strategy` MCP prompt now starts with **§0 Component-First**: read manifest → search → instance+override → fallback to primitives as last resort, then offer to componentize.
- `figma-design-flow` skill updated with §0 (Component-First) cross-linked from golden rules.

---

### Phase 2 — Vision Loop

**Goal:** Let the agent design with eyes, not blind — screenshot the section it just built, score it against a rubric, fix what fails, repeat.

#### New skill: `figma-vision-loop`

File: `.claude/skills/figma-vision-loop/SKILL.md`

The loop:
```
build a section
  → export_node_as_image(scale:1)   ← reduced scale for critique
  → critique in writing vs rubric
  → apply targeted fixes for failing dimensions only
  → re-export and re-check
  → stop when clean OR after 3 passes
final: one export at scale:2 for the record
```

The rubric (6 dimensions):

| Dimension | Question |
|-----------|----------|
| **Hierarchy** | Clear focal point and visual order? |
| **Spacing & rhythm** | Consistent, on-grid (8pt), balanced whitespace? |
| **Alignment** | Edges and baselines line up? |
| **Contrast / a11y** | Text legible, WCAG AA where it matters? |
| **Consistency** | Colors/type/spacing from the system, not arbitrary? |
| **Density** | Not cramped, not empty? |

Rules: section-scoped exports, reduced scale for critique, hard cap of 2–3 passes, early-exit when the rubric is clean, fixes must use styles/variables not new hardcoded values.

`figma-design-flow` §6 (Verify loop) updated to reference and describe this skill.

---

### How to test

**Start the bridge:**
```bash
bun socket          # WebSocket relay on :3055
# In Figma: run the plugin → join a channel
```

**Token Diet:**
```
# Cheap read
get_node_info({ nodeId: "<id>", depth: 1, fields: "layout" })

# vs full dump
read_my_design()
```
The depth/layout read should return noticeably less JSON.

**Component-First:**
```
get_local_components()                      # check variants/properties/hint fields
get_design_system_manifest()                # first call builds; second should be a cache hit (check stderr)
search_design_system({ query: "button" })   # ranked matches
```

**Vision Loop:**
Build any section in Figma, then ask "critique this section visually" or invoke `/figma-vision-loop`. The agent should export the section, write a rubric critique, apply targeted fixes, and self-terminate within 3 passes.
