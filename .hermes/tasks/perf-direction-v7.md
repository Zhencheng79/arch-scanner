# 性能优化方案 v7 — 两条 TubeGeometry 参数统一减半

## 根因
每条边束创建两个 TubeGeometry：glow层(line 4731) + core层(line 4735)
两者都用 tubularSegments=20, radialSegments=8

## 修复
### Fix：两条 TubeGeometry 参数统一从 20,8 → 8,4
- line 4731: `new THREE.TubeGeometry(curve, 20, _glowRadius, 8, false)` → `8, _glowRadius, 4, false`
- line 4735: `new THREE.TubeGeometry(curve, 20, _coreRadius, 8, false)` → `8, _coreRadius, 4, false`
- 三角形从 `161×2×20×8×2=103,040` → `161×2×8×4×2=20,608`（减少80%）
- **不改其他任何东西**
- **工作量**：改4个数字

## 预期
帧数恢复可操作水平
