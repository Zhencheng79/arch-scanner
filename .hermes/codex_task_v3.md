# 修复Y轴散布 + 穿模问题 (v0.1.42-spread)

## 项目上下文
- 项目：hermes-3d-panorama（3D 监视器）
- 代码位置：`packages/3d-monitor/viewer.html`（单文件内联 Three.js）
- 当前分支：feature/node-spread
- 当前版本：v0.1.42-spread
- 工作目录：/Users/zhencheng/projects/hermes-3d-panorama/packages/3d-monitor/

## 问题一：Y 轴散布仍然不明显
### 根因
computeLayout 中节点驱动模式的 Y 轴：所有同一层级的节点 Y 值几乎相同，肉眼看不出层次之内的自然散布。

### 要求
- 同一层级内每个节点的 Y 位置必须有肉眼可见的差异
- 幅度至少 ±0.5 单位（当前只有 ±0.15）
- 参考 X 轴的做法：X 轴上同组节点按顺序排列，每个节点有唯一位置。Y 轴也应如此
- 散布方式：基于节点在层内的排列次序，让 Y 值自然错开
- 整体仍能看出层级参考关系（基础设施层在下方，展示层在上方）

## 问题二：穿模（节点重叠）
### 根因
Y 轴位置改变后，节点之间的间距不够，碰撞检测未覆盖到新的 Y 分布。

### 要求
- 增加碰撞检测的迭代次数或强度
- 所有节点之间的最小间距 ≥ 1.8 单位（任意两节点中心距离）
- 检测覆盖 X/Y/Z 三个方向（3D 球体碰撞）
- 修复后连线也不能穿过节点内部

## 改动范围
只改 viewer.html 中的 computeLayout 函数及相关碰撞检测逻辑。
版本号保持不变（v0.1.42-spread）。

## 具体文件信息
- 目标文件：/Users/zhencheng/projects/hermes-3d-panorama/packages/3d-monitor/viewer.html
- 备份文件：/Users/zhencheng/projects/hermes-3d-panorama/packages/3d-monitor/viewer.html.v0.1.42-spread.bak4
- 修改前请先查看 backup 文件了解原始代码结构

## 验收标准
1. Y 轴散布幅度 ≥ ±0.5 单位，同层节点 Y 值肉眼可见不同
2. 任意两节点中心距离 ≥ 1.8 单位（3D 球体碰撞检测）
3. 连线不穿过节点内部
4. 整体层级参考关系仍清晰可见
5. 浏览器打开后 0 JS error
6. 版本号保持 v0.1.42-spread
