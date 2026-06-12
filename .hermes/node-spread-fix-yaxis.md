# 修复：Y 轴改用与 X/Z 相同的"参考+自然"机制

## 问题
当前 Y 轴被特殊处理了——用了 yRanges、层级范围、hash 分布等一套复杂逻辑，反而让 Y 轴排布不自然。

## 正确做法
Y 轴应该跟 X 轴、Z 轴采用完全相同的处理方式：

- **X 轴**：按业务领域分组作为参考，节点自然分布（不强制）
- **Z 轴**：按内外边界偏移作为参考，节点自然分布（不强制）
- **Y 轴**：按技术层级（infrastructure→data→business→presentation→external，从低到高）作为参考位置，节点在 Y 方向上自然分散

## 具体改动

### 移除
- 移除 yRanges、yRange、_ySpread、_yOffset 等 Y 轴特殊处理的代码
- 移除 Y 轴打散的 hash 分布逻辑

### 恢复到原始 Y 轴参考机制
让 Y 轴参考原始 `computeLayout` 中的层级 Y 值（infrastructure=0, data=1, business=2, presentation=3, external=4），但不强制：

```javascript
// Y 轴参考位置：按层级
var yRef = LAYERS[layerKey] ? LAYERS[layerKey].y : 0;
// 在参考位置周围加微小偏移，但不压死
var yPos = yRef + (Math.random() - 0.5) * 0.3;
```

这与 X 轴的做法一致：X 轴有参考位置（按 group 分组排列），但不强制节点必须停在精确位置。

### 正确路径
viewer.html 中 `computeLayout` 函数的 connection 模式：

```javascript
// 当前 connection 模式：
result[n.id] = { x: p.x, y: p.y, z: p.z };
// 这里的 p.y 是 3D 力导向算出来的 Y 位置，不是层级 Y

// 节点驱动模式应该保持原始逻辑但 Y 不压死：
// 在 computeLayout 的节点驱动分支中：
// - X 参考：按 group 分组排列（已有）
// - Z 参考：按 group 偏移（已有）
// - Y 参考：按层级 Y 值 + 微随机偏移（需要恢复）
```

## 验收
- Y 轴节点不再固定在几个水平面上，但能看出上下层级关系
- 没有特殊的 Y 轴打散逻辑干扰
- 连线正确，0 JS 报错
