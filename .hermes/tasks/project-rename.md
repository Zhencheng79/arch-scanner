# 项目名统一：hermes-3d-panorama → arch-scanner

## 分支
当前分支 feature/node-spread (v0.1.46)

## 工作目录
~/projects/hermes-3d-panorama

## 任务描述
统一项目名称为 arch-scanner，以下文件需要修改：

### 1. package.json
- `"name": "system-3d-panorama"` → `"name": "arch-scanner"`
- `"description":` 更新为 `"Architecture Scanner — 3D visualization of project architecture"`

### 2. README.md
- 标题 `# System 3D Panorama` → `# Arch Scanner`
- 正文描述中的 "3D Panorama" 改为 "Architecture Scanner"
- 线不要改动项目功能的描述，只改名称

### 3. packages/3d-monitor/mcp-server.js
- 第4行 header 注释：`3d-monitor MCP Server (v0.1.10)` → `3d-monitor MCP Server (v0.1.10)`（版本号保留）
- 注释中的 "3D全景" 等描述不改，只改文件名相关的引用

### 4. AGENTS.md
- 项目简介部分的 `hermes-3d-panorama` 改为 `arch-scanner`
- 如果有路径引用 `~/projects/hermes-3d-panorama` 改为 `~/projects/arch-scanner`

### 5. 注意：不要修改以下内容
- 扫描数据 JSON 文件（port_tag_result.json 等）中的描述性标签
- projectScanner.js 中的 chineseName 描述（"3D全景前端"等是节点描述）
- viewer.html 的 title（已经是 "3D Monitor v0.1.46"）
- 各种 .bak 和备份文件

## 验证方式
- git diff 检查修改的文件列表
- 确认 package.json name 字段正确
- 确认 README.md 标题正确
