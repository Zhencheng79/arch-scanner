# 性能优化方向方案 v3

## 三个真实问题（军师确认）

### P0-1: 帧数卡顿 — TubeGeometry 渲染
**根因**：边束用 TubeGeometry（glow+core 双层），376条边×2=752个独立geometry
**修复**：所有边束合并为 LineSegments，per-vertex color，用平行线模拟粗细
**预期**：draw call 从 752→1

### P0-2: 0边线 — nodeMap 查找失败
**根因**：`buildScene` line 4597-4599 检查 `nodeMap[conn.from]`，但聚合后 `conn.from` 是 groupNode ID（`__modgroup_*`），而 nodeMap 可能未包含全部 groupNode ID
**修复**：edge 渲染时若 nodeMap 查找失败，回退到 `nodeMeshes[conn.from]` 或直接使用 positions
**预期**：边线恢复显示

### P0-3: 展开/折叠失效 — nodeMeshes 子节点未注册
**根因**：`toggleGroup` 中 `showGroupChildren` 访问 `nodeMeshes[childId]`，但聚合模式下子节点 mesh 在 `_allOriginalNodes` 阶段创建后未正确注册到 nodeMeshes
**修复**：确保 `showGroupChildren/hideGroupChildren` 能正确找到子节点 mesh
**预期**：双击展开/折叠正常工作

## 优先级
P0-1 + P0-2 同时做（帧数恢复+边线可见）
P0-3 后续（展开折叠）
