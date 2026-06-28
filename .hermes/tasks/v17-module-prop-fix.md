# v0.1.40-node-spread.17: 修复节点 module 属性未赋值导致颜色全灰

## 根因
v13 引入 resolveModuleColor 后，节点颜色依赖 n.module 属性。
但 buildScene 中没有将 detectModule() 的结果写入 n.module。
导致 resolveModuleColor(n) 中 n.module 始终为 undefined，
所有节点 fallback 到 0x888888（灰色）。

## 修复
在 buildScene 的节点创建循环中，节点位置赋值之后，加入：

```javascript
n.module = detectModule(n.id);
```

位置：在 `var chipColor = resolveModuleColor(n);` 这一行之前。
确保 resolveModuleColor 能正确读取 n.module。

## 文件
packages/3d-monitor/viewer.html

## 版本
v0.1.40-node-spread.17

## 验证
生成测试页后应能看到：
- 节点有正确的层颜色（恢复层配色resolveLayerColor）
- 模块背景台面（半透明彩色 + 标签）
- 模块间流向箭头（粗管道 + 流动光点）
- 枢纽节点（1.5倍 + 发光）
