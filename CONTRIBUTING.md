# Contributing

Thanks for considering a contribution.

This repository is maintained as a frozen prototype and local fallback for Talk to Figma MCP workflows. Contributions are welcome when they improve the existing local workflow, documentation, compatibility, tests, or attribution.

## Good Contributions

Good fits for this repo:

- setup and documentation fixes
- focused bug fixes in existing Lite tools
- test coverage for existing Lite planner behavior
- local compatibility fixes for Bun, MCP clients, Figma plugin setup, or the WebSocket relay
- security fixes
- attribution and license corrections

Usually not a good fit:

- turning this into a competitor to official Figma MCP
- large rewrites of the plugin or relay
- adding a hosted service, auth system, or production collaboration model
- adding `DESIGN.md` orchestration directly to this repo
- removing the original low-level tool surface

## Development Setup

```bash
bun install
bun run build
bun test src/talk_to_figma_mcp/lite.test.ts
```

For manual Figma testing:

1. Start the relay with `bun socket`.
2. Run the Figma plugin from `src/cursor_mcp_plugin/manifest.json`.
3. Join the plugin channel with `figma_session`.
4. Exercise the Lite flow from `docs/lite-tool-flow.md`.

## Pull Request Guidelines

Before opening a PR:

- keep changes small and focused
- avoid unrelated formatting churn
- preserve upstream attribution and MIT license text
- update docs when behavior changes
- add or update tests for Lite facade planner behavior when possible
- run `bun run build`
- run `bun test src/talk_to_figma_mcp/lite.test.ts`

## Code Style Notes

- The plugin runtime file `src/cursor_mcp_plugin/code.js` is intentionally plain JavaScript and is not bundled.
- MCP stdout is reserved for protocol messages; logs should go to stderr.
- Tool schemas should stay Zod-validated.
- Lite responses should keep the `{ ok, data, error, warnings, affectedNodeIds }` shape.
- Destructive operations should require explicit confirmation.

## License And Attribution

This repository builds on the original `cursor-talk-to-figma-mcp` work by Sonny Lazuardi and contributors. Keep attribution intact. See `docs/lineage-license.md` and `LICENSE`.
