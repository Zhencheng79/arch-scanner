# 聚合模式体验修复 v4 — 诊断文本 + 边束性能

## 问题1：诊断文本为空（P0）

**根因**：auto_diagnose.js Phase 2a 设计把 summary/detail/suggestions 全部留空。
viewer 读到空数组就不显示任何文本。

**修复**：auto_diagnose.js 生成基础文本
- 全局 issues：列出 overloaded/warning 状态的模块名
- 全局 suggestions：基于常见模式生成基础建议
  - "有 N 个模块处于 warning/overloaded 状态"
  - "gateway 模块连接数高，建议关注"
- 模块 summary：`模块名 — N个节点，状态：healthy/warning/overloaded`
- 不改数据结构，只填充空字符串

## 问题3：边束渲染卡顿（P0）

**根因**：376条边束用独立 TubeGeometry 渲染，draw call 太多导致2帧。

**修复**：分层渲染
- 主要边束（bundleCount ≥ 5）：用粗管道 + 流动粒子（原有TubeGeometry方式）
- 次要边束（bundleCount < 5）：用细线（LineSegments，合并为一个Geometry）
- 这样可以大幅减少 TubeGeometry 的 draw call 数量

**改动范围**：
- auto_diagnose.js：补充全局和模块的 summary/建议文本
- viewer.html：边束分层渲染逻辑

## 优先级
P0：问题1（诊断文本为空）+ 问题3（边束卡顿）同时做
