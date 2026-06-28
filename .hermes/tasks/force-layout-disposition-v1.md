# Force-Layout 分支处置方案 v1

## 背景

arch-scanner 有两个并行分支：
- `feature/node-spread`（活跃，v0.1.40-node-spread.22）
- `feature/force-layout`（落后7版本，v0.1.40-force.15）

主公指示：如果 force-layout 无独特价值则回收（方案B），有独特价值则真正实现力导向排布（方案C）。

## 分析

| 维度 | force-layout | node-spread |
|------|-------------|-------------|
| 布局算法 | Y轴分层+水平网格 | Y轴分层+fan spread（相同架构） |
| 模块检测 | 硬编码前缀匹配（9个固定模块） | 动态 `--` 分割（任意数量） |
| 图例风格 | 模块配色（提取/存储/解析...） | 分层配色（external/presentation/...） |
| Agent诊断面板 | ❌ 无 | ✅ 有 |
| 图例折叠 | ❌ 无 | ✅ 有 |
| 跨模块粗管道 | ❌ 无 | ✅ 有 |
| 左右详情面板 | ❌ 无 | ✅ 有 |
| 颜色编码（status/role） | ❌ 无 | ✅ 有 |
| 版本 | v0.1.40-force.15 | v0.1.40-node-spread.22 |

**核心发现**：force-layout 的 computeLayout() 布局算法与 node-spread 属于**同一架构**——都是 Y 轴分层排列，不是真正的力导向物理仿真。"力导向"仅是早期设计命名，从未实现过。

## 方案B：回收 force-layout（推荐）

### 步骤
1. 将 force-layout 分支存档到 tag（如 `archive/force-layout-v0.1.40-force.15`），保留历史
2. 删除远程和本地的 feature/force-layout 分支
3. 在 AGENTS.md 中记录分支去向
4. 更新版本现状文档（arch-scanner 改为单一分支）

### 优点
- 减少维护负担（不用同步两个分支）
- 消除"两个版本答案不一致"的验收风险
- 精简代码库

### 风险
- 彻底失去力导向可能性——不过历史上也从未真正实现过

## 方案C：真正实现力导向排布（有价值但成本高）

### 改动范围
在 viewer.html 中新增第二套布局算法：
1. 实现 d3-force 风格的物理仿真（节点排斥、连接吸引、中心引力）
2. 增加布局切换开关（Y轴分层 / 力导向）
3. 适配所有已有功能（模块台面、粗管道、详情面板、Agent诊断等）

### 评估
- 复杂度：**高**（5659行单文件已接近极限，再加一套布局算法进一步膨胀）
- 视觉价值：**中**（力导向对大型项目自动排布有用，但对语义化的Y轴分层没有优势）
- 维护成本：**高**（两套布局算法兼容性测试）
- 当前 viewer.html 已 5659行，再加力导向会加剧技术债务

## 建议

**推荐方案B（回收）**。理由：
1. force-layout 当前没有任何 node-spread 没有的独特功能（仅图例风格不同，这是配置差异不是功能差异）
2. "力导向"从未实现过，只是历史命名
3. 两个分支并行增加了维护成本和验收风险
4. 如果未来真正需要力导向，应该重构 viewer.html 架构后再加，而不是在单文件里堆功能

## 后续问题处理清单

回收后一并处理：
1. ✅ MCP路径修复：`/hermes-3d-panorama/` → `/arch-scanner/`
2. ✅ 根 package.json 版本同步（0.1.17 → 0.1.40）
3. ✅ 清理 agent_diagnosis.json 中过时的"旧版React Three Fiber"记录
4. ✅ 提交未追踪文件（agent_diagnosis.json、load-data.html）
5. ⏸️ force-layout 图例配色风格：可以考虑在 node-spread 中作为一个主题选项保留
