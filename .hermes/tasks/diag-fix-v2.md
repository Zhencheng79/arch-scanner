# 诊断修复方案 v2

## Fix 1：外部依赖零连接不标 warning
**方法**：按节点ID前缀判断而非layer判断。dep-开头的节点零连接直接标healthy。
**代码位置**：determineNodeStatus 中 warning 判定前先检查 dep- 前缀

## Fix 2：overloaded 阈值改为连接数 > 0 的节点数的 99% 
（军师指正：95百分位在14个节点时取第13位，改为99%取第14位=最大值，实际只对≥100节点有效。对大项目hermes-agent 3349节点仍有效）

## 验收
arch-scanner：无外部dep warning，port-tag-tool 不 overloaded
hermes-agent：行为不变
