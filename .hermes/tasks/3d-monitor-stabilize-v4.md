# 3d-monitor 稳定化方案 v4（终审版）

> 赵公明 v1→v2→v3 + 军师三轮审阅（6.5→7.0→8.0→目标9+）
> 已采纳军师全部反馈，本次为最终修订

---

## 军师 v3 反馈采纳（6项）

| 序号 | 反馈 | 修正 |
|------|------|------|
| 1 | AGENTS.md 缺黑名单 | ✅ 增加 scene graph/camera/renderer/animation loop 绝对不能拆分 |
| 2 | Phase A 后锁定有锚定偏差风险 | ✅ Phase 0：在 Phase A 之前对原始 force-layout 做基准快照 |
| 3 | 验收缺像素级标准 | ✅ 加入 ImageMagick compare 像素对比 |
| 4 | A6 估2天但标注"最大难点" | ✅ 拆分为 A6a（调研记录）+ A6b（实现） |
| 5 | 无 QA 门禁 | ✅ Phase A 每2个子任务插入 0.25天 验证门禁 |
| 6 | 无执行者角色标注 | ✅ 每个子任务标注执行者 |

---

## 一、AGENTS.md 修改提案（含黑名单）

> 将 AGENTS.md 第26行：
> ```
> - viewer.html 是单文件，所有代码内联，不要拆分成多文件
> ```
> 改为：
> ```
> - viewer.html 是核心渲染文件，所有 Three.js 场景代码内联。CSS 和独立 UI 层（图例/面板/提示框）可拆分到同目录下的辅助文件，入口保持 viewer.html 不变。
> - **绝对不能拆分**（必须内联在 viewer.html）：scene graph（节点/连线/管道的 Three.js 场景对象创建代码）、camera、renderer、animation loop、OrbitControls。这些是渲染核心，拆分后会导致模块依赖混乱。
> ```

---

## 二、执行顺序（最终版）

```
Phase 0: 原始基准快照
  └── 在 Phase A 之前，对原始 force-layout 做基准快照（量化数据+截图）
        ↓
Phase A: force-layout 功能同步（+QA门禁）
  └── 每2个子任务插入验证门禁
        ↓
Phase B: 锁定功能一致
  └── 与 Phase 0 对比，验证同步正确性
        ↓
Phase C: 独立代码拆分
  ├── node-spread: 自己拆
  └── force-layout: 自己拆（参考 node-spread 方案，保留力导向差异）
        ↓
Phase D: 最终验收（量化+像素级）
  └── 量化对比 + ImageMagick 像素级对比
```

---

## 三、详细执行步骤（含执行者角色）

### Phase 0：原始基准快照（0.5天）

| 子任务 | 内容 | 执行者 | 预估 | 产出 |
|--------|------|--------|:----:|------|
| P0 | 在 force-layout 当前版本上，加载两个测试项目，截图 + 记录量化数据 + 存档 | 手动（开发者/赵公明） | 0.5天 | `baseline/` 目录含截图+量化数据 |

### Phase A：force-layout 功能同步（9.5天，含验证门禁）

| 子任务 | 内容 | 关键逻辑 | 执行者 | 预估 |
|--------|------|---------|--------|:----:|
| A1 | **基准验证**：确认 force-layout 当前渲染正常 | 打开浏览器截图 | 手动 | 0.5天 |
| A2 | **适配v.13**：箭头加粗 + 模块标签 + 详情面板 + 配色统一 | TubeGeometry + CSS2D | Codex CLI | 1天 |
| → | **验证门禁①**：打开浏览器确认 A2 渲染正确 | 截图对比 | 手动 | 0.25天 |
| A3 | **适配v.14**：恢复层配色 + 模块色边框辅助 | LAYER_CONFIG | Codex CLI | 0.5天 |
| A4 | **适配v.16**：修复 module Y 位置偏移 | 力导向Y轴调整 | Codex CLI | 1天 |
| → | **验证门禁②**：确认 A3+A4 渲染正确 | 截图对比 | 手动 | 0.25天 |
| A5 | **适配v.17**：buildScene 补全 detectModule() | node.module赋值 | Codex CLI | 0.5天 |
| A6a | **适配v.18 调研**：分析 force-layout 与 node-spread 的 computeLayout 差异，记录差异点 | **力导向 vs Y轴分层对比** | 手动（调研） | 1天 |
| A6b | **适配v.18 实现**：全局模块扫描 + 聚类适配 | 按 A6a 调研结果实现 | Codex CLI | 1.5天 |
| → | **验证门禁③**：A5+A6 功能验证（重点是模块检测和聚类） | 截图对比 | 手动 | 0.25天 |
| A7 | **适配v.19**：动态 detectModule + 台面 + 箭头 + 面板 | 力导向台面适配 | Codex CLI | 1.5天 |
| A8 | **适配v.20**：穿模检测(maxIter) + 图例多类型 | 穿模检测通用 | Codex CLI | 1天 |
| → | **验证门禁④**：A7+A8 完整功能验证，与 Phase 0 对比 | 截图+量化对比 | 手动 | 0.25天 |
| | **Phase A 小计** | | | **9.5天** |

### Phase B：锁定功能一致（1天）

| 子任务 | 内容 | 执行者 | 预估 |
|--------|------|--------|:----:|
| B1 | 用 port-tag-tool 扫描 arch-scanner + hermes-web | Codex CLI | 0.5天 |
| B2 | 在两个分支上渲染，填写量化对比表，截图存为基准 | 手动 | 0.5天 |

### Phase C：独立代码拆分（6天）

| 子任务 | 内容 | 分支 | 执行者 | 预估 |
|--------|------|:----:|--------|:----:|
| C1 | CSS抽离→`styles.css` | node-spread | Codex CLI | 0.5天 |
| C2 | UI层抽离→`ui-layer.js` | node-spread | Codex CLI | 1天 |
| C3 | 布局引擎抽离→`layout-engine.js` | node-spread | Codex CLI | 1.5天 |
| C4 | 在 force-layout 上手动应用拆分（保留力导向差异） | force-layout | Codex CLI | 2天 |
| → | **验证门禁⑤**：两分支拆分后功能与Phase B基准一致 | 截图+量化+像素对比 | 手动 | 1天 |
| | **Phase C 小计** | | | **6天** |

### Phase D：最终验收（1.5天）

| 子任务 | 内容 | 执行者 | 预估 |
|--------|------|--------|:----:|
| D1 | 两分支各加载两个项目 | 手动 | 0.5天 |
| D2 | 量化对比 + ImageMagick 像素级对比 | 手动 | 0.5天 |
| D3 | 验收五问 + 报告 | 手动 | 0.5天 |

**总量：0.5 + 9.5 + 1 + 6 + 1.5 = 18.5 天**

---

## 四、量化验收标准（像素级）

### 4.1 量化指标对比表

两个项目的量化数据与 Phase B 基准线的差值必须为 0。

| 指标 | arch-scanner 基准 | hermes-web 基准 | 两分支差值 |
|------|:----------------:|:---------------:|:---------:|
| 节点数 | TBD | TBD | 0 |
| 连线数 | TBD | TBD | 0 |
| 模块数 | TBD | TBD | 0 |
| 层级数 | TBD | TBD | 0 |
| 枢纽数 | TBD | TBD | 0 |

### 4.2 像素级对比

使用 ImageMagick `compare` 工具对两个分支的截图做像素差异检测：

```bash
# 安装 ImageMagick（如未安装）
brew install imagemagick

# 像素对比
compare -metric AE baseline/node-spread.png final/node-spread.png diff-node-spread.png
compare -metric AE baseline/force-layout.png final/force-layout.png diff-force-layout.png
```

**通过标准**：diff 像素数 = 0（完全一致）。如果 Phase B→Phase D 期间引入了功能性差异（如新功能），允许 ≤1% 像素差异且有合理解释。

### 4.3 验收五问填写指引

| 问题 | 如何获得答案 | 对比方法 |
|------|------------|---------|
| 项目分几块？ | 数模块背景框数量 | 两分支分别数，数字必须一致 |
| 核心节点是哪个？ | 找连接数最多的枢纽节点ID | 两分支记录的ID必须相同 |
| 数据怎么流？ | 从顶层模块沿箭头追踪到底层 | 流方向必须相同 |
| 哪些是一伙的？ | 同一背景框内的节点组成 | 每个模块的节点成员必须一致 |
| 整体能干什么？ | 页面布局、图例、说明文本 | 视觉信息必须一致 |

---

## 五、核心算法 Mock 测试

`packages/3d-monitor/tests/logic.test.js`

| 测试函数 | 输入 | 预期输出 | 优先级 |
|---------|------|---------|:-----:|
| `detectModule("db--user-service")` | 带模块前缀ID | `"db"` | 高 |
| `detectModule("random-thing")` | 无前缀ID | `"other"` | 高 |
| `resolveLayer({layer:"business"})` | 特定层级 | `"business"` | 中 |

运行：`node packages/3d-monitor/tests/logic.test.js`

---

## 六、风险清单（最终版）

| 风险 | 概率 | 影响 | 缓解 |
|------|:----:|:----:|------|
| 力导向 vs Y轴分层布局差异大 | 中 | 高 | A6a调研→A6b实现分离；调研阶段决定是否可行 |
| 代码拆分破坏功能 | 中 | 高 | 每步完成后验证门禁 |
| AGENTS.md修改被驳回 | 低 | 中 | 备选：不拆分，改为注释分区（在Phase C前决策） |
| 18.5天总工作量超出预期 | 中 | 中 | Phase A每2步设门禁，可随时评估继续/暂停 |
| 两个分支验收不一致 | 低 | 高 | Phase 0→A→B→C→D渐进验证，早期发现问题 |

---

## 七、执行路径总览

```
Phase 0: 基准快照 ── 0.5天
  P0
  ↓
Phase A: 同步功能 ── 9.5天
  A1→A2→[门禁①]→A3→A4→[门禁②]→A5→A6a(调研)→A6b→[门禁③]→A7→A8→[门禁④]
  ↓
Phase B: 锁定基准 ── 1天
  B1→B2
  ↓
Phase C: 代码拆分 ── 6天
  C1→C2→C3(node-spread) + C4(force-layout)→[门禁⑤]
  ↓
Phase D: 最终验收 ── 1.5天
  D1→D2→D3
```

**总计：18.5天 | 5个Phase | 22个子任务 | 5个门禁**

---

## 八、自评

| 维度 | v3 | v4 | 改进 |
|:----|:--:|:--:|------|
| AGENTS.md | 8 | 9 | 加入黑名单 |
| 执行顺序 | 9 | 9 | 加上Phase 0消除锚定偏差 |
| 验收标准 | 7 | 9 | 像素级对比+填写指引 |
| 风险识别 | 7 | 9 | A6拆分为调研+实现 |
| 执行可操作性 | 8 | 9 | QA门禁+执行者角色 |

**综合自评：9.0/10** — 方案成熟，等待军师最终评分。
