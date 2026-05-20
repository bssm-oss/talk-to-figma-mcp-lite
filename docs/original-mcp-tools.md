# Original MCP Tools

The original tools remain available and respected. Lite is a smaller default facade, not a replacement for the full Talk to Figma MCP surface.

## Document & Selection

- `get_document_info` - get current document information.
- `get_selection` - get the current selection.
- `read_my_design` - read detailed node information for the current selection.
- `get_node_info` - read one node.
- `get_nodes_info` - read multiple nodes.
- `set_focus` - focus a node in the viewport.
- `set_selections` - select multiple nodes.

## Creation

- `create_rectangle` - create a rectangle.
- `create_frame` - create a frame.
- `create_text` - create a text node.
- `clone_node` - clone an existing node.
- `create_component_instance` - create a local or library component instance.

## Text

- `scan_text_nodes` - scan text nodes, including large designs through chunking.
- `set_text_content` - update one text node.
- `set_multiple_text_contents` - batch-update text nodes.

## Layout & Styling

- `move_node` - move a node.
- `resize_node` - resize a node.
- `set_layout_mode` - set auto-layout direction and wrap behavior.
- `set_padding` - set auto-layout padding.
- `set_axis_align` - set auto-layout axis alignment.
- `set_layout_sizing` - set auto-layout sizing mode.
- `set_item_spacing` - set auto-layout item spacing.
- `set_fill_color` - set fill color.
- `set_stroke_color` - set stroke color and weight.
- `set_corner_radius` - set corner radius.

## Annotations

- `get_annotations` - read annotations.
- `set_annotation` - create or update one annotation.
- `set_multiple_annotations` - batch-create or update annotations.
- `scan_nodes_by_types` - find target nodes by type.

## Prototyping & Connections

- `get_reactions` - read prototype reactions.
- `set_default_connector` - set the copied FigJam connector style.
- `create_connections` - create FigJam connector lines.

## Components & Styles

- `get_styles` - read local styles.
- `get_local_components` - read local components.
- `get_instance_overrides` - copy instance override properties.
- `set_instance_overrides` - apply overrides to target instances.

## Export & Session

- `export_node_as_image` - export a node as PNG base64 text.
- `join_channel` - join a relay channel directly.
- `delete_node` - delete one node; requires `confirmDestructive: true`.
- `delete_multiple_nodes` - delete many nodes; requires `confirmDestructive: true`.

## MCP Prompts

- `design_strategy`
- `read_design_strategy`
- `text_replacement_strategy`
- `annotation_conversion_strategy`
- `swap_overrides_instances`
- `reaction_to_connector_strategy`
