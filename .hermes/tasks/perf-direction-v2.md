# 性能优化方向方案 v2

## 真实根因（军师指正）

1. **帧数卡顿**：不是节点Mesh，是 TubeGeometry（边束管道）渲染开销。3349节点的Mesh渲染没问题，但376条边束用了独立TubeGeometry。
2. **0边线**：`computePipeCrossings` 中用 `positions[n.id]` 查找失败——聚合后节点ID变了但边束引用的还是原始节点ID。
3. **展开/折叠失效**：`toggleGroup` 依赖的 `nodeMeshes[childId]` 未正确注册——聚合模式下子节点mesh在另一位置。

## 修复方案

### Fix 1：边束删除 TubeGeometry，改用 LineSegments 合批（P0）
- 当前边束用 `TubeGeometry`（glow+core两层）→ 376×2=752个draw call
- 改为：所有边束合并为 1 个 `LineSegments` BufferGeometry
- 颜色用 per-vertex color，粗细用 line width（或平行线多画几层模拟粗细）
- 删除 TubeGeometry 的 glow/core 双层渲染
- **工作量**：约30分钟
- **效果预期**：draw call 从752→1，帧数应恢复正常

### Fix 2：边束渲染 positions 查找修复（P0）
- `computePipeCrossings` 中遍历 `_aggDataConns`，但聚合后 `positions[n.id]` 查找原始节点ID会失败
- 修复：查找时检查 `AGGREGATION.childGroupMap[childId]` 映射到 groupId 再查 positions
- **工作量**：约15分钟

### Fix 3：展开/折叠子节点 mesh 注册（P1）
- `toggleGroup` 中 `showGroupChildren` 访问 `nodeMeshes[childId]`，但聚合模式下子节点mesh在 `_allOriginalNodes` 的渲染阶段创建的位置和注册方式不同
- 修复：确保 `showGroupChildren/hideGroupChildren` 中能找到并操作子节点mesh
- **工作量**：约20分钟

## 优先级
P0：Fix 1（帧数）+ Fix 2（边线显示）— 做完后主公可以看到边线+不卡
P1：Fix 3（展开/折叠）— 后续
