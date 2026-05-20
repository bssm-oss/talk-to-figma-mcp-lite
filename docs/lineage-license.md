# Lineage and License

This project builds on the original `cursor-talk-to-figma-mcp` work by Sonny Lazuardi and contributors.

Lite is an additive workflow facade. It keeps the original MCP server, WebSocket relay, Figma plugin, low-level tools, prompts, and community contributions available.

## What Lite Adds

- A smaller default tool surface for agents.
- Intent-based workflows around session, inspection, creation, updates, text, and export.
- Normalized responses using `{ ok, data, error, warnings, affectedNodeIds }`.
- Preview-first and explicit-confirmation paths for broad or destructive updates.

## What Lite Does Not Replace

- The original Figma plugin.
- The relay architecture.
- The original low-level MCP tools.
- Existing workflows that depend on those tools.
- Original attribution and license obligations.

## License

This repository is MIT licensed. See [`../LICENSE`](../LICENSE) for the full text.

Keep the copyright and permission notice with substantial copies, redistributions, packages, or forks of this software.
