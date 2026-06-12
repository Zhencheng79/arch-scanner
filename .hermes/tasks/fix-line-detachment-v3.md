# 修复连线端点脱离节点（精确方案）

## 技能要求
执行前加载以下技能：
- `design-taste-frontend` — 用于检查视觉对齐质量
- `js-code-quality` — 代码质量

## 根因（已验证）
fan spread 把 p1/p2 从节点中心横向推开了，然后 offsetToBoxSurface 从被推离的位置算表面偏移，方向也歪了，导致端点不在节点表面。

## 修复方案
不用"调顺序"——要从根本上改。

### 正确做法
1. 用两个独立变量保存**节点中心位置**（fromCenter、toCenter），fan spread 不碰它们
2. fan spread 只影响**方向向量**（从 fromCenter 指向 toCenter 的方向），而不是直接改 p1/p2
3. 表面偏移**从节点中心出发、沿 fan spread 后的方向、用 offsetToBoxSurface 正确算到盒子表面**
4. p1 = 节点A中心 + 沿fanned方向到盒子表面的偏移
   p2 = 节点B中心 + 沿fanned反方向到盒子表面的偏移

### 具体代码改动
在 viewer.html 的 buildScene → 构建 Edges 部分：

1. 在 fan spread 之前，保存 `var fromCenter = p1.clone(); var toCenter = p2.clone();`
2. fan spread 仍然修改 p1/p2（用于计算方向）
3. fan spread 结束后，用方向向量重新计算表面偏移：
   ```
   var fannedDir = new THREE.Vector3().subVectors(p2, p1).normalize();
   p1 = offsetToBoxSurface(fromCenter, fromCenter.clone().add(fannedDir), fromSize*0.5, fromSize*0.3, fromSize*0.5);
   var revDir = fannedDir.clone().negate();
   p2 = offsetToBoxSurface(toCenter, toCenter.clone().add(revDir), toSize*0.5, toSize*0.3, toSize*0.5);
   ```

### 测试验证
生成测试页后，用 OrbitControls 旋转视角：
- 所有连线的两端是否紧贴节点表面
- 没有浮空的线头
- 多线束的 fan spread 效果保持（不要因为修端点而丢失 fan spread）

## 工作目录
~/projects/arch-scanner

## 分支
feature/node-spread

## 版本号
v0.1.50

## 修改文件
packages/3d-monitor/viewer.html
