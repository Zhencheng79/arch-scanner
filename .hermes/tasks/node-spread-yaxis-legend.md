# node-spread: Y轴等级规范 + 图例更新

## 分支
feature/node-spread (v0.1.44)

## 工作目录
~/projects/hermes-3d-panorama

## 问题描述

### 问题1：Y轴需要有管理关系参考引力
当前 Y 轴是完全自由的全局散布，但主公要求 Y 轴应该体现管理关系。

**修复要求**：
- Y轴不再完全自由散布，而是按层级（layer）给出基准Y值
- 在同一layer内的节点，在基准Y附近做小幅散布 (±0.5)
- 各层Y基准（沿用主分支）：
  infrastructure: y=0
  data: y=2
  business: y=4
  presentation: y=6
  external: y=8
- 层内散布用随机偏移，不要碰撞穿透

### 问题2：图例更新
当前图例显示"排布: Y轴自由散布 | X轴业务领域参考 | Z轴内外边界参考"

**修复要求**：
- 去掉"层数"相关描述
- 改为："排布: Y轴层级参考 | X轴业务领域 | Z轴内外边界"
- 图例位置保持在右下角

### 问题3：连线与Y轴匹配
Y轴改为层级参考后，连线需要重新匹配端点位置

## 修改文件
packages/3d-monitor/viewer.html — 修改 `computeLayout` 函数和legend部分

## 验证方式
生成测试页确认：
1. 节点按层级分布在不同的Y高度
2. 同层节点在基准Y附近散布不重叠
3. 图例文字正确
