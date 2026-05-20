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

## Examples

### Create, Update, Delete Text

Create text:

```json
{
  "nodes": [{ "kind": "text", "name": "Smoke Label", "x": 120, "y": 120, "text": "Hello Lite" }]
}
```

Preview a change before applying it:

```json
{
  "mode": "preview",
  "patches": [{ "nodeId": "1:2", "text": { "characters": "Hello Lite Updated" } }]
}
```

Apply only after preview looks right. Deletes need explicit confirmation:

```json
{
  "mode": "apply",
  "patches": [{ "nodeId": "1:2", "delete": true }],
  "confirmDestructive": true
}
```

### Scan and Replace Text

Scan a bounded subtree first:

```json
{
  "action": "scan",
  "scope": { "nodeId": "0:1" },
  "chunkSize": 25
}
```

Then preview or apply narrow replacements:

```json
{
  "action": "replace",
  "mode": "apply",
  "scope": { "nodeId": "0:1" },
  "replacements": [{ "nodeId": "1:2", "text": "New copy" }]
}
```

### Focus and Export

Focus the node you want to inspect:

```json
{ "action": "focus", "nodeId": "1:2" }
```

Export the smallest useful node area as PNG:

```json
{ "action": "export", "nodeId": "1:2", "export": { "format": "PNG", "scale": 1 } }
```

## Safety Notes

- Inspect before mutating.
- Use `update_nodes` with `mode: "preview"` before broad or destructive changes.
- Keep `manage_text` replacements scoped and narrow.
- Export is read-only, but large nodes can return large base64 payloads.
- Delete patches require `confirmDestructive: true`.
- Lite responses use `{ ok, data, error, warnings, affectedNodeIds }`.

## When to Drop Down

Use [Original MCP Tools](./original-mcp-tools.md) when you need exact low-level control, a capability not wrapped by Lite, or compatibility with an existing workflow.
