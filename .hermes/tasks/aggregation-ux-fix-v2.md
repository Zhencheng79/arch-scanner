# 聚合模式体验修复方案 v2

## 根因确认
1. `buildModuleAggregation` 创建的 `groupNode` 没有 `agentDiagnosis` 字段 → 单击显示空白
2. `showModuleInfo()` 依赖 `_moduleLayoutInfo[modId]` → 聚合模式下不存在
3. `updateNodeInfoPanel()` 对 `_isGroupNode` 无特殊处理 → 空数据
4. 存量双击展开/折叠功能正常，无需修复（军师指正）

## 修复项

### Fix A：groupNode 携带诊断数据（核心）
在 `buildModuleAggregation` 中创建 groupNode 时，从 `_agentDiagnosisData` 读取模块诊断数据并注入：

```javascript
// 从模块诊断数据获取状态
var modDiag = null;
if (window._agentDiagnosisData && window._agentDiagnosisData.modules) {
  for (var mi = 0; mi < window._agentDiagnosisData.modules.length; mi++) {
    var md = window._agentDiagnosisData.modules[mi];
    if (md.name === mod || md.id === mod) {
      modDiag = md.agentDiagnosis;
      break;
    }
  }
}

var groupNode = {
  ...,
  agentDiagnosis: modDiag || { status: 'healthy', role: 'normal', summary: moduleLabel + ' 模块，含 ' + children.length + ' 个节点', detail: '', suggestions: [] },
  color: modDiag ? (AGENT_STATUS_COLORS[modDiag.status] || modColor) : modColor,
};
```

### Fix B：单击聚合节点显示模块详情面板
在 `handleClick` 中检测 `_isGroupNode`：
- 如果是 groupNode → 调用 `showModuleInfo(moduleName)` 而非 `updateNodeInfoPanel`
- 如果 `showModuleInfo` 因 `_moduleLayoutInfo` 不存在而失败 → 回退到显示聚合节点的 `updateNodeInfoPanel`（此时已有 agentDiagnosis）

### Fix C：聚合模式下构建 _moduleLayoutInfo
在 `buildModuleAggregation` 中附加构造 `_moduleLayoutInfo` 数据，使 `showModuleInfo` 可正常工作：
```javascript
window._moduleLayoutInfo = {};
AGG.groups.forEach(function(g) {
  window._moduleLayoutInfo[g.label] = { ... };
});
```

### Fix D：CSS2D 标签显示诊断状态
聚合节点标签由 `label(count)` 改为带状态标识：`📗 label (27)` / `📙 label (5)` / `📕 label (3)`

### Fix E：全局诊断面板保留
聚合模式下 `showGlobalDiagnosis()` 独立于节点数据，应该不受影响。验证即可。

## 验收条件
1. GIVEN 3349节点聚合模式 WHEN 单击模块节点 THEN 显示模块详情面板（含节点数、诊断状态、模块描述）
2. GIVEN 模块详情面板 WHEN 面板显示 THEN 显示Agent诊断文本和优化建议（如有）
3. GIVEN 聚合模式 WHEN 页面加载 THEN 底部全局诊断面板显示评分和问题清单
4. GIVEN 小项目（<20节点）WHEN 页面加载 THEN 不使用聚合模式，行为不变
5. GIVEN 双击聚合节点 WHEN 双击 THEN 展开内部节点（存量功能，验证无回归）
