# 修复连线端点脱离节点 + 管穿透节点

## 问题1：端点脱离节点（根因定位完成）

### 根因
代码 viewer.html 中 buildScene 函数内，**处理顺序错误**：

```
第3617-3618行: offsetToBoxSurface() → 端点对齐到盒子表面  ✅
第3641-3648行: fan spread 横向偏移            → 又把端点推离表面 ❌
```

fan spread 在 XZ 平面横向推了 p1/p2，但表面偏移已经做过了——fan spread 的推离导致端点不再在表面。

### 修复方案
**调换顺序**：先做 fan spread，再做 surface offset。

改动：
1. 把第3617-3618行的 `p1 = offsetToBoxSurface(...)` 和 `p2 = offsetToBoxSurface(...)` 移到 fan spread 代码块（3641-3648行）的**后面**
2. 保留 `var fromSize / toSize` 在原来位置，但把 offset 调用移到 fan spread 之后
3. 注意：`offsetToBoxSurface` 以 p1/p2 为参数，fan spread 修改了 p1/p2，所以 fan spread 之后再做 offset 才是正确的

### 验证
生成测试页，用 OrbitControls 旋转到各角度检查：
- 所有连线的两端是否紧贴节点表面
- 没有浮空的线头

## 问题2：线管穿透节点（障碍规避不足）

### 根因
`computeAvoidanceCurve` 的 obstacle avoidance 控制点不够多或 maxIter 不够，导致避障曲线不够弯，仍然穿过中间节点。

### 修复方案
在 `computeAvoidanceCurve` 或 `findObstacles` 中：
1. 增加 obstacle avoidance 的控制点数量
2. 增大 margin（目前是 0.35，可增大到 0.5）
3. 或者增加迭代次数让曲线更弯曲

### 验证
旋转视角检查是否有线管从节点内部穿过

## 工作目录
~/projects/arch-scanner

## 分支
feature/node-spread

## 版本号
v0.1.49

## 修改文件
packages/3d-monitor/viewer.html — 在 buildScene → 构建 Edges 部分
