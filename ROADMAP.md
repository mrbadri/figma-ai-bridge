# Roadmap — Full-Access Figma Design Bridge

Goal: extend this MCP↔Figma bridge into a complete, AI-driven design tool — components, multi-variant sets, token-driven styles, async long jobs, and old→new design-system migration — with a screenshot feedback loop for visual understanding.

Status legend: ✅ done · ◐ in progress · ☐ planned

---

## ✅ Phase 1 — Variants & component properties
Turn components into multi-variant sets with typed properties.

| Tool | Purpose |
|------|---------|
| `combine_as_variants` | Merge 2+ components into one component set (name sources `Prop=Value`). |
| `create_component_property` | Add BOOLEAN / TEXT / INSTANCE_SWAP property to a component or set. |
| `set_variant_properties` | Set a variant's axis values via `{ Size:'Large', State:'Hover' }`. |

Files: `src/cursor_mcp_plugin/code.js`, `src/talk_to_figma_mcp/server.ts`.
Acceptance: build a button, clone+rename variants, `combine_as_variants`, verify set in Figma.

---

## ✅ Phase 2 — Style authoring (token-driven output)
Create shared styles so generated designs reference tokens instead of hardcoded values.

| Tool | Purpose |
|------|---------|
| `create_paint_style` | Shared color style (0–1 RGBA, slash-grouped names like `Brand/Primary`). |
| `create_text_style` | Shared typography style (loads font, then size/line-height/letter-spacing). |
| `create_effect_style` | Shared shadow/blur style (mirrors `set_effects` shape). |
| `create_grid_style` | Shared layout-grid style. |

Files: `src/cursor_mcp_plugin/code.js`, `src/talk_to_figma_mcp/server.ts`.
Acceptance: `create_paint_style({name:"Brand/Primary",color:{r:.1,g:.4,b:.9,a:1}})` → `get_styles` shows it.

---

## ☐ Phase 3 — Async job queue
Beat the 30s per-command timeout for large operations (e.g. 40-variant grids, full-screen regen).

- Long tasks return a `jobId` immediately instead of blocking.
- Plugin streams progress (reuse `sendProgressUpdate`).
- New tools: `get_job_status`, `cancel_job`.
- Server tracks jobs alongside the existing `pendingRequests` map.

Acceptance: start a big batch job, poll `get_job_status` to completion, `cancel_job` aborts mid-run.

---

## ☐ Phase 4 — Old design system → new design
Migration pipeline from an existing file to a fresh, token-driven design.

1. `extract_design_system` — scan a file/page → emit tokens + component inventory JSON.
2. Map old tokens → new semantic names.
3. Regenerate components/variants/styles in the target using Phase 1+2 tools.
4. Verify each section via the `export_node_as_image` screenshot loop.

Acceptance: point at an old file, produce a regenerated component set + style library in a new file.

---

## ☐ Optional — `create_component_set` matrix convenience
One call: base node + variant matrix (e.g. `size × state × type`) → generates the full grid and combines automatically. Biggest single UX win on top of Phase 1.

---

## Screenshot feedback loop (already available)
`export_node_as_image` returns an MCP `image` content block, so the agent can *see* the canvas: **export → read → adjust → repeat**. Use this to verify every phase's output visually. No new tool needed.

## Reload reminder
After changing `code.js`: re-run the plugin in Figma (Plugins → Development). After changing `server.ts`: `bun run build` and restart the MCP client.
