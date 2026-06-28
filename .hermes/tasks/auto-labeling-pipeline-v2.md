# 架构认知管线自动标注方案 v2

## 背景
当前 arch-scanner 的 3D 监视器对自身项目效果很好，但扫描其他项目存在三个短板。军师 v1 评审 7.4/10，核心意见已全部采纳。

---

## 短板A：模块检测依赖 `--` 命名规范（P0）

### 根因
viewer.html 的 `detectModule()` 通过 `nodeId.split('--')` 判断模块归属。其他项目无此规范，全部归为 "other"。

### 推荐方案：方案A（主） + 方案B（备选）

**方案A（推荐）：port-tag-tool 扫描时输出 module 字段** ⭐
- 改动位置：`packages/port-tag-tool/projectScanner.js`（扫描引擎）
- 做法：projectScanner 遍历文件系统时，根据目录层级自动推断模块归属
  - `packages/port-tag-tool/xxx.js` → module: `port-tag-tool`
  - `packages/3d-monitor/viewer.html` → module: `3d-monitor`
  - `src/App.tsx` → module: `src`
  - `node_modules/xxx` → module: `external`
  - 根目录文件 → module: `root`
- 输出：每个节点增加 `module` 字段
- 边界情况：
  - 扁平项目（所有文件在 `src/` 下）→ 按 layer 分层
  - monorepo（`packages/` 下有多个子包）→ 按二级目录分
  - 单文件项目 → 归为 `root`
- 优势：根源方案，一次修改所有消费者受益（3D监视器/CLI/JSON输出）

**方案B（备选）：viewer.html 增加目录前缀匹配**
- 如果方案A来不及，viewer.html 自己根据节点 id 的目录前缀匹配
- 但这是权宜方案，不根源解决

### 验收条件（P0 gate）
1. 随机选 3 个不同结构项目扫描：hermes-agent（深度嵌套）、arch-scanner（packages结构）、一个前端项目
2. 每个项目非 "other" 节点占比 ≥ 80%
3. 模块聚类在 3D 图中肉眼可识别（打开 viewer 看模块台面包围正确）

---

## 短板B：Agent 诊断数据（拆分两阶段）

### Phase 2a：启发式标注（P1）

**做法**：基于原始扫描数据的量化指标，自动判定 status/role，写入 `agentDiagnosis`。

判定规则（已有的判定标准，直接编码）：

| 维度 | 判定条件 | 输出 |
|------|----------|------|
| status: risk | 扇入+扇出 > 20，或有循环引用，或单节点承载跨3模块流转 | 🔴 |
| status: warning | 扇入或扇出 > 10 但 < 20，或跨2模块流转 | 🟡 |
| status: healthy | 以上都不满足 | 🟢 |
| role: hub | 扇入+扇出 > 15，或连接了 ≥3 个不同模块 | 金 |
| role: bridge | 连接2个模块且是唯一通信路径 | 紫 |
| role: leaf | 扇出 = 0 | 灰 |
| role: normal | 不满足以上 | 白 |

模块诊断：
| 模块状态 | 判定条件 |
|----------|----------|
| overloaded | 模块内节点数 > 10，或模块间连接数 > 20 |
| needs-split | 模块内节点数 > 6 且承担2种以上职责 |
| healthy | 以上都不满足 |

**输出格式**：直接追加到扫描结果 JSON 中：

```json
{
  "nodes": [...现有扫描节点, 每个增加 agentDiagnosis 字段],
  "modules": [...按模块分组后自动生成的诊断],
  "global": {
    "score": "根据各模块健康度加权计算",
    "issues": ["自动识别的共性问题"],
    "suggestions": ["基于判定规则的自动建议"]
  }
}
```

**数据交付路径**：
```
port-tag-tool 扫描 → 启发式标注模块（新增 scripts/auto_diagnose.js）
  → 输出 agent_diagnosis.json（与扫描结果合并）
  → 存到 packages/3d-monitor/ 目录
  → load-data.html 自动加载
```

**验收条件（Phase 2a gate）**：
1. 在 arch-scanner 和 hermes-agent 两个项目上跑通
2. 节点颜色编码正确率 ≥ 90%（与赵公明手动标注结果对比）
3. 处理耗时 < 5 秒（3349 节点）
4. 无诊断数据时 viewer 回退到层颜色渲染（向下兼容）

**限制（必须文档化）**：
- 仅输出基于连接数/节点数的量化诊断
- 不会生成有上下文的自然语言描述（如"建议拆分为scanner-core.js"这类需要代码理解的内容）
- 全局评分是加权计算，不是深刻架构洞察

### Phase 2b：LLM 理解式诊断（P2，暂不实施）

**能力**：
- 读代码上下文，生成有意义的诊断叙述
- 给出具体的架构优化建议（如"建议拆分"、"建议增加缓存"等）

**风险**（也是暂不实施的原因）：
1. LLM 幻觉 — 可能给出错误建议，污染可视化
2. 每次扫描需要 LLM 调用 — token 成本（hermes-agent 3349 节点可能一次都读不完）
3. 质量保障 — 谁复核 LLM 输出？缺乏机制
4. 延迟 — LLM 生成 >10 秒，影响用户体验

**前提条件**（什么时候可以开始做）：
- Phase 2a 稳定运行 ≥ 2 周
- 建立了 LLM 输出复核机制（人工或自动化）
- Token 预算明确

---

## 短板C：大数据量性能（P1）

### 具体方案

| 问题 | 方案 | 优先级 |
|------|------|--------|
| 5.5MB 超 localStorage 上限 | 改用 IndexedDB，支持 ≥ 50MB | P1 |
| 同步 XHR 超时 | 改用 fetch（异步，支持 ProgressEvent 显示加载进度） | P1 |
| 500+ 节点帧率下降 | 已有 LOD（距离远时不渲染诊断细节），验证是否生效 | P1 |
| 加载体验 | 增加进度条提示"正在加载 XXXX 个节点..." | P1 |

### 验收条件
1. 5.5MB 数据加载到显示 < 3 秒（Safari实测）
2. 3349 节点场景下帧率 > 20fps（翻滚时）
3. 加载时显示进度反馈
4. 不支持 IndexedDB 的浏览器自动 fallback 到 fetch + 内存

---

## 优先级和依赖关系

```
P0 [模块检测] → gate: 3项目 ≥ 80% 非other
  ↓
P1 [启发式标注]  → gate: 与手动标注对比 ≥ 90% 准确率
  ↓
P1 [性能优化]  → gate: 5.5MB < 3秒加载
  ↓
P2 [LLM诊断]  → 前提: Phase 2a 稳定 2周 + 有复核机制
```

P0 和 P1 之间无依赖（可并行）。
性能优化可在任何阶段做。

## 风险评估

| 风险 | 可能性 | 影响 | 缓解 |
|------|--------|------|------|
| 方案A（port-tag-tool 输出 module）改动量超出预期 | 中 | 阻塞 P0 | 先方案B快速验证，确保 MVP |
| 启发式判定规则不适应所有项目 | 中 | Phase 2a 准确率不达标 | 判定规则可配置，不同项目可调阈值 |
| 3349 节点性能优化后仍卡顿 | 低 | P1 不达标 | Three.js InstancedMesh 优化，或合并同模块节点 |
| IndexedDB 浏览器兼容性 | 低 | 部分用户体验降级 | 自动 fallback 到内存加载 |
