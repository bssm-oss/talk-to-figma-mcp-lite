# Lite Tool Flow

Lite is the default agent-facing surface. Use it when you want fewer tool calls, normalized responses, and a safer inspect-before-change loop.

## Default Loop

```text
figma_session -> inspect_design -> preview update_nodes -> apply update_nodes -> inspect_design
```

## Tools

- `figma_session` - join, reconnect, or check the relay channel.
- `inspect_design` - read the document, current selection, nodes, text, or node types.
- `create_nodes` - batch-create frames, rectangles, and text nodes.
- `update_nodes` - preview or apply geometry, style, layout, text, clone, and guarded delete patches.
- `manage_text` - scan text or preview/apply batch text replacement.
- `view_and_export` - focus, select, or export PNG node images.

## Safety Notes

- Inspect before mutating.
- Use `update_nodes` with `mode: "preview"` before broad or destructive changes.
- Delete patches require `confirmDestructive: true`.
- Lite responses use `{ ok, data, error, warnings, affectedNodeIds }`.

## When to Drop Down

Use [Original MCP Tools](./original-mcp-tools.md) when you need exact low-level control, a capability not wrapped by Lite, or compatibility with an existing workflow.
