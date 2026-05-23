# Talk to Figma MCP Lite

A local-first, agent-friendly facade for the unofficial Talk to Figma MCP stack.

> Project status: frozen prototype / local fallback. This repository is kept as a polished open-source reference for local Figma MCP workflows. It is not intended to compete with the official Figma MCP server, which now provides the strongest path for broad Figma read/write capability.

Lite keeps the original Talk to Figma MCP server, relay, plugin, prompts, and low-level tools intact. It adds a smaller intent-based facade so agents can inspect, create, update, and export with less context overhead and a safer preview-first workflow.

https://github.com/user-attachments/assets/129a14d2-ed73-470f-9a4c-2240b2a4885c

## Why This Exists

The original Talk to Figma MCP exposes a large low-level tool surface. That is powerful, but agents can waste context choosing between similar tools or mutate Figma without enough inspection.

Lite explores a narrower workflow:

```text
figma_session -> inspect_design -> preview update_nodes -> apply update_nodes -> inspect_design
```

Use this repo when you want:

- a local Figma plugin + WebSocket relay workflow
- a small agent-facing tool surface
- normalized responses from common Figma actions
- preview-first updates and explicit destructive-operation confirmation
- a reference implementation for building safer Figma agent adapters

Prefer the official Figma MCP when you need first-class remote access, variables, components, Code Connect, or production-grade Figma agent workflows.

## Start Here

- Current project status: [Project Status](./docs/project-status.md)
- New user setup: [Setup and Local Development](./docs/setup-local-dev.md)
- Agent workflow: [Lite Tool Flow](./docs/lite-tool-flow.md)
- Full original tool surface: [Original MCP Tools](./docs/original-mcp-tools.md)
- Attribution and redistribution: [Lineage and License](./docs/lineage-license.md)
- Product plan and historical rationale: [Lite MVP PRD](./docs/PRD.md)
- Contributing guide: [CONTRIBUTING](./CONTRIBUTING.md)
- Security policy: [SECURITY](./SECURITY.md)
- Support policy: [SUPPORT](./SUPPORT.md)

## Quick Start

```bash
bun install
bun socket
```

Then run the Figma plugin and join its channel with `figma_session`.

Need the plugin? Install it from the [Figma community page](https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin) or link `src/cursor_mcp_plugin/manifest.json` locally.

## Local MCP Setup

For local repo testing, point your MCP client at the TypeScript server:

```json
{
  "mcpServers": {
    "TalkToFigma": {
      "command": "bun",
      "args": ["/path-to-repo/src/talk_to_figma_mcp/server.ts"]
    }
  }
}
```

For package-style usage, use the upstream published command:

```json
{
  "mcpServers": {
    "TalkToFigma": {
      "command": "bunx",
      "args": ["cursor-talk-to-figma-mcp@latest"]
    }
  }
}
```

Runtime checklist:

1. Start the relay with `bun socket` on port `3055`.
2. Open Figma and run the Talk to Figma plugin.
3. Copy the plugin channel.
4. Call `figma_session({ "action": "join", "channel": "..." })`.
5. Use the Lite flow below.

Local `.mcp.json` files are machine-specific. Keep local path changes uncommitted unless you intentionally want to share that config.

Full setup notes live in [Setup and Local Development](./docs/setup-local-dev.md).

## Lite Tools

| Tool | Purpose |
| --- | --- |
| `figma_session` | Join, reconnect, or inspect relay/channel state. |
| `inspect_design` | Read the document, selection, nodes, text, or node types. |
| `create_nodes` | Batch-create frames, rectangles, and text. |
| `update_nodes` | Preview or apply geometry, style, layout, text, clone, and guarded delete patches. |
| `manage_text` | Scan text or preview/apply batch text replacement. |
| `view_and_export` | Focus, select, or export PNG node images. |

Use [Lite Tool Flow](./docs/lite-tool-flow.md) for routine agent work. Drop to [Original MCP Tools](./docs/original-mcp-tools.md) when you need exact low-level control.

## Project Shape

```text
Claude Code / Cursor <-> MCP Server <-> WebSocket Relay <-> Figma Plugin
```

- `src/talk_to_figma_mcp/` - MCP server and Lite facade
- `src/cursor_mcp_plugin/` - Figma plugin
- `src/socket.ts` - WebSocket relay
- `docs/` - setup, tool-flow, status, and lineage docs

## Development

```bash
bun install
bun run build
bun test src/talk_to_figma_mcp/lite.test.ts
```

There is no general lint suite configured. The focused Lite facade tests live in `src/talk_to_figma_mcp/lite.test.ts`.

## Maintenance Scope

This repository is complete as a prototype and local fallback. Future work should generally be limited to:

- documentation fixes
- security fixes
- compatibility fixes for local development
- small Lite facade bug fixes
- attribution/license corrections

New product exploration around `DESIGN.md`-driven Figma and web sync should happen in a separate project rather than expanding this repo into another official Figma MCP competitor.

## Community Notes

This project builds on the original `cursor-talk-to-figma-mcp` by Sonny Lazuardi and contributors. Lite is additive: the original tools and workflows remain first-class escape hatches.

Useful original demos:

- [Quick video tutorial](https://www.linkedin.com/posts/sonnylazuardi_just-wanted-to-share-my-latest-experiment-activity-7307821553654657024-yrh8)
- [Bulk text replacement demo](https://www.youtube.com/watch?v=j05gGT3xfCs), contributed by [@dusskapark](https://github.com/dusskapark)
- [Instance override propagation demo](https://youtu.be/uvuT8LByroI), also contributed by [@dusskapark](https://github.com/dusskapark)

## License

MIT. See [`LICENSE`](./LICENSE) and [Lineage and License](./docs/lineage-license.md).
