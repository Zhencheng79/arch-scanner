# v18: 修复模块台面/箭头/详情面板不渲染

## 问题
v13 引入了 resolveModuleColor 替换 resolveLayerColor，
但 node.module 未赋值导致颜色回退。
v17已修复 module 赋值，但台面/箭头/详情面板仍不渲染。

## 修复方向
排查 buildScene 中节点创建后到模块功能代码之间是否有未捕获错误。
添加 try-catch，确认 moduleGroup 是否添加到 scene。
台面Y位置下调避免与节点重叠。
详情面板点击事件检查 raycaster 命中。

## 文件
packages/3d-monitor/viewer.html

## 版本
v0.1.40-node-spread.18

## 技能
architecture-visualization-standard, design-taste-frontend, js-code-quality
