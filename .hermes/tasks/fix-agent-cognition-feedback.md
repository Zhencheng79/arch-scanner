# 第一轮验证反馈修复方案

> 基于主公 2026-06-23 实测验证反馈，对 viewer.html 改造的修复与补充。
> 需经军师评分 ≥9 后派发 Codex 执行。

---

## 一、问题清单

### P0（功能bug，必须修）

| # | 问题 | 位置 | 描述 |
|---|------|------|------|
| 1 | **图例折叠按钮不生效** | viewer.html 图例区 | 图例新增了 legend-title 点击事件，但 onClick 绑定的 toggleLegend() 函数未正确定义或存在 JS 作用域问题，点击无响应 |
| 2 | **双击空白处全局诊断面板消失** | viewer.html 交互逻辑 | 双击空白处执行脱选（deselectAll）时，全局诊断面板被错误地隐藏了。全局诊断不应受选中状态影响 |

### P1（视觉/内容问题，建议修）

| # | 问题 | 位置 | 描述 |
|---|------|------|------|
| 3 | **旧图例被顶掉** | viewer.html 图例区 | 新图例替换了旧的层级/连接类型图例。旧的节点分层（external/presentation/business/data/infrastructure）和连接类型（control/data/event）图例应该保留，与新图例共存 |
| 4 | **红色和橙色太接近** | viewer.html 颜色定义 | overloaded（#F44336 红）和 needs-split（#FF5722 橙深）视觉上难以区分。建议将 overloaded 改为深红色 #B71C1C，needs-split 保持橙色 #FF9800 |
| 5 | **选中模块时底部无模块诊断** | viewer.html 详情区 | 当前底部全局诊断面板仅显示全局诊断。选中模块时（左侧模块详情弹出），底部应同步显示对应模块的诊断意见和改进建议 |

---

## 二、修复方案

### 2.1 图例：新旧共存 + 折叠修复

**图例布局改造：**

```
┌─────────────────────────────────────┐
│ 📋 图例 ▲ (可折叠标题，点击切换)      │
├─────────────────────────────────────┤
│ 【节点分层】（旧的保留）              │
│ ● external(外部)  ● presentation(展示) │
│ ● business(业务)  ● data(数据)       │
│ ● infrastructure(基础设施)           │
│ 【连接类型】（旧的保留）              │
│ ─ control(控制流) ─ data(数据流)      │
│ ─ event(事件流)                      │
│ ──────────────────                   │
│ 【节点角色】（新的）                  │
│ ■ 枢纽(金) ■ 桥梁(紫) ■ 叶子(灰) ■ 普通(白) │
│ 【模块状态】（新的）                  │
│ ■ 健康(绿) ■ 过载(深红) ■ 建议拆分(橙) │
│ 【健康状态】（新的）                  │
│ ■ 正常(绿) ■ 警告(黄) ■ 风险(红)     │
│ 节点主体=status · 边框=role          │
└─────────────────────────────────────┘
```

**折叠修复：**
- 确认 `toggleLegend()` 函数在 IIFE 内部正确定义
- 使用 `window.toggleLegend = function()` 确保全局可访问
- 或者用 `onclick="toggleLegend()"` 改为直接操作 DOM：先找到 `#legend .legend-body` 切换 display

### 2.2 颜色调整

| 当前颜色 | 问题 | 改为 |
|----------|------|------|
| overloaded 红 #F44336 | 与 needs-split 橙太接近 | 深红 **#B71C1C** |
| needs-split 橙深 #FF5722 | 与红色接近 | 保持橙色但调亮 **#FF9800** |
| warning 黄 #FF9800 | OK | 不变 |

### 2.3 双击不关闭全局诊断

**根因分析：** 双击空白处的 `deselectAll()` 或 `resetSelection()` 函数中，将 `#globalDiagnosisPanel` 也设置为了 `display:none`。

**修复：** 在脱选逻辑中，只隐藏 `#nodeInfoPanel` 和 `#moduleInfoPanel`，保留 `#globalDiagnosisPanel` 的显示状态。如果全局面板原本是显示的，脱选后不应隐藏。

### 2.4 模块诊断联动（P1可选，先评估复杂度）

当双击模块触发 `#moduleInfoPanel` 显示时，底部 `#globalDiagnosisPanel` 改为显示**该模块的诊断**（而非当前全局诊断），并在面板中标注"模块：xxx 的诊断"以区分。

**若实现复杂度高，可延后至下轮迭代。**

---

## 三、实施步骤

### Step 1：修复图例折叠（高优先级）
- 定位 viewer.html 中图例折叠函数
- 修复 toggleLegend() 函数定义和作用域问题
- 同时将旧图例（节点分层+连接类型）重新加入图例区

### Step 2：修复双击脱选bug
- 定位 deselectAll/resetSelection 函数
- 移除对全局诊断面板的隐藏逻辑

### Step 3：调整颜色
- 更新 overloaded 颜色为 #B71C1C

### Step 4（可选）：模块诊断联动
- Codex 评估复杂度，如果简单则一起实现

## 四、验收标准

1. 点击"📋 图例"可折叠/展开图例内容
2. 旧图例（节点分层5层 + 连接类型3种）显示在新图例上方
3. 双击空白处脱选后，全局诊断面板仍然可见
4. overloaded 和 needs-split 颜色可明显区分
5. 图例折叠/展开后，各类型图例内容正确

## 五、回滚

- 备份已存在 `viewer.html.bak.pre-agent-cognition`
- 如果修复有问题，Codex 执行前再做一次备份
