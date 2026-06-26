# Claude Code ⇄ Figma Bridge

Let **Claude Code** read and write a Figma file directly, on the **free plan**, with **no API
key** and **no Dev Mode**. Writing happens through Figma's **Plugin API** (free on every plan),
not the paywalled official MCP write seat.

```
Claude Code (CLI) ⇄ local MCP server ⇄ local WebSocket relay ⇄ Figma plugin ⇄ Plugin API ⇄ Canvas
```

Everything runs on `127.0.0.1`. No design data leaves your machine except context you
deliberately send to the model. See `proposal-claude-code-figma.md` for the full design.

This is a fork of [`sonnylazuardi/cursor-talk-to-figma-mcp`](https://github.com/sonnylazuardi/cursor-talk-to-figma-mcp),
rebranded for Claude Code, hardened to loopback-only, analytics removed, and extended with the
full read/write tool surface (shapes, gradients/images/effects, variables/tokens, styles,
boolean ops, componentization).

## Prerequisites

- [Bun](https://bun.sh) and Node.js (current LTS)
- Claude Code, logged in with your Anthropic account (this replaces a Figma API key)
- **Figma desktop app** (the browser build can't reach the local WebSocket)

## Setup

```bash
bun install
bun run build          # builds dist/server.js
```

**1. Start the relay** (leave it running):

```bash
bun socket             # WebSocket relay on 127.0.0.1:3055
```

**2. Register the MCP server with Claude Code:**

```bash
claude mcp add talk-to-figma -- bun run "$PWD/dist/server.js"
```

A project-scoped `.mcp.json` is also included; if you open Claude Code in this directory it
picks up the `talk-to-figma` server automatically. Restart Claude Code, then run `/mcp` and
confirm `talk-to-figma` shows **connected**.

**3. Install the plugin in Figma:**
Figma → Plugins → Development → Import plugin from manifest → select
`src/cursor_mcp_plugin/manifest.json`.

**4. Pair the channel:**
Run the plugin inside your target file, copy the channel id it shows, then tell Claude Code to
`join_channel` with that id. One channel = one session.

**5. Smoke test:**
Ask Claude Code to "describe the current document" (read), then "create a frame with a
Semi Bold Inter heading and vertical auto-layout" (write).

## Tool surface

**Read:** `get_document_info`, `get_selection`, `get_node_info(s)`, `read_my_design`,
`get_styles`, `get_local_components`, `get_variables`, `scan_text_nodes`,
`scan_nodes_by_types`, `export_node_as_image`, …

**Write — shapes:** `create_frame`, `create_rectangle`, `create_ellipse`, `create_line`,
`create_polygon`, `create_star`, `create_svg`, `create_text`.

**Write — appearance:** `set_fill_color`, `set_gradient_fill`, `set_image_fill`,
`set_stroke_color`, `set_corner_radius`, `set_effects`.

**Write — layout & structure:** `set_layout_mode`, `set_padding`, `set_axis_align`,
`set_layout_sizing`, `set_item_spacing`, `group_nodes`, `ungroup_node`, `reorder_node`,
`boolean_operation`, `move_node`, `resize_node`, `clone_node`, `delete_node`.

**Write — design system:** `create_component_instance`, `create_component_from_node`,
`create_variable`, `set_bound_variable`, `apply_style`, instance overrides.

## Notes & limits

- The plugin only sees the **currently open file** — no account-level or cross-file access.
- "Anything" means anything the **Plugin API** allows (some Dev Mode features excluded).
- Heavy operations are chunked so Figma doesn't freeze; errors return structured so Claude can
  self-correct (e.g. a missing font → it picks another).
- Fonts are loaded before any text write (`loadFontAsync`); note Inter's weight is `"Semi Bold"`.

## Companion skill

`.claude/skills/figma-bridge/` documents this workflow for Claude Code. The installed
`figma-generate-design` skill targets Figma's *official* MCP (the path this project avoids) —
keep it as a Plugin API capability reference, not a runtime dependency.
