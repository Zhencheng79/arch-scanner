# v5: 聚合模式体验修复 — 4个P0问题

## 问题清单

### P0-1: 模块数据未找到
**现象**：debug overlay 显示 `模块数据: ❌ 未找到`，showModuleInfo 报"模块数据未找到"
**根因猜想**：`_moduleLayoutInfo[modId]` key 不匹配。buildModuleAggregation 构建时和 onClick 路由时用的 modId 可能不一致。
**修复**：在 showModuleInfo 中增加 key 模糊匹配（trim/大小写），或确认 key 一致性问题

### P0-2: groupNode 无 agentDiagnosis
**现象**：debug overlay 显示 `agentD: ❌`
**根因**：buildModuleAggregation 创建 groupNode 时，从 `_agentDiagnosisData.modules` 读取对应模块的诊断数据注入
**修复**：groupNode 创建时查 `_agentDiagnosisData.modules` 找到匹配的模块诊断并注入

### P0-3: 双击消失 + 无展开折叠
**现象**：双击聚合节点"消失"，再双击显示。没有展开内部节点的效果
**根因**：onDblClick 中双击 groupNode 时 toggleGroup 执行了，但同时 updateNodeInfoPanel(null) 关闭了面板。用户看到"消失"
**修复**：双击 groupNode 时不关闭面板，保持模块详情可见。toggleGroup 负责展开/折叠子节点

### P0-4: 帧数卡（拖拽时几帧）
**现象**：全景视角 30帧以下，拖拽时几帧
**根因**：边束分层渲染（bundleCount<5用LineSegments）性能提升不够。130节点+376边束 + CSS2D标签 仍有压力
**修复**：进一步削减渲染开销——合并LineSegments为一个Geometry、限制帧率无关动画更新频率

## 优先级
P0-1 + P0-2 + P0-3 同时修（都是viewer.html聚合节点信息展示问题）
P0-4 进一步性能优化
