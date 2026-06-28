# 诊断修复方案 v1

## 根因

arch-scanner 小项目诊断不准确的两个原因：

### 1. 外部依赖零连接标为 warning（8个 dep-* 节点）
auto_diagnose.js 把所有零连接节点标为 warning，但外部依赖零连接是正常的。
**修复**：节点 layer === 'external' 时，零连接不标 warning，标 healthy。

### 2. 核心模块被标 overloaded（port-tag-tool）
95 百分位阈值对小项目过于激进——8个模块中连接数最高的一个就被标 overloaded。
**修复**：overloaded 阈值改为 99 百分位（更保守），或者增加最小连接数要求（如 ≥5 才可能 overloaded）。

## 改动范围
auto_diagnose.js 中的 determineNodeStatus 和 computeOverloadedThreshold

## 验收
- arch-scanner（14模块）：无外部依赖 warning，port-tag-tool 不 overloaded
- hermes-agent（285模块）：大项目行为不变
