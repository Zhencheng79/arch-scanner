# 3D渲染性能优化方案 v1

## 问题
Hermes Agent（3349节点/2658连线）在3D监视器中卡顿无法操作。

## 方案：三层优化

### Layer 1：聚合模式（P0，立刻见效）
当前 viewer.html 已有 `buildAggregation()` 函数，但效果不够。
增强：超过 500 节点时，自动聚合文件节点到模块节点，只显示模块级视图。

改动范围：
- viewer.html 的 buildAggregation 函数
- 仅显示模块头节点（不含 `--` 的文件节点折叠）
- 模块间连接用粗管道表示
- 模块台面显示模块名
- 耗时：约30分钟

### Layer 2：InstancedMesh（P1）
3349个独立 Mesh → 1个 InstancedMesh + 3349个变换矩阵。
减少 draw call 从 3349 降到 ~10。

改动范围：
- viewer.html 的 buildScene 函数
- 节点 BoxGeometry 改用 InstancedMesh
- 需处理：不同颜色节点（不同 instance color）
- 需处理：点击交互（raycaster 支持 InstancedMesh）
- 耗时：约60分钟

### Layer 3：LOD + 懒加载（P2）
- 远距离节点自动降级（六面体→平面 Sprite）
- 初始只渲染视野内的节点
- 耗时：约40分钟

## 优先级建议
先做 Layer 1（聚合模式），500节点阈值，效果立竿见影。
如果还不够再做 Layer 2。
Layer 3 后续。

## 验收条件
1. 3349节点场景帧率 > 30fps
2. 模块级视图仍能读出架构（模块名+模块间连接可见）
3. 点击模块节点可展开查看内部文件
4. 小项目（<500节点）行为不变
