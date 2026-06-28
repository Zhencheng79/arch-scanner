# 帧数问题诊断方案

## 已知
- 3349节点/376边，2fps
- TubeGeometry 参数减半（20,8→8,4）未改善
- 改动已确认在文件中生效
- arch-scanner 自身（31节点/19边）已准备好测试

## 两个可能瓶颈待验证

### 可能性A：CSS2DRenderer 逐帧重排
viewer 用 THREE.CSS2DRenderer 渲染标签。130个CSS2DObject在每个requestAnimationFrame中触发DOM重排。
**验证**：在大项目中禁用CSS2D标签看帧数是否提升

### 可能性B：节点Mesh材质消耗
3349个子节点（文件芯片）作为独立MeshStandardMaterial渲染，带金属度/粗糙度。
但聚合后只显示125个groupNode，子节点不渲染——所以这个应该不是问题。

## 建议下一步
1. 先扫小项目（arch-scanner自身）看是否流畅
2. 如果小项目流畅则问题在大项目的特定因素
3. 如果小项目也卡则问题在viewer.html的公共代码
