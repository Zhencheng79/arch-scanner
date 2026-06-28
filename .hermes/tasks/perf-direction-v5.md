# 性能优化方案 v5 — TubeGeometry 减面

## 根因
TubeGeometry 创建耗时+draw call多。161条边，每个 tubularSegments=20, radialSegments=8
→ 每条边 20×8×2=320个三角形，161条共 51,520个三角形
→ 322个独立geometry（glow+core双层）

## 修复（渐进策略）

### Fix 1a：TubeGeometry 参数减半
- tubularSegments: 20→8
- radialSegments: 8→4
- 三角形数：51,520→5,152（减少90%）
- 视觉效果几乎不变（管道平滑度降低但仍可识别）
- **工作量**：改2个数字

### Fix 1b：如还不够，取消glow层
- 当前是 glow(半透明外包)+core(实心内核) 双层
- 改为只有core层（glow层不透明度0.05基本不可见）
- draw call从322→161
- **工作量**：删除glow层代码

### Fix 2：保留 computePipeCrossings
- 一次性构建，不逐帧
- 保留交叉抬升feature

### Fix 3：展开/折叠不修
- 无bug

## 优先级
先Fix 1a（2个数字，立竿见影）
不够再加Fix 1b（删glow层）
