# v0.1.40-node-spread.16: 修复模块台面/标签/箭头Y位置错误

## 根因
_computeLayout 中 _moduleLayoutInfo 在Y轴分层调整之前被填充。_
_模块Y轴分层（v10）修改了节点Y坐标，但_ _moduleLayoutInfo.avgY_ _记录的还是原始Y值。_
_导致背景框、模块标签、流向箭头都画在了错误的Y位置。_

## 修复
在 computeLayout 函数中，将 _moduleLayoutInfo 的 avgY 更新放在 Y轴分层调整 **之后**：

1. 在 module Y-layering 代码块末尾（约第2992行），遍历所有 moduleLayoutInfo 条目，重新计算 avgY
2. 或：在 Y-layering 调整完 positions 后，重新遍历节点更新 _moduleLayoutInfo 的 Y 值

```javascript
// 在Y轴分层调整后，更新 _moduleLayoutInfo 的Y值
Object.keys(window._moduleLayoutInfo).forEach(function(modId) {
  var info = window._moduleLayoutInfo[modId];
  // 重新计算该模块所有节点的平均Y
  var ySum = 0, count = 0;
  var members = moduleMembers[modId];
  if (members) {
    members.forEach(function(n) {
      var p = positions[n.id];
      if (p) { ySum += p.y; count++; }
    });
    if (count > 0) info.avgY = ySum / count;
  }
});
```

## 分支
feature/node-spread

## 文件
packages/3d-monitor/viewer.html

## 版本
v0.1.40-node-spread.16

## 验证
生成测试页后，应该能看到：
- 每个模块有背景台面 + 模块名标签
- 模块之间有流向箭头 + 流动光点
- 枢纽节点明显更大且发光
