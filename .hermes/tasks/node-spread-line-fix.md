# node-spread: 修复连线穿模 + 端点对齐

## 分支
feature/node-spread (v0.1.44)

## 工作目录
~/projects/hermes-3d-panorama

## 问题描述

### 问题1：连线穿模（管道穿透节点）
当前连线从节点中心开始画，但节点是 BoxGeometry(1.2 x 0.72 x 1.2)，导致连线穿过节点内部。

**修复要求**：
- 连线端点偏移到节点表面（不是节点中心）
- Box 半尺寸：x=0.6, y=0.36, z=0.6
- 偏移量 = 半尺寸 + 0.2（额外间距）
- 在 `computeEdgePath` 中计算偏移方向向量，沿连线方向从端点向内缩

### 问题2：连线端点不对齐
连线端点与节点位置不完全对齐。

**修复要求**：
- 确认连线端点从 nodeMeshes[fromId].mesh.position 读取
- 加上表面偏移后确保精确匹配

### 问题3：连线避障优化
当前 obstacle avoidance 控制点过多导致线条扭曲。

**修复要求**：
- 保持 control points ≤ 4
- 保留 fallbackBezierPath 逻辑
- maxIter 保持 6

## 修改文件
packages/3d-monitor/viewer.html — 定位 `computeEdgePath` 函数和连线生成部分

## 验证方式
生成测试页后用 OrbitControls 旋转查看各角度，确认连线不从节点内部穿过
