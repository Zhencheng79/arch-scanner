# 3d-monitor 模块详情面板 + 排布策略优化

> 必须修改的文件：`packages/3d-monitor/viewer.html`（单文件）
> 分支：feature/node-spread

---

## 修改一：模块详情面板

### 需求
点击模块台面或模块标签时，弹出详情面板展示模块信息。复用现有 `nodeInfoPanel` DOM结构。

### 交互行为
- **点击模块台面** → 弹出模块详情面板
- **点击模块标签（CSS2D标签）** → 弹出模块详情面板
- **点击模块内节点** → 弹出节点详情面板（和现有行为一致）
- **点击空白区域** → 面板消失
- **按ESC键** → 面板消失
- **面板中的"← 返回"按钮** → 回到节点详情（如果有历史记录）

### 面板内容

```
┌─ 模块详情 ─────────────────────────┐
│ [← 返回] 模块名称: components       │
│                                      │
│  成员节点: 10                        │
│  层级分布: presentation(6) business(4)│
│  连接数: 28（模块内12，模块间16）     │
│                                      │
│  成员节点（单击跳转节点详情）          │
│  • AccordionExpand                  │
│  • BillboardText                    │
│  • ConnectionLine                   │
│  ...                                │
│                                      │
│  模块间连接                          │
│  → data（5条data流, 2条control流）    │
│  → packages-port-tag-tool（3条data） │
│  ← .hermes（2条data流）              │
└──────────────────────────────────────┘
```

### 实现步骤
1. 在台面Mesh上挂click事件（`mesh.userData._isModulePlatform = true`），点击时调用`showModuleInfo(modId)`
2. 新增`showModuleInfo(modId)`函数，读取`window._moduleLayoutInfo[modId]`的数据
3. 复用现有`nodeInfoPanel`的HTML结构，填充模块数据
4. 在面板中添加成员节点列表（单击跳转到节点详情）
5. 统计模块间连接（遍历dataConns，统计跨模块连接）
6. 添加"← 返回"导航 + ESC键处理

### 代码位置
- 台面Mesh创建在 buildScene 中（`moduleGroup.add(bgMesh)`附近），在bgMesh上挂click事件
- 详情面板在现有 `showNodeInfo(nodeId)` 旁新增 `showModuleInfo(modId)` 函数
- ESC键处理在页面已有的全局keydown事件中补充

---

## 修改二：排布策略优化

### 需求
对现有 computeModuleLayout 中的排序逻辑进行增强，使得模块排列更合理。

### 具体修改

**排序策略**（在computeModuleLayout中+修改）：
- 在`platformOrder`排序时，改为按模块总连接数降序排列
- 遍历 dataConns，统计每个模块的入度和出度
- 连接多的模块优先靠左

**间距量化**：
- `PLATFORM_SPACING_X` 从固定值改为 `Math.min(moduleIds.length * 0.3 + 2, 6)`
- 最小间距2.0，最大间距6.0

**折叠兜底**（当前4个模块不会触发，但代码保留）：
- 在 computeModuleLayout 顶部检测 `if (moduleIds.length >= 10)` 启用折叠模式
- 折叠模式下台面只显示模块名+成员数
- 双击标签展开

---

## 通用要求

1. **改前备份**：`cp viewer.html viewer.html.bak.$(date +%s)`
2. **不要用sed删除行**。console.log逐行替换为空行
3. **改完后验证**：Node.js语法验证 + 浏览器渲染验证
4. **一次性完成两个修改**
5. USE_MODULE_LAYOUT = true
