# 3D渲染性能优化方案 v2

## 根因
Hermes Agent（3349节点/2658连线）卡顿的三个瓶颈：
1. **Draw call**：3349个独立 Mesh → 每个节点一个draw call
2. **CSS2D DOM 负载**：每个节点一个 CSS2DObject label → 3349个 DOM 元素
3. **连线 draw call**：2658条连线，每条一个独立 Line/Mesh

## 优化方案

### Layer 0：CSS2D 优化（P0）
**问题**：3349个 CSS2DObject（文本标签）造成巨大 DOM 开销。
**方案**：超过 300 节点时，仅枢纽节点（hub）和模块头节点显示标签，普通节点 hover 时才显示。
**改动**：viewer.html 的 label 创建逻辑，加 LOD 判断。
**耗时**：~20分钟

### Layer 1：聚合粒度改为模块级（P0）
**问题**：现有 buildAggregation（≥100节点触发）已生效但仍卡顿，因为聚合粒度不够——文件节点折叠到模块节点后仍有大量模块头节点。
**方案**：聚合粒度改为模块级视图：
- 文件节点（含 `--`）→ 折叠到所属模块
- 模块头节点 → 保留，用粗管道表示模块间连接
- 不显示文件粒度的细线
- 模块台面标注模块节点数和诊断状态
- 根节点风险处理：如果 extractDirPrefix 返回空，按 layer 分组
**改动**：viewer.html 的 buildAggregation，聚合阈值从节点数改为模块数
**耗时**：~30分钟

### Layer 2：InstancedMesh（P0）
**问题**：3349个独立 Mesh → 3349次 draw call
**方案**：BoxGeometry 合并为 InstancedMesh + per-instance color
- 分批：普通节点一批（同尺寸），hub节点一批（大尺寸）
- 点击交互：raycaster.intersectObjects 支持 InstancedMesh
- 连线另行优化（先合并为 BufferGeometry）
**注意**：edgeWire/decorative lines 需另寻渲染方式（InstancedMesh 不支持子物体）
**耗时**：~90分钟

### Layer 3：LOD + 懒加载（P2，后续）
- 远距离节点降级为 Sprite
- 初始只渲染视野内节点

## 优先级
```
Layer 0 (CSS2D) + Layer 1 (聚合) → P0，同时做
Layer 2 (InstancedMesh) → P0，做完 Layer 0/1 评估效果后再决定
Layer 3 (LOD) → P2
```

## 验收条件
1. 3349节点 + 2658连线场景帧率 > 30fps
2. 交互响应延迟 < 200ms（点击到高亮）
3. 模块级视图能读出架构（模块名+模块间连接可见）
4. 点击模块可展开查看内部文件
5. 2658条连线渲染不卡顿
6. 无内存泄漏（切换项目后 GC 回收）
7. 小项目（<50节点）行为不变
8. 回退机制：各优化层有独立开关，出问题时可按层回退
