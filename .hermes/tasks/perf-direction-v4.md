# 性能优化方案 v4 — TubeGeometry 合批为 LineSegments

## 根因（数据验证）

376条边束中：
- 161条 ≥ 5 bundleCount → TubeGeometry（厚管道，glow+core双层=322个geometry）
- 215条 < 5 bundleCount → LineSegments（薄线，已合并）

**帧数杀手**：161×2=322个独立 TubeGeometry draw call
**0边线**：TubeGeometry + LineSegments 渲染，但 TubeGeometry 创建极其耗资源导致帧数归零

## 修复

### Fix 1：所有边束统一为 LineSegments 合批
- 删除 TubeGeometry 代码路径（glow+core 双层）
- 所有376条边束合并为单个 LineSegments 的 BufferGeometry
- 粗细模拟：bundleCount < 5 画1条线，≥5画3条平行线（模拟管道粗细）
- 颜色用 per-vertex：flowType 映射 data=#60A5FA, control=#3B82F6, event=#34D399
- draw call：376→1

### Fix 2：删除 computePipeCrossings
- O(n²) crossing 计算在大项目（376边=70k次比较）消耗大
- 合批后 crossing 逻辑不再需要（LineSegments不需要交叉抬升）
- 直接删除 pipeCrossings 调用

### Fix 3：展开/折叠子节点修复
- toggleGroup 中确保 nodeMeshes[childId] 能找到子节点 mesh
- 子节点 mesh 在 _allOriginalNodes 渲染阶段注册

## 工作量
Fix 1: ~30分钟（删除TubeGeometry，改为LineSegments）
Fix 2: ~5分钟（删除crossing调用）
Fix 3: ~20分钟

## 预期效果
帧数：从2帧恢复到30-60帧
边线：376条边全部可见
