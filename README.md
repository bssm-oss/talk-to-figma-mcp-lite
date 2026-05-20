# Talk to Figma MCP Lite

A thinner default workflow for using Figma through MCP.

Lite keeps the original Talk to Figma MCP server, relay, plugin, prompts, and low-level tools intact. It adds a small intent-based facade so agents can inspect, create, update, and export with less context overhead.

https://github.com/user-attachments/assets/129a14d2-ed73-470f-9a4c-2240b2a4885c

## Start Here

- New user: [Setup and Local Development](./docs/setup-local-dev.md)
- Agent workflow: [Lite Tool Flow](./docs/lite-tool-flow.md)
- Full tool surface: [Original MCP Tools](./docs/original-mcp-tools.md)
- Attribution and redistribution: [Lineage and License](./docs/lineage-license.md)
- Product plan: [Lite MVP PRD](./docs/PRD.md)

## Quick Start

```bash
bun setup
bun socket
```

Then run the Figma plugin and join its channel with `figma_session`.

Need the plugin? Install it from the [Figma community page](https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin) or link `src/cursor_mcp_plugin/manifest.json` locally.

## Lite Flow

```text
figma_session -> inspect_design -> preview update_nodes -> apply update_nodes -> inspect_design
```

Use [Lite Tool Flow](./docs/lite-tool-flow.md) for routine agent work. Drop to [Original MCP Tools](./docs/original-mcp-tools.md) when you need exact low-level control.

## Project Shape

```text
Claude Code / Cursor <-> MCP Server <-> WebSocket Relay <-> Figma Plugin
```

- `src/talk_to_figma_mcp/` - MCP server and Lite facade
- `src/cursor_mcp_plugin/` - Figma plugin
- `src/socket.ts` - WebSocket relay

## Community Notes

This project builds on the original `cursor-talk-to-figma-mcp` by Sonny Lazuardi and contributors. Lite is additive: the original tools and workflows remain first-class escape hatches.

Useful original demos:

- [Quick video tutorial](https://www.linkedin.com/posts/sonnylazuardi_just-wanted-to-share-my-latest-experiment-activity-7307821553654657024-yrh8)
- [Bulk text replacement demo](https://www.youtube.com/watch?v=j05gGT3xfCs), contributed by [@dusskapark](https://github.com/dusskapark)
- [Instance override propagation demo](https://youtu.be/uvuT8LByroI), also contributed by [@dusskapark](https://github.com/dusskapark)

## Development

```bash
bun install
bun run build
bun test src/talk_to_figma_mcp/lite.test.ts
```

More commands and local MCP config examples are in [Setup and Local Development](./docs/setup-local-dev.md).

## License

MIT. See [`LICENSE`](./LICENSE) and [Lineage and License](./docs/lineage-license.md).
