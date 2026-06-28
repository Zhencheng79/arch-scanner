# 3d-monitor 修复任务：穿模 + 连接颜色 + 图例

> 必须修改的文件：`packages/3d-monitor/viewer.html`（单文件）
> 分支：feature/node-spread
> 工作目录：`/Users/zhencheng/projects/arch-scanner`

---

## 问题一：连接管道颜色与图例不一致（最严重）

### 根因分析

viewer.html 第4055行和4214行：
```javascript
var colorHex = targetNodeData ? resolveLayerColor(targetNodeData) : (FLOW_COLORS[flowType] || 0x888888);
```

管道颜色用的是 **目标节点的层级颜色**（`resolveLayerColor(targetNodeData)`），而不是 **连接类型的颜色**（`FLOW_COLORS[flowType]`）。

后果：一个"control"（控制流，图例标蓝色#3B82F6）的连接，如果流向一个"business"层（业务层，绿色#34D399）的节点，管道渲染成绿色。和图例对不上。

### 修复要求

1. **改4055行和4214行**：管道颜色优先使用 `FLOW_COLORS[flowType]`，只有当flowType未定义时才fallback到节点颜色

   正确的逻辑：
   ```javascript
   var colorHex = FLOW_COLORS[flowType] || (targetNodeData ? resolveLayerColor(targetNodeData) : 0x888888);
   ```

2. **保持第4086行的pipeline特例**：
   ```javascript
   if (isPipelineAdj) { colorHex = 0xFFD700; flowType = 'pipeline'; }
   ```
   这行不能删，管道流向相邻模块时金色高亮标注是有意设计。

3. **颜色值对照表**（必须严格匹配）：
   ```
   control → 0x3B82F6（蓝，控制流）
   data    → 0x60A5FA（浅蓝，数据流）
   event   → 0x34D399（绿，事件流）
   config  → 0xFBBF24（黄，配置流）
   pipeline → 0xFFD700（金，跨模块流向）
   ```

### 验收标准
- 打开页面，随机找一个连接管道，看它的颜色是否和图例中该流类型的颜色一致
- 例如：所有"control"流管道都显示蓝色（#3B82F6），所有"data"流管道都显示浅蓝（#60A5FA）
- 第4086行的金色管道（pipeline流向）不受影响

---

## 问题二：图例缺少"粗管道"条目

### 根因分析

图例（HTML第108-111行）只显示了4种连接类型的"细线样条"（`.line-sample`）。但实际渲染中有两种管道：
- 外部连接（主glow管道）：半径0.04（粗），有发光效果
- 内部连接（子管道）：半径0.02（细），半透明

图例中没有解释"粗管道"和"细管道"的区别。

### 修复要求

在图例的"连接类型"区域下方，添加一个"管道粗细"说明行：

```html
<div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:4px">
<div style="font-size:10px;color:#666;margin-bottom:2px;letter-spacing:0.5px;font-weight:600">管道</div>
<div class="row"><span class="line-sample" style="background:rgba(255,255,255,0.5);height:3px"></span> 外部连接（粗）<span style="color:#666;margin-left:4px;font-size:10px">（跨模块/跨层）</span></div>
<div class="row"><span class="line-sample" style="background:rgba(255,255,255,0.3);height:1px"></span> 内部连接（细）<span style="color:#666;margin-left:4px;font-size:10px">（模块内部）</span></div>
</div>
```

注意：`height:3px` 和 `height:1px` 分别代表粗细。

---

## 问题三：节点穿模

### 根因分析

当前computeLayout中的间距参数（在第2775行附近的`groupSpacing`和`intraGroupSpacing`）不足以容纳50个节点和100条连接线。穿模检测逻辑（v.20的maxIter机制）可能在迭代次数内没有收敛到无穿摸状态。

### 修复要求

1. **增加节点间距**：将 `groupSpacing` 从 `2.5` 调整到 `3.0-3.5`，`intraGroupSpacing` 从 `1.1` 调整到 `1.4-1.6`
2. **增加穿模检测迭代上限**：maxIter（第 `maxIter` 相关代码）从当前值增加50%（如原来是18改为27）
3. **调大MAX_PER_ROW**（第2805行附近）：从 `16` 改为 `20`，减少行数，避免太多行堆叠
4. **减少Z轴随机散布范围**：`(Math.random() - 0.5) * 0.6` 改为 `(Math.random() - 0.5) * 0.4`，让节点在Z轴上更集中

### 验收标准
- 打开页面后，肉眼观察没有节点重叠
- 所有节点的标签文字可读（不被其他节点遮挡）
- 50个节点在视口中整体分布均匀，不挤在一角

---

## 通用要求

1. **不要用sed删除行**。如果有console.log需要移除，逐行替换为空行，不要整行删除
2. **改动前备份**：`cp viewer.html viewer.html.bak.$(date +%s)`
3. **改完后验证**：在浏览器中打开 `http://127.0.0.1:3001/viewer.html`（需先启动python3 -m http.server），用localStorage注入port_tag_result.json的数据来测试
4. **三个问题在一个任务中一次性完成**，不要拆成多个子任务
