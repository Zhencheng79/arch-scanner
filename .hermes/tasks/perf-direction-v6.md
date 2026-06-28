# 性能优化方案 v6 — TubeGeometry 减面（实际参数）

## 根因
161条边用 TubeGeometry(curve, tubularSegments=20, radialSegments=8, tubeRadius, false) + glow层

## 修复（代码实测参数）
### Fix：tubularSegments 20→8, radialSegments 8→4
- viewer.html line 4731: `new THREE.TubeGeometry(curve, 20, _glowRadius, 8, false)` → `...8, _glowRadius, 4, false)`
- 三角形从 `161×20×8×2=51,520` → `161×8×4×2=10,304`（减少80%）
- 视觉效果：管道平滑度略降但仍可识别
- 保留 glow 层 opacity 动态值不变
- 保留 computePipeCrossings
- **工作量**：改2个数字

### 预期
帧数从2帧恢复到可操作水平（估算15-30fps）
