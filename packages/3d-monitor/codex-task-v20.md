# Task for Codex CLI: v0.1.40-node-spread.20

You are working on the arch-scanner project's 3D monitor viewer. Edit the single file:
`/Users/zhencheng/projects/arch-scanner/packages/3d-monitor/viewer.html`

This is a large single-file HTML app with inline Three.js. All changes go into this file. Do NOT split into multiple files.

## Task 1: Fix Clipping (穿模修复)

### A. Connection lines clipping through nodes
The current avoidance in `computeAvoidanceCurve()` uses obstacles found by `findObstacles()`. The routes still penetrate node boxes.

Fix:
- In `findObstacles()`, increase the `linePenetratesBox` steps from 24 to 36 for finer detection
- In `computeAvoidanceCurve()` iterative loop, when a waypoint is still inside a box, increase the `pushDist` from `2.8 + centerFactor * 1.5` to `3.5 + centerFactor * 2.0`
- Increase `minDist` (minimum distance from obstacle center) from `NODE_RADIUS * 2.2` to `NODE_RADIUS * 2.8`
- In `getNodeBox()`, increase margin from `0.5` to `0.8` for better obstacle detection margin

### B. Module platform (台面) overlapping nodes
Current code at line 3749: `var cY = info.avgY - 1.8;` — this uses average Y of all nodes in the module, but if a node is at the bottom of the module, it may be inside or below the platform.

Fix:
- Add `minY` tracking in `_moduleLayoutInfo` (inside computeLayout, around line 2921-2940)
- Change platform Y position to use `info.minY - 1.8` instead of `info.avgY - 1.8`
- The platform should always sit BELOW the lowest node in the module

### C. Module platforms clipping each other
Currently the platforms in Z direction may overlap if modules are close in Z space.

Fix:
- In the platform creation code (line 3745-3753), if two module platforms have overlapping Z ranges, add a small Z offset to separate them
- Track per-module Z ranges and check for overlap; when overlap is found, adjust one platform's Z slightly

### D. Pipe arrows clipping through module platforms
In `buildModuleFlowArrow()` (line 3808), the arrow starts at `srcInfo.maxX + 2.0`. But the platform extends `sX = info.maxX - info.minX + 5.0`, so maxX + 2.0 might still be inside the platform.

Fix:
- Change arrow start from `srcInfo.maxX + 2.0` to `srcInfo.maxX + 3.0`
- Change arrow end from `dstInfo.minX - 2.0` to `dstInfo.minX - 3.0`

## Task 2: Legend Multi-Type Display (图例多类型展示)

Replace the current legend (lines 99-116) with a comprehensive legend that shows ALL element types in the scene.

### Legend structure (replace entire #legend div):
- Position: bottom-right (use `right:20px;bottom:20px;left:auto` instead of current `left:20px`)
- Background: semi-transparent dark panel with blur, rounded corners
- Grouped sections with section headers
- Collapsible (preserve current toggle behavior)

### Section A: Node Layers (节点类型)
```
标题：节点分层
┌──────────────────────────┐
│ ● external （外部依赖）    │
│ ● presentation （展示层）  │
│ ● business （业务逻辑层）  │
│ ● data （数据层）          │
│ ● infrastructure（基础设施层）│
└──────────────────────────┘
```
Colors from LAYER_CONFIG:
- infrastructure: 0x3B82F6 (blue)
- data: 0x60A5FA (light blue)
- business: 0x34D399 (green)
- presentation: 0xFBBF24 (yellow)
- external: 0xF87171 (red)

Use the `.dot` CSS class for the colored circles.

### Section B: Connection Types (连接类型)
```
标题：连接类型
┌──────────────────────────┐
│ ── control （控制流/蓝）  │
│ ── data （数据流/浅蓝）   │
│ ── event （事件流/绿）    │
│ ── config （配置流/黄）   │
└──────────────────────────┘
```
Use the `.line-sample` CSS class for the colored line samples.
Note: The actual FLOW_COLORS in code are:
- control: 0x3B82F6
- data: 0x60A5FA
- event: 0x34D399
- (there's no config in FLOW_COLORS — you need to add one. Use 0xFBBF24 for config flow to match the original legend's "knowledge" line)

### Section C: Modules (模块)
```
标题：模块分组
┌──────────────────────────┐
│ ■ 提取模块                │
│ ■ 存储模块                │
│ ■ ... (dynamic)          │
└──────────────────────────┘
```
These should be dynamically generated at runtime from `MODULE_CONFIG`, just like the current legend, but using `.dot` class.

### Section D: Hub Nodes (枢纽节点)
```
标题：图例
┌──────────────────────────┐
│ ★ 枢纽节点（高连接度）     │
└──────────────────────────┘
```
Use a golden star/diamond icon to indicate hub nodes (金色 = 0xFFD700).

### Layout rules
- Sections separated by thin borders (like current `border-top:1px solid rgba(255,255,255,0.06)`)
- Font size: 11px for items, 10px for section headers
- Colors: #999 for item text, #666 for headers
- At the bottom: a info row like "排布: Y轴分层排列 | X轴业务领域参考 | Z轴内外边界参考"

## Important
- Update the HTML title to: "3D Monitor v0.1.40-node-spread.20 — 修复穿模 + 图例多类型展示"
- Keep all existing Three.js code intact (inline libraries, rendering, interactions, etc.)
- Do NOT split the file
- After editing, regenerate the test page using the gen_test_v19.py script
