# 架构认知管线 — 下一步执行方案 v1

## 当前状态

| 阶段 | 状态 | 军师评分 |
|------|------|---------|
| P0: 通用模块检测 | ✅ git已提交 | 9.6 |
| Phase 2a: 自动标注脚本 | ✅ 代码完成，军师批准合并 | 9.6 |
| └ auto_diagnose.js 整合到加载流程 | ❌ 未做 | - |
| P1: 性能优化（fetch异步） | ❌ 未做 | - |
| 更新Obsidian文档 | ❌ 未做 | - |

## 下一步做什么

选项：

### A: 整合 auto_diagnose.js 到加载流程
把自动标注嵌入 viewer 打开流程：
- load-data.html → 加载扫描JSON → 调用 auto_diagnose.js 逻辑 → 注入 agentDiagnosis → 打开 viewer
- 或者在 viewer.html 启动时自动检测并调用
- 好处：用户打开即用，不需要手动跑脚本
- 风险：增加首屏加载时间

### B: P1 性能优化
- 把同步 XHR 改为 fetch 异步加载
- 加上加载进度条
- 准备 IndexedDB 方案（暂不实施）
- 好处：解决 5.5MB 加载问题

### C: 合并 + 文档更新
- 把 P0 + Phase 2a 的改动 git commit 并推送
- 更新 Obsidian 版本现状文档
- 清理临时测试文件（load-hermes-agent.html、hermes-agent-scan.json）
- 好处：交付物落地

### D: 下一迭代（Phase 2b 准备）
- 评估 LLM 诊断接入的成本和收益
- 但按方案共识，Phase 2b 要等 Phase 2a 稳定2周后

## 建议
按 **C → A → B** 顺序：
1. 先合并提交+落盘文档（让主公看到交付物）
2. 再整合 auto_diagnose 到加载流程（体验完整）
3. 性能优化（规模出现问题时再做）
