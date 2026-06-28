# 3d-monitor 模块归属视觉强化 + 粗管道

> 必须修改的文件：`packages/3d-monitor/viewer.html`（单文件）
> 分支：feature/node-spread
> 工作目录：`/Users/zhencheng/projects/arch-scanner`

---

## 修改一：台面视觉增强

### 现状
- 台面透明度 0.18，几乎看不见
- 台面大小已根据节点范围自动计算（minX/maxX/minZ/maxZ + padding 5.0），这个逻辑OK
- 台面颜色来自 MODULE_CONFIG 的颜色

### 修改要求
1. **提高台面透明度**：`opacity: 0.18` → `opacity: 0.35`
2. **加粗台面边框**：边框线 `linewidth` 加粗到2（如果three.js支持），不支持的浏览器使用默认
3. **台面颜色不变**：保持 MODULE_CONFIG 的颜色

### 代码位置
第3795-3797行（bgMat透明度）
第3808-3810行（边框颜色和透明度）

---

## 修改二：节点添加模块颜色边框

### 现状
- 节点颜色用 resolveLayerColor(n.data)（层级颜色）
- 模块台面用 MODULE_CONFIG[modId].color（模块颜色）
- 两者没有关联，视觉上割裂

### 修改要求
1. 节点渲染时，如果节点属于某个模块（detectModule返回值不是'other'），在节点周围加一圈细的**模块色边框**
2. 边框颜色 = MODULE_CONFIG[modId].color
3. 边框宽度 = 1-2像素
4. 边框透明度 = 0.6-0.8

### 代码位置
在 buildScene 中创建节点Mesh的地方（第3501行附近），找到节点的渲染逻辑，在已有Mesh外层加一个边框Mesh。

具体实现方式：
- 使用 EdgesGeometry + LineBasicMaterial 或
- 使用比原Mesh略大的第二个Mesh作为边框（用模块色，半透明）

**注意**：不要使用网格几何体（wireframe），使用固体边框（solid edge outline）。

---

## 修改三：模块间粗管道（最重要）

### 现状
- 所有连接管道都用同样的粗细（glow半径0.04，core半径0.022）
- 没有区分模块间连接和模块内连接

### 修改要求
1. **判断逻辑**：渲染每一条连接时，判断 from 和 to 节点是否属于不同模块
   - 同模块 → 保持现有管道粗细（细）
   - 不同模块 → 管道加粗50%（glow半径0.04→0.06，core半径0.022→0.035），且颜色两侧各取所属模块的颜色，中间渐变过渡

2. **模块间管道渲染位置**：从源模块台面边缘绘制到目标模块台面边缘（不是节点到节点），视觉上像是"模块与模块之间的连线"

3. **具体实现**：
   - 在 buildScene 的连接渲染循环中（第4050行附近），对每条连接做 `detectModule(conn.from)` 和 `detectModule(conn.to)` 比较
   - 如果不同模块：
     - 管道半径放大（glow: 0.04→0.06，core: 0.022→0.035）
     - 颜色：起点用源模块颜色，终点用目标模块颜色，中间渐变过渡
     - 透明度调高（glowOpacity和coreOpacity提高30%）
   - 如果同模块：
     - 保持现有参数不变

---

## 修改四：图例同步更新

### 现状
图例已有"管道"分类：
- 外部连接（粗）跨模块/跨层
- 内部连接（细）模块内部

### 修改要求
更新图例中的"管道"描述，使其与新的逻辑对应：
- 外部连接（粗）→ 改为 **模块间连接（粗）**
- 内部连接（细）→ 改为 **模块内连接（细）**

文字在 viewer.html 第113-117行附近。

---

## 通用要求

1. **改前备份**：`cp viewer.html viewer.html.bak.$(date +%s)`
2. **不要用sed删除行**。console.log逐行替换为空行
3. **改完后验证**：本地起 http server + port_tag_result.json 注入数据
4. **如果改坏了就回滚**：`git checkout -- packages/3d-monitor/viewer.html`
5. **一次性完成所有修改**，不要拆成多个子任务
