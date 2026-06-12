# 应用Darwin进化出的最优3D布局参数

## 分支
feature/node-spread (v0.1.47)

## 工作目录
~/projects/arch-scanner

## 修改内容
在 viewer.html 的 computeLayout 函数中，将布局参数更新为 Darwin 进化算法得出的最优值。

### 新参数（进化最优）
- Y_SPREAD_RANGE: 7.0 → 6.17
- 布局算法中的阻尼系数改为 0.95
- 布局算法中的斥力系数改为 1.33
- 布局算法中的引力系数改为 0.0525

### 修改位置
在 viewer.html 中搜索并更新：
- `var Y_SPREAD_RANGE =` 当前值 7.0，改为 6.17
- 如果有 force 模拟相关的系数，对应修改

### 版本号
更新为 v0.1.48

### 验证
生成测试页，确认节点分布更紧凑、稳定
