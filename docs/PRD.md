# talk-to-figma-mcp-lite PRD

## 1. 문제 정의

`talk-to-figma-mcp-lite`는 `cursor-talk-to-figma-mcp` 기반 포크다. 기존 프로젝트는 AI agent가 Figma 문서를 읽고 수정할 수 있는 기능을 제공하지만, 현재 tool surface가 너무 넓고 저수준 명령 중심이라 agent가 안전하고 일관된 조작 순서를 만들기 어렵다.

현재 코드 기준 MCP server는 `src/talk_to_figma_mcp/server.ts` 한 파일에서 40개의 `server.tool(...)`과 6개의 `server.prompt(...)`를 등록한다. Figma plugin은 `src/cursor_mcp_plugin/code.js`의 `handleCommand(command, params)` switch에서 동일한 command 이름을 받아 직접 실행한다. WebSocket relay는 `src/socket.ts`에서 channel 단위 broadcast만 수행한다.

문제는 기능 부족이 아니라 API 설계의 과밀함이다. agent는 `join_channel`을 먼저 호출해야 하고, `get_selection`/`read_my_design`/`get_node_info`/`get_nodes_info` 중 무엇을 써야 할지 판단해야 하며, 레이아웃 변경은 `set_layout_mode`, `set_padding`, `set_axis_align`, `set_layout_sizing`, `set_item_spacing`을 올바른 순서로 조합해야 한다. prototype connector 작업도 `get_reactions` -> prompt 해석 -> `set_default_connector` -> `create_connections` 순서가 필요하다. Lite 버전은 기존 Figma 조작 능력을 유지하되, agent가 실수하기 쉬운 raw API를 의도 기반 workflow tool로 축소한다.

## 2. 현재 코드베이스 구조 요약

### 2.1 MCP server

파일: `src/talk_to_figma_mcp/server.ts`

- `McpServer`를 `TalkToFigmaMCP` 이름과 `1.0.0` 버전으로 생성한다.
- stdio transport는 `StdioServerTransport`를 사용한다.
- WebSocket client는 `ws` 패키지를 사용해 relay에 연결한다.
- `pendingRequests` Map은 request id별 `resolve`, `reject`, `timeout`, `lastActivity`를 저장한다.
- `sendCommandToFigma(command, params, timeoutMs)`가 모든 tool call을 `{ id, type, channel, message: { id, command, params } }` envelope로 relay에 보낸다.
- `connectToFigma(port = 3055)`는 close 시 모든 pending request를 reject하고 2초 뒤 재연결한다.
- stdout은 MCP protocol용으로 유지하고, `logger`는 stderr에 `[INFO]`, `[DEBUG]`, `[WARN]`, `[ERROR]` prefix로 기록한다.
- command type union과 `CommandParams`가 파일 하단에 정의되어 있으나, `get_team_components`, `execute_code`처럼 실제 tool 등록이나 plugin dispatcher와 맞지 않는 항목이 남아 있다.

### 2.2 WebSocket relay

파일: `src/socket.ts`

- Bun WebSocket server가 port `3055`에서 실행된다.
- `channels: Map<string, Set<ServerWebSocket>>`로 channel별 client를 관리한다.
- client는 `{ type: "join", channel }` 메시지로 channel에 들어간다.
- command/response는 `{ type: "message", channel, message }` 형태로 같은 channel의 다른 client에게만 `{ type: "broadcast", message, sender: "peer", channel }`로 전달된다.
- progress는 `{ type: "progress_update", channel, message }`를 같은 channel의 다른 client에게 pass-through한다.
- auth, peer role 구분, channel ownership, durable session state는 없다.
- server log는 전체 message JSON을 console에 출력하므로 디버깅에는 유리하지만 noisy하고 민감한 design payload가 그대로 노출될 수 있다.

### 2.3 Figma plugin UI bridge

파일: `src/cursor_mcp_plugin/ui.html`

- `state`는 `connected`, `socket`, `serverPort`, `pendingRequests`, `channel`, `commandTracking`을 가진다.
- `connectToServer(port)`가 `ws://localhost:${port}`에 연결하고, 연결되면 8자리 random channel을 생성해 join한다.
- MCP server에서 온 broadcast command는 `handleSocketMessage(payload)`가 `parent.postMessage({ pluginMessage: { type: "execute-command", id, command, params }})`로 plugin main thread에 넘긴다.
- plugin main thread 결과는 `command-result` 또는 `command-error`로 UI에 돌아오고, UI는 다시 relay에 `{ type: "message", channel, message: { id, result/error } }`를 보낸다.
- plugin progress는 `command_progress`로 UI에 도착하고, UI는 progress bar를 갱신한 뒤 relay에 `progress_update`로 전달한다.
- UI 쪽 reconnect/backoff는 없다. `onclose`와 `onerror`는 disconnected 상태로 바꾸고 종료한다.
- UI에는 GA4 analytics 코드와 API secret 문자열이 포함되어 있다. Lite에서는 기본 비활성화 또는 제거 대상이다.

### 2.4 Figma plugin command executor

파일: `src/cursor_mcp_plugin/code.js`

- `figma.ui.onmessage`에서 `execute-command`를 받아 `handleCommand(command, params)`로 실행한다.
- `handleCommand`는 command 이름별 switch이며, unknown command는 throw한다.
- selection read는 `getSelection()`이 `figma.currentPage.selection`의 id/name/type/visible을 반환한다.
- selection detail read는 `readMyDesign()`이 현재 selection node를 `JSON_REST_V1`로 export하고 `filterFigmaNode()`로 정리한다.
- selection write는 `setFocus(params)`와 `setSelections(params)`가 `figma.currentPage.selection`을 바꾸고 `figma.viewport.scrollAndZoomIntoView(...)`를 호출한다.
- canvas mutation은 `createRectangle`, `createFrame`, `createText`, `setFillColor`, `setStrokeColor`, `moveNode`, `resizeNode`, `deleteNode`, `cloneNode`, layout setter, connector 생성 함수가 직접 Figma node를 수정한다.
- long-running scan/batch 작업은 `sendProgressUpdate(...)`로 started/in_progress/completed/error 상태를 UI로 보낸다.
- rollback/undo abstraction은 없다. 대부분의 작업은 live node를 즉시 mutate한다.

## 3. 기존 프로젝트의 핵심 문제

### 3.1 Tool surface 과밀

README의 MCP Tools 섹션은 Document & Selection, Annotations, Prototyping & Connections, Creating Elements, Modifying text content, Auto Layout & Spacing, Styling, Layout & Organization, Components & Styles, Export & Advanced, Connection Management로 tool을 나눈다. 실제 `server.ts`도 이 분류에 맞춰 40개 tool을 등록한다.

Agent 관점에서는 tool 수보다 의사결정 분기가 문제다. 예를 들어 문서를 읽는 목적 하나에 `get_document_info`, `get_selection`, `read_my_design`, `get_node_info`, `get_nodes_info`가 존재한다. 레이아웃 변경 목적 하나에도 5개의 setter가 나뉘어 있다.

### 3.2 저수준 command 조합 요구

현재 API는 Figma API property에 가까운 명령이 많다.

- `move_node`: x/y를 직접 지정해야 한다.
- `resize_node`: width/height를 직접 지정해야 한다.
- `set_fill_color`: RGBA 0-1 값을 직접 넣어야 한다.
- `set_padding`: auto-layout 상태를 agent가 먼저 알아야 한다.
- `set_axis_align`: layout direction과 BASELINE 제약을 agent가 알아야 한다.

이 구조는 agent가 중간 검증 없이 여러 raw command를 순차 실행하게 만들고, 실패 지점이 늦게 드러난다.

### 3.3 연결 디버깅이 agent에게 노출됨

MCP server는 `currentChannel`이 없으면 `Must join a channel before sending commands`를 반환한다. UI는 random channel을 생성하고 화면에 표시한다. agent는 사람이 보는 plugin UI의 channel 값을 받아 `join_channel`을 호출해야 한다. 연결이 끊기면 MCP server는 2초 재연결을 시도하지만 channel은 reset되고, UI는 자동 reconnect하지 않는다.

Lite에서는 connection state를 별도 tool과 상태 진단으로 분리하고, 일반 조작 tool이 channel 문제를 더 명확히 설명해야 한다.

### 3.4 Error/progress 형식 불일치

- MCP server는 plugin response에서 `myResponse.result`가 truthy일 때만 resolve한다. 빈 object나 false-like result는 edge case가 될 수 있다.
- UI의 `sendErrorResponse`는 `{ error, result: {} }`를 같이 보낸다.
- plugin command 중 일부는 throw하고, 일부는 `{ success: false, message }`를 반환한다.
- progress 값이 어떤 곳에서는 0-100이고, `create_connections`는 `processedCount / totalCount`로 0-1 값을 보낸다.

Lite에서는 모든 tool response를 `{ ok, data?, error?, warnings?, operationId?, affectedNodeIds? }` 형태로 통일해야 한다.

### 3.5 Undo-safe 전략 부재

현재 `deleteNode`는 삭제 전 id/name/type만 저장하고 `node.remove()`를 호출한다. `setTextContent`, `setFillColor`, `moveNode`, `resizeNode` 등은 이전 값을 기록하지 않는다. Figma 자체 undo stack에 의존할 수는 있지만, agent가 operation 단위로 preview/confirm/rollback을 제어할 수 없다.

## 4. Lite 버전의 목표

1. MCP tool 수를 MVP 기준 8개 내외로 줄인다.
2. raw property setter를 숨기고 intent-based workflow를 제공한다.
3. 모든 mutation은 기본적으로 inspect -> plan -> apply -> verify 흐름을 따른다.
4. 연결/channel 상태를 명확히 진단하고, 일반 tool 실패 메시지를 actionable하게 만든다.
5. 기존 plugin command 구현은 최대한 재사용하되, MCP-facing tool layer와 response schema를 새로 설계한다.
6. destructive operation은 preview 또는 explicit confirmation 없이는 실행하지 않는다.
7. progress, logging, error response를 표준화한다.
8. 기존 `cursor-talk-to-figma-mcp` 사용자가 점진적으로 migration할 수 있게 legacy command mapping을 제공한다.

## 5. Non-goals

- Figma plugin 전체를 TypeScript/bundler 기반으로 재작성하지 않는다.
- Figma REST API 기반 cloud sync 제품으로 확장하지 않는다.
- 모든 Figma API property를 MCP tool로 노출하지 않는다.
- 복잡한 design generation agent를 내장하지 않는다.
- multi-user collaboration, auth, permission model을 MVP에서 해결하지 않는다.
- 기존 command를 즉시 삭제해 breaking change를 크게 만들지 않는다. MVP에서는 legacy adapter 또는 hidden mode를 둔다.
- Figma native undo stack을 대체하는 완전한 transaction engine을 MVP 범위에 넣지 않는다.

## 6. Target users

1. Claude Code, Cursor, OpenCode 같은 AI coding/design agent를 사용하는 개발자
2. Figma 디자인을 코드 구현 전 구조적으로 읽고 싶은 frontend engineer
3. 반복적인 text/annotation/component instance 작업을 agent에게 맡기고 싶은 designer-developer
4. 기존 talk-to-figma-mcp를 써봤지만 tool 수와 연결 flow 때문에 실패율이 높았던 사용자
5. local Figma plugin + MCP workflow를 유지하면서 더 안전한 API를 원하는 사용자

## 7. 핵심 기능

### 7.1 Connection session 관리

- 현재 channel, relay 연결 상태, plugin peer 존재 여부를 읽는 `figma_session` tool 제공
- `join_channel`은 public default tool에서 숨기고 `figma_session({ action: "join", channel })`로 통합
- reconnect 후 이전 channel 자동 재join 시도
- relay에 같은 channel peer count를 반환하는 system message 추가

### 7.2 Design inspection

- `get_document_info`, `get_selection`, `read_my_design`, `get_node_info`, `get_nodes_info`, `scan_nodes_by_types`, `scan_text_nodes`를 `inspect_design`으로 통합
- selection 중심 기본값 제공: nodeId가 없으면 selection을 읽는다.
- detail level 제공: `summary`, `structure`, `full`, `text`, `types`
- 큰 문서는 chunk progress를 내부 처리하고 최종 summary를 안정적으로 반환

### 7.3 Canvas mutation workflow

- `create_rectangle`, `create_frame`, `create_text`, `create_component_instance`를 `create_nodes`로 통합
- `move_node`, `resize_node`, `set_fill_color`, `set_stroke_color`, `set_corner_radius`, `set_text_content`, layout setter를 `update_nodes`로 통합
- apply 전 validation 결과와 affected node 목록 반환
- destructive action은 `mode: "preview" | "apply"`와 `confirmDestructive: true` 필요

### 7.4 Text and annotation workflow

- `scan_text_nodes`, `set_text_content`, `set_multiple_text_contents`를 `manage_text`로 통합
- `get_annotations`, `set_annotation`, `set_multiple_annotations`를 `manage_annotations`로 통합
- batch operation은 partial failure를 `warnings`와 per-item result로 반환

### 7.5 Prototype connector workflow

- `get_reactions`, `set_default_connector`, `create_connections`를 `prototype_flow`로 통합
- `mode: "inspect"`는 reactions만 읽는다.
- `mode: "create_connectors"`는 default connector 확인/자동 탐색/connector 생성까지 한 번에 수행한다.
- prompt에 의존하던 `reaction_to_connector_strategy`는 tool 내부 planning response로 대체한다.

### 7.6 Export and focus

- `export_node_as_image`, `set_focus`, `set_selections`를 `view_and_export`로 통합
- focus/select/export를 하나의 viewport operation으로 제공
- export 결과는 base64 payload 크기와 format metadata를 명시한다.

## 8. 제거하거나 숨길 기능

### 8.1 Public surface에서 숨길 tool

- `join_channel`: `figma_session`으로 통합
- `set_default_connector`: `prototype_flow` 내부 detail로 이동
- `set_focus`, `set_selections`: `view_and_export` 또는 `inspect_design` option으로 통합
- `get_nodes_info`: `inspect_design`의 `nodeIds` 배열로 통합
- `delete_node`: `update_nodes`의 destructive operation으로 통합
- `delete_multiple_nodes`: `update_nodes`의 destructive operation으로 통합

### 8.2 통합할 tool

| 기존 tool | Lite tool | 이유 |
| --- | --- | --- |
| `get_document_info`, `get_selection`, `read_my_design`, `get_node_info`, `get_nodes_info` | `inspect_design` | 읽기 목적은 같고 detail level만 다름 |
| `scan_text_nodes`, `set_text_content`, `set_multiple_text_contents` | `manage_text` | text 작업은 scan/update/verify가 한 workflow |
| `set_layout_mode`, `set_padding`, `set_axis_align`, `set_layout_sizing`, `set_item_spacing` | `update_nodes.layout` | auto-layout은 순서 의존성이 있어 단일 config가 안전함 |
| `set_fill_color`, `set_stroke_color`, `set_corner_radius` | `update_nodes.style` | style patch로 합치는 편이 검증/rollback에 유리함 |
| `move_node`, `resize_node`, `clone_node` | `update_nodes.geometry` / `create_nodes.clone` | node transform intent로 묶어야 함 |
| `get_annotations`, `set_annotation`, `set_multiple_annotations` | `manage_annotations` | batch와 단건을 분리할 이유가 작음 |
| `get_reactions`, `set_default_connector`, `create_connections` | `prototype_flow` | 현재 prompt 기반 multi-step이라 agent 실패율이 높음 |

### 8.3 MVP에서 defer할 기능

- `get_instance_overrides`, `set_instance_overrides`: 유용하지만 schema와 plugin param naming이 어긋나는 부분이 있어 MVP 후순위
- `get_styles`, `get_local_components`: `inspect_design({ target: "assets" })`로 통합하되, MVP에서는 read-only 유지
- Analytics: Lite 기본 배포에서는 제거 또는 opt-in

## 9. 새 MCP tool 설계

MVP public tools는 아래 8개를 목표로 한다.

1. `figma_session`
2. `inspect_design`
3. `create_nodes`
4. `update_nodes`
5. `manage_text`
6. `manage_annotations`
7. `prototype_flow`
8. `view_and_export`

Legacy compatibility mode에서는 기존 40개 tool을 hidden/internal alias로 유지할 수 있다. 단, 기본 README와 agent prompt에는 Lite tool만 노출한다.

## 10. Tool schema 초안

### 10.1 공통 response

```ts
type LiteToolResponse<T> = {
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
```

### 10.2 `figma_session`

```ts
type FigmaSessionInput = {
  action: "status" | "join" | "reconnect" | "disconnect";
  channel?: string;
  port?: number;
};
```

동작:

- `status`: MCP server WebSocket state, currentChannel, lastError, pendingRequestCount 반환
- `join`: 기존 `joinChannel()` 재사용
- `reconnect`: `connectToFigma()` 후 channel 재join 시도
- `disconnect`: pending request reject 후 socket close

### 10.3 `inspect_design`

```ts
type InspectDesignInput = {
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
```

재사용 구현:

- `getDocumentInfo`, `getSelection`, `readMyDesign`, `getNodeInfo`, `getNodesInfo`
- text detail은 `scanTextNodes`
- types detail은 `scanNodesByTypes`

### 10.4 `create_nodes`

```ts
type CreateNodesInput = {
  parentId?: string;
  nodes: Array<
    | {
        kind: "frame";
        name?: string;
        x?: number;
        y?: number;
        width: number;
        height: number;
        style?: StylePatch;
        layout?: LayoutPatch;
      }
    | {
        kind: "rectangle";
        name?: string;
        x?: number;
        y?: number;
        width: number;
        height: number;
        style?: StylePatch;
      }
    | {
        kind: "text";
        name?: string;
        x?: number;
        y?: number;
        text: string;
        fontSize?: number;
        fontWeight?: number;
        color?: RGBA;
      }
    | {
        kind: "component_instance";
        componentId?: string;
        componentKey?: string;
        x?: number;
        y?: number;
      }
  >;
  selectCreated?: boolean;
};
```

### 10.5 `update_nodes`

```ts
type UpdateNodesInput = {
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
```

```ts
type StylePatch = {
  fill?: RGBA;
  stroke?: { color: RGBA; weight?: number };
  cornerRadius?: { radius: number; corners?: [boolean, boolean, boolean, boolean] };
};

type LayoutPatch = {
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

type RGBA = { r: number; g: number; b: number; a?: number };
```

### 10.6 `manage_text`

```ts
type ManageTextInput = {
  action: "scan" | "replace";
  scope: { nodeId?: string; selection?: boolean };
  replacements?: Array<{ nodeId: string; text: string }>;
  preserveStyle?: boolean;
  mode?: "preview" | "apply";
  chunkSize?: number;
};
```

### 10.7 `manage_annotations`

```ts
type ManageAnnotationsInput = {
  action: "list" | "upsert";
  nodeId?: string;
  includeCategories?: boolean;
  annotations?: Array<{
    nodeId: string;
    annotationId?: string;
    labelMarkdown: string;
    categoryId?: string;
    properties?: Array<{ type: string }>;
  }>;
  mode?: "preview" | "apply";
};
```

### 10.8 `prototype_flow`

```ts
type PrototypeFlowInput = {
  action: "inspect_reactions" | "create_connectors";
  nodeIds: string[];
  connectorId?: string;
  includeCursorMarkers?: boolean;
  mode?: "preview" | "apply";
};
```

### 10.9 `view_and_export`

```ts
type ViewAndExportInput = {
  action: "focus" | "select" | "export";
  nodeIds?: string[];
  nodeId?: string;
  export?: { format: "PNG" | "JPG" | "SVG" | "PDF"; scale?: number };
};
```

## 11. Connection/reconnect/logging 개선안

### 11.1 Connection

현재 MCP server는 socket close 시 2초 뒤 재연결하지만 `currentChannel`을 null로 reset한다. Lite에서는 다음 상태를 저장한다.

```ts
type ConnectionState = {
  wsState: "idle" | "connecting" | "connected" | "disconnected" | "reconnecting";
  currentChannel: string | null;
  desiredChannel: string | null;
  lastConnectedAt?: number;
  lastError?: string;
  peerCount?: number;
};
```

개선사항:

- `join` 성공 channel을 `desiredChannel`로 저장한다.
- reconnect 후 `desiredChannel`이 있으면 자동 rejoin한다.
- relay join response에 channel client count를 포함한다.
- command 전 peer count가 2 미만이면 `NO_PLUGIN_PEER` error를 반환한다.
- UI도 optional auto reconnect를 제공하되, runaway loop 방지를 위해 exponential backoff와 max retry를 둔다.

### 11.2 Logging

현재 relay는 full message JSON을 console에 출력한다. Lite에서는 structured log level을 둔다.

- 기본: command name, request id, channel, duration, status만 기록
- debug: params/result preview를 max length로 truncate
- trace: full payload 출력, 명시적으로 `TALK_TO_FIGMA_LOG_LEVEL=trace`일 때만 허용
- 모든 stderr/stdout 규칙 유지: MCP server stdout은 protocol 전용, 로그는 stderr

### 11.3 Error schema

표준 error code:

- `NOT_CONNECTED`
- `CHANNEL_REQUIRED`
- `NO_PLUGIN_PEER`
- `NODE_NOT_FOUND`
- `INVALID_NODE_TYPE`
- `INVALID_PATCH`
- `DESTRUCTIVE_CONFIRMATION_REQUIRED`
- `FIGMA_COMMAND_FAILED`
- `TIMEOUT`

## 12. Rollback/undo-safe operation 전략

MVP에서는 완전 transaction이 아니라 safe operation layer를 제공한다.

1. 모든 mutation tool은 `mode: "preview" | "apply"`를 지원한다.
2. `preview`는 node 존재 여부, type support, patch validity, destructive 여부, affected node list를 반환하고 Figma를 변경하지 않는다.
3. `apply`는 변경 전 snapshot을 가능한 범위에서 수집한다.
4. snapshot은 operation response에 `operationId`와 함께 요약을 남기고 plugin memory에 짧게 보관한다.
5. destructive operation은 `confirmDestructive: true`가 없으면 실패한다.
6. batch operation은 per-item result를 반환하고, 실패 item을 숨기지 않는다.
7. delete는 MVP에서 실제 rollback을 보장하기 어렵기 때문에 기본적으로 clone-to-backup 또는 preview-first 정책을 사용한다.

Snapshot 범위:

- geometry: x, y, width, height
- text: characters, fontName, selected style metadata
- style: fills, strokes, strokeWeight, cornerRadius
- layout: layoutMode, layoutWrap, padding, alignment, sizing, spacing
- selection: previous selection ids

추가 tool 후보:

```ts
type OperationHistoryInput = {
  action: "list" | "rollback";
  operationId?: string;
};
```

단, `operation_history`는 MVP 필수 tool이 아니라 Phase 2 후보로 둔다.

## 13. Migration plan

### Phase 0: Inventory lock

- 현재 40개 tool과 6개 prompt를 inventory 문서 또는 test fixture로 고정한다.
- `server.ts`의 `FigmaCommand`와 plugin `handleCommand` command 목록 차이를 확인한다.
- `CommandParams`의 stale key(`get_team_components`, `execute_code`)를 migration note에 기록한다.

### Phase 1: Lite tool facade 추가

- 기존 plugin command는 유지한다.
- MCP server에 Lite tool 8개를 추가하고, 내부에서 기존 `sendCommandToFigma` command를 호출한다.
- response schema를 `LiteToolResponse`로 normalize한다.
- README는 Lite tool을 기본으로 문서화하고 legacy tools는 appendix로 내린다.

### Phase 2: Plugin helper 정리

- `code.js`에 validation helper와 response helper를 추가한다.
- layout setter를 내부 `applyLayoutPatch(node, layout)`로 통합한다.
- style setter를 내부 `applyStylePatch(node, style)`로 통합한다.
- progress value를 0-100으로 통일한다.

### Phase 3: Legacy tool 숨김

- 기본 MCP export에서는 Lite tool만 노출한다.
- `--legacy-tools` flag가 있을 때 기존 raw tools를 등록한다.
- 기존 prompt 중 Lite tool과 충돌하는 multi-step prompt는 새 tool 설명으로 대체한다.

### Phase 4: Safety and observability

- preview/apply와 operation snapshot을 mutation에 적용한다.
- connection state tool과 structured logging을 완성한다.
- relay에 peer count와 concise log mode를 추가한다.

## 14. MVP scope

MVP에 포함:

- `figma_session(status/join/reconnect)`
- `inspect_design(document/selection/nodes/subtree/text/types)`
- `create_nodes(frame/rectangle/text)`
- `update_nodes`에서 geometry/style/layout/text patch
- `manage_text(scan/replace)`
- `view_and_export(focus/select/export)`
- response schema normalize
- reconnect 후 desired channel rejoin
- structured logging 기본값
- docs: Lite tool guide와 legacy mapping

MVP에서 제외:

- component override propagation 재설계
- prototype connector 완전 자동화
- operation rollback UI
- auth/channel permission
- remote Figma REST integration

## 15. 단계별 구현 계획

### Step 1: Tool inventory test fixture 작성

- `server.tool(` 등록 목록을 fixture로 추출한다.
- `code.js` `handleCommand` case 목록과 비교한다.
- mismatch를 CI 또는 script에서 감지한다.

### Step 2: Response normalizer 추가

- MCP server에 `ok(data)`, `fail(code, message, recoverable, nextAction)` helper를 추가한다.
- 기존 `sendCommandToFigma` 결과를 Lite response로 감싼다.
- error response에서 raw stack 대신 actionable message를 반환한다.

### Step 3: `figma_session` 구현

- 기존 `join_channel`을 내부화한다.
- connection state object를 추가한다.
- reconnect 후 desired channel 재join을 구현한다.

### Step 4: `inspect_design` 구현

- target/detail에 따라 기존 read command를 dispatch한다.
- selection default를 적용한다.
- nodeIds 배열은 server loop가 아니라 plugin command 또는 parallel request helper로 처리한다.

### Step 5: `create_nodes` 구현

- 기존 `create_rectangle`, `create_frame`, `create_text` command를 재사용한다.
- multi-node create는 per-item result와 created ids를 반환한다.
- `selectCreated`가 true면 마지막에 `set_selections`를 내부 호출한다.

### Step 6: `update_nodes` 구현

- preview validation을 먼저 만든다.
- geometry/style/layout/text patch를 기존 raw commands로 dispatch한다.
- delete는 `confirmDestructive` 없이는 막는다.

### Step 7: `manage_text`, `view_and_export` 구현

- text scan/update workflow를 한 tool로 묶는다.
- focus/select/export를 한 tool로 묶는다.
- progress update와 final response shape를 맞춘다.

### Step 8: Legacy mode와 docs 갱신

- raw tools registration을 `registerLegacyTools(server)`로 분리한다.
- CLI flag 또는 env로 legacy 노출 여부를 제어한다.
- README와 `docs/PRD.md` 이후 구현 문서를 갱신한다.

## 16. 리스크

1. Figma plugin sandbox는 long-running operation 중 UI freeze가 발생할 수 있다. 기존 chunking/delay 패턴을 유지해야 한다.
2. Figma node snapshot은 모든 property를 완벽히 복원하기 어렵다. MVP rollback은 best-effort로 명시해야 한다.
3. 기존 사용자는 raw tool 이름에 의존할 수 있다. legacy mode 없이 제거하면 migration 비용이 크다.
4. channel reconnect는 MCP server와 plugin UI 양쪽 상태가 맞아야 한다. 한쪽만 자동화하면 ghost connection이 생긴다.
5. connector flow는 FigJam connector node와 Figma design node 제약이 섞여 있어 단순 통합 시 실패율이 높을 수 있다.
6. analytics 코드와 full payload logging은 privacy review가 필요하다.
7. 현재 plugin file은 plain JS라 TypeScript schema와 runtime validation이 쉽게 drift될 수 있다.
8. MCP server의 `any` 기반 response 처리는 schema 안정성을 떨어뜨린다. Lite facade부터 타입을 좁혀야 한다.

## 17. 테스트 전략

### 17.1 Static/tool inventory tests

- `server.ts`에서 `server.tool(` 이름 목록을 추출해 snapshot 테스트한다.
- `code.js` `handleCommand` case 목록과 `FigmaCommand` union을 비교한다.
- Lite tool schema가 legacy command mapping을 모두 설명하는지 table-driven test로 확인한다.

### 17.2 Unit tests

- response normalizer: success/error/progress/falsy result 처리
- connection state reducer: connect, join, close, reconnect, rejoin 실패
- layout patch validator: layoutMode NONE에서 padding/spacing 거부
- destructive validator: delete without confirmation 거부
- style patch validator: RGBA range 검증

### 17.3 Relay integration tests

- channel join 전 message는 error 반환
- 같은 channel의 다른 peer에게만 broadcast
- 다른 channel에는 command/progress가 전달되지 않음
- progress_update가 MCP peer에게 forwarding됨
- peer count가 join/leave에 맞게 갱신됨

### 17.4 Plugin manual QA

MVP마다 실제 Figma 파일에서 확인한다.

1. plugin connect -> MCP `figma_session(status)` 확인
2. `inspect_design({ target: { kind: "selection" }, detail: "summary" })`
3. `create_nodes`로 frame/text 생성
4. `update_nodes(mode: "preview")` 후 `apply`
5. `manage_text(scan)` 후 일부 text replace
6. `view_and_export(focus)`와 `view_and_export(export)`
7. relay 끊기 -> reconnect -> channel rejoin 확인

### 17.5 Build verification

- `bun run build`로 MCP server bundle 확인
- `bun socket` smoke test
- plugin은 bundling이 없으므로 `src/cursor_mcp_plugin/manifest.json`로 Figma development plugin link 후 수동 실행

## 18. 성공 기준

- 기본 노출 MCP tool 수가 8개 내외로 줄어든다.
- agent가 Figma 조작 전 `inspect_design` 하나로 필요한 context를 얻을 수 있다.
- raw layout/style/text 조작은 `update_nodes` patch 한 번으로 수행된다.
- destructive operation은 preview 또는 confirmation 없이 실행되지 않는다.
- 연결 실패 시 `join_channel을 먼저 호출하라`가 아니라 현재 상태와 next action을 포함한 error가 반환된다.
- 기존 기능은 legacy mode 또는 내부 command reuse로 유지된다.
- README의 일반 사용 flow가 `join_channel` 중심에서 `figma_session` + intent tool 중심으로 바뀐다.
