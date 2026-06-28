# 架构认知管线 — 下一步执行方案 v2

## 当前状态

| 阶段 | 状态 | 军师评分 |
|------|------|---------|
| P0: 通用模块检测 | ✅ git已提交 (521f427) | 9.6 |
| Phase 2a: auto_diagnose.js | ✅ 代码完成，未提交 | 9.6 |
| 其他未提交改动（AGENTS.md/package.json） | modified，待提交 | - |
| 临时测试文件 | 待清理 | - |
| Obsidian文档 | 待更新 | - |

---

## 方向C：合并 + 文档更新（先做）

**工作量**：约10分钟

| 事项 | 操作 | 估算 |
|------|------|:----:|
| auto_diagnose.js | git add + commit | 1分钟 |
| AGENTS.md + package.json 修改 | git add + commit（或并入上一条） | 1分钟 |
| 清理临时文件 | 删除 load-hermes-agent.html、hermes-agent-scan.json（输出目录那份保留） | 1分钟 |
| 更新 Obsidian 索引和版本现状 | 标记 Phase 2a 完成 | 5分钟 |
| 更新 .gitignore | 添加 output/ 和临时测试数据 | 2分钟 |

**验收条件**：git log 看到新 commit，Obsidian 文档已更新。

---

## 方向A：整合 auto_diagnose 到加载流程（第二做）

**工作量**：约30分钟

### 核心问题
auto_diagnose.js 是 Node.js CLI（`process.stdin/exit`），不能在浏览器直接运行。

### 推荐方案：build step（预处理）

把 auto_diagnose 作为数据预处理步骤，不侵入浏览器：

```
扫描原始JSON → node scripts/auto_diagnose.js → 含诊断的JSON → load-data.html 加载 → viewer.html 渲染
```

具体改动：
1. `load-data.html`：改为先尝试加载 `port_tag_result_with_diagnosis.json`（已含诊断），如果没有则加载原始扫描数据但不标注
2. 或者在 `package.json` 加一个 npm script：`"diagnose": "node scripts/auto_diagnose.js < port_tag_result.json > port_tag_result_with_diagnosis.json"`
3. viewer.html 不变（已能消费 agentDiagnosis 字段）

**备选：in-browser port**（暂不选）
- 提取 auto_diagnose.js 核心算法到 browser JS
- 优点是用户不需要手动跑脚本
- 缺点是增加 viewer.html 体积和首屏加载时间
- 作为后续优化项

### 验收条件
1. 运行 `node scripts/auto_diagnose.js < port_tag_result.json > result.json` 后，打开 viewer 能看到颜色编码
2. viewer.html 无修改（向下兼容）
3. 没有诊断数据的原始扫描文件 viewer 仍能正常渲染（绿色 fallback）

---

## 方向B：性能优化（最后做）

**工作量**：约20分钟

| 改动 | 说明 | 估算 |
|------|------|:----:|
| 同步XHR → fetch异步 | 替换 load-data.html 中的同步XHR | 10分钟 |
| 加载进度条 | 大JSON时显示"正在加载XX节点" | 5分钟 |
| IndexedDB | 暂不实施 | - |

**验收条件**：5.5MB 数据加载 < 3 秒（Safari实测），加载时有进度提示。

---

## 优先级和估算总览

| 方向 | 估算 | 做完的标志 |
|------|:----:|-----------|
| **C** 合并+文档 | ~10分钟 | git push + Obsidian 更新 |
| **A** 整合加载 | ~30分钟 | node scripts/auto_diagnose.js < json > result.json → viewer 显示颜色 |
| **B** 性能优化 | ~20分钟 | fetch + 进度条，5.5MB < 3 秒 |

建议一次做完 C + A（约40分钟），B 等规模出现问题时再做。如果 1-2 天内出现性能投诉，B 提升优先级。
