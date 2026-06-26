---
name: figma-bridge
description: Connect Claude Code to Figma to read and write the canvas directly via a local WebSocket bridge and a Figma plugin (Plugin API), on the free plan — no Dev Mode and no API key. Use when the user wants to set up the bridge, register the MCP server, install/pair the Figma plugin, troubleshoot the channel/WebSocket connection, or drive design tasks (create frames, text, components, auto-layout, variables) inside an open Figma file.
---

# Figma Bridge (Claude Code ⇄ Figma, free plan)

This skill operationalizes `proposal-claude-code-figma.md`: a local bridge that lets
Claude Code read and write a Figma file through the **Plugin API** (free on every plan),
instead of Figma's official MCP write seat (paywalled, ~6 calls/month on free).

## Architecture

```
Claude Code (CLI)  ⇄  local MCP server  ⇄  local WebSocket relay  ⇄  Figma plugin  ⇄  Plugin API  ⇄  Canvas
   (brain/auth)        (tool translator)      (message relay)        (executor)       (write engine)
```

Everything runs on `127.0.0.1`. No design data leaves the machine except context
deliberately sent to the model. Auth comes from Claude Code's Anthropic login — no
Figma API key. The plugin only ever sees the **currently open file**.

## When to use

- "Set up / connect the Figma bridge", "register the MCP server", "install the plugin"
- "Pair the channel", "the plugin won't connect", WebSocket / `/mcp` not-connected issues
- Driving design from natural language: build frames, text, components, auto-layout, variables
- "Read this file's structure / styles / selection" before editing

## Setup workflow

1. **Prereqs**: Bun + Node.js (current LTS); Claude Code installed and logged in (the Anthropic
   login replaces a Figma API key); **Figma desktop app** (browser version can't reach the WS).
2. **Build + start the relay**: `bun install && bun run build`, then `bun socket` (relay on
   `127.0.0.1:3055`, leave running).
3. **Register MCP in Claude Code** (stdio):
   `claude mcp add talk-to-figma -- bun run "$PWD/dist/server.js"` (or rely on the project
   `.mcp.json`).
4. **Restart Claude Code fully**, then run `/mcp` and confirm `talk-to-figma` is **connected**.
5. **Install the plugin**: Figma → Plugins → Development → Import plugin from manifest,
   using a `manifest.json` whose `networkAccess.allowedDomains` includes the local WS host.
6. **Pair the channel**: open the plugin in the target file, copy its channel ID, then have
   Claude Code join that channel. One channel = one session (prevents cross-talk).
7. **Smoke test**: one read ("describe the current document") + one write ("create a frame").

## Tool surface

These are the **actual MCP tool names** exposed by this project's server (see `README.md`).
Always pair the file first with `join_channel`.

**Read (understand the open file):** `get_document_info`, `get_selection`, `get_node_info`,
`get_nodes_info`, `read_my_design`, `get_styles`, `get_local_components`, `get_variables`,
`scan_text_nodes`, `scan_nodes_by_types`, `get_reactions`, `get_annotations`, and
`export_node_as_image` (PNG for visual grounding — send structure **plus** image).

**Write — shapes:** `create_frame`, `create_rectangle`, `create_ellipse`, `create_line`,
`create_polygon`, `create_star`, `create_svg` (icons — import the codebase SVG, don't redraw),
`create_text`.

**Write — appearance:** `set_fill_color`, `set_gradient_fill`, `set_image_fill` (base64 →
`createImage`), `set_stroke_color`, `set_corner_radius`, `set_effects` (shadows/blur).

**Write — layout & structure:** `set_layout_mode`, `set_padding`, `set_axis_align`,
`set_layout_sizing`, `set_item_spacing`, `group_nodes`, `ungroup_node`, `reorder_node`,
`boolean_operation`, `move_node`, `resize_node`, `clone_node`, `delete_node`,
`delete_multiple_nodes`.

**Write — design system:** `create_component_instance`, `create_component_from_node`,
`create_variable`, `set_bound_variable` (use field `fills`/`strokes` for color), `apply_style`,
`get_instance_overrides` / `set_instance_overrides`.

> Note: the installed **`figma-generate-design`** skill targets Figma's *official* MCP
> (`use_figma`/`get_screenshot`) — the paid path this project avoids. Treat it as a Plugin API
> capability **reference** (font loading, auto-layout, `setBoundVariable`, componentization,
> SVG icons), **not** a runtime dependency for this bridge.

## Critical pitfalls — bake these into the implementation

These are where naive implementations break:

- **Load fonts before writing text**: call `figma.loadFontAsync` for the layer's exact
  font *before* setting/changing any text, or it throws. (Inter's weight is `"Semi Bold"`,
  not `"SemiBold"`.)
- **manifest network access**: the local WS domain must be under
  `networkAccess.allowedDomains` in `manifest.json` or the plugin can't connect.
- **Node serialization**: Figma nodes can't go into JSON directly. Pass node **ids** and
  rehydrate plugin-side with `figma.getNodeById`.
- **Non-blocking + batching**: run heavy ops async and in batches so the Figma UI doesn't
  freeze on large files.
- **Structured error reporting**: every command returns clear success/error so the model
  can self-correct (e.g. "font not found" → pick another font).
- **Connection recovery**: the plugin should auto-reconnect and preserve channel state if
  the WebSocket drops.

## Security

Keep all traffic on `127.0.0.1`; never expose the WS relay publicly. No secrets baked into
published plugin code — run as a development plugin for personal use. Gate destructive ops
(bulk delete/overwrite) behind a confirm or read-only mode.

## Limits

Community/unofficial — Figma updates may break it. "Anything" means "anything the Plugin
API allows" (no account-level ops, no unopened files, some Dev Mode features excluded).
Quality of the model's understanding depends on sending structure **plus** an exported image.

## Acceptance checklist

- [ ] `/mcp` shows the bridge server `connected`, no API key entered
- [ ] Plugin reports full structure, styles, typography, variables of the open file
- [ ] Plugin can export a node image for visual grounding
- [ ] Claude Code builds frame/text/component/auto-layout from scratch
- [ ] Text edits complete with no font errors
- [ ] Several-hundred-layer file operates without freezing
- [ ] Errors return structured so the model self-corrects
- [ ] Full setup under a few minutes, no complex manual config editing
- [ ] All traffic local; design data stays on device

## Reference

Full proposal (Persian): `proposal-claude-code-figma.md` in the project root.
