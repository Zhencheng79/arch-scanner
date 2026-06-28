# arch-scanner Project — Agent Instructions

## 项目简介
arch-scanner（架构扫描器）是一个 MCP-powered 项目架构扫描与 3D 可视化工具。
包含两个核心工具：端口标签工具（port-tag-tool）和 3D 监视器（3d-monitor）。

## 对 Codex CLI 的要求

### 通用要求
- 改 JS/TS 代码时，加载 js-code-quality skill 确保代码质量
- 改 3D 视觉相关代码（Three.js 场景、渲染、动画）时，注意视觉品味和交互细节
- 所有代码修改前先备份原文件
- 不要在 console.log 删除时用 sed 整行删除——用替换为空行

### 端口标签工具（port-tag-tool）
- 代码位置：`packages/port-tag-tool/`
- 核心文件：`projectScanner.js`（扫描引擎）
- 技能：加载 `port-tag-scan-enhancement` skill 了解扫描强化流程
- 注意事项：
  - npm install 需要网络，Codex 沙箱无网络时需要 X 专员手动安装
  - AST 解析用 acorn + acorn-jsx
  - 跨目录相对路径（`../data/systemData`）需解析到子模块（`data--systemData`）

### 3D 监视器（3d-monitor）
- 代码位置：`packages/3d-monitor/`
- 核心文件：`viewer.html`（单文件内联 Three.js）
- 注意：viewer.html 是单文件，所有代码内联，不要拆分成多文件
- force-layout分支已存档（tag: archive/force-layout-v0.1.40-force.15）

### 交互规范
- 代码修改走 Kanban 任务
- 改完后生成测试页验证效果
- 验收后方可汇报完成
