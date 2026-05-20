# Setup and Local Development

## Quick Start

```bash
bun setup
bun socket
```

Then install the Figma plugin from the [Figma community page](https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin) or link it locally from `src/cursor_mcp_plugin/manifest.json`.

Need Bun first?

```bash
curl -fsSL https://bun.sh/install | bash
```

## Manual MCP Config

Cursor config example:

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

Claude Code CLI example:

```bash
claude mcp add TalkToFigma -- bunx cursor-talk-to-figma-mcp@latest
```

## Local Server Config

For repo-local development, point MCP at the TypeScript server file:

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

## Figma Plugin

1. Open Figma.
2. Go to Plugins > Development > New Plugin.
3. Choose "Link existing plugin".
4. Select `src/cursor_mcp_plugin/manifest.json`.
5. Run the plugin and join the same channel from MCP.

## Windows + WSL

1. Install Bun via PowerShell:

```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

2. If needed, bind the socket server to `0.0.0.0` in `src/socket.ts`.
3. Start the relay with `bun socket`.

## Development Commands

```bash
bun install
bun run build
bun run dev
bun socket
bun run start
bun test src/talk_to_figma_mcp/lite.test.ts
```
