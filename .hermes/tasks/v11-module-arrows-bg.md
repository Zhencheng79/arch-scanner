# v0.1.40-node-spread.11: 模块流向箭头 + 背景框 + 连线脱节修复

## 前置
v0.1.40-node-spread.10 已完成：MODULE_Y_ORDER, 模块在Y轴分层排列

## 本轮完成
1. **模块间流向箭头** — 用Three.js TubeGeometry绘制粗管道，从提取→存储→解析→图查询→上下文→MCP，带流动光点动画
2. **模块背景框** — 每个模块组外圈加半透明圆角矩形框（透明度0.08），上面加模块名标签
3. **连线端点脱节** — fan spread之后再做surface offset，见前面v3方案的根因

## 文件
packages/3d-monitor/viewer.html

## 版本
v0.1.40-node-spread.11

## 技能
design-taste-frontend, js-code-quality, architecture-visualization-standard
