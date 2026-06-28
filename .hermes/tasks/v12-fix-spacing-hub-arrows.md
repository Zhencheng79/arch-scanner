# v0.1.40-node-spread.12: 修三件事

## 工作目录
~/projects/arch-scanner
分支: feature/node-spread

## 问题（经用户验证）
1. 节点间距离过大（XZ轴铺太远，一屏看不全）
2. 枢纽高亮代码丢失（被v10/v11迭代覆盖）
3. 模块流向箭头没显示（函数存在但不被调用）

## 修改

### 1. 缩小XZ间距
当前 MAX_PER_ROW=6, intraGroupSpacing 导致141节点铺出57+单位。
改为：
- MAX_PER_ROW=12（每行多放节点）
- intraGroupSpacing 缩小50%
- groupSpacing 缩小50%
- 初始相机距离自适应场景大小

### 2. 恢复枢纽高亮
从 v0.1.40-node-spread.08 恢复枢纽高亮代码:
- 节点创建时按连接数计算 _isHub / _degree
- _isHub 节点放大1.5倍，增加emissiveIntensity
- 动画循环中添加 hubPulse 脉动发光
- 详情面板显示枢纽标签

### 3. 修复流向箭头
检查 buildModuleFlowArrow 为什么不调用：
- 可能被包在未执行的函数作用域内
- 或 moduleGroup 未正确添加到 scene
- 修复并确保箭头调用

## 验证
1. 一屏能看到大部分节点（不需要大量拖拽）
2. 枢纽节点明显大于普通节点且脉动发光
3. 模块间有可见的粗管道箭头+流动光点
4. 点击枢纽节点弹出详情面板
