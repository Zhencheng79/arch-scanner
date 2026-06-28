# 聚合模式信息展示修复方案 v3

## 问题根因

auto_diagnose.js 把诊断数据直接注入到节点/模块/全局字段，但 viewer.html 期待的是 `embeddedData.agentDiagnosis` 子对象：

```
auto_diagnose.js 输出:              viewer.html 期望:
{                                   {
  "nodes": [{agentDiagnosis:...}],    "nodes": [...],
  "modules": [{agentDiagnosis:...}],  "agentDiagnosis": {
  "global": {score:5.1}                "nodes": [...],
}                                      "modules": [...],
                                       "global": {...}
                                     }
                                   }
```

结果：`window._agentDiagnosisData = null` → 诊断面板/模块详情/颜色编码全部丢失。

## Fix 1：auto_diagnose.js 输出格式修正
在 auto_diagnose.js 的输出中增加根级 `agentDiagnosis` 字段：

```javascript
output.agentDiagnosis = {
  nodes: nodes.filter(n => n.agentDiagnosis).map(n => ({ id: n.id, agentDiagnosis: n.agentDiagnosis })),
  modules: moduleList,
  global: globalDiag
};
```

同时保留节点级别的 agentDiagnosis（向下兼容）。

## Fix 2：groupNode 标签显示
highDensity 模式下 groupNode 因无 `_isHub` 属性导致 `skipLabel = true`。
修正：在 groupNode 创建时设置 `_isHub: true`（或专门处理 `_isGroupNode` 跳过 skipLabel 判断）。

## Fix 3：双击聚合节点保持面板
双击 groupNode 时 `onDblClick` 调用了 `updateNodeInfoPanel(null)` 关闭面板。
修正：双击 groupNode 时调用 `showModuleInfo(moduleName)` 而非 `updateNodeInfoPanel(null)`。

## 验收条件
1. 页面加载后底部显示全局诊断面板（评分+问题清单）
2. 单击聚合节点 → 右侧显示模块详情面板（含节点数、诊断状态、文本、建议）
3. 聚合节点上方显示标签（模块名+节点数）
4. 双击聚合节点 → 展开内部节点，不关闭面板
5. 全部 fix 对 <20 节点的小项目无影响
