# 调试v13为什么模块功能不渲染

## 怀疑
v13 引入 resolveModuleColor 替换 resolveLayerColor 后, n.module 未赋值导致颜色全灰。
但背景框（使用 info.color）和箭头（使用 MODULE_CONFIG 直接）应该不受影响。
如果仍然不显示，可能 buildScene 中存在 JS 错误导致执行中断。

## 检查
1. 确认 buildScene 中是否有 try-catch
2. 确认 _moduleLayoutInfo 是否被正确填充
3. 确认 moduleGroup 是否被添加到 scene
4. 确认三个轴上的渲染顺序（nodeGroup, edgeGroup, moduleGroup）

## 修复建议
如果 _moduleLayoutInfo 填充正确但 moduleGroup 不渲染，尝试：
1. 降低背景框透明度（0.18 → 0.35）
2. 将 moduleGroup 的 position 下调 0.2（避免与节点重叠）
3. 添加 console.log 确认 moduleGroup 子节点数量
