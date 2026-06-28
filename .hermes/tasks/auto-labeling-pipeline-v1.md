# 架构认知管线自动标注方案 v1

## 背景
当前 arch-scanner 的 3D 监视器对 arch-scanner 自身项目效果很好，但扫描其他项目存在三个短板：

### 短板A：模块检测依赖 `--` 命名规范
- viewer.html 的 detectModule() 通过 `nodeId.split('--')` 判断模块归属
- 其他项目的节点命名无此规范，全部归为 "other"
- 影响：模块聚类、模块详情面板、跨模块粗管道全部失效

### 短板B：Agent 诊断数据需要手动标注
- 状态颜色（healthy/warning/risk）和角色颜色（hub/bridge/leaf）需要 Agent 读代码分析
- 全局诊断评分和建议也需要人工阅读代码后输出
- 目前没有自动化流程

### 短板C：大数据量性能
- 3349 节点/2658 连线时，JSON 5.5MB
- localStorage 容量紧张，同步 XHR 超时

## 解决方案方向

### 方向1：修复通用模块检测（P0）
让模块检测不依赖 `--` 命名规范：
- 方案A：port-tag-tool 扫描时输出模块归属（基于目录结构/package.json）
- 方案B：viewer.html 改用目录前缀匹配（如 `packages/` 前缀）
- 方案C：port-tag-tool 增加 module 字段标注

### 方向2：自动化 Agent 诊断（P1）
建立自动标注 pipeline：
```
port-tag-tool 扫描 →  Agent 自动分析（读代码/读扫描结果）→  输出 agent_diagnosis.json  →  3D 渲染
```
- Agent 读取扫描结果中的节点名/连接数等信息
- 基于连接数等量化指标自动判定 status/role
- 基于模块节点数等自动给出模块诊断

### 方向3：大数据量优化（P1）
- 使用 fetch + 流式处理替代同步 XHR
- 考虑用 IndexedDB 替代 localStorage
- 超过 500 节点时自动 LOD 降级
- 支持 URL 参数传数据源路径

## 优先级建议
P0：方向1（模块检测）— 这是通用化的前提
P1：方向2（自动诊断）— 这是有价值差异化的核心
P1：方向3（性能）— 规模大了再优化
