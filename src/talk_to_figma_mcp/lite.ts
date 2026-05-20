export type LiteToolResponse<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
    nextAction?: string;
  };
  warnings?: Array<{ code: string; message: string; nodeId?: string }>;
  operationId?: string;
  affectedNodeIds?: string[];
};

export type LitePluginCommand =
  | "get_document_info"
  | "get_selection"
  | "get_node_info"
  | "get_nodes_info"
  | "read_my_design"
  | "scan_text_nodes"
  | "scan_nodes_by_types"
  | "create_rectangle"
  | "create_frame"
  | "create_text"
  | "set_fill_color"
  | "set_stroke_color"
  | "set_corner_radius"
  | "move_node"
  | "resize_node"
  | "set_layout_mode"
  | "set_padding"
  | "set_axis_align"
  | "set_layout_sizing"
  | "set_item_spacing"
  | "set_text_content"
  | "set_multiple_text_contents"
  | "clone_node"
  | "delete_node"
  | "set_focus"
  | "set_selections"
  | "export_node_as_image";

export type LiteDispatch = {
  command: LitePluginCommand;
  params?: Record<string, unknown>;
};

export type LiteWarning = { code: string; message: string; nodeId?: string };
export type RGBA = { r: number; g: number; b: number; a?: number };

export function liteOk<T>(
  data: T,
  extras: Pick<LiteToolResponse<T>, "warnings" | "operationId" | "affectedNodeIds"> = {},
): LiteToolResponse<T> {
  return { ok: true, data, ...extras };
}

export function liteFail(
  code: string,
  message: string,
  recoverable: boolean,
  nextAction?: string,
): LiteToolResponse<never> {
  return {
    ok: false,
    error: { code, message, recoverable, nextAction },
  };
}

export function liteTextResponse(response: LiteToolResponse<unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export function liteErrorFromUnknown(error: unknown, nextAction?: string): LiteToolResponse<never> {
  return liteFail(
    "FIGMA_COMMAND_FAILED",
    error instanceof Error ? error.message : String(error),
    true,
    nextAction,
  );
}

export function normalizeChunkSize(chunkSize: number | undefined): number {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    return 10;
  }

  return Math.min(chunkSize, 100);
}

export function liteCreateNodesResult(
  created: unknown[],
  warnings: LiteWarning[],
  affectedNodeIds: string[],
): LiteToolResponse<{ created: unknown[] }> {
  if (created.length === 0 && warnings.length > 0) {
    return {
      ...liteFail(
        "FIGMA_COMMAND_FAILED",
        "All create_nodes operations failed",
        true,
        "Check the Figma connection, joined channel, parentId, and node parameters, then retry.",
      ),
      warnings,
      affectedNodeIds,
    };
  }

  return liteOk({ created }, { warnings, affectedNodeIds });
}

export function extractNodeId(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const record = result as Record<string, unknown>;
  return typeof record.id === "string" ? record.id : undefined;
}

export type InspectDesignInput = {
  target?:
    | { kind: "document" }
    | { kind: "selection" }
    | { kind: "nodes"; nodeIds: string[] }
    | { kind: "subtree"; nodeId: string }
    | { kind: "assets" };
  detail?: "summary" | "structure" | "full" | "text" | "types";
  types?: string[];
  maxDepth?: number;
  chunkSize?: number;
};

export function planInspectDesign(input: InspectDesignInput = {}): LiteDispatch | LiteToolResponse<never> {
  const target = input.target ?? { kind: "selection" };
  const detail = input.detail ?? "summary";

  if (target.kind === "document") {
    if (detail === "text" || detail === "types") {
      return liteFail(
        "INVALID_PATCH",
        `detail '${detail}' requires a node-scoped target`,
        true,
        "Use target.kind 'subtree' with nodeId, or use detail 'summary' for document metadata.",
      );
    }

    return { command: "get_document_info", params: {} };
  }

  if (target.kind === "selection") {
    if (detail === "full" || detail === "structure") {
      return { command: "read_my_design", params: {} };
    }

    if (detail === "text" || detail === "types") {
      return liteFail(
        "INVALID_PATCH",
        `detail '${detail}' requires a concrete nodeId`,
        true,
        "Call inspect_design with target.kind 'subtree' and the selected node id.",
      );
    }

    return { command: "get_selection", params: {} };
  }

  if (target.kind === "nodes") {
    if (target.nodeIds.length === 0) {
      return liteFail("INVALID_PATCH", "target.nodeIds must not be empty", true);
    }

    return { command: "get_nodes_info", params: { nodeIds: target.nodeIds } };
  }

  if (target.kind === "assets") {
    return liteFail(
      "INVALID_PATCH",
      "inspect_design assets target is not part of this first Lite slice",
      true,
      "Use legacy get_styles or get_local_components for now.",
    );
  }

  if (detail === "text") {
    return {
      command: "scan_text_nodes",
      params: {
        nodeId: target.nodeId,
        useChunking: true,
        chunkSize: normalizeChunkSize(input.chunkSize),
      },
    };
  }

  if (detail === "types") {
    if (!input.types || input.types.length === 0) {
      return liteFail("INVALID_PATCH", "detail 'types' requires a non-empty types array", true);
    }

    return { command: "scan_nodes_by_types", params: { nodeId: target.nodeId, types: input.types } };
  }

  return { command: "get_node_info", params: { nodeId: target.nodeId } };
}

export type CreateNodesInput = {
  parentId?: string;
  nodes: Array<
    | {
        kind: "frame";
        name?: string;
        x?: number;
        y?: number;
        width: number;
        height: number;
        fillColor?: RGBA;
        strokeColor?: RGBA;
        strokeWeight?: number;
        layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
        layoutWrap?: "NO_WRAP" | "WRAP";
        paddingTop?: number;
        paddingRight?: number;
        paddingBottom?: number;
        paddingLeft?: number;
        primaryAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
        counterAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "BASELINE";
        layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
        layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
        itemSpacing?: number;
      }
    | {
        kind: "rectangle";
        name?: string;
        x?: number;
        y?: number;
        width: number;
        height: number;
      }
    | {
        kind: "text";
        name?: string;
        x?: number;
        y?: number;
        text: string;
        fontSize?: number;
        fontWeight?: number;
        fontColor?: RGBA;
      }
  >;
  selectCreated?: boolean;
};

export type StylePatch = {
  fill?: RGBA;
  stroke?: { color: RGBA; weight?: number };
  cornerRadius?: { radius: number; corners?: [boolean, boolean, boolean, boolean] };
};

export type LayoutPatch = {
  mode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  wrap?: "NO_WRAP" | "WRAP";
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  align?: {
    primary?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
    counter?: "MIN" | "MAX" | "CENTER" | "BASELINE";
  };
  sizing?: { horizontal?: "FIXED" | "HUG" | "FILL"; vertical?: "FIXED" | "HUG" | "FILL" };
  spacing?: { item?: number; counterAxis?: number };
};

export type UpdateNodesInput = {
  mode: "preview" | "apply";
  confirmDestructive?: boolean;
  patches: Array<{
    nodeId: string;
    rename?: string;
    geometry?: { x?: number; y?: number; width?: number; height?: number };
    style?: StylePatch;
    layout?: LayoutPatch;
    text?: { characters: string; preserveStyle?: boolean };
    clone?: { x?: number; y?: number };
    delete?: boolean;
  }>;
};

export type PlannedPatch = {
  nodeId: string;
  destructive: boolean;
  dispatches: LiteDispatch[];
};

export function planUpdateNodes(input: UpdateNodesInput): LiteToolResponse<never> | { patches: PlannedPatch[] } {
  if (input.patches.length === 0) {
    return liteFail("INVALID_PATCH", "update_nodes requires at least one patch", true);
  }

  const planned: PlannedPatch[] = [];

  for (const patch of input.patches) {
    if (patch.rename) {
      return liteFail("INVALID_PATCH", "rename is not supported by the current plugin command set", true);
    }

    const dispatches: LiteDispatch[] = [];

    if (patch.geometry?.x !== undefined || patch.geometry?.y !== undefined) {
      if (patch.geometry.x === undefined || patch.geometry.y === undefined) {
        return liteFail("INVALID_PATCH", "geometry move requires both x and y", true);
      }
      dispatches.push({
        command: "move_node",
        params: { nodeId: patch.nodeId, x: patch.geometry.x, y: patch.geometry.y },
      });
    }

    if (patch.geometry?.width !== undefined || patch.geometry?.height !== undefined) {
      if (patch.geometry.width === undefined || patch.geometry.height === undefined) {
        return liteFail("INVALID_PATCH", "geometry resize requires both width and height", true);
      }
      dispatches.push({
        command: "resize_node",
        params: { nodeId: patch.nodeId, width: patch.geometry.width, height: patch.geometry.height },
      });
    }

    if (patch.style?.fill) {
      dispatches.push({ command: "set_fill_color", params: { nodeId: patch.nodeId, color: patch.style.fill } });
    }

    if (patch.style?.stroke) {
      if (patch.style.stroke.weight === undefined) {
        return liteFail("INVALID_PATCH", "style.stroke requires weight to avoid changing stroke weight implicitly", true);
      }
      dispatches.push({
        command: "set_stroke_color",
        params: { nodeId: patch.nodeId, color: patch.style.stroke.color, weight: patch.style.stroke.weight },
      });
    }

    if (patch.style?.cornerRadius) {
      dispatches.push({
        command: "set_corner_radius",
        params: {
          nodeId: patch.nodeId,
          radius: patch.style.cornerRadius.radius,
          corners: patch.style.cornerRadius.corners ?? [true, true, true, true],
        },
      });
    }

    if (patch.layout?.mode !== undefined || patch.layout?.wrap !== undefined) {
      if (patch.layout.mode === undefined || patch.layout.wrap === undefined) {
        return liteFail("INVALID_PATCH", "layout mode changes require both mode and wrap", true);
      }
      dispatches.push({ command: "set_layout_mode", params: { nodeId: patch.nodeId, layoutMode: patch.layout.mode, layoutWrap: patch.layout.wrap } });
    }

    if (patch.layout?.padding) {
      const { top, right, bottom, left } = patch.layout.padding;
      if (top === undefined || right === undefined || bottom === undefined || left === undefined) {
        return liteFail("INVALID_PATCH", "layout.padding requires top, right, bottom, and left", true);
      }
      dispatches.push({
        command: "set_padding",
        params: {
          nodeId: patch.nodeId,
          paddingTop: top,
          paddingRight: right,
          paddingBottom: bottom,
          paddingLeft: left,
        },
      });
    }

    if (patch.layout?.align) {
      const { primary, counter } = patch.layout.align;
      if (primary === undefined || counter === undefined) {
        return liteFail("INVALID_PATCH", "layout.align requires both primary and counter", true);
      }
      dispatches.push({
        command: "set_axis_align",
        params: {
          nodeId: patch.nodeId,
          primaryAxisAlignItems: primary,
          counterAxisAlignItems: counter,
        },
      });
    }

    if (patch.layout?.sizing) {
      const { horizontal, vertical } = patch.layout.sizing;
      if (horizontal === undefined || vertical === undefined) {
        return liteFail("INVALID_PATCH", "layout.sizing requires both horizontal and vertical", true);
      }
      dispatches.push({
        command: "set_layout_sizing",
        params: {
          nodeId: patch.nodeId,
          layoutSizingHorizontal: horizontal,
          layoutSizingVertical: vertical,
        },
      });
    }

    if (patch.layout?.spacing) {
      dispatches.push({
        command: "set_item_spacing",
        params: { nodeId: patch.nodeId, itemSpacing: patch.layout.spacing.item, counterAxisSpacing: patch.layout.spacing.counterAxis },
      });
    }

    if (patch.text) {
      dispatches.push({ command: "set_text_content", params: { nodeId: patch.nodeId, text: patch.text.characters } });
    }

    if (patch.clone) {
      dispatches.push({ command: "clone_node", params: { nodeId: patch.nodeId, x: patch.clone.x, y: patch.clone.y } });
    }

    if (patch.delete) {
      dispatches.push({ command: "delete_node", params: { nodeId: patch.nodeId } });
    }

    planned.push({ nodeId: patch.nodeId, destructive: Boolean(patch.delete), dispatches });
  }

  if (planned.some((patch) => patch.destructive) && input.mode === "apply" && !input.confirmDestructive) {
    return liteFail(
      "DESTRUCTIVE_CONFIRMATION_REQUIRED",
      "delete patches require confirmDestructive: true when mode is apply",
      true,
      "Run update_nodes in preview mode first, then retry with confirmDestructive: true if the deletion is intentional.",
    );
  }

  return { patches: planned };
}

export type ManageTextInput = {
  action: "scan" | "replace";
  scope: { nodeId?: string; selection?: boolean };
  replacements?: Array<{ nodeId: string; text: string }>;
  preserveStyle?: boolean;
  mode?: "preview" | "apply";
  chunkSize?: number;
};

export function planManageText(input: ManageTextInput): LiteDispatch | LiteToolResponse<unknown> {
  if (input.action === "scan") {
    if (!input.scope.nodeId) {
      return liteFail("INVALID_PATCH", "manage_text scan requires scope.nodeId", true);
    }

    return {
      command: "scan_text_nodes",
      params: { nodeId: input.scope.nodeId, useChunking: true, chunkSize: normalizeChunkSize(input.chunkSize) },
    };
  }

  if (!input.replacements || input.replacements.length === 0) {
    return liteFail("INVALID_PATCH", "manage_text replace requires at least one replacement", true);
  }

  if (input.mode !== "apply") {
    return liteOk({ replacements: input.replacements, affectedNodeIds: input.replacements.map((item) => item.nodeId) });
  }

  if (!input.scope.nodeId) {
    return liteFail("INVALID_PATCH", "manage_text apply replace requires scope.nodeId", true);
  }

  return {
    command: "set_multiple_text_contents",
    params: { nodeId: input.scope.nodeId, text: input.replacements },
  };
}

export type ViewAndExportInput = {
  action: "focus" | "select" | "export";
  nodeIds?: string[];
  nodeId?: string;
  export?: { format?: "PNG"; scale?: number };
};

export function planViewAndExport(input: ViewAndExportInput): LiteDispatch | LiteToolResponse<never> {
  if (input.action === "focus") {
    if (!input.nodeId) {
      return liteFail("INVALID_PATCH", "view_and_export focus requires nodeId", true);
    }

    return { command: "set_focus", params: { nodeId: input.nodeId } };
  }

  if (input.action === "select") {
    if (!input.nodeIds || input.nodeIds.length === 0) {
      return liteFail("INVALID_PATCH", "view_and_export select requires nodeIds", true);
    }

    return { command: "set_selections", params: { nodeIds: input.nodeIds } };
  }

  if (!input.nodeId) {
    return liteFail("INVALID_PATCH", "view_and_export export requires nodeId", true);
  }

  if ((input.export?.format ?? "PNG") !== "PNG") {
    return liteFail("INVALID_PATCH", "view_and_export currently supports PNG exports only", true);
  }

  return {
    command: "export_node_as_image",
    params: { nodeId: input.nodeId, format: "PNG", scale: input.export?.scale ?? 1 },
  };
}

export function planCreateNode(
  node: CreateNodesInput["nodes"][number],
  parentId?: string,
): LiteDispatch {
  if (node.kind === "frame") {
    return {
      command: "create_frame",
      params: {
        ...node,
        name: node.name ?? "Frame",
        x: node.x ?? 0,
        y: node.y ?? 0,
        fillColor: node.fillColor ?? { r: 1, g: 1, b: 1, a: 1 },
        parentId,
      },
    };
  }

  if (node.kind === "rectangle") {
    return {
      command: "create_rectangle",
      params: {
        ...node,
        name: node.name ?? "Rectangle",
        x: node.x ?? 0,
        y: node.y ?? 0,
        parentId,
      },
    };
  }

  return {
    command: "create_text",
    params: {
      ...node,
      name: node.name ?? "Text",
      x: node.x ?? 0,
      y: node.y ?? 0,
      fontSize: node.fontSize ?? 14,
      fontWeight: node.fontWeight ?? 400,
      fontColor: node.fontColor ?? { r: 0, g: 0, b: 0, a: 1 },
      parentId,
    },
  };
}
