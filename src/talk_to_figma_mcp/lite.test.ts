import { describe, expect, it } from "bun:test";
import {
  extractNodeId,
  liteCreateNodesResult,
  liteErrorFromUnknown,
  liteFail,
  liteOk,
  liteTextResponse,
  normalizeChunkSize,
  planCreateNode,
  planInspectDesign,
  planManageText,
  planUpdateNodes,
  planViewAndExport,
} from "./lite";

describe("Lite response helpers", () => {
  it("wraps successful data in the common response shape", () => {
    expect(liteOk({ value: 0 })).toEqual({ ok: true, data: { value: 0 } });
  });

  it("wraps failures with actionable metadata", () => {
    expect(liteFail("CHANNEL_REQUIRED", "Join a channel first", true, "Call figma_session join")).toEqual({
      ok: false,
      error: {
        code: "CHANNEL_REQUIRED",
        message: "Join a channel first",
        recoverable: true,
        nextAction: "Call figma_session join",
      },
    });
  });

  it("serializes Lite responses as MCP text content", () => {
    expect(liteTextResponse(liteOk(false)).content[0].text).toContain('"data": false');
  });

  it("normalizes unknown errors", () => {
    expect(liteErrorFromUnknown(new Error("boom"))).toEqual({
      ok: false,
      error: {
        code: "FIGMA_COMMAND_FAILED",
        message: "boom",
        recoverable: true,
      },
    });
  });

  it("extracts node ids from plugin results", () => {
    expect(extractNodeId({ id: "1:2", name: "Frame" })).toBe("1:2");
    expect(extractNodeId({ name: "Frame" })).toBeUndefined();
  });

  it("bounds text scan chunk sizes", () => {
    expect(normalizeChunkSize(undefined)).toBe(10);
    expect(normalizeChunkSize(0)).toBe(10);
    expect(normalizeChunkSize(1.5)).toBe(10);
    expect(normalizeChunkSize(250)).toBe(100);
    expect(normalizeChunkSize(25)).toBe(25);
  });

  it("marks total create_nodes failure as an error", () => {
    expect(liteCreateNodesResult([], [{ code: "FIGMA_COMMAND_FAILED", message: "missing channel" }], [])).toMatchObject({
      ok: false,
      error: { code: "FIGMA_COMMAND_FAILED" },
      warnings: [{ code: "FIGMA_COMMAND_FAILED", message: "missing channel" }],
    });
  });

  it("keeps partial create_nodes success successful with warnings", () => {
    expect(liteCreateNodesResult([{ id: "1:2" }], [{ code: "SELECTION_FAILED", message: "selection failed" }], ["1:2"])).toEqual({
      ok: true,
      data: { created: [{ id: "1:2" }] },
      warnings: [{ code: "SELECTION_FAILED", message: "selection failed" }],
      affectedNodeIds: ["1:2"],
    });
  });
});

describe("inspect_design planning", () => {
  it("maps document summary to document info", () => {
    expect(planInspectDesign({ target: { kind: "document" } })).toEqual({
      command: "get_document_info",
      params: {},
    });
  });

  it("maps selection full detail to read_my_design", () => {
    expect(planInspectDesign({ target: { kind: "selection" }, detail: "full" })).toEqual({
      command: "read_my_design",
      params: {},
    });
  });

  it("maps nodes target to get_nodes_info", () => {
    expect(planInspectDesign({ target: { kind: "nodes", nodeIds: ["1:1"] } })).toEqual({
      command: "get_nodes_info",
      params: { nodeIds: ["1:1"] },
    });
  });

  it("maps subtree text detail to scan_text_nodes", () => {
    expect(planInspectDesign({ target: { kind: "subtree", nodeId: "1:1" }, detail: "text", chunkSize: 20 })).toEqual({
      command: "scan_text_nodes",
      params: { nodeId: "1:1", useChunking: true, chunkSize: 20 },
    });
  });

  it("bounds subtree text detail chunk size", () => {
    expect(planInspectDesign({ target: { kind: "subtree", nodeId: "1:1" }, detail: "text", chunkSize: 0 })).toEqual({
      command: "scan_text_nodes",
      params: { nodeId: "1:1", useChunking: true, chunkSize: 10 },
    });
  });

  it("requires a nodeId for type scans", () => {
    expect(planInspectDesign({ target: { kind: "subtree", nodeId: "1:1" }, detail: "types", types: ["FRAME"] })).toEqual({
      command: "scan_nodes_by_types",
      params: { nodeId: "1:1", types: ["FRAME"] },
    });
  });

  it("rejects unsupported asset target in the first slice", () => {
    expect(planInspectDesign({ target: { kind: "assets" } })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });
  });
});

describe("update_nodes planning", () => {
  it("previews geometry, style, layout, and text dispatches", () => {
    expect(planUpdateNodes({
      mode: "preview",
      patches: [{
        nodeId: "1:1",
        geometry: { x: 10, y: 20, width: 100, height: 80 },
        style: { fill: { r: 1, g: 0, b: 0, a: 1 } },
        layout: {
          mode: "HORIZONTAL",
          wrap: "WRAP",
          padding: { top: 8, right: 8, bottom: 8, left: 8 },
          align: { primary: "CENTER", counter: "CENTER" },
        },
        text: { characters: "Updated" },
      }],
    })).toMatchObject({
      patches: [{
        nodeId: "1:1",
        destructive: false,
        dispatches: [
          { command: "move_node" },
          { command: "resize_node" },
          { command: "set_fill_color" },
          { command: "set_layout_mode" },
          { command: "set_padding" },
          { command: "set_axis_align" },
          { command: "set_text_content" },
        ],
      }],
    });
  });

  it("requires complete move, resize, and non-destructive patch values", () => {
    expect(planUpdateNodes({ mode: "preview", patches: [{ nodeId: "1:1", geometry: { x: 10 } }] })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });

    expect(planUpdateNodes({ mode: "preview", patches: [{ nodeId: "1:1", geometry: { width: 10 } }] })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });

    expect(planUpdateNodes({ mode: "preview", patches: [{ nodeId: "1:1", layout: { mode: "HORIZONTAL" } }] })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });

    expect(planUpdateNodes({ mode: "preview", patches: [{ nodeId: "1:1", layout: { wrap: "WRAP" } }] })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });

    expect(planUpdateNodes({ mode: "preview", patches: [{ nodeId: "1:1", layout: { padding: { top: 8 } } }] })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });

    expect(planUpdateNodes({ mode: "preview", patches: [{ nodeId: "1:1", layout: { align: { primary: "CENTER" } } }] })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });

    expect(planUpdateNodes({ mode: "preview", patches: [{ nodeId: "1:1", layout: { sizing: { horizontal: "HUG" } } }] })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });

    expect(planUpdateNodes({ mode: "preview", patches: [{ nodeId: "1:1", style: { stroke: { color: { r: 0, g: 0, b: 0 } } } }] })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });
  });

  it("requires destructive confirmation for apply deletes", () => {
    expect(planUpdateNodes({ mode: "apply", patches: [{ nodeId: "1:1", delete: true }] })).toMatchObject({
      ok: false,
      error: { code: "DESTRUCTIVE_CONFIRMATION_REQUIRED" },
    });
  });

  it("allows delete preview without confirmation", () => {
    expect(planUpdateNodes({ mode: "preview", patches: [{ nodeId: "1:1", delete: true }] })).toMatchObject({
      patches: [{ destructive: true, dispatches: [{ command: "delete_node" }] }],
    });
  });
});

describe("manage_text planning", () => {
  it("plans scan using bounded chunking", () => {
    expect(planManageText({ action: "scan", scope: { nodeId: "1:1" }, chunkSize: 200 })).toEqual({
      command: "scan_text_nodes",
      params: { nodeId: "1:1", useChunking: true, chunkSize: 100 },
    });
  });

  it("previews replacements without dispatching", () => {
    expect(planManageText({ action: "replace", scope: { nodeId: "0:1" }, replacements: [{ nodeId: "1:1", text: "Next" }] })).toMatchObject({
      ok: true,
      data: { affectedNodeIds: ["1:1"] },
    });
  });

  it("plans apply replacements", () => {
    expect(planManageText({ action: "replace", mode: "apply", scope: { nodeId: "0:1" }, replacements: [{ nodeId: "1:1", text: "Next" }] })).toEqual({
      command: "set_multiple_text_contents",
      params: { nodeId: "0:1", text: [{ nodeId: "1:1", text: "Next" }] },
    });
  });

  it("rejects apply replacements without a root node", () => {
    expect(planManageText({ action: "replace", mode: "apply", scope: {}, replacements: [{ nodeId: "1:1", text: "Next" }] })).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });
  });
});

describe("view_and_export planning", () => {
  it("plans focus, select, and export commands", () => {
    expect(planViewAndExport({ action: "focus", nodeId: "1:1" })).toEqual({ command: "set_focus", params: { nodeId: "1:1" } });
    expect(planViewAndExport({ action: "select", nodeIds: ["1:1", "1:2"] })).toEqual({ command: "set_selections", params: { nodeIds: ["1:1", "1:2"] } });
    expect(planViewAndExport({ action: "export", nodeId: "1:1" })).toEqual({ command: "export_node_as_image", params: { nodeId: "1:1", format: "PNG", scale: 1 } });
  });

  it("rejects non-PNG Lite exports", () => {
    expect(planViewAndExport({ action: "export", nodeId: "1:1", export: { format: "SVG" } } as never)).toMatchObject({
      ok: false,
      error: { code: "INVALID_PATCH" },
    });
  });

  it("rejects missing required node ids", () => {
    expect(planViewAndExport({ action: "focus" })).toMatchObject({ ok: false, error: { code: "INVALID_PATCH" } });
    expect(planViewAndExport({ action: "select", nodeIds: [] })).toMatchObject({ ok: false, error: { code: "INVALID_PATCH" } });
    expect(planViewAndExport({ action: "export" })).toMatchObject({ ok: false, error: { code: "INVALID_PATCH" } });
  });
});

describe("create_nodes planning", () => {
  it("maps frame nodes to create_frame", () => {
    expect(planCreateNode({ kind: "frame", width: 100, height: 80 }, "0:1")).toMatchObject({
      command: "create_frame",
      params: { name: "Frame", x: 0, y: 0, width: 100, height: 80, parentId: "0:1" },
    });
  });

  it("maps rectangle nodes to create_rectangle", () => {
    expect(planCreateNode({ kind: "rectangle", width: 10, height: 20 })).toMatchObject({
      command: "create_rectangle",
      params: { name: "Rectangle", x: 0, y: 0, width: 10, height: 20 },
    });
  });

  it("maps text nodes to create_text", () => {
    expect(planCreateNode({ kind: "text", text: "Hello" })).toMatchObject({
      command: "create_text",
      params: { name: "Text", x: 0, y: 0, text: "Hello", fontSize: 14, fontWeight: 400 },
    });
  });
});
