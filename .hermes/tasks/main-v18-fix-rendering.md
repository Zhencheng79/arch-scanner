# 主任务：修复模块台面/箭头/详情面板不渲染

## 根因（从v12-v13定位）
v13 引入 resolveModuleColor 后，node.module 未赋值导致颜色回退。
现有v17已修复 module 赋值，但模块台面、箭头、详情面板仍未渲染。
怀疑 buildScene 在节点创建后到模块功能代码之间抛出了未捕获错误。

## 修复方向
1. 在 buildScene 的模块背景框代码周围添加 try-catch
2. 确认 _moduleLayoutInfo 在 buildScene 中可访问
3. 确认 moduleGroup 在 scene 中位置正确
4. 台面Y位置比节点低0.2（不重叠）
5. 详情面板点击事件检查 raycaster 是否命中

## 分支
feature/node-spread

## 版本
v0.1.40-node-spread.18

## 验证
- 能看到模块彩色半透明台面
- 能看到模块之间粗管道箭头
- 点击节点弹出详情面板
- 枢纽节点金色+放大
