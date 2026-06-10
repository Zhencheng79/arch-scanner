# 3d-monitor 重构方案

> 基于主公2026-06-09指令：纯展示端，吃port-tag-tool产出数据，给不懂技术的人用视觉观察

## 核心原则

1. **不做功能性工作** — 扫描/标签/分析全部由Agent调用port-tag-tool完成
2. **只管展示** — 输入：port-tag-tool的数据 → 输出：可打开的HTML文件
3. **面向非技术人员** — 视觉首位，交互简单，不展示底层技术细节
4. **电路板设计规范** — 不穿模/不交叉/分层清晰/Grid布局

## 架构

```
                 port-tag-tool
                      ↓
             { nodes, connections, ports, tags }
                      ↓
    ┌─────── 3d-monitor MCP Server ───────┐
    │  工具: 3d-monitor (单一工具)         │
    │  输入: --data-file <port-tag输出>    │
    │        或 --project <项目路径>        │
    │  输出: HTML文件路径                   │
    └─────────────────────────────────────┘
                      ↓
              3D 拓扑图 HTML
           (浏览器直接打开, 拖拽/缩放/点击)
```

## 数据接口

输入数据格式（与port-tag-tool对齐）：

```json
{
  "nodes": [
    { "id": "zhaogongming", "label": "赵公明", "layer": "command", "chineseName": "主帅" },
    { "id": "research", "label": "研究部", "layer": "analysis", "chineseName": "研究员" }
  ],
  "connections": [
    { "id": "conn-1", "from": "zhaogongming", "to": "research",
      "label": "调研指令", "flowType": "control", "tagId": "tag-dispatcher-research-command" }
  ],
  "ports": [
    { "portId": "zhaogongming-out-conn-1", "nodeId": "zhaogongming",
      "type": "output", "color": "#F44336", "label": "发送: 调研指令" },
    { "portId": "research-in-conn-1", "nodeId": "research",
      "type": "input", "color": "#4CAF50", "label": "接收: 调研指令" }
  ],
  "tags": {
    "tag-dispatcher-research-command": {
      "label": "调研指令", "flowType": "control", "color": "#FFEB3B",
      "description": "调度器向调研员发起调研任务"
    }
  }
}
```

## 3D展示设计（电路板风格）

### 视觉层次
- **背景**：深色网格电路板（Grid + 暗色）
- **节点**：不同层叠高度的"芯片"方块，按layer分颜色
  - command层(黄色) → 最高层
  - data层(青色) → 中间层
  - 其他层按类型区分
- **管道**：发光线条，按flowType分色
  - control=黄色, data=青色, event=品红, knowledge=紫色
- **端口**：节点边缘的小圆点
  - 输出=红色, 输入=绿色
- **标签**：悬浮文字，hover时展开

### 交互（非技术人员友好）
- **拖拽旋转**：鼠标拖拽旋转视角
- **滚轮缩放**：拉近拉远
- **悬停节点**：显示中文名+职责简述
- **点击节点**：高亮该节点所有出入管道
- **自动旋转**：默认缓慢自转，拖拽时暂停

### 布局算法
- **分层Grid布局**：按layer垂直分层，每层水平均匀分布
- **不穿模不交叉**：管道走SmoothCurve避开节点
- **固定间距**：同层节点间距固定，视觉整齐

## MCP工具定义

```json
{
  "name": "3d-monitor",
  "description": "根据系统架构数据生成3D可视化拓扑图，返回可直接打开的HTML文件路径",
  "inputSchema": {
    "type": "object",
    "properties": {
      "dataFile": {
        "type": "string",
        "description": "port-tag-tool输出的JSON数据文件路径（推荐）"
      },
      "project": {
        "type": "string",
        "description": "要扫描的项目路径（非必填，不填则只用dataFile）"
      },
      "title": {
        "type": "string",
        "description": "展示标题（可选，默认'系统架构3D拓扑'）"
      }
    }
  }
}
```

## 产出物

```
packages/3d-monitor/
├── mcp-server.js        ← MCP Server（简化版，不需要HTTP Server）
├── package.json
├── viewer.html          ← 3D展示HTML模板（核心）
├── data-schema.json     ← 数据接口说明
```

## 实施步骤

1. 重写 `mcp-server.js` — 去掉HTTP Server，改为文件输出模式
2. 重写 `viewer.html` — 从零开始，用Three.js CDN + script标签
3. 实现布局算法 — 分层Grid + 曲线管道
4. 实现交互 — 拖拽/缩放/hover/点击
5. 验证 — 用port-tag-tool扫hermes-web的数据做输入

## 与port-tag-tool协作流程

```
Agent想展示系统架构:
  1. Agent调 port-tag-tool scan_project("hermes-web")
  2. port-tag-tool 返回 {nodes, connections, ports, tags}
  3. Agent将数据传给 3d-monitor
  4. 3d-monitor 生成HTML，返回文件路径
  5. Agent 告诉主公"打开这个文件"
```
